const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const { MongoClient } = require('mongodb');
const mysql = require('mysql2/promise');

// ANSI Color codes for premium CLI output
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
  gray: "\x1b[90m"
};

const mariadbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD ? process.env.DB_PASSWORD.replace(/\\(\$)/g, '$1') : process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
};

function printHelp() {
  console.log(`
${c.bold}${c.cyan}Sync Conference Info from MongoDB${c.reset}
------------------------------------------------------
Reads conference details from the "All-Conferences" view in MongoDB and populates the local MariaDB 'conferences' table.

${c.bold}Usage:${c.reset}
  npm run sync-conference-info <ACRONYM>

${c.bold}Example:${c.reset}
  npm run sync-conference-info EMLEM26
  `);
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  const acronym = args[0];
  if (!acronym) {
    console.error(`${c.red}❌ Error: Conference acronym is required.${c.reset}`);
    printHelp();
    process.exit(1);
  }

  console.log(`\n${c.bold}${c.cyan}=== Conference Info Sync ===${c.reset}`);
  console.log(`${c.bold}Acronym:${c.reset} ${c.yellow}${acronym}${c.reset}`);
  
  let mariadb, mongoClient;

  try {
    // 1. Connect to MariaDB
    console.log(`\n📡 Connecting to MariaDB...`);
    mariadb = await mysql.createConnection(mariadbConfig);
    
    // Check if conference exists in MariaDB
    const [rows] = await mariadb.execute('SELECT id, name FROM conferences WHERE acronym = ?', [acronym]);
    
    if (rows.length === 0) {
      console.error(`${c.red}❌ Error: Conference '${acronym}' not found in local MariaDB database.${c.reset}`);
      console.log(`${c.gray}The script requires the conference to be created locally first (e.g., via the Admin UI).${c.reset}`);
      process.exit(1); // Exit if not found
    }
    
    const confId = rows[0].id;
    console.log(`${c.green}✓ Found local conference (ID: ${confId})${c.reset}`);

    // 2. Connect to MongoDB
    console.log(`\n📡 Connecting to MongoDB...`);
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is missing in .env.local");
    }

    mongoClient = new MongoClient(process.env.MONGO_URI);
    await mongoClient.connect();
    
    console.log(`🔍 Searching for '${acronym}' in nanoge-production (view: All-Conferences)...`);
    const dbNanoge = mongoClient.db('nanoge-production');
    const colNanoge = dbNanoge.collection('All-Conferences');
    let mongoData = await colNanoge.findOne({ acronym: acronym });
    let sourceDB = 'nanoge';
    
    if (!mongoData) {
      console.log(`🔍 Searching for '${acronym}' in scito-prod (view: All-Events-ScitoEvents)...`);
      const dbScito = mongoClient.db('scito-prod');
      const colScito = dbScito.collection('All-Events-ScitoEvents');
      mongoData = await colScito.findOne({ acronym: acronym });
      sourceDB = 'scito';
    }
    
    if (!mongoData) {
      console.error(`${c.red}❌ Error: Conference '${acronym}' not found in MongoDB view 'All-Conferences'.${c.reset}`);
      process.exit(1);
    }
    
    console.log(`${c.green}✓ Found conference data in MongoDB!${c.reset}`);
    
    // 3. Map Data & Update MariaDB
    const updateFields = [];
    const updateValues = [];
    
    if (mongoData.name) {
      updateFields.push('name = ?');
      updateFields.push('conference_full_name = ?');
      updateValues.push(mongoData.name, mongoData.name);
    }
    if (mongoData.email) {
      updateFields.push('email = ?');
      updateValues.push(mongoData.email);
    }
    if (mongoData.featuredcolor) {
      updateFields.push('accent_color = ?');
      updateValues.push(mongoData.featuredcolor);
    }
    if (mongoData.start && mongoData.start) {
        // Handle native date object or date string
        const startDate = new Date(mongoData.start);
        if (!isNaN(startDate)) {
            updateFields.push('start_date = ?');
            updateValues.push(startDate.toISOString().split('T')[0]);
        }
    }
    if (mongoData.end && mongoData.end) {
        const endDate = new Date(mongoData.end);
        if (!isNaN(endDate)) {
            updateFields.push('end_date = ?');
            updateValues.push(endDate.toISOString().split('T')[0]);
        }
    }

    const baseUrl = sourceDB === 'nanoge' 
        ? 'https://www.nanoge.org/static/events/' 
        : 'https://app.scitoevents.com/static/events/';

    if (mongoData.image) {
        updateFields.push('banner_url = ?');
        updateValues.push(baseUrl + mongoData.image);
    }
    
    if (mongoData.featuredimage) {
        updateFields.push('logo_url = ?');
        updateValues.push(baseUrl + mongoData.featuredimage);
    }

    updateFields.push('email_from_domain = ?');
    updateValues.push(sourceDB === 'nanoge' ? '@nanoge.org' : '@scitoevents.com');
    
    if (updateFields.length > 0) {
      updateValues.push(acronym); // for the WHERE clause
      const query = `UPDATE conferences SET ${updateFields.join(', ')} WHERE acronym = ?`;
      
      console.log(`\n💾 Updating MariaDB...`);
      await mariadb.execute(query, updateValues);
      
      console.log(`${c.green}✨ Successfully synced conference info for ${acronym}!${c.reset}`);
      console.log(`Updated fields: ${c.gray}${updateFields.map(f => f.replace(' = ?', '')).join(', ')}${c.reset}`);
    } else {
      console.log(`${c.yellow}⚠️ No relevant fields found in MongoDB data to update.${c.reset}`);
    }

  } catch (error) {
    console.error(`\n${c.red}💥 Sync failed:${c.reset}`, error.message);
  } finally {
    if (mariadb) await mariadb.end();
    if (mongoClient) await mongoClient.close();
    console.log(`\n${c.gray}Connections closed.${c.reset}\n`);
  }
}

main();
