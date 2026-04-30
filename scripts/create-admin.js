const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '.env.local' });

async function createAdmin() {
  const firstName = process.argv[2] || 'Admin';
  const lastName = process.argv[3] || 'User';
  const email = process.argv[4] || 'admin@scito.org';
  const password = process.argv[5] || 'password123';

  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    await pool.execute(
      'INSERT INTO users (firstName, lastName, email, password) VALUES (?, ?, ?, ?)',
      [firstName, lastName, email, hashedPassword]
    );

    console.log('Successfully created admin user:');
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
    console.log('\nIMPORTANT: Change this password immediately after logging in.');
    
    process.exit(0);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      console.error('Error: A user with this email already exists.');
    } else {
      console.error('Error creating admin user:', error.message);
    }
    process.exit(1);
  }
}

createAdmin();
