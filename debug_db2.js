const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });
async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1', port: 3307, user: process.env.DB_USER,
    password: process.env.DB_PASSWORD.replace(/\\(\$)/g, '$1'), database: process.env.DB_NAME
  });
  const [rows] = await conn.execute("SELECT id, acronym, mongo_id FROM conferences");
  console.log('All Conferences:', rows);
  
  const [cipie] = await conn.execute("SELECT id, acronym, mongo_id FROM global_calendar WHERE acronym LIKE '%CIPIE%'");
  console.log('CIPIE in calendar:', cipie);
  conn.end();
}
run();
