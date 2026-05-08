// scripts/migrate-add-conference-email-body-columns.js

// Run with: node scripts/migrate-add-conference-email-body-columns.js

import { query } from '../src/lib/db.js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function migrate() {
  console.log('Adding email body columns to conferences table...');
  try {
    await query(`
      ALTER TABLE conferences
        ADD COLUMN email_magic_link_body TEXT NULL,
        ADD COLUMN email_poster_voting_invite_body TEXT NULL,
        ADD COLUMN email_social_dinner_tickets_body TEXT NULL;
    `);
    console.log('✅ Migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
