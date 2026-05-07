const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function migrate() {
    try {
        const db = await mysql.createConnection({
            host: process.env.DB_HOST || '127.0.0.1',
            port: Number(process.env.DB_PORT) || 3306,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD ? process.env.DB_PASSWORD.replace(/\\(\$)/g, '$1') : process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
        });

        console.log('📡 Connected to database');

        await db.execute(`
            CREATE TABLE IF NOT EXISTS social_dinner_tickets (
                id INT AUTO_INCREMENT PRIMARY KEY,
                registration_id INT NOT NULL,
                payment_id INT NOT NULL,
                ticket_index INT NOT NULL,
                token VARCHAR(255) UNIQUE NOT NULL,
                scanned_at DATETIME DEFAULT NULL,
                email_sent_at DATETIME DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY (payment_id, ticket_index)
            )
        `);

        console.log('✅ social_dinner_tickets table created');
        await db.end();
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
    }
}

migrate();
