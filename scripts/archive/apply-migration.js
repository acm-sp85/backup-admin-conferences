import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config({ path: '/Users/franciscoacontellmonje/Desktop/SCITO/SCITO_webdev/Admin_Conferencias/.env.local' });

async function migrate() {
    console.log('Connecting to DB...');
    const pool = mysql.createPool({
        host: process.env.DB_HOST || '127.0.0.1',
        port: Number(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD ? process.env.DB_PASSWORD.replace(/\\(\$)/g, '$1') : process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        waitForConnections: true,
        connectionLimit: 1
    });

    try {
        await pool.execute('ALTER TABLE extra_activities ADD COLUMN email_subject VARCHAR(255) DEFAULT NULL');
        console.log('Added email_subject');
    } catch (e) {
        console.log('email_subject error:', e.message);
    }

    try {
        await pool.execute('ALTER TABLE extra_activities ADD COLUMN email_body_template TEXT DEFAULT NULL');
        console.log('Added email_body_template');
    } catch (e) {
        console.log('email_body_template error:', e.message);
    }

    try {
        await pool.execute('ALTER TABLE extra_activities ADD COLUMN include_qr BOOLEAN NOT NULL DEFAULT 1');
        console.log('Added include_qr');
    } catch (e) {
        console.log('include_qr error:', e.message);
    }

    await pool.end();
    console.log('Done.');
}

migrate();
