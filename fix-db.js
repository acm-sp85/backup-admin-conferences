require('dotenv').config({ path: '.env.local' });
const { query } = require('./src/lib/db.js');
async function run() {
  try {
    await query("UPDATE conferences SET email_certificate_body = NULL");
    console.log("Success! Reset email_certificate_body to NULL for all conferences.");
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
run();
