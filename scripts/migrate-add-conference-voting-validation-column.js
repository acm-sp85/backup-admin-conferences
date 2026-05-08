import { query } from '../src/lib/db.js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function migrate() {
  console.log('Adding voting_validation_enabled column to conferences table...');
  try {
    await query(`
      ALTER TABLE conferences 
      ADD COLUMN IF NOT EXISTS voting_validation_enabled TINYINT(1) DEFAULT 1
    `);
    console.log('✅ Migration completed successfully.');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    process.exit();
  }
}

migrate();
