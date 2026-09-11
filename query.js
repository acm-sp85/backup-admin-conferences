const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });
async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1', port: 3307, user: process.env.DB_USER,
    password: process.env.DB_PASSWORD.replace(/\\(\$)/g, '$1'), database: process.env.DB_NAME
  });
  try {
      await conn.execute('ALTER TABLE conferences ADD COLUMN mongo_id VARCHAR(50) DEFAULT NULL');
      console.log('Column added');
  } catch (e) {
      console.log(e.message);
  }
  conn.end();
}
run();
