const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
const mysql = require('mysql2/promise');

async function migrate() {
    console.log('🚀 Starting migration: adding entity to participants table...');
    
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

        // Check if entity column exists in participants
        const [columns] = await mariadb.execute(`
            SHOW COLUMNS FROM participants LIKE 'entity'
        `);

        if (columns.length === 0) {
            await mariadb.execute(`
                ALTER TABLE participants ADD COLUMN entity VARCHAR(255) DEFAULT NULL AFTER registration_type
            `);
            console.log('✅ Added column entity to participants table');
        } else {
            console.log('ℹ️ Column entity already exists in participants table');
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
