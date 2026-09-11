const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function migrate() {
    let mariadb;
    try {
        mariadb = await mysql.createConnection({
            host: process.env.DB_HOST || '127.0.0.1',
            port: Number(process.env.DB_PORT) || 3306,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD ? process.env.DB_PASSWORD.replace(/\\(\$)/g, '$1') : process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
        });

        console.log('Adding Orals fields to program_slots...');
        
        try { await mariadb.execute('ALTER TABLE program_slots ADD COLUMN mongo_id VARCHAR(255) DEFAULT NULL'); console.log('✅ Added mongo_id'); } catch (e) {}
        try { await mariadb.execute('ALTER TABLE program_slots ADD COLUMN authors TEXT DEFAULT NULL'); console.log('✅ Added authors'); } catch (e) {}
        try { await mariadb.execute('ALTER TABLE program_slots ADD COLUMN content LONGTEXT DEFAULT NULL'); console.log('✅ Added content'); } catch (e) {}
        try { await mariadb.execute('ALTER TABLE program_slots ADD COLUMN code VARCHAR(50) DEFAULT NULL'); console.log('✅ Added code'); } catch (e) {}

        console.log('Migration complete!');
    } catch (e) {
        console.error('Error during migration:', e);
    } finally {
        if (mariadb) await mariadb.end();
    }
}
migrate();
