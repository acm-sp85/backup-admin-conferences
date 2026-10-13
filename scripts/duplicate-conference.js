const mysql = require('mysql2/promise');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

async function duplicateConference() {
  const args = process.argv.slice(2);
  const positionalArgs = args.filter(a => !a.startsWith('-'));
  const sourceAcronym = positionalArgs[0] || 'MATSUSFall26';
  const targetAcronym = positionalArgs[1] || 'MATSUSFtest';

  // Optional emails flag: --emails=alex@scito.org,team@scito.org
  const emailsArg = args.find(a => a.startsWith('--emails='));
  const testEmails = emailsArg 
    ? emailsArg.split('=')[1].split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
    : [];

  console.log(`\n======================================================`);
  console.log(`📋 DUPLICATING CONFERENCE FOR POSTER VOTING TEST`);
  console.log(`Source Conference: ${sourceAcronym}`);
  console.log(`Target Conference: ${targetAcronym}`);
  if (testEmails.length > 0) {
    console.log(`Test Voter Emails: ${testEmails.join(', ')}`);
  }
  console.log(`======================================================\n`);

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
    // 1. Fetch source conference
    const [sourceConfs] = await conn.execute(
      'SELECT * FROM conferences WHERE acronym = ?',
      [sourceAcronym]
    );

    if (sourceConfs.length === 0) {
      console.error(`❌ Source conference '${sourceAcronym}' not found in database.`);
      process.exit(1);
    }

    const source = sourceConfs[0];
    console.log(`✅ Found source conference: "${source.name}" (ID: ${source.id})`);

    // 2. Check if target acronym already exists
    const [existingTargets] = await conn.execute(
      'SELECT id, name FROM conferences WHERE acronym = ?',
      [targetAcronym]
    );

    if (existingTargets.length > 0) {
      console.error(`⚠️ Target conference '${targetAcronym}' already exists (ID: ${existingTargets[0].id}).`);
      console.error(`   If you want to recreate it, first run:`);
      console.error(`   node scripts/delete-test-conference.js ${targetAcronym}\n`);
      process.exit(1);
    }

    await conn.beginTransaction();

    // 3. Duplicate conference row
    const targetName = `${source.name} (TEST)`;
    const targetFullName = `${source.conference_full_name || source.name} (TEST)`;

    // Prepare conference copy
    const confFields = [
      'acronym', 'name', 'email', 'accent_color', 'logo_url', 'banner_url',
      'email_text', 'email_subject', 'how_to_get_there_url', 'voting_window_open',
      'door_sign_bg', 'door_sign_config', 'email_magic_link_body',
      'email_poster_voting_invite_body', 'email_social_dinner_tickets_body',
      'email_checkin_body', 'voting_validation_enabled', 'voting_instructions',
      'emails_enabled', 'badge_config', 'badge_bg', 'base_url',
      'custom_voting_instructions', 'email_custom_voting_invite_body',
      'email_certificate_body', 'sponsor_list', 'conference_address',
      'signature_image', 'text_under_signature', 'conference_full_name',
      'start_date', 'end_date', 'social_dinner_date', 'social_dinner_location',
      'social_dinner_time', 'social_dinner_timezone', 'social_dinner_maps_url',
      'registration_venue', 'registration_starts_at', 'registration_notes',
      'registration_maps_url', 'certificate_orientation', 'certificate_background_image',
      'email_from_domain', 'notes', 'book_of_abstracts_state'
    ];

    const confValues = confFields.map(field => {
      if (field === 'acronym') return targetAcronym;
      if (field === 'name') return targetName;
      if (field === 'conference_full_name') return targetFullName;
      // Pre-enable voting and communications for testing
      if (field === 'voting_window_open') return 1;
      if (field === 'emails_enabled') return 1;
      return source[field] !== undefined ? source[field] : null;
    });

    const placeholders = confFields.map(() => '?').join(', ');
    const insertConfSql = `INSERT INTO conferences (${confFields.join(', ')}) VALUES (${placeholders})`;
    
    const [confResult] = await conn.execute(insertConfSql, confValues);
    const targetConfId = confResult.insertId;
    console.log(`✅ Created test conference '${targetAcronym}' with ID: ${targetConfId}`);

    // 4. Duplicate clusters from source if any exist
    const [sourceClusters] = await conn.execute(
      'SELECT * FROM clusters WHERE conference_id = ? ORDER BY id ASC',
      [source.id]
    );

    const clusterIdMap = new Map();

    if (sourceClusters.length > 0) {
      console.log(`📦 Copying ${sourceClusters.length} clusters...`);
      for (const cl of sourceClusters) {
        const [clRes] = await conn.execute(
          'INSERT INTO clusters (conference_id, name, color) VALUES (?, ?, ?)',
          [targetConfId, cl.name, cl.color || '#007aff']
        );
        clusterIdMap.set(cl.id, clRes.insertId);
      }
    } else {
      // Auto-create 2 test clusters so the team has something ready right away
      console.log(`ℹ️  Source has no clusters. Creating 2 starter test clusters ("Cluster A - Energy", "Cluster B - Materials")...`);
      const [clA] = await conn.execute(
        'INSERT INTO clusters (conference_id, name, color) VALUES (?, ?, ?)',
        [targetConfId, 'Cluster A - Energy', '#007aff']
      );
      const [clB] = await conn.execute(
        'INSERT INTO clusters (conference_id, name, color) VALUES (?, ?, ?)',
        [targetConfId, 'Cluster B - Materials', '#34c759']
      );
      clusterIdMap.set('defaultA', clA.insertId);
      clusterIdMap.set('defaultB', clB.insertId);
    }

    // 5. Duplicate all posters
    const [sourcePosters] = await conn.execute(
      'SELECT * FROM posters WHERE conference_id = ? ORDER BY id ASC',
      [source.id]
    );

    console.log(`🖼️  Copying ${sourcePosters.length} posters from ${sourceAcronym}...`);
    let postersAssignedToA = 0;
    let postersAssignedToB = 0;

    for (let i = 0; i < sourcePosters.length; i++) {
      const p = sourcePosters[i];
      let assignedClusterId = null;

      if (p.cluster_id && clusterIdMap.has(p.cluster_id)) {
        assignedClusterId = clusterIdMap.get(p.cluster_id);
      } else if (clusterIdMap.has('defaultA') && clusterIdMap.has('defaultB')) {
        // Assign the first 5 posters to Cluster A, next 5 to Cluster B for quick testing
        if (i < 5) {
          assignedClusterId = clusterIdMap.get('defaultA');
          postersAssignedToA++;
        } else if (i < 10) {
          assignedClusterId = clusterIdMap.get('defaultB');
          postersAssignedToB++;
        }
      }

      await conn.execute(
        `INSERT INTO posters (conference_id, mongo_id, title, authors, content, toc, points, votes_received, code, cluster_id)
         VALUES (?, ?, ?, ?, ?, ?, 0, NULL, ?, ?)`,
        [
          targetConfId,
          p.mongo_id || `test-mongo-${i}`,
          p.title || 'Untitled Poster',
          typeof p.authors === 'object' ? JSON.stringify(p.authors) : (p.authors || '[]'),
          p.content || null,
          p.toc || null,
          p.code || null,
          assignedClusterId
        ]
      );
    }

    console.log(`✅ Successfully copied ${sourcePosters.length} posters with points reset to 0.`);
    if (postersAssignedToA > 0 || postersAssignedToB > 0) {
      console.log(`   - ${postersAssignedToA} posters pre-assigned to Cluster A`);
      console.log(`   - ${postersAssignedToB} posters pre-assigned to Cluster B`);
      console.log(`   - Remaining ${sourcePosters.length - postersAssignedToA - postersAssignedToB} posters available in cluster pool.`);
    }

    // 6. Duplicate program sessions & slots (needed for Custom / Oral Presentation Voting)
    const [sourceSessions] = await conn.execute(
      'SELECT * FROM program_sessions WHERE conference_id = ? ORDER BY id ASC',
      [source.id]
    );

    if (sourceSessions.length > 0) {
      console.log(`\n📅 Copying ${sourceSessions.length} program sessions for Custom Voting...`);
      const sessionIdMap = new Map();
      for (const s of sourceSessions) {
        const testMongoId = s.mongo_id ? `${s.mongo_id}-test` : null;
        const [sRes] = await conn.execute(
          `INSERT INTO program_sessions (conference_id, session_name, full_session_name, start_time, end_time, mongo_id, is_hidden, is_manual)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [targetConfId, s.session_name, s.full_session_name, s.start_time, s.end_time, testMongoId, s.is_hidden || 0, s.is_manual || 0]
        );
        sessionIdMap.set(s.id, sRes.insertId);
      }

      const [sourceSlots] = await conn.execute(
        'SELECT * FROM program_slots WHERE session_id IN (SELECT id FROM program_sessions WHERE conference_id = ?)',
        [source.id]
      );
      console.log(`🎤 Copying ${sourceSlots.length} program slots/presentations...`);
      for (const slot of sourceSlots) {
        const newSessionId = sessionIdMap.get(slot.session_id);
        if (!newSessionId) continue;
        const testSlotMongoId = slot.mongo_id ? `${slot.mongo_id}-test` : null;
        await conn.execute(
          `INSERT INTO program_slots (session_id, type, title, presenter_name, presenter_entity, presenter_country, start_time, end_time, mongo_id, authors, content, code, toc, is_manual, topic_mongo_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            newSessionId, slot.type, slot.title, slot.presenter_name, slot.presenter_entity, slot.presenter_country,
            slot.start_time, slot.end_time, testSlotMongoId,
            typeof slot.authors === 'object' ? JSON.stringify(slot.authors) : slot.authors,
            slot.content, slot.code, slot.toc,
            slot.is_manual || 0, slot.topic_mongo_id
          ]
        );
      }
      console.log(`✅ Program slots copied successfully.`);

      // Pre-create 1 sample Custom Voting Group for fast testing
      console.log(`⭐ Creating starter Custom Voting Group ("Best Oral Presentation Award")...`);
      const [cvgRes] = await conn.execute(
        'INSERT INTO custom_voting_groups (conference_id, name, color) VALUES (?, ?, ?)',
        [targetConfId, 'Best Oral Presentation Award', '#ff9500']
      );
      const newGroupId = cvgRes.insertId;

      const [sampleSlots] = await conn.execute(
        `SELECT id FROM program_slots 
         WHERE session_id IN (SELECT id FROM program_sessions WHERE conference_id = ?) 
         AND (type LIKE '%oral%' OR type LIKE '%talk%' OR type LIKE '%plenary%' OR type LIKE '%invited%') 
         LIMIT 3`,
        [targetConfId]
      );

      for (const ts of sampleSlots) {
        await conn.execute(
          'INSERT INTO custom_voting_items (group_id, slot_id) VALUES (?, ?)',
          [newGroupId, ts.id]
        );
      }
      console.log(`✅ Sample Custom Voting Group ready with ${sampleSlots.length} oral presentations.`);
    }

    // 7. Copy staff & office team members (@scito.org, @nanoge.org) from source conference
    console.log(`\n👥 Copying staff & office team participants (@scito.org, @nanoge.org)...`);
    const [teamParticipants] = await conn.execute(`
      SELECT p.id, p.firstName, p.lastName, p.email, p.email_alias
      FROM participants p
      JOIN registrations r ON p.id = r.participant_id
      WHERE r.conference_id = ?
        AND (p.email LIKE "%@scito.org" OR p.email LIKE "%@nanoge.org" OR p.email_alias LIKE "%@scito.org" OR p.email_alias LIKE "%@nanoge.org")
    `, [source.id]);

    for (const p of teamParticipants) {
      const [regRes] = await conn.execute(`
        INSERT INTO registrations (participant_id, conference_id, status, is_manual, has_voted, has_custom_voted)
        VALUES (?, ?, "Registered", 1, 0, 0)
      `, [p.id, targetConfId]);
      const regId = regRes.insertId;

      const token = crypto.randomBytes(24).toString("hex");
      await conn.execute(`
        INSERT INTO participant_qr_tokens (registration_id, token)
        VALUES (?, ?)
      `, [regId, token]);

      const [existingUser] = await conn.execute("SELECT id FROM users WHERE email = ?", [p.email]);
      if (!existingUser.length) {
        await conn.execute(`
          INSERT INTO users (email, role, firstName, lastName)
          VALUES (?, "user", ?, ?)
        `, [p.email, p.firstName, p.lastName]);
      }
      console.log(`   ✓ Copied team member: ${p.firstName} ${p.lastName} (${p.email})`);
    }
    console.log(`✅ ${teamParticipants.length} team members registered into '${targetAcronym}'.`);

    // 8. Register any additional requested test voter emails from CLI
    if (testEmails.length > 0) {
      console.log(`\n👥 Registering test voters...`);
      for (const email of testEmails) {
        // Look up or insert participant
        let [existingP] = await conn.execute(
          'SELECT id, firstName, lastName FROM participants WHERE email = ?',
          [email]
        );
        let pId;
        let pFirst = 'Tester';
        let pLast = email.split('@')[0];

        if (existingP.length > 0) {
          pId = existingP[0].id;
          pFirst = existingP[0].firstName || pFirst;
          pLast = existingP[0].lastName || pLast;
        } else {
          const [newP] = await conn.execute(
            `INSERT INTO participants (firstName, lastName, email, registration_type, is_manual)
             VALUES (?, ?, ?, 'Standard', 1)`,
            [pFirst, pLast, email]
          );
          pId = newP.insertId;
        }

        // Create registration for this conference
        const [newReg] = await conn.execute(
          `INSERT INTO registrations (participant_id, conference_id, status, is_manual)
           VALUES (?, ?, 'Registered', 1)`,
          [pId, targetConfId]
        );
        const regId = newReg.insertId;

        // Generate QR token
        const token = crypto.randomBytes(24).toString('hex');
        await conn.execute(
          'INSERT INTO participant_qr_tokens (registration_id, token) VALUES (?, ?)',
          [regId, token]
        );

        console.log(`   ✓ Registered ${email} (Participant ID: ${pId}, Reg ID: ${regId})`);
      }
    }

    await conn.commit();

    console.log(`\n🎉 SUCCESS! Test conference '${targetAcronym}' is ready!`);
    console.log(`------------------------------------------------------`);
    console.log(`• Acronym:              ${targetAcronym}`);
    console.log(`• Name:                 ${targetName}`);
    console.log(`• Conference ID:        ${targetConfId}`);
    console.log(`• Voting Window:        OPEN (1)`);
    console.log(`• Communications:       ENABLED (1)`);
    console.log(`• Total Posters:        ${sourcePosters.length}`);
    console.log(`------------------------------------------------------`);
    console.log(`Next steps:`);
    console.log(`1. In the Admin UI, go to Voting Management and select '${targetAcronym}'.`);
    console.log(`2. Assign voters to clusters and send invitation emails.`);
    console.log(`3. When done testing, delete cleanly with:`);
    console.log(`   node scripts/delete-test-conference.js ${targetAcronym}\n`);

  } catch (error) {
    await conn.rollback();
    console.error('\n❌ Error duplicating conference:', error);
    process.exit(1);
  } finally {
    conn.release();
    await pool.end();
  }
}

duplicateConference();
