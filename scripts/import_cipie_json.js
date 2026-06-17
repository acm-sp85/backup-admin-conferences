import fs from 'fs';
import path from 'path';
import { query } from '../src/lib/db.js';

const CONFERENCE_ID = 11;

const dateMap = {
    "Jueves 9 de Julio": "2026-07-09",
    "Viernes 10 de Julio": "2026-07-10",
    "Sábado 11 de Julio": "2026-07-11",
    "Presentaciones Online": "2026-07-12"
};

async function main() {
    try {
        console.log('Reading CIPIE.json from scratch folder...');
        const jsonPath = path.join(process.cwd(), 'scratch', 'CIPIE.json');
        const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

        console.log(`Clearing existing sessions for CIPIE26 (ID: ${CONFERENCE_ID})...`);
        await query('DELETE FROM program_sessions WHERE conference_id = ?', [CONFERENCE_ID]);

        let sessionsCount = 0;
        let slotsCount = 0;

        for (const daySchedule of data.days.schedule) {
            const dateStr = dateMap[daySchedule.day];
            if (!dateStr) {
                console.warn(`Unknown day: ${daySchedule.day}`);
                continue;
            }

            for (const sym of daySchedule.symposia) {
                // Parse time
                const [startStr, endStr] = (sym.time || "00:00 - 00:00").split('-').map(s => s.trim());
                const startTime = `${dateStr} ${startStr.length === 5 ? startStr + ':00' : (startStr || '00:00:00')}`;
                let endTime = `${dateStr} ${endStr ? (endStr.length === 5 ? endStr + ':00' : endStr) : (startStr.length === 5 ? startStr + ':00' : (startStr || '00:00:00'))}`;
                
                // Construct full_session_name
                let sessionName = sym.name ? sym.name : (sym.type || 'Session');
                
                // Prepend Room if it exists
                if (sym.room && sym.room !== 'General') {
                    // Extract just "SALA X" or similar if possible, or use full string
                    const roomPrefix = sym.room.split(':')[0]; // Gets "SALA 5" from "SALA 5: description"
                    sessionName = `[${roomPrefix}] ${sessionName}`;
                }

                if (sym.presenter) {
                    sessionName += ` (Chair: ${sym.presenter})`;
                }

                // Insert session
                const sessionRes = await query(`
                    INSERT INTO program_sessions (conference_id, session_name, full_session_name, start_time, end_time)
                    VALUES (?, ?, ?, ?, ?)
                `, [CONFERENCE_ID, sessionName.substring(0, 250), sessionName, startTime, endTime]);
                
                const sessionId = sessionRes.insertId;
                sessionsCount++;

                // Insert slots
                if (sym.talks && sym.talks.length > 0) {
                    for (const talk of sym.talks) {
                        let tStartStr = startStr;
                        let tEndStr = endStr;
                        
                        if (talk.time && talk.time.includes('-')) {
                            const parsed = talk.time.split('-').map(s => s.trim());
                            tStartStr = parsed[0] || tStartStr;
                            tEndStr = parsed[1] || tEndStr;
                        }

                        const tStartTime = `${dateStr} ${tStartStr.length === 5 ? tStartStr + ':00' : (tStartStr || '00:00:00')}`;
                        const tEndTime = `${dateStr} ${tEndStr ? (tEndStr.length === 5 ? tEndStr + ':00' : tEndStr) : (tStartStr.length === 5 ? tStartStr + ':00' : (tStartStr || '00:00:00'))}`;

                        await query(`
                            INSERT INTO program_slots (session_id, type, title, presenter_name, start_time, end_time)
                            VALUES (?, ?, ?, ?, ?, ?)
                        `, [sessionId, talk.type || sym.type, talk.title || '(No title)', talk.presenter || null, tStartTime, tEndTime]);
                        slotsCount++;
                    }
                }
            }
        }

        console.log(`Success! Inserted ${sessionsCount} sessions and ${slotsCount} slots.`);
        process.exit(0);
    } catch (error) {
        console.error('Error importing JSON:', error);
        process.exit(1);
    }
}

main();
