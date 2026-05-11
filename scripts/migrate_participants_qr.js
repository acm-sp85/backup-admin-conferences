const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function migrate() {
    console.log('Starting migration...');
    const pool = mysql.createPool({
        host: process.env.DB_HOST || '127.0.0.1',
        port: Number(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD ? process.env.DB_PASSWORD.replace(/\\(\$)/g, '$1') : process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    });

    try {
        // Add email_checkin_body to conferences if it doesn't exist
        console.log('Adding email_checkin_body to conferences...');
        await pool.execute(`
            ALTER TABLE conferences 
            ADD COLUMN email_checkin_body TEXT AFTER email_social_dinner_tickets_body
        `).catch(err => {
            if (err.code === 'ER_DUP_COLUMN_NAMES') {
                console.log('Column email_checkin_body already exists.');
            } else {
                throw err;
            }
        });

        // Create participant_qr_tokens table
        console.log('Creating participant_qr_tokens table...');
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS participant_qr_tokens (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                registration_id BIGINT NOT NULL,
                token VARCHAR(48) NOT NULL UNIQUE,
                email_sent_at DATETIME NULL,
                scanned_at DATETIME NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX (registration_id)
            )
        `);

        console.log('Migration completed successfully.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await pool.end();
        process.exit();
    }
}

migrate();

