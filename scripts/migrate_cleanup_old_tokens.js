const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function migrate() {
    console.log('🧹 Cleaning up old check_in_token references...');

    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || '127.0.0.1',
        port: Number(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD ? process.env.DB_PASSWORD.replace(/\\(\$)/g, '$1') : process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    });

    try {
        // Drop check_in_token column from registrations
        console.log('Dropping check_in_token column from registrations...');
        try {
            await connection.execute('ALTER TABLE registrations DROP COLUMN check_in_token');
            console.log('✅ Column dropped successfully.');
        } catch (e) {
            console.log('ℹ️ Column check_in_token does not exist or already dropped.');
        }

        console.log('✅ Cleanup migration complete.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await connection.end();
    }
}

migrate();
