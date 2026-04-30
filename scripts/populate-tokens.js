const mysql = require('mysql2/promise');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function populateTokens() {
  console.log('🔄 Generating tokens for existing registrations...');
  
  const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD ? process.env.DB_PASSWORD.replace(/\\(\$)/g, '$1') : process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    const [registrations] = await pool.execute('SELECT id FROM registrations WHERE check_in_token IS NULL');
    console.log(`📝 Found ${registrations.length} registrations without tokens.`);

    for (const reg of registrations) {
      const token = crypto.randomBytes(16).toString('hex');
      await pool.execute('UPDATE registrations SET check_in_token = ? WHERE id = ?', [token, reg.id]);
    }
    
    console.log('✅ All registrations now have check-in tokens!');
    process.exit(0);
  } catch (e) {
    console.error('❌ Token generation failed:', e.message);
    process.exit(1);
  }
}

populateTokens();
