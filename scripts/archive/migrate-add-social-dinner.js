const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
const mysql = require('mysql2/promise');

async function migrate() {
    console.log('🚀 Starting migration: adding social dinner columns to conferences...');
    
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

        // Check if social_dinner_date column exists
        const [dateCols] = await mariadb.execute(`
            SHOW COLUMNS FROM conferences LIKE 'social_dinner_date'
        `);

        if (dateCols.length === 0) {
            await mariadb.execute(`
                ALTER TABLE conferences ADD COLUMN social_dinner_date VARCHAR(255) DEFAULT NULL
            `);
            console.log('✅ Added column social_dinner_date to conferences');
        } else {
            console.log('ℹ️ Column social_dinner_date already exists');
        }

        // Check if social_dinner_location column exists
        const [locCols] = await mariadb.execute(`
            SHOW COLUMNS FROM conferences LIKE 'social_dinner_location'
        `);

        if (locCols.length === 0) {
            await mariadb.execute(`
                ALTER TABLE conferences ADD COLUMN social_dinner_location TEXT DEFAULT NULL
            `);
            console.log('✅ Added column social_dinner_location to conferences');
        } else {
            console.log('ℹ️ Column social_dinner_location already exists');
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
