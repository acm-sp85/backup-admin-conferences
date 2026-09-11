const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
const mysql = require('mysql2/promise');

async function migrate() {
    console.log('🚀 Starting migration: adding country_inferred to participants...');
    
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

        const [pColumns] = await mariadb.execute(`SHOW COLUMNS FROM participants LIKE 'country_inferred'`);
        if (pColumns.length === 0) {
            await mariadb.execute(`ALTER TABLE participants ADD COLUMN country_inferred TINYINT(1) DEFAULT 0 AFTER country`);
            console.log('✅ Added column country_inferred to participants');
        } else {
            console.log('ℹ️ Column country_inferred already exists in participants');
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
