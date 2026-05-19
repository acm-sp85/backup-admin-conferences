const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
const mysql = require('mysql2/promise');

async function migrate() {
    console.log('🚀 Starting migration: adding tickets_count to extra_activity_attendees...');
    
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

        // Check if tickets_count column exists
        const [columns] = await mariadb.execute(`
            SHOW COLUMNS FROM extra_activity_attendees LIKE 'tickets_count'
        `);

        if (columns.length === 0) {
            await mariadb.execute(`
                ALTER TABLE extra_activity_attendees ADD COLUMN tickets_count INT DEFAULT 1 AFTER email
            `);
            console.log('✅ Added column tickets_count to extra_activity_attendees');
        } else {
            console.log('ℹ️ Column tickets_count already exists');
        }

        console.log('✨ Migration complete.');
    } catch (e) {
        console.error('❌ Error during migration:', e.message);
    } finally {
        if (mariadb) await mariadb.end();
        process.exit(0);
    }
}

migrate();
