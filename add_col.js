import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { query } from './src/lib/db.js';

async function run() {
    try {
        await query(`ALTER TABLE registrations ADD COLUMN badge_adjustments JSON`);
        console.log('Successfully added badge_adjustments column to registrations table');
    } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME') {
            console.log('Column badge_adjustments already exists.');
        } else {
            console.error('Error adding column:', e);
        }
    }
    process.exit(0);
}

run();
