const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
const mysql = require('mysql2/promise');

async function migrate() {
    console.log('🚀 Starting migration: adding presenter_entity to program_slots...');
    
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

        // Check if presenter_entity column exists
        const [columns] = await mariadb.execute(`
            SHOW COLUMNS FROM program_slots LIKE 'presenter_entity'
        `);

        if (columns.length === 0) {
            await mariadb.execute(`
                ALTER TABLE program_slots ADD COLUMN presenter_entity VARCHAR(255) DEFAULT NULL AFTER presenter_name
            `);
            console.log('✅ Added column presenter_entity to program_slots');
        } else {
            console.log('ℹ️ Column presenter_entity already exists');
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
