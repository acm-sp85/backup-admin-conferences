const mariadb = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function run() {
    let pool;
    try {
        pool = mariadb.createPool({
            host: process.env.DB_HOST || '127.0.0.1',
            port: Number(process.env.DB_PORT) || 3306,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD ? process.env.DB_PASSWORD.replace(/\\/g, '') : undefined,
            database: process.env.DB_NAME,
            connectionLimit: 1
        });

        const conn = await pool.getConnection();

        try {
            await conn.query('ALTER TABLE registrations ADD COLUMN paystatus_total DECIMAL(10,2) DEFAULT 0.00');
            await conn.query('ALTER TABLE registrations ADD COLUMN paystatus_paid DECIMAL(10,2) DEFAULT 0.00');
            await conn.query('ALTER TABLE registrations ADD COLUMN paystatus_due DECIMAL(10,2) DEFAULT 0.00');
            console.log('✅ Successfully added paystatus columns to registrations');
        } catch (e) {
            console.log('ℹ️ Columns might already exist:', e.message);
        }

        await conn.release();
    } catch (e) {
        console.error('Error:', e);
    } finally {
        if (pool) await pool.end();
    }
}

run();
