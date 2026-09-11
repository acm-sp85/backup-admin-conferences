const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });
async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1', port: 3307, user: process.env.DB_USER,
    password: process.env.DB_PASSWORD.replace(/\\(\$)/g, '$1'), database: process.env.DB_NAME
  });
  
  await conn.execute('UPDATE conferences SET mongo_id = ? WHERE acronym = ?', ['684ada152b7b0a64a0fda8da', 'ANGEL26']);
  await conn.execute('UPDATE conferences SET mongo_id = ? WHERE acronym = ?', ['68495ae866041d09402d8c71', 'CIPIE26']);
  console.log('Fixed!');
  conn.end();
}
run();
