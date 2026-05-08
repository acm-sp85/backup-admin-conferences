const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// --- CONFIGURATION SECTION ---
const ACRONYM = process.env.CONFERENCE_ACRONYM || 'HOPV26';
const SYNC_CONFIG = {
  mongoPostersView: `${ACRONYM} - Posters`,
  targetConferenceAcronym: ACRONYM,
  targetConferenceName: process.env.CONFERENCE_NAME || 'HOPV 2026',
};
// -----------------------------

const { MongoClient } = require('mongodb');
const mysql = require('mysql2/promise');

const mariadbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD ? process.env.DB_PASSWORD.replace(/\\(\$)/g, '$1') : process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
};

async function syncPosters() {
  const { targetConferenceAcronym, targetConferenceName, mongoPostersView } = SYNC_CONFIG;
  const mongoDbName = process.env.MONGO_DB_NAME || 'nanoge-production';
  
  console.log(`🚀 Starting Poster Sync for conference: ${targetConferenceAcronym}...`);

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

    // --- PRE-FETCH DATA FOR OPTIMIZATION ---
    console.log('📡 Pre-fetching existing posters...');
    const [existingPosters] = await mariadb.execute('SELECT mongo_id FROM posters WHERE conference_id = ?', [conferenceId]);
    const posterSet = new Set(existingPosters.map(p => p.mongo_id));
    // ---------------------------------------

    const seenPosterMongoIds = new Set();

    // 2. SYNC POSTERS
    const records = await mongoDb.collection(mongoPostersView).find({}).toArray();
    console.log(`📥 Processing ${records.length} posters...`);

    let newCount = 0;
    let updateCount = 0;

    for (const record of records) {
      const mongoId = record._id.toString();
      seenPosterMongoIds.add(mongoId);

      const title = record.title || 'Untitled Poster';
      const code = record.code || null;
      const authors = record.authors ? JSON.stringify(record.authors) : '[]';
      const content = record.content || null;
      const toc = record.toc || null;

      if (!posterSet.has(mongoId)) {
        await mariadb.execute(
          'INSERT INTO posters (conference_id, mongo_id, title, code, authors, content, toc) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [conferenceId, mongoId, title, code, authors, content, toc]
        );
        posterSet.add(mongoId); // Update cache
        newCount++;
      } else {
        await mariadb.execute(
          'UPDATE posters SET title = ?, code = ?, authors = ?, content = ?, toc = ? WHERE mongo_id = ?',
          [title, code, authors, content, toc, mongoId]
        );
        updateCount++;
      }
    }

    // --- CLEANUP PHASE ---
    console.log('🧹 Cleaning up stale posters...');
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

        const [delRes] = await mariadb.execute(`
            DELETE FROM posters 
            WHERE conference_id = ? AND mongo_id NOT IN (${mongoIds})
        `, [conferenceId]);
        if (delRes.affectedRows > 0) console.log(`🗑️  Archived and removed ${delRes.affectedRows} stale posters`);
    }
    // ---------------------

    console.log(`
✨ Sync Summary for ${targetConferenceAcronym}:
----------------------------------
🖼️  New Posters Added: ${newCount}
🔄 Posters Updated: ${updateCount}
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

syncPosters();
