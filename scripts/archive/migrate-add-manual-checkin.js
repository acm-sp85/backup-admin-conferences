const { query } = require('../src/lib/db');

async function migrate() {
    console.log('🚀 Starting migration: adding manual check-in tracking...');
    
    try {
        // Add is_manual to participant_qr_tokens
        await query(`
            ALTER TABLE participant_qr_tokens 
            ADD COLUMN is_manual BOOLEAN DEFAULT 0
        `);
        console.log('✅ Added is_manual to participant_qr_tokens');
    } catch (e) {
        if (e.message.includes('Duplicate column name')) {
            console.log('ℹ️ is_manual already exists in participant_qr_tokens');
        } else {
            console.error('❌ Error updating participant_qr_tokens:', e.message);
        }
    }

    try {
        // Add is_manual to social_dinner_tickets
        await query(`
            ALTER TABLE social_dinner_tickets 
            ADD COLUMN is_manual BOOLEAN DEFAULT 0
        `);
        console.log('✅ Added is_manual to social_dinner_tickets');
    } catch (e) {
        if (e.message.includes('Duplicate column name')) {
            console.log('ℹ️ is_manual already exists in social_dinner_tickets');
        } else {
            console.error('❌ Error updating social_dinner_tickets:', e.message);
        }
    }

    console.log('✨ Migration complete.');
    process.exit(0);
}

migrate();
