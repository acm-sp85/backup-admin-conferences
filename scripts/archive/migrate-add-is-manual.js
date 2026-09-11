const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
const mysql = require('mysql2/promise');

async function migrate() {
    console.log('🚀 Starting migration: adding is_manual to participants and registrations...');
    
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

        // Check if is_manual column exists in participants
        const [pColumns] = await mariadb.execute(`SHOW COLUMNS FROM participants LIKE 'is_manual'`);
        if (pColumns.length === 0) {
            await mariadb.execute(`ALTER TABLE participants ADD COLUMN is_manual TINYINT(1) DEFAULT 0 AFTER entity_country`);
            console.log('✅ Added column is_manual to participants');
        } else {
            console.log('ℹ️ Column is_manual already exists in participants');
        }

        // Check if is_manual column exists in registrations
        const [rColumns] = await mariadb.execute(`SHOW COLUMNS FROM registrations LIKE 'is_manual'`);
        if (rColumns.length === 0) {
            await mariadb.execute(`ALTER TABLE registrations ADD COLUMN is_manual TINYINT(1) DEFAULT 0 AFTER is_guest`);
            console.log('✅ Added column is_manual to registrations');
        } else {
            console.log('ℹ️ Column is_manual already exists in registrations');
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
