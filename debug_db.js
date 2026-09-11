const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });
async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1', port: 3307, user: process.env.DB_USER,
    password: process.env.DB_PASSWORD.replace(/\\(\$)/g, '$1'), database: process.env.DB_NAME
  });
  const [rows] = await conn.execute("SELECT id, acronym, mongo_id, email_from_domain FROM conferences WHERE acronym IN ('CIPIE', 'ANGEL')");
  console.log('Conferences:', rows);
  
  const [cal] = await conn.execute("SELECT id, acronym, mongo_id FROM global_calendar WHERE acronym IN ('CIPIE', 'ANGEL')");
  console.log('Global Calendar:', cal);
  conn.end();
}
run();
