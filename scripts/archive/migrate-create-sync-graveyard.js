const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const config = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD ? process.env.DB_PASSWORD.replace(/\\(\$)/g, '') : process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
};

async function migrate() {
  console.log('Creating sync_graveyard table...');
  const db = await mysql.createConnection(config);
  try {
    await db.execute(`
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
    console.log('✅ Graveyard table ready.');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await db.end();
    process.exit();
  }
}

migrate();
