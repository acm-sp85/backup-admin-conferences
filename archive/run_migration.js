require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');

async function migrate() {
    try {
        const pool = mysql.createPool({
            host: process.env.DB_HOST || '127.0.0.1',
            port: Number(process.env.DB_PORT) || 3306,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD ? process.env.DB_PASSWORD.replace(/\\(\$)/g, '$1') : process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
        });

        console.log('Running migration...');
        
        try {
            await pool.query("ALTER TABLE conferences ADD COLUMN certificate_orientation VARCHAR(20) DEFAULT 'portrait'");
            console.log('Added certificate_orientation');
        } catch(e) {
            if(e.code === 'ER_DUP_FIELDNAME') console.log('certificate_orientation already exists');
            else throw e;
        }

        try {
            await pool.query("ALTER TABLE conferences ADD COLUMN certificate_background_image TEXT DEFAULT NULL");
            console.log('Added certificate_background_image');
        } catch(e) {
            if(e.code === 'ER_DUP_FIELDNAME') console.log('certificate_background_image already exists');
            else throw e;
        }

        console.log('Migration complete');
        process.exit(0);
    } catch(e) {
        console.error('Migration failed:', e);
        process.exit(1);
    }
}

migrate();
