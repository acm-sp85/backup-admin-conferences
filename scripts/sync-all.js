const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// --- CONFIGURATION SECTION ---
const ACRONYM = process.env.CONFERENCE_ACRONYM || 'HOPV26';
const SYNC_CONFIG = {
  mongoParticipantsView: `${ACRONYM} - Participants`, 
  mongoPaymentsView: `${ACRONYM} - Payments`, 
  mongoProgramView: `${ACRONYM} - Program`, 
  mongoPostersView: `${ACRONYM} - Posters`,
  targetConferenceAcronym: ACRONYM,
  targetConferenceName: process.env.CONFERENCE_NAME || 'HOPV 2026',
};
// -----------------------------

const { MongoClient } = require('mongodb');
const mysql = require('mysql2/promise');
const crypto = require('crypto');

// Summary state
const summary = {
  participants: 0,
  registrations: 0,
  payments: 0,
  sessions: 0,
  slots: 0,
  posters: { new: 0, updated: 0 },
  errors: []
};

async function syncAll() {
  const { targetConferenceAcronym, targetConferenceName } = SYNC_CONFIG;
  const mongoDbName = process.env.MONGO_DB_NAME || 'nanoge-production';
  const MONGO_URI = process.env.MONGO_URI;

  if (!MONGO_URI) {
    console.error('❌ Error: MONGO_URI is missing from .env.local');
    process.exit(1);
  }

  console.log(`🚀 Starting Master Sync for conference: ${targetConferenceAcronym}...`);

  const mongoClient = new MongoClient(MONGO_URI);
  let mariadb;

  try {
    await mongoClient.connect();
    mariadb = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD ? process.env.DB_PASSWORD.replace(/\\(\$)/g, '$1') : process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });
    console.log('📡 Databases connected');

    const mongoDb = mongoClient.db(mongoDbName);

    // 0. Ensure Graveyard table exists
    await mariadb.execute(`
      CREATE TABLE IF NOT EXISTS sync_graveyard (
        id INT AUTO_INCREMENT PRIMARY KEY,
        entity_type VARCHAR(50) NOT NULL,
        original_id INT,
        mongo_id VARCHAR(100),
        conference_id INT,
        data JSON NOT NULL,
        deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 0.1 Ensure Social Dinner Tickets table exists
    await mariadb.execute(`
      CREATE TABLE IF NOT EXISTS social_dinner_tickets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        registration_id INT NOT NULL,
        payment_id INT NOT NULL,
        ticket_index INT NOT NULL,
        token VARCHAR(100) UNIQUE NOT NULL,
        email_sent_at TIMESTAMP NULL,
        scanned_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_ticket_registration FOREIGN KEY (registration_id) REFERENCES registrations(id) ON DELETE CASCADE,
        CONSTRAINT fk_ticket_payment FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 0.2 Ensure participant_qr_tokens table exists
    await mariadb.execute(`
      CREATE TABLE IF NOT EXISTS participant_qr_tokens (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        registration_id INT NOT NULL,
        token VARCHAR(48) NOT NULL UNIQUE,
        email_sent_at DATETIME NULL,
        scanned_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX (registration_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 0.3 Ensure program_sessions has is_hidden column
    try {
      await mariadb.execute('ALTER TABLE program_sessions ADD COLUMN is_hidden TINYINT(1) DEFAULT 0');
      console.log('✅ Added is_hidden column to program_sessions');
    } catch (e) { /* ignore duplicate */ }

    // 1. Ensure Conference exists
    let conferenceId = await ensureConference(mariadb, targetConferenceAcronym, targetConferenceName);

    // 2. Pre-fetch existing data for optimization
    console.log('📡 Pre-fetching existing data...');
    const [existingParticipants] = await mariadb.execute('SELECT id, email FROM participants');
    const participantMap = new Map(existingParticipants.map(p => [p.email.toLowerCase(), p.id]));

    const [existingRegs] = await mariadb.execute('SELECT id, participant_id FROM registrations WHERE conference_id = ?', [conferenceId]);
    const registrationMap = new Map(existingRegs.map(r => [r.participant_id, r.id]));

    // --- TRACKING FOR MIRROR SYNC ---
    const seenRegistrationIds = new Set();
    const seenPaymentMongoIds = new Set();
    const seenPosterMongoIds = new Set();
    const seenSessionMongoIds = new Set();
    const seenTicketIds = new Set();
    // --------------------------------

    // --- EXECUTE SYNC MODULES ---
    
    // Module: Participants & Registrations
    await runSyncModule('Participants', async () => {
      const records = await mongoDb.collection(SYNC_CONFIG.mongoParticipantsView).find({}).toArray();
      console.log(`👤 Processing ${records.length} participants...`);
      for (const record of records) {
        const email = (record.user?.email || record.user_email || record.email || '').toLowerCase();
        if (!email) continue;

        let firstName = record.user_firstName || record.user?.firstName || '';
        let lastName = record.user_lastName || record.user?.lastName || '';
        const fullName = record.user_name || record.name || '';
        if (!firstName && !lastName && fullName) {
          const parts = fullName.split(' ');
          firstName = parts[0];
          lastName = parts.slice(1).join(' ');
        }

        let participantId = participantMap.get(email);
        if (!participantId) {
          const [res] = await mariadb.execute(
            'INSERT INTO participants (firstName, lastName, email, registration_type) VALUES (?, ?, ?, ?)', 
            [firstName, lastName, email, record.registration_type || 'Standard']
          );
          participantId = res.insertId;
          participantMap.set(email, participantId);
          summary.participants++;
        } else {
          await mariadb.execute(
            'UPDATE participants SET firstName = ?, lastName = ?, registration_type = ? WHERE id = ?', 
            [firstName, lastName, record.registration_type || 'Standard', participantId]
          );
        }

        if (!registrationMap.has(participantId)) {
          const [regRes] = await mariadb.execute(
            'INSERT INTO registrations (participant_id, conference_id, status) VALUES (?, ?, ?)', 
            [participantId, conferenceId, 'Registered']
          );
          registrationMap.set(participantId, regRes.insertId);
          summary.registrations++;
        }
        
        const regId = registrationMap.get(participantId);
        if (regId) {
          seenRegistrationIds.add(regId);
          
          // --- Generate Participant QR Token if missing ---
          const [existingQR] = await mariadb.execute(
            'SELECT id FROM participant_qr_tokens WHERE registration_id = ?',
            [regId]
          );
          if (existingQR.length === 0) {
            const token = crypto.randomBytes(24).toString('hex');
            await mariadb.execute(
              'INSERT INTO participant_qr_tokens (registration_id, token) VALUES (?, ?)',
              [regId, token]
            );
          }
        }
      }
    });

    // Module: Payments
    await runSyncModule('Payments', async () => {
      const payFilter = SYNC_CONFIG.mongoPaymentsView.includes(targetConferenceAcronym) ? {} : { 
        $or: [
          { conference: targetConferenceAcronym },
          { code: { $regex: `^${targetConferenceAcronym}` } }
        ]
      };
      const mongoPayments = await mongoDb.collection(SYNC_CONFIG.mongoPaymentsView).find(payFilter).toArray();
      console.log(`💰 Processing ${mongoPayments.length} payments...`);
      for (const pay of mongoPayments) {
        const email = (pay.user?.email || (pay.user_info ? pay.user_info.email : (pay.email || pay.userEmail)) || '').toLowerCase();
        if (!email) continue;

        const participantId = participantMap.get(email);
        const registrationId = participantId ? registrationMap.get(participantId) : null;

        if (registrationId) {
          const mongoId = pay._id.toString();
          seenPaymentMongoIds.add(mongoId);
          const [res] = await mariadb.execute(`
            INSERT INTO payments (
              registration_id, amount, balance, currency, status, payment_method, mongo_id,
              invoice_code, client_name, client_country_id, group_name, tickets_info
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              amount = VALUES(amount), balance = VALUES(balance), status = VALUES(status), invoice_code = VALUES(invoice_code),
              client_name = VALUES(client_name), client_country_id = VALUES(client_country_id),
              group_name = VALUES(group_name), tickets_info = VALUES(tickets_info)
          `, [
            registrationId, pay.total || 0, pay.balance !== undefined ? pay.balance : null, pay.currency || 'EUR', pay.status || 'Paid',
            pay.method || 'Unknown', mongoId, pay.code || null, pay.client?.name || null,
            pay.client?.country?.$oid || null, pay.group?.name || null, 
            pay.tickets ? JSON.stringify(pay.tickets) : null
          ]);
          summary.payments++;

          // --- NEW: Generate Social Dinner Tokens automatically ---
          const paymentId = res.insertId || (await mariadb.execute('SELECT id FROM payments WHERE mongo_id = ?', [mongoId]))[0][0].id;
          let tickets = [];
          try {
            tickets = typeof pay.tickets === 'string' ? JSON.parse(pay.tickets) : pay.tickets;
          } catch (e) {}

          if (Array.isArray(tickets)) {
            for (let i = 0; i < tickets.length; i++) {
              const ticket = tickets[i];
              const tName = ticket.name || (ticket.ticket_data && ticket.ticket_data.name);
              if (tName === 'Social Dinner') {
                const [existing] = await mariadb.execute(
                  'SELECT id FROM social_dinner_tickets WHERE payment_id = ? AND ticket_index = ?',
                  [paymentId, i]
                );
                if (!existing.length) {
                  const token = crypto.randomBytes(24).toString('hex');
                  await mariadb.execute(
                    'INSERT INTO social_dinner_tickets (registration_id, payment_id, ticket_index, token) VALUES (?, ?, ?, ?)',
                    [registrationId, paymentId, i, token]
                  );
                }
                const [final] = await mariadb.execute(
                  'SELECT id FROM social_dinner_tickets WHERE payment_id = ? AND ticket_index = ?',
                  [paymentId, i]
                );
                if (final.length) seenTicketIds.add(final[0].id);
              }
            }
          }
        }
      }
    });

    // Module: Posters
    await runSyncModule('Posters', async () => {
      const [existingPosters] = await mariadb.execute('SELECT mongo_id FROM posters WHERE conference_id = ?', [conferenceId]);
      const posterSet = new Set(existingPosters.map(p => p.mongo_id));
      const records = await mongoDb.collection(SYNC_CONFIG.mongoPostersView).find({}).toArray();
      console.log(`🖼️  Processing ${records.length} posters...`);
      for (const record of records) {
        const mongoId = record._id.toString();
        seenPosterMongoIds.add(mongoId);
        if (!posterSet.has(mongoId)) {
          await mariadb.execute(
            'INSERT INTO posters (conference_id, mongo_id, title, code, authors, content, toc) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [conferenceId, mongoId, record.title || 'Untitled', record.code || null, JSON.stringify(record.authors || []), record.content || null, record.toc || null]
          );
          summary.posters.new++;
          posterSet.add(mongoId);
        } else {
          await mariadb.execute(
            'UPDATE posters SET title = ?, code = ?, authors = ?, content = ?, toc = ? WHERE mongo_id = ?',
            [record.title || 'Untitled', record.code || null, JSON.stringify(record.authors || []), record.content || null, record.toc || null, mongoId]
          );
          summary.posters.updated++;
        }
      }
    });

    // Module: Program
    await runSyncModule('Program', async () => {
      const records = await mongoDb.collection(SYNC_CONFIG.mongoProgramView).find({}).toArray();
      console.log(`📅 Processing ${records.length} sessions...`);
      for (const session of records) {
        const mongoId = session._id.toString();
        seenSessionMongoIds.add(mongoId);
        const [res] = await mariadb.execute(`
          INSERT INTO program_sessions (conference_id, session_name, full_session_name, start_time, end_time, mongo_id)
          VALUES (?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE session_name = VALUES(session_name), full_session_name = VALUES(full_session_name),
                                  start_time = VALUES(start_time), end_time = VALUES(end_time)
                                  /* is_hidden is intentionally omitted to preserve manual state */
        `, [conferenceId, session.session_name, session.full_session_name, 
            session.start_time ? new Date(session.start_time) : null,
            session.end_time ? new Date(session.end_time) : null, mongoId]);

        let sessionId = res.insertId || (await mariadb.execute('SELECT id FROM program_sessions WHERE mongo_id = ?', [mongoId]))[0][0].id;
        summary.sessions++;

        await mariadb.execute('DELETE FROM program_slots WHERE session_id = ?', [sessionId]);
        if (session.full_slots && Array.isArray(session.full_slots)) {
          for (const slot of session.full_slots) {
            let slotType = slot.type || 'oral';
            if (slotType === 'invSession') slotType = 'Invited Speaker Session';
            if (slotType === 'invSpeaker') slotType = 'Invited Speaker';

            await mariadb.execute(`
              INSERT INTO program_slots (session_id, type, title, presenter_name, start_time, end_time)
              VALUES (?, ?, ?, ?, ?, ?)
            `, [sessionId, slotType, slot.title || null, slot.presenter_name || null,
                slot.start_time ? new Date(slot.start_time) : null,
                slot.end_time ? new Date(slot.end_time) : null]);
            summary.slots++;
          }
        }
      }
    });

    // --- CLEANUP PHASE (Mirror Logic) ---
    console.log('\n🧹 Starting cleanup of stale records...');
    
    if (seenRegistrationIds.size > 0) {
        const ids = Array.from(seenRegistrationIds).join(',');
        
        // Archive
        const [toArchive] = await mariadb.execute(`SELECT * FROM registrations WHERE conference_id = ? AND id NOT IN (${ids})`, [conferenceId]);
        for (const row of toArchive) {
            await mariadb.execute(
                'INSERT INTO sync_graveyard (entity_type, original_id, conference_id, data) VALUES (?, ?, ?, ?)',
                ['registration', row.id, conferenceId, JSON.stringify(row)]
            );
        }

        const [delRegs] = await mariadb.execute(`DELETE FROM registrations WHERE conference_id = ? AND id NOT IN (${ids})`, [conferenceId]);
        if (delRegs.affectedRows > 0) console.log(`🗑️  Archived and removed ${delRegs.affectedRows} stale registrations`);
    }

    if (seenPaymentMongoIds.size > 0) {
        const mongoIds = Array.from(seenPaymentMongoIds).map(id => `'${id}'`).join(',');
        
        // Archive
        const [toArchive] = await mariadb.execute(`
            SELECT p.* FROM payments p 
            JOIN registrations r ON p.registration_id = r.id
            WHERE r.conference_id = ? AND p.mongo_id NOT IN (${mongoIds})
        `, [conferenceId]);
        for (const row of toArchive) {
            await mariadb.execute(
                'INSERT INTO sync_graveyard (entity_type, original_id, mongo_id, conference_id, data) VALUES (?, ?, ?, ?, ?)',
                ['payment', row.id, row.mongo_id, conferenceId, JSON.stringify(row)]
            );
        }

        const [delPays] = await mariadb.execute(`
            DELETE FROM payments 
            WHERE registration_id IN (SELECT id FROM registrations WHERE conference_id = ?) 
            AND mongo_id NOT IN (${mongoIds})
        `, [conferenceId]);
        if (delPays.affectedRows > 0) console.log(`🗑️  Archived and removed ${delPays.affectedRows} stale payments`);
    }

    if (seenPosterMongoIds.size > 0) {
        const mongoIds = Array.from(seenPosterMongoIds).map(id => `'${id}'`).join(',');
        
        // Archive
        const [toArchive] = await mariadb.execute(`SELECT * FROM posters WHERE conference_id = ? AND mongo_id NOT IN (${mongoIds})`, [conferenceId]);
        for (const row of toArchive) {
            await mariadb.execute(
                'INSERT INTO sync_graveyard (entity_type, original_id, mongo_id, conference_id, data) VALUES (?, ?, ?, ?, ?)',
                ['poster', row.id, row.mongo_id, conferenceId, JSON.stringify(row)]
            );
        }

        const [delPosters] = await mariadb.execute(`DELETE FROM posters WHERE conference_id = ? AND mongo_id NOT IN (${mongoIds})`, [conferenceId]);
        if (delPosters.affectedRows > 0) console.log(`🗑️  Archived and removed ${delPosters.affectedRows} stale posters`);
    }

    if (seenSessionMongoIds.size > 0) {
        const mongoIds = Array.from(seenSessionMongoIds).map(id => `'${id}'`).join(',');
        
        // Archive
        const [toArchive] = await mariadb.execute(`SELECT * FROM program_sessions WHERE conference_id = ? AND mongo_id NOT IN (${mongoIds})`, [conferenceId]);
        for (const row of toArchive) {
            await mariadb.execute(
                'INSERT INTO sync_graveyard (entity_type, original_id, mongo_id, conference_id, data) VALUES (?, ?, ?, ?, ?)',
                ['session', row.id, row.mongo_id, conferenceId, JSON.stringify(row)]
            );
        }

        const [delSessions] = await mariadb.execute(`DELETE FROM program_sessions WHERE conference_id = ? AND mongo_id NOT IN (${mongoIds})`, [conferenceId]);
        if (delSessions.affectedRows > 0) console.log(`🗑️  Archived and removed ${delSessions.affectedRows} stale program sessions`);
    }

    if (seenTicketIds.size > 0) {
        const ids = Array.from(seenTicketIds).join(',');
        
        // Archive
        const [toArchive] = await mariadb.execute(`
            SELECT * FROM social_dinner_tickets 
            WHERE registration_id IN (SELECT id FROM registrations WHERE conference_id = ?) 
            AND id NOT IN (${ids})
        `, [conferenceId]);
        for (const row of toArchive) {
            await mariadb.execute(
                'INSERT INTO sync_graveyard (entity_type, original_id, conference_id, data) VALUES (?, ?, ?, ?)',
                ['dinner_ticket', row.id, conferenceId, JSON.stringify(row)]
            );
        }

        const [delTickets] = await mariadb.execute(`
            DELETE FROM social_dinner_tickets 
            WHERE registration_id IN (SELECT id FROM registrations WHERE conference_id = ?) 
            AND id NOT IN (${ids})
        `, [conferenceId]);
        if (delTickets.affectedRows > 0) console.log(`🗑️  Archived and removed ${delTickets.affectedRows} stale dinner tickets`);
    }
    // ------------------------------------

    printSummary(targetConferenceAcronym);

  } catch (error) {
    console.error('❌ Critical Sync Error:', error.message);
  } finally {
    if (mongoClient) await mongoClient.close();
    if (mariadb) await mariadb.end();
  }
}

async function ensureConference(mariadb, acronym, name) {
  let [rows] = await mariadb.execute('SELECT id FROM conferences WHERE acronym = ?', [acronym]);
  if (rows.length === 0) {
    console.log(`➕ Creating conference: ${acronym}`);
    const [res] = await mariadb.execute('INSERT INTO conferences (acronym, name) VALUES (?, ?)', [acronym, name]);
    return res.insertId;
  }
  return rows[0].id;
}

async function runSyncModule(name, fn) {
  console.log(`\n🔹 Starting [${name}] Sync...`);
  try {
    await fn();
    console.log(`✅ [${name}] Sync complete.`);
  } catch (err) {
    console.error(`⚠️  [${name}] Sync failed:`, err.message);
    summary.errors.push({ module: name, error: err.message });
  }
}

function printSummary(acronym) {
  console.log(`
✨ Master Sync Summary for ${acronym}:
----------------------------------
👤 New Participants: ${summary.participants}
🔗 New Registrations: ${summary.registrations}
💰 Payments Synced: ${summary.payments}
🖼️  Posters: ${summary.posters.new} new, ${summary.posters.updated} updated
📅 Program: ${summary.sessions} sessions, ${summary.slots} slots
----------------------------------`);

  if (summary.errors.length > 0) {
    console.warn('⚠️  Issues encountered during sync:');
    summary.errors.forEach(e => console.warn(`   - ${e.module}: ${e.error}`));
  } else {
    console.log('✅ All modules processed successfully!');
  }
  console.log('----------------------------------\n');
}

syncAll();
