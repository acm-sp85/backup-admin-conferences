const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function migrate() {
    try {
        const db = await mysql.createConnection({
            host: process.env.DB_HOST || '127.0.0.1',
            port: Number(process.env.DB_PORT) || 3306,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD ? process.env.DB_PASSWORD.replace(/\\(\$)/g, '$1') : process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
        });

        console.log('📡 Connected to database');

        // 1. Add is_manual and is_hidden columns
        try {
            await db.execute('ALTER TABLE social_dinner_tickets ADD COLUMN is_manual TINYINT(1) DEFAULT 0');
            console.log('✅ Added is_manual column');
        } catch (e) { console.log('ℹ️  is_manual column already exists'); }

        try {
            await db.execute('ALTER TABLE social_dinner_tickets ADD COLUMN is_hidden TINYINT(1) DEFAULT 0');
            console.log('✅ Added is_hidden column');
        } catch (e) { console.log('ℹ️  is_hidden column already exists'); }

        // 2. Make payment_id and ticket_index nullable
        console.log('🔄 Making payment_id and ticket_index nullable...');
        await db.execute('ALTER TABLE social_dinner_tickets MODIFY payment_id INT NULL');
        await db.execute('ALTER TABLE social_dinner_tickets MODIFY ticket_index INT NULL');
        console.log('✅ Columns are now nullable');

        await db.end();
        console.log('🏁 Migration finished');
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
    }
}

migrate();
