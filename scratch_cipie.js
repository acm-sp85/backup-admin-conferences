const { query } = require('./src/lib/db.js');
const fs = require('fs');

async function main() {
    try {
        const results = await query("SELECT name, email_certificate_body FROM conferences WHERE name LIKE '%CIPIE%' OR acronym LIKE '%CIPIE%' LIMIT 5;");
        fs.writeFileSync('cipie_db_out.json', JSON.stringify(results, null, 2));
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

main();
