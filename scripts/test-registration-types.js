const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

async function run() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || '127.0.0.1',
            port: Number(process.env.DB_PORT) || 3306,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD ? process.env.DB_PASSWORD.replace(/\\(\$)/g, '$1') : process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
        });
        
        const [rows] = await connection.execute(`
            SELECT c.acronym, p.registration_type, COUNT(*) as count 
            FROM participants p 
            JOIN registrations r ON p.id = r.participant_id
            JOIN conferences c ON r.conference_id = c.id
            WHERE p.registration_type IS NOT NULL AND p.registration_type != ""
            GROUP BY c.acronym, p.registration_type
            ORDER BY c.acronym, count DESC
        `);
        console.log('Registration types per conference:', rows);
        
        await connection.end();
    } catch (err) {
        console.error('❌ Failed:', err.message);
    }
}

run();
