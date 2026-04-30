// --- CONFIGURATION SECTION ---
const SYNC_CONFIG = {
  mongoParticipantsView: 'HOPV26 - Participants', // For participants
  mongoPaymentsView: 'HOPV26 - Payments', // For payment info
  mongoProgramView: 'HOPV26 - Program', // For program info
  targetConferenceAcronym: 'HOPV26',
  targetConferenceName: 'HOPV 2026',
};
// -----------------------------

const { MongoClient } = require('mongodb');
const mysql = require('mysql2/promise');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const mariadbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD ? process.env.DB_PASSWORD.replace(/\\(\$)/g, '$1') : process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
};

async function syncParticipants() {
  const { targetConferenceAcronym, targetConferenceName, mongoParticipantsView, mongoPaymentsView, mongoProgramView } = SYNC_CONFIG;
  const mongoDbName = process.env.MONGO_DB_NAME || 'nanoge-production';
  
  console.log(`🚀 Starting Multi-Sync for conference: ${targetConferenceAcronym}...`);

  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) {
    console.error('❌ Error: MONGO_URI is missing from .env.local');
    process.exit(1);
  }

  const mongoClient = new MongoClient(MONGO_URI);
  let mariadb;

  try {
    await mongoClient.connect();
    mariadb = await mysql.createConnection(mariadbConfig);
    console.log('📡 Databases connected');

    // 0. Ensure Payments Table exists
    await mariadb.execute(`
      CREATE TABLE IF NOT EXISTS payments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        registration_id INT NOT NULL,
        amount DECIMAL(10,2),
        currency VARCHAR(10) DEFAULT 'EUR',
        status VARCHAR(50),
        payment_method VARCHAR(50),
        mongo_id VARCHAR(100) UNIQUE,
        invoice_code VARCHAR(100),
        client_name VARCHAR(255),
        client_country_id VARCHAR(100),
        group_name VARCHAR(100),
        tickets_info JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_registration FOREIGN KEY (registration_id) REFERENCES registrations(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 1. Ensure Conference exists
    let [confRows] = await mariadb.execute('SELECT id FROM conferences WHERE acronym = ?', [targetConferenceAcronym]);
    let conferenceId;

    if (confRows.length === 0) {
      console.log(`➕ Creating conference: ${targetConferenceAcronym}`);
      const [res] = await mariadb.execute('INSERT INTO conferences (acronym, name) VALUES (?, ?)', [targetConferenceAcronym, targetConferenceName]);
      conferenceId = res.insertId;
    } else {
      conferenceId = confRows[0].id;
    }

    // 1.1 Ensure participants table has firstName/lastName columns
    try {
        await mariadb.execute('ALTER TABLE participants ADD COLUMN firstName VARCHAR(255) AFTER id');
        await mariadb.execute('ALTER TABLE participants ADD COLUMN lastName VARCHAR(255) AFTER firstName');
    } catch (err) { /* ignore duplicate */ }
    
    // 1.2 Remove the old redundant name column
    try {
        await mariadb.execute('ALTER TABLE participants DROP COLUMN name');
        console.log('🗑️  Removed redundant name column from participants');
    } catch (err) { /* ignore */ }

    // 1.3 Prepare registrations table for multi-conference voting
    try {
        const cols = ['cluster_for_review', 'has_voted', 'votes'];
        for (const col of cols) {
            try {
                const type = col === 'has_voted' ? 'TINYINT(1) DEFAULT 0' : 'TEXT';
                await mariadb.execute(`ALTER TABLE registrations ADD COLUMN ${col} ${type}`);
            } catch (e) { /* ignore duplicate column */ }
        }
        console.log('✅ Prepared registrations table for multi-conference voting');
    } catch (err) { }

    // 1.4 Ensure payments table has the new columns if it already existed
    try {
        const paymentCols = [
            { name: 'invoice_code', type: 'VARCHAR(100)' },
            { name: 'client_name', type: 'VARCHAR(255)' },
            { name: 'client_country_id', type: 'VARCHAR(100)' },
            { name: 'group_name', type: 'VARCHAR(100)' },
            { name: 'tickets_info', type: 'JSON' }
        ];
        for (const col of paymentCols) {
            try {
                await mariadb.execute(`ALTER TABLE payments ADD COLUMN ${col.name} ${col.type} AFTER mongo_id`);
            } catch (e) { /* ignore duplicate column */ }
        }
        console.log('✅ Updated payments table schema');
    } catch (err) { }

    const mongoDb = mongoClient.db(mongoDbName);

    // 2. SYNC PARTICIPANTS
    const partFilter = mongoParticipantsView.includes(targetConferenceAcronym) ? {} : { conference: targetConferenceAcronym };
    const records = await mongoDb.collection(mongoParticipantsView).find(partFilter).toArray();
    let participantCount = 0;
    let registrationCount = 0;

    for (const record of records) {
      const email = record.user?.email || record.user_email || record.email;
      
      // Handle the new separate fields or fallback to concatenated name
      let firstName = record.user_firstName || record.user?.firstName || '';
      let lastName = record.user_lastName || record.user?.lastName || '';
      const fullName = record.user_name || record.name || '';
      
      if (!firstName && !lastName && fullName) {
        const parts = fullName.split(' ');
        firstName = parts[0];
        lastName = parts.slice(1).join(' ');
      }

      if (!email) continue;

      let [pRows] = await mariadb.execute('SELECT id FROM participants WHERE email = ?', [email]);
      let participantId;

      if (pRows.length === 0) {
        const [res] = await mariadb.execute(
          'INSERT INTO participants (firstName, lastName, email, registration_type) VALUES (?, ?, ?, ?)', 
          [firstName, lastName, email, record.registration_type || 'Standard']
        );
        participantId = res.insertId;
        participantCount++;
      } else {
        participantId = pRows[0].id;
        await mariadb.execute(
          'UPDATE participants SET firstName = ?, lastName = ?, registration_type = ? WHERE id = ?', 
          [firstName, lastName, record.registration_type || 'Standard', participantId]
        );
      }

      // Ensure Registration link exists
      try {
        const [regExists] = await mariadb.execute('SELECT id FROM registrations WHERE participant_id = ? AND conference_id = ?', [participantId, conferenceId]);
        
        if (regExists.length === 0) {
          const checkInToken = crypto.randomBytes(16).toString('hex');
          await mariadb.execute(
            'INSERT INTO registrations (participant_id, conference_id, status, check_in_token) VALUES (?, ?, ?, ?)', 
            [participantId, conferenceId, 'Registered', checkInToken]
          );
          registrationCount++;
        }
      } catch (err) { console.error('Registration link error:', err.message); }
    }

    // 3. SYNC PAYMENTS
    console.log(`📥 Fetching payments from [${mongoPaymentsView}]...`);
    const payFilter = mongoPaymentsView.includes(targetConferenceAcronym) ? {} : { 
      $or: [
        { conference: targetConferenceAcronym },
        { code: { $regex: `^${targetConferenceAcronym}` } }
      ]
    };
    const mongoPayments = await mongoDb.collection(mongoPaymentsView).find(payFilter).toArray();
    console.log(`💰 Found ${mongoPayments.length} payments in MongoDB`);

    let payCount = 0;
    for (const pay of mongoPayments) {
      // Mapping based on your provided structure (user.email or user_info.email)
      const email = pay.user?.email || (pay.user_info ? pay.user_info.email : (pay.email || pay.userEmail));
      if (!email) continue;

      const [regRows] = await mariadb.execute(`
        SELECT r.id 
        FROM registrations r
        JOIN participants p ON r.participant_id = p.id
        WHERE p.email = ? AND r.conference_id = ?
      `, [email, conferenceId]);

      if (regRows.length > 0) {
        const registrationId = regRows[0].id;
        const mongoId = pay._id.toString();
        
        try {
          const invoiceCode = pay.code || null;
          const clientName = pay.client?.name || null;
          const clientCountryId = pay.client?.country?.$oid || null;
          const groupName = pay.group?.name || null;
          const ticketsInfo = pay.tickets ? JSON.stringify(pay.tickets) : null;

          await mariadb.execute(`
            INSERT INTO payments (
              registration_id, amount, currency, status, payment_method, mongo_id,
              invoice_code, client_name, client_country_id, group_name, tickets_info
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              amount = VALUES(amount),
              status = VALUES(status),
              invoice_code = VALUES(invoice_code),
              client_name = VALUES(client_name),
              client_country_id = VALUES(client_country_id),
              group_name = VALUES(group_name),
              tickets_info = VALUES(tickets_info)
          `, [
            registrationId,
            pay.total || 0,
            pay.currency || 'EUR',
            pay.status || 'Paid',
            pay.method || 'Unknown',
            mongoId,
            invoiceCode,
            clientName,
            clientCountryId,
            groupName,
            ticketsInfo
          ]);
          payCount++;
        } catch (err) {
          console.error(`⚠️ Payment sync error for ${email}:`, err.message);
        }
      }
    }

    // 4. SYNC PROGRAM
    console.log(`📥 Fetching program from [${mongoProgramView}]...`);
    // Filter by conference if not already implicit in the view name
    const progFilter = mongoProgramView.includes(targetConferenceAcronym) ? {} : { conference: targetConferenceAcronym };
    const programRecords = await mongoDb.collection(mongoProgramView).find(progFilter).toArray();
    console.log(`📅 Found ${programRecords.length} sessions in MongoDB`);

    let sessionCount = 0;
    let slotCount = 0;

    for (const session of programRecords) {
        const mongoId = session._id.toString();
        
        // Insert or Update Session
        const [res] = await mariadb.execute(`
            INSERT INTO program_sessions (conference_id, session_name, full_session_name, start_time, end_time, mongo_id)
            VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                session_name = VALUES(session_name),
                full_session_name = VALUES(full_session_name),
                start_time = VALUES(start_time),
                end_time = VALUES(end_time)
        `, [
            conferenceId,
            session.session_name,
            session.full_session_name,
            session.start_time ? new Date(session.start_time) : null,
            session.end_time ? new Date(session.end_time) : null,
            mongoId
        ]);

        let sessionId;
        if (res.insertId) {
            sessionId = res.insertId;
        } else {
            const [rows] = await mariadb.execute('SELECT id FROM program_sessions WHERE mongo_id = ?', [mongoId]);
            sessionId = rows[0].id;
        }
        sessionCount++;

        // Sync Slots for this session
        // Clear existing slots first to ensure we have a fresh list (since slots don't have stable mongo IDs usually)
        await mariadb.execute('DELETE FROM program_slots WHERE session_id = ?', [sessionId]);

        if (session.full_slots && Array.isArray(session.full_slots)) {
            for (const slot of session.full_slots) {
                await mariadb.execute(`
                    INSERT INTO program_slots (session_id, type, title, presenter_name, start_time, end_time)
                    VALUES (?, ?, ?, ?, ?, ?)
                `, [
                    sessionId,
                    slot.type || 'oral',
                    slot.title || null,
                    slot.presenter_name || null,
                    slot.start_time ? new Date(slot.start_time) : null,
                    slot.end_time ? new Date(slot.end_time) : null
                ]);
                slotCount++;
            }
        }
    }

    console.log(`
✨ Sync Summary for ${targetConferenceAcronym}:
----------------------------------
👤 New Participants Added: ${participantCount}
🔗 New Registrations Linked: ${registrationCount}
💰 New Payments Logged: ${payCount}
📅 Program Sessions Synced: ${sessionCount}
🔢 Presentation Slots Synced: ${slotCount}
----------------------------------
✅ Process Finished!
    `);

  } catch (error) {
    console.error('❌ Sync Failed:', error);
  } finally {
    if (mongoClient) await mongoClient.close();
    if (mariadb) await mariadb.end();
  }
}

syncParticipants();
