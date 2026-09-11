const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const { MongoClient, ObjectId } = require('mongodb');
const mysql = require('mysql2/promise');

// ANSI Color codes for premium CLI output
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
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
${c.bold}${c.blue}Sync Check-Ins to MongoDB 'members' Collection${c.reset}
------------------------------------------------------
Reads local checked-in participants from MariaDB and marks them as "arrived" in the MongoDB "members" collection.

${c.bold}Usage:${c.reset}
  node scripts/sync-checkins-to-mongo.js [options]

${c.bold}Options:${c.reset}
  ${c.green}-d, --dry-run${c.reset}               Perform a read-only run. Matches records but does not write to MongoDB.
  ${c.green}-e, --event <ObjectId>${c.reset}    Specify MongoDB Event ID (overrides MONGO_EVENT_ID in .env.local).
  ${c.green}-h, --help${c.reset}                  Show this help message.

${c.bold}Configuration:${c.reset}
  The script automatically reads the Conference Acronym from the CLI and fetches Platform & Event ID from MariaDB.
  MongoDB URI:        ${c.gray}${process.env.MONGO_URI ? 'Defined' : 'Missing'}${c.reset}
  MariaDB Host:       ${c.gray}${process.env.DB_HOST || '127.0.0.1'}:${process.env.DB_PORT || 3306}${c.reset}
`);
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  const isDryRun = args.includes('--dry-run') || args.includes('-d');
  
  const positionalArgs = args.filter(a => !a.startsWith('-') && args[args.indexOf(a) - 1] !== '--event' && args[args.indexOf(a) - 1] !== '-e');
  const ACRONYM = positionalArgs[0];

  if (!ACRONYM) {
    console.error('❌ Error: Conference acronym is required (e.g., node scripts/sync-checkins-to-mongo.js MATSUSFall26)');
    process.exit(1);
  }

  let mongoClient;
  let mariadb;

  try {
    // 1. Establish Database Connections
    console.log(`📡 Connecting to MariaDB...`);
    mariadb = await mysql.createConnection(mariadbConfig);
    
    // Fetch dynamic config from MariaDB
    const [confRows] = await mariadb.execute('SELECT name, email_from_domain, mongo_id FROM conferences WHERE acronym = ?', [ACRONYM]);
    if (confRows.length === 0) {
      console.error(`❌ Error: Conference ${ACRONYM} not found in local database. Run sync-conference-info first.`);
      process.exit(1);
    }
    const confData = confRows[0];
    const PLATFORM = confData.email_from_domain === '@scitoevents.com' ? 'SCITO' : 'NANOGE';
    const isScito = PLATFORM === 'SCITO';
    const mongoDbName = isScito ? 'scito-prod' : (process.env.MONGO_DB_NAME || 'nanoge-production');
    
    // Parse event ID from arguments or fall back to DB
    let eventId = confData.mongo_id;
    const eventIdx = args.findIndex(a => a === '--event' || a === '-e');
    if (eventIdx !== -1 && args[eventIdx + 1]) {
      eventId = args[eventIdx + 1];
    }

    // MongoDB collection name is lowercase 'members' on both platforms
    const collectionName = "members";
    const mongoParticipantsView = `${ACRONYM} - Participants`;

    console.log(`\n${c.bold}${c.cyan}=== Check-in Sync Pipeline ===${c.reset}`);
    console.log(`${c.bold}Conference Acronym:${c.reset} ${c.yellow}${ACRONYM}${c.reset}`);
    console.log(`${c.bold}Platform:${c.reset}           ${c.yellow}${PLATFORM}${c.reset}`);
    console.log(`${c.bold}Target DB Name:${c.reset}     ${c.yellow}${mongoDbName}${c.reset}`);
    console.log(`${c.bold}Target Collection:${c.reset}  ${c.yellow}${collectionName}${c.reset}`);
    console.log(`${c.bold}Target Event ID:${c.reset}    ${eventId ? `${c.yellow}${eventId}${c.reset}` : `${c.red}Not Defined (Required for live writes)${c.reset}`}`);
    console.log(`${c.bold}Execution Mode:${c.reset}     ${isDryRun ? `${c.bold}${c.magenta}OFFLINE DRY-RUN (No Mongo Connection)${c.reset}` : `${c.bold}${c.red}LIVE-WRITE (Modifying MongoDB)${c.reset}`}`);
    console.log(`--------------------------------------------\n`);

    // If in live mode, ensure we have an event ID
    if (!eventId && !isDryRun) {
      console.error(`${c.red}❌ Error: Event ID is required. Please ensure mongo_id is in DB or pass --event <id>${c.reset}`);
      printHelp();
      process.exit(1);
    }

    if (isDryRun) {
      console.log(`${c.green}✅ MariaDB connected successfully! [MongoDB connection skipped for Dry-Run]${c.reset}\n`);
    } else {
      const MONGO_URI = process.env.MONGO_URI;
      if (!MONGO_URI) {
        console.error(`${c.red}❌ Error: MONGO_URI is missing from .env.local${c.reset}`);
        process.exit(1);
      }
      console.log(`📡 Connecting to MongoDB (Live Mode)...`);
      mongoClient = new MongoClient(MONGO_URI);
      await mongoClient.connect();
      console.log(`${c.green}✅ Both databases connected successfully!${c.reset}\n`);
    }

    // 2. Fetch Checked-in participants from MariaDB
    console.log(`🔍 Querying MariaDB for checked-in participants of ${c.yellow}${ACRONYM}${c.reset}...`);
    const [checkedInRows] = await mariadb.execute(`
      SELECT 
        p.email, 
        p.firstName, 
        p.lastName, 
        t.scanned_at,
        t.is_manual
      FROM participant_qr_tokens t
      JOIN registrations r ON t.registration_id = r.id
      JOIN participants p ON r.participant_id = p.id
      JOIN conferences c ON r.conference_id = c.id
      WHERE c.acronym = ? AND t.scanned_at IS NOT NULL
    `, [ACRONYM]);

    const totalCheckins = checkedInRows.length;
    console.log(`📊 Found ${c.bold}${totalCheckins}${c.reset} checked-in participants in local database.`);

    if (totalCheckins === 0) {
      console.log(`${c.yellow}⚠️ No local check-in records found. Exiting...${c.reset}`);
      return;
    }

    console.log(`\n⏳ Processing & Synchronizing...\n`);

    let updatedCount = 0;
    let upToDateCount = 0;
    let notFoundCount = 0;
    const notFoundEmails = [];

    // 3. Process each record
    if (isDryRun) {
      // In dry-run mode, we just log what we WOULD write without connecting to MongoDB at all!
      for (let i = 0; i < checkedInRows.length; i++) {
        const row = checkedInRows[i];
        const email = row.email.trim().toLowerCase();
        const fullName = `${row.firstName || ''} ${row.lastName || ''}`.trim() || 'Unknown';
        const scannedAtDate = new Date(row.scanned_at);
        const displayTime = scannedAtDate.toISOString();

        updatedCount++;
        console.log(` ${c.gray}[${i + 1}/${totalCheckins}]${c.reset} ${c.magenta}⚙ Would Update Mongo (${collectionName}):${c.reset} ${c.bold}${fullName}${c.reset} ${c.gray}<${email}>${c.reset}`);
        console.log(`     ${c.gray}➜ Query:${c.reset} db.collection("${collectionName}").updateOne({ _id: ObjectId("<resolved_member_id>") }, { $set: { arrived: { "$date": "${displayTime}" } } })`);
      }
    } else {
      // Live-Write Mode: Connects and updates MongoDB 'members' collection
      let parsedEventId;
      try {
        parsedEventId = new ObjectId(eventId);
      } catch (e) {
        console.error(`${c.red}❌ Error: Invalid MongoDB ObjectId format for Event ID "${eventId}".${c.reset}`);
        process.exit(1);
      }

      const mongoDb = mongoClient.db(mongoDbName);

      for (let i = 0; i < checkedInRows.length; i++) {
        const row = checkedInRows[i];
        const email = row.email.trim().toLowerCase();
        const fullName = `${row.firstName || ''} ${row.lastName || ''}`.trim() || 'Unknown';
        const scannedAtDate = new Date(row.scanned_at);

        // Find in MongoDB participant view first to resolve the unique member _id
        const participantViewDoc = await mongoDb.collection(mongoParticipantsView).findOne({
          $or: [
            { user_email: email },
            { email: email },
            { "user.email": email }
          ]
        });

        if (!participantViewDoc) {
          notFoundCount++;
          notFoundEmails.push(`${fullName} (${row.email})`);
          console.log(` ${c.gray}[${i + 1}/${totalCheckins}]${c.reset} ${c.red}✖ Not Found in MongoDB (view: ${mongoParticipantsView}):${c.reset} ${fullName} ${c.gray}<${row.email}>${c.reset}`);
          continue;
        }

        // Fetch the corresponding raw member document to check current check-in status
        const mongoUser = await mongoDb.collection(collectionName).findOne({
          _id: participantViewDoc._id
        });

        if (!mongoUser) {
          notFoundCount++;
          notFoundEmails.push(`${fullName} (${row.email})`);
          console.log(` ${c.gray}[${i + 1}/${totalCheckins}]${c.reset} ${c.red}✖ Member ID Not Found in '${collectionName}' collection:${c.reset} ${fullName} ${c.gray}<${row.email}>${c.reset}`);
          continue;
        }

        // Check if arrived is already set and matching
        let alreadySet = false;
        if (mongoUser.arrived) {
          const mongoTime = new Date(mongoUser.arrived).getTime();
          const localTime = scannedAtDate.getTime();
          
          // If they are within 5 seconds of each other, consider them identical
          if (Math.abs(mongoTime - localTime) < 5000) {
            alreadySet = true;
          }
        }

        if (alreadySet) {
          upToDateCount++;
          console.log(` ${c.gray}[${i + 1}/${totalCheckins}]${c.reset} ${c.blue}➖ Already Marked:${c.reset} ${c.bold}${fullName}${c.reset} ${c.gray}(arrived: ${new Date(mongoUser.arrived).toISOString()})${c.reset}`);
        } else {
          updatedCount++;
          const displayTime = scannedAtDate.toISOString();
          // Perform the actual MongoDB write to 'members'
          await mongoDb.collection(collectionName).updateOne(
            { _id: mongoUser._id },
            { $set: { arrived: scannedAtDate } }
          );
          console.log(` ${c.gray}[${i + 1}/${totalCheckins}]${c.reset} ${c.green}✔ Updated MongoDB (${collectionName}):${c.reset} ${c.bold}${fullName}${c.reset} ${c.gray}<${email}>${c.reset} ➜ arrived: ${c.yellow}${displayTime}${c.reset}`);
        }
      }
    }

    // 4. Print Summary Report
    console.log(`\n${c.bold}${c.cyan}================ SUMMARY REPORT ================${c.reset}`);
    console.log(`${c.bold}Status:${c.reset}             ${isDryRun ? `${c.magenta}Offline Dry Run Complete (No Mongo Writes)${c.reset}` : `${c.green}Sync Completed Successfully${c.reset}`}`);
    console.log(`${c.bold}Total Checked-in:${c.reset}    ${totalCheckins}`);
    
    if (isDryRun) {
      console.log(`${c.bold}Would Update:${c.reset}        ${c.magenta}${updatedCount}${c.reset}`);
      console.log(`${c.bold}MongoDB Status:${c.reset}      ${c.gray}Read-only skip (no network requests made)${c.reset}`);
    } else {
      console.log(`${c.bold}Already Up-To-Date:${c.reset}  ${c.blue}${upToDateCount}${c.reset}`);
      console.log(`${c.bold}Updated in MongoDB:${c.reset}  ${c.green}${updatedCount}${c.reset}`);
      console.log(`${c.bold}Not Found in Mongo:${c.reset}  ${notFoundCount > 0 ? `${c.red}${notFoundCount}${c.reset}` : `0`}`);
      
      if (notFoundCount > 0) {
        console.log(`\n${c.bold}${c.yellow}⚠️ Warning: The following participants checked in locally, but do not exist in MongoDB:${c.reset}`);
        notFoundEmails.forEach(item => console.log(" - " + c.red + item + c.reset));
      }
    }
    
    console.log(`${c.bold}${c.cyan}================================================${c.reset}\n`);

  } catch (error) {
    console.error(`\n${c.red}❌ Sync Pipeline Failed:${c.reset}`, error);
  } finally {
    // 5. Close database sessions
    if (mongoClient) {
      await mongoClient.close();
    }
    if (mariadb) {
      await mariadb.end();
    }
    console.log(`📡 Database connections closed. Graceful exit.`);
  }
}

main();
