const mysql = require('mysql2/promise');

async function main() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3307,
    user: 'adnfc2',
    password: 'Y26$d4ss3',
    database: 'admin_conferencias'
  });

  const [rows] = await connection.execute('DESCRIBE program_slots;');
  console.log(rows);
  await connection.end();
}
main().catch(console.error);
