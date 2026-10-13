const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function deleteTestConference() {
  const args = process.argv.slice(2);
  const positionalArgs = args.filter(a => !a.startsWith('-'));
  const targetAcronym = positionalArgs[0] || 'MATSUSFtest';
  const force = args.includes('--force');

  console.log(`\n======================================================`);
  console.log(`🗑️  CLEANING UP TEST CONFERENCE`);
  console.log(`Target Acronym: ${targetAcronym}`);
  console.log(`======================================================\n`);

  // Safety check: must contain "test" or have --force flag to prevent accidental deletion of production conferences
  if (!targetAcronym.toLowerCase().includes('test') && !force) {
    console.error(`🛑 SAFETY ABORT: The acronym '${targetAcronym}' does not contain 'test'.`);
    console.error(`   To prevent accidental data loss of real conferences, this script only deletes`);
    console.error(`   conferences containing 'test' in their acronym, unless you pass '--force'.\n`);
    process.exit(1);
  }

  const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD ? process.env.DB_PASSWORD.replace(/\\(\$)/g, '$1') : process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 5,
  });

  const conn = await pool.getConnection();

  try {
    const [confs] = await conn.execute(
      'SELECT id, name, acronym FROM conferences WHERE acronym = ?',
      [targetAcronym]
    );

    if (confs.length === 0) {
      console.log(`ℹ️  No conference found with acronym '${targetAcronym}'. Nothing to delete.`);
      process.exit(0);
    }

    const conf = confs[0];
    console.log(`⚠️  Found target conference: "${conf.name}" (ID: ${conf.id})`);
    console.log(`   Preparing to delete all linked data in correct foreign-key order...\n`);

    await conn.beginTransaction();

    // 1. Find all registrations for this conference
    const [regs] = await conn.execute(
      'SELECT id FROM registrations WHERE conference_id = ?',
      [conf.id]
    );
    const regIds = regs.map(r => r.id);

    if (regIds.length > 0) {
      const placeholders = regIds.map(() => '?').join(', ');
      
      // Delete participant_qr_tokens
      const [tokRes] = await conn.execute(
        `DELETE FROM participant_qr_tokens WHERE registration_id IN (${placeholders})`,
        regIds
      );
      console.log(`   ✓ Deleted ${tokRes.affectedRows} participant QR tokens`);

      // Delete social_dinner_tickets
      const [socRes] = await conn.execute(
        `DELETE FROM social_dinner_tickets WHERE registration_id IN (${placeholders})`,
        regIds
      );
      console.log(`   ✓ Deleted ${socRes.affectedRows} social dinner tickets`);

      // Delete payments
      const [payRes] = await conn.execute(
        `DELETE FROM payments WHERE registration_id IN (${placeholders})`,
        regIds
      );
      console.log(`   ✓ Deleted ${payRes.affectedRows} payments`);

      // Delete registrations
      const [regRes] = await conn.execute(
        'DELETE FROM registrations WHERE conference_id = ?',
        [conf.id]
      );
      console.log(`   ✓ Deleted ${regRes.affectedRows} registrations`);
    }

    // 2. Program slots and sessions
    const [sess] = await conn.execute(
      'SELECT id FROM program_sessions WHERE conference_id = ?',
      [conf.id]
    );
    const sessIds = sess.map(s => s.id);
    if (sessIds.length > 0) {
      const sessPlaceholders = sessIds.map(() => '?').join(', ');
      await conn.execute(
        `DELETE FROM program_slots WHERE session_id IN (${sessPlaceholders})`,
        sessIds
      );
      const [sessRes] = await conn.execute(
        'DELETE FROM program_sessions WHERE conference_id = ?',
        [conf.id]
      );
      console.log(`   ✓ Deleted ${sessRes.affectedRows} program sessions`);
    }

    // 3. Delete posters
    const [posterRes] = await conn.execute(
      'DELETE FROM posters WHERE conference_id = ?',
      [conf.id]
    );
    console.log(`   ✓ Deleted ${posterRes.affectedRows} posters`);

    // 4. Delete clusters
    const [clusterRes] = await conn.execute(
      'DELETE FROM clusters WHERE conference_id = ?',
      [conf.id]
    );
    console.log(`   ✓ Deleted ${clusterRes.affectedRows} clusters`);

    // 5. Delete custom voting groups and custom votes if any
    try {
      await conn.execute('DELETE FROM custom_votes WHERE conference_id = ?', [conf.id]);
      await conn.execute('DELETE FROM custom_voting_groups WHERE conference_id = ?', [conf.id]);
    } catch (e) {
      // Table or column might not exist or differ
    }

    // 6. Delete topics, extra activities, global calendar if any
    try {
      await conn.execute('DELETE FROM topics WHERE conference_id = ?', [conf.id]);
    } catch (e) {}
    try {
      await conn.execute('DELETE FROM extra_activities WHERE conference_id = ?', [conf.id]);
    } catch (e) {}
    try {
      await conn.execute('DELETE FROM global_calendar WHERE conference_id = ?', [conf.id]);
    } catch (e) {}

    // 7. Finally delete the conference itself
    await conn.execute('DELETE FROM conferences WHERE id = ?', [conf.id]);
    console.log(`   ✓ Deleted conference record (ID: ${conf.id})\n`);

    await conn.commit();
    console.log(`🎉 SUCCESS! Conference '${targetAcronym}' and all associated test data were completely removed.\n`);

  } catch (error) {
    await conn.rollback();
    console.error('\n❌ Error deleting test conference:', error);
    process.exit(1);
  } finally {
    conn.release();
    await pool.end();
  }
}

deleteTestConference();
