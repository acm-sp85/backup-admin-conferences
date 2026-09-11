const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
const mysql = require('mysql2/promise');

async function migrate() {
    console.log('🚀 Starting migration: adding country to participants and presenter_country to program_slots...');
    
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

        // Check if country column exists in participants
        const [pColumns] = await mariadb.execute(`SHOW COLUMNS FROM participants LIKE 'country'`);
        if (pColumns.length === 0) {
            await mariadb.execute(`ALTER TABLE participants ADD COLUMN country VARCHAR(255) DEFAULT NULL AFTER entity`);
            console.log('✅ Added column country to participants');
        } else {
            console.log('ℹ️ Column country already exists in participants');
        }

        // Check if presenter_country column exists in program_slots
        const [psColumns] = await mariadb.execute(`SHOW COLUMNS FROM program_slots LIKE 'presenter_country'`);
        if (psColumns.length === 0) {
            await mariadb.execute(`ALTER TABLE program_slots ADD COLUMN presenter_country VARCHAR(255) DEFAULT NULL AFTER presenter_entity`);
            console.log('✅ Added column presenter_country to program_slots');
        } else {
            console.log('ℹ️ Column presenter_country already exists in program_slots');
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
