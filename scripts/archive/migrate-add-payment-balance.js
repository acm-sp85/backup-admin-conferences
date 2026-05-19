import { query } from '../src/lib/db.js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function migrate() {
  console.log('Adding balance column to payments table...');
  try {
    await query(`
      ALTER TABLE payments 
      ADD COLUMN IF NOT EXISTS balance DECIMAL(10,2) DEFAULT 0.00 AFTER amount
    `);
    console.log('✅ Migration completed successfully.');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    process.exit();
  }
}

migrate();
