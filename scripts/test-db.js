const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

async function test() {
    console.log('Testing connection with:', {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        db: process.env.DB_NAME,
        passwordRaw: process.env.DB_PASSWORD,
    });

    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || '127.0.0.1',
            port: Number(process.env.DB_PORT) || 3306,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD ? process.env.DB_PASSWORD.replace(/\\(\$)/g, '$1') : process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
        });
        console.log('✅ Success!');
        await connection.end();
    } catch (err) {
        console.error('❌ Failed:', err.message);
    }
}

test();
