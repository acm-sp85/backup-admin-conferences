const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });
async function main() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });
  const [rows] = await db.query('SELECT COUNT(*) as count FROM posters');
  console.log('Posters count:', rows[0].count);
  const [cols] = await db.query('DESCRIBE posters');
  console.log('Posters columns:', cols.map(c => c.Field));
  
  const [slots] = await db.query('SELECT COUNT(*) as count FROM program_slots');
  console.log('Slots count:', slots[0].count);
  db.end();
}
main();
