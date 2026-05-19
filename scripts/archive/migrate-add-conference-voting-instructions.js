import { query } from '../src/lib/db.js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function migrate() {
  console.log('Adding voting_instructions column to conferences table...');
  try {
    await query(`
      ALTER TABLE conferences 
      ADD COLUMN IF NOT EXISTS voting_instructions TEXT DEFAULT NULL
    `);
    console.log('✅ Migration completed successfully.');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    process.exit();
  }
}

migrate();
