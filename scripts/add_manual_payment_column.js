const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
const mysql = require('mysql2/promise');

async function main() {
    let db;
    try {
        db = await mysql.createConnection({
            host: process.env.DB_HOST || '127.0.0.1',
            port: Number(process.env.DB_PORT) || 3306,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD ? process.env.DB_PASSWORD.replace(/\\(\$)/g, '$1') : process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
        });

        console.log('Connected to DB');
        
        await db.execute('ALTER TABLE payments ADD COLUMN is_manual TINYINT(1) DEFAULT 0');
        console.log('Successfully added is_manual column to payments');
        
    } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
            console.log('Column is_manual already exists');
        } else {
            console.error('Error:', err);
        }
    } finally {
        if (db) await db.end();
        process.exit(0);
    }
}

main();
