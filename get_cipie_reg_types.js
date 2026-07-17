const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });
async function main() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD.replace(/\\(\$)/g, '$1'),
    database: process.env.DB_NAME
  });
  
  // Try checking participants table for registration types
  const [rows] = await db.query('SELECT DISTINCT registration_type FROM participants WHERE id IN (SELECT participant_id FROM registrations WHERE conference_id = 11)');
  console.log('Registration Types from participants:', rows.map(r => r.registration_type).filter(Boolean));
  
  // Also check payment_group if that's used
  const [pgRows] = await db.query('SELECT DISTINCT payment_group FROM participants WHERE id IN (SELECT participant_id FROM registrations WHERE conference_id = 11)');
  console.log('Payment Groups from participants:', pgRows.map(r => r.payment_group).filter(Boolean));
  
  db.end();
}
main().catch(console.error);
