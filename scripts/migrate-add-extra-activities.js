const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
const mysql = require('mysql2/promise');

async function migrate() {
    console.log('🚀 Starting migration: adding extra activities tracking...');
    
    let mariadb;
    try {
        mariadb = await mysql.createConnection({
            host: process.env.DB_HOST || '127.0.0.1',
            port: Number(process.env.DB_PORT) || 3306,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD ? process.env.DB_PASSWORD.replace(/\\(\$)/g, '$1') : process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
        });
        console.log('📡 Database connected');

        // 1. Create extra_activities table
        await mariadb.execute(`
            CREATE TABLE IF NOT EXISTS extra_activities (
                id INT AUTO_INCREMENT PRIMARY KEY,
                conference_id INT NOT NULL,
                name VARCHAR(255) NOT NULL,
                date DATETIME NULL,
                description TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_activity_conference FOREIGN KEY (conference_id) REFERENCES conferences(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log('✅ Created table extra_activities');

        // 2. Create extra_activity_attendees table
        await mariadb.execute(`
            CREATE TABLE IF NOT EXISTS extra_activity_attendees (
                id INT AUTO_INCREMENT PRIMARY KEY,
                activity_id INT NOT NULL,
                participant_id INT NULL,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL,
                qr_token VARCHAR(100) UNIQUE NOT NULL,
                email_sent_at TIMESTAMP NULL,
                scanned_at TIMESTAMP NULL,
                is_manual TINYINT(1) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_attendee_activity FOREIGN KEY (activity_id) REFERENCES extra_activities(id) ON DELETE CASCADE,
                CONSTRAINT fk_attendee_participant FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log('✅ Created table extra_activity_attendees');

        console.log('✨ Migration complete.');
    } catch (e) {
        console.error('❌ Error during migration:', e.message);
    } finally {
        if (mariadb) await mariadb.end();
        process.exit(0);
    }
}

migrate();
