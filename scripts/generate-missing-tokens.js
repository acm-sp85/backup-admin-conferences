const mysql = require('mysql2/promise');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

async function generateMissingTokens() {
    console.log('🚀 Searching for registrations missing QR tokens...');
    
    const pool = mysql.createPool({
        host: process.env.DB_HOST || '127.0.0.1',
        port: Number(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD ? process.env.DB_PASSWORD.replace(/\\(\$)/g, '$1') : process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    });

    try {
        // 1. Find all registrations that don't have a record in participant_qr_tokens
        const [missing] = await pool.execute(`
            SELECT r.id, p.email 
            FROM registrations r
            JOIN participants p ON r.participant_id = p.id
            LEFT JOIN participant_qr_tokens t ON r.id = t.registration_id
            WHERE t.token IS NULL
        `);

        if (missing.length === 0) {
            console.log('✅ All participants already have QR tokens.');
            return;
        }

        console.log(`👤 Found ${missing.length} participants missing tokens. Generating...`);

        let count = 0;
        for (const reg of missing) {
            const token = crypto.randomBytes(24).toString('hex');
            await pool.execute(
                'INSERT INTO participant_qr_tokens (registration_id, token) VALUES (?, ?)',
                [reg.id, token]
            );
            count++;
            if (count % 50 === 0) console.log(`...processed ${count} tokens`);
        }

        console.log(`\n✨ Success! Generated ${count} new QR tokens.`);
        console.log('You can now refresh the Participants page in the dashboard.');

    } catch (error) {
        console.error('❌ Failed to generate tokens:', error);
    } finally {
        await pool.end();
        process.exit();
    }
}

generateMissingTokens();
