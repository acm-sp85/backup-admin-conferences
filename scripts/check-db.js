const { query } = require('../src/lib/db');

async function check() {
    try {
        const res1 = await query("SHOW COLUMNS FROM participant_qr_tokens LIKE 'is_manual'");
        const res2 = await query("SHOW COLUMNS FROM social_dinner_tickets LIKE 'is_manual'");
        console.log('PARTICIPANT_COL:', JSON.stringify(res1));
        console.log('SOCIAL_DINNER_COL:', JSON.stringify(res2));
    } catch (e) {
        console.error('ERROR:', e.message);
    }
    process.exit(0);
}

check();
