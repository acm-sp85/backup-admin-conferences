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

        try { 
            await mariadb.execute('ALTER TABLE program_slots ADD COLUMN toc VARCHAR(2083) DEFAULT NULL'); 
            console.log('✅ Added toc to program_slots'); 
        } catch (e) { 
            console.log('toc might already exist:', e.message); 
        }
    } catch (e) {
        console.error('Error during migration:', e);
    } finally {
        if (mariadb) await mariadb.end();
    }
}
migrate();
