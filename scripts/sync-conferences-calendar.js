const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const { MongoClient } = require('mongodb');
const mysql = require('mysql2/promise');

// ANSI Color codes for premium CLI output
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
  gray: "\x1b[90m",
  magenta: "\x1b[35m"
};

const mariadbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD ? process.env.DB_PASSWORD.replace(/\\(\$)/g, '$1') : process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
};

async function main() {
  console.log(`\n${c.bold}${c.cyan}=== Global Conferences Calendar Sync ===${c.reset}\n`);

  let mariadb, mongoClient;

  try {
    // 1. Connect to MariaDB and setup table
    console.log(`📡 Connecting to MariaDB...`);
    mariadb = await mysql.createConnection(mariadbConfig);
    
    console.log(`🛠️  Ensuring 'global_calendar' table exists...`);
    await mariadb.execute(`
      CREATE TABLE IF NOT EXISTS global_calendar (
        id INT AUTO_INCREMENT PRIMARY KEY,
        acronym VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(255),
        start_date DATE,
        end_date DATE,
        accent_color VARCHAR(20),
        conference_id INT NULL,
        deadlines JSON NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_acronym (acronym),
        FOREIGN KEY (conference_id) REFERENCES conferences(id) ON DELETE SET NULL
      )
    `);

    // 2. Connect to MongoDB
    console.log(`📡 Connecting to MongoDB...`);
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is missing in .env.local");
    }

    mongoClient = new MongoClient(process.env.MONGO_URI);
    await mongoClient.connect();
    
    const PLATFORM = process.env.CONFERENCE_PLATFORM;
    const isScito = PLATFORM === 'SCITO';
    const mongoDbName = isScito ? 'scito-prod' : (process.env.MONGO_DB_NAME || 'nanoge-production');
    
    const db = mongoClient.db(mongoDbName);
    const collection = db.collection('All-Conferences');
    
    console.log(`🔍 Fetching all conferences from MongoDB (db: ${mongoDbName}, view: All-Conferences)...`);
    
    const now = new Date();
    // Filter conferences that end in the future
    const query = { end: { $gte: now } };
    
    const cursor = collection.find(query);
    const allConferences = await cursor.toArray();
    
    console.log(`${c.green}✓ Found ${allConferences.length} conferences in MongoDB!${c.reset}`);
    
    // Get all existing local conferences for linking
    const [localConfs] = await mariadb.execute('SELECT id, acronym FROM conferences');
    const localConfMap = new Map();
    for (const conf of localConfs) {
      localConfMap.set(conf.acronym, conf.id);
    }

    // 3. Sync into global_calendar
    console.log(`\n💾 Upserting to MariaDB global_calendar...`);
    
    let added = 0;
    let updated = 0;

    for (const mongoData of allConferences) {
      const acronym = mongoData.acronym;
      if (!acronym) continue;

      const name = mongoData.name || null;
      const accent_color = mongoData.featuredcolor || '#007aff';
      
      let start_date = null;
      if (mongoData.start && mongoData.start) {
        const d = new Date(mongoData.start);
        if (!isNaN(d)) start_date = d.toISOString().split('T')[0];
      }
      
      let end_date = null;
      if (mongoData.end && mongoData.end) {
        const d = new Date(mongoData.end);
        if (!isNaN(d)) end_date = d.toISOString().split('T')[0];
      }

      const deadlines = mongoData.deadlines ? JSON.stringify(mongoData.deadlines) : null;
      
      // Auto-link if exists locally
      const conference_id = localConfMap.get(acronym) || null;

      // Upsert query
      const query = `
        INSERT INTO global_calendar (acronym, name, start_date, end_date, accent_color, conference_id, deadlines)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          start_date = VALUES(start_date),
          end_date = VALUES(end_date),
          accent_color = VALUES(accent_color),
          conference_id = VALUES(conference_id),
          deadlines = VALUES(deadlines)
      `;

      try {
        const [result] = await mariadb.execute(query, [acronym, name, start_date, end_date, accent_color, conference_id, deadlines]);
        if (result.insertId) {
          added++;
        } else {
          updated++;
        }
      } catch (err) {
        console.error(`${c.red}Failed to upsert ${acronym}:${c.reset}`, err.message);
      }
    }
    
    console.log(`\n${c.green}✨ Sync complete!${c.reset}`);
    console.log(`${c.magenta}Added/New: ${added}${c.reset}`);
    console.log(`${c.yellow}Updated/Existing: ${updated}${c.reset}`);

  } catch (error) {
    console.error(`\n${c.red}💥 Sync failed:${c.reset}`, error.message);
  } finally {
    if (mariadb) await mariadb.end();
    if (mongoClient) await mongoClient.close();
    console.log(`\n${c.gray}Connections closed.${c.reset}\n`);
  }
}

main();
