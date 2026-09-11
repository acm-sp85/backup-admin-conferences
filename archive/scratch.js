require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');

async function check() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD ? process.env.DB_PASSWORD.replace(/\\(\$)/g, '$1') : process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT) || 3306,
  });

  try {
    const [conferences] = await connection.execute('SELECT id, name, acronym FROM conferences WHERE acronym LIKE "%ANGEL%"');
    console.log('Conferences:', conferences);

    if (conferences.length > 0) {
      const confId = conferences[0].id;
      const [groups] = await connection.execute('SELECT * FROM custom_voting_groups WHERE conference_id = ?', [confId]);
      console.log('Custom Voting Groups:', groups);

      for (let g of groups) {
          const [items] = await connection.execute('SELECT cvi.*, ps.title FROM custom_voting_items cvi JOIN program_slots ps ON cvi.slot_id = ps.id WHERE group_id = ?', [g.id]);
          console.log(`Items for group ${g.name}:`, items);
      }
    }
  } catch (e) {
    console.error(e);
  } finally {
    await connection.end();
  }
}
check();
