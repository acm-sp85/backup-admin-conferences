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

function getTimeBlock(timeStr) {
    if (!timeStr) return 'Tarde';
    const startStr = timeStr.split('-')[0].trim();
    if (!startStr) return 'Tarde';
    
    const parts = startStr.split(':');
    const hour = parseInt(parts[0], 10);
    const minute = parseInt(parts[1] || '0', 10);
    
    if (isNaN(hour)) return 'Tarde';
    
    const timeVal = hour + minute / 60;
    
    if (timeVal < 11.5) return 'Mañana';
    if (timeVal < 14) return 'Mediodía';
    return 'Tarde';
}

function parseTime(timeStr, defaultTime) {
    const startStr = timeStr.split('-')[0].trim();
    if (!startStr) return defaultTime;
    return startStr.length === 5 ? startStr + ':00' : startStr;
}

function parseEndTime(timeStr, defaultTime) {
    const parts = timeStr.split('-');
    if (parts.length < 2) return defaultTime;
    const endStr = parts[1].trim();
    if (!endStr) return defaultTime;
    return endStr.length === 5 ? endStr + ':00' : endStr;
}

function getTimeMs(timeStr) {
    const parts = timeStr.split(':');
    if(parts.length < 2) return 0;
    return (parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10)) * 60 * 1000;
}

function formatTimeMs(ms) {
    const totalMins = Math.floor(ms / (60 * 1000));
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:00`;
}

function translateType(type) {
    if (!type) return '';
    const t = type.toLowerCase();
    if (t.includes('symposium')) return 'Simposio';
    if (t.includes('oral')) return 'Oral';
    if (t.includes('talk') || t.includes('comunicación')) return 'Comunicación Asociada';
    if (t.includes('workshop')) return 'Taller';
    if (t.includes('break')) return '';
    return type;
}

async function main() {
    try {
        console.log('Reading CIPIE.json from scratch folder...');
        const jsonPath = path.join(process.cwd(), 'scratch', 'CIPIE.json');
        const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

        console.log(`[SAFE] Clearing existing sessions ONLY for CIPIE26 (ID: ${CONFERENCE_ID})...`);
        await query('DELETE FROM program_sessions WHERE conference_id = ?', [CONFERENCE_ID]);
        
        let sessionsCount = 0;
        let slotsCount = 0;

        for (const daySchedule of data.days.schedule) {
            const dateStr = dateMap[daySchedule.day];
            if (!dateStr) continue;

            const groups = {};

            for (const sym of daySchedule.symposia) {
                const roomStr = sym.room ? sym.room.split(':')[0].trim() : 'General';
                const timeBlock = getTimeBlock(sym.time);
                
                if (!groups[roomStr]) groups[roomStr] = {};
                if (!groups[roomStr][timeBlock]) groups[roomStr][timeBlock] = [];
                
                groups[roomStr][timeBlock].push(sym);
            }

            const roomDescriptions = {
                "SALA 1": "SALA 1: Innovación y Emprendimiento en Psicología mediante tecnología y análisis de datos. Psicología de la Intervención en redes sociales, análisis de datos e IA",
                "SALA 2": "SALA 2: Psicología Clínica y de la Salud",
                "SALA 3": "SALA 3: Psicología de la Educación",
                "SALA 4": "SALA 4: Psicología del Trabajo y de las Organizaciones. Psicología Social. Psicología Deportiva",
                "SALA 5": "SALA 5: Psicología Jurídica. Psicología de la Mediación. Psicología del Tráfico y Seguridad Vial",
                "SALA 6": "SALA 6: Neuropsicología. Psicología del Envejecimiento. Psicología de los Cuidados paliativos y Psicooncología. Psicología de las Emergencias y de la Cooperación. Psicología de la Igualdad y la Diversidad"
            };

            for (const room in groups) {
                for (const block in groups[room]) {
                    const symposiaList = groups[room][block];
                    
                    const sessionName = roomDescriptions[room] || room;
                    
                    let minStartTime = '23:59:59';
                    let maxEndTime = '00:00:00';
                    
                    for (const sym of symposiaList) {
                        const sTime = parseTime(sym.time || '', '12:00:00');
                        const eTime = parseEndTime(sym.time || '', '13:00:00');
                        if (sTime < minStartTime) minStartTime = sTime;
                        if (eTime > maxEndTime) maxEndTime = eTime;
                    }
                    
                    if (minStartTime === '23:59:59') minStartTime = '08:00:00'; 
                    if (maxEndTime === '00:00:00') maxEndTime = '20:00:00'; 

                    const fullStartTime = `${dateStr} ${minStartTime}`;
                    const fullEndTime = `${dateStr} ${maxEndTime}`;

                    const sessionRes = await query(`
                        INSERT INTO program_sessions (conference_id, session_name, full_session_name, start_time, end_time)
                        VALUES (?, ?, ?, ?, ?)
                    `, [CONFERENCE_ID, sessionName.substring(0, 250), sessionName, fullStartTime, fullEndTime]);
                    
                    const sessionId = sessionRes.insertId;
                    sessionsCount++;

                    for (const sym of symposiaList) {
                        const sStr = parseTime(sym.time || '', minStartTime);
                        const eStr = parseEndTime(sym.time || '', maxEndTime);
                        
                        const symStartTime = `${dateStr} ${sStr}`;
                        const symEndTime = `${dateStr} ${eStr}`;

                        // Intelligent deduplication: if there is exactly 1 talk, merge it into the top-level slot
                        if (sym.talks && sym.talks.length === 1) {
                            const talk = sym.talks[0];
                            const rawTitle = talk.title || sym.name || sym.type || 'Presentación';
                            const finalTitle = `\u2022 ${rawTitle}`;
                            const presenter = talk.presenter || sym.presenter || null;
                            const type = talk.type || sym.type || 'Talk';

                            let talkStartTime = symStartTime;
                            let talkEndTime = symEndTime;
                            if (talk.time && talk.time.includes('-')) {
                                talkStartTime = `${dateStr} ${parseTime(talk.time, sStr)}`;
                                talkEndTime = `${dateStr} ${parseEndTime(talk.time, eStr)}`;
                            }

                            await query(`
                                INSERT INTO program_slots (session_id, type, title, presenter_name, start_time, end_time)
                                VALUES (?, ?, ?, ?, ?, ?)
                            `, [sessionId, translateType(type), finalTitle, presenter, talkStartTime, talkEndTime]);
                            slotsCount++;
                        } else {
                            // Normal behavior: Insert Symposium Header, then insert multiple talks
                            const rawSymTitle = sym.name || sym.type || 'Symposium';
                            const symTitle = `\u2022 ${rawSymTitle}`;

                            await query(`
                                INSERT INTO program_slots (session_id, type, title, presenter_name, start_time, end_time)
                                VALUES (?, ?, ?, ?, ?, ?)
                            `, [sessionId, translateType(sym.type || 'Symposium'), symTitle, sym.presenter || null, symStartTime, symEndTime]);
                            slotsCount++;

                            if (sym.talks && sym.talks.length > 1) {
                                const sMs = getTimeMs(sStr);
                                const eMs = getTimeMs(eStr);
                                let durationMs = eMs - sMs;
                                if (durationMs <= 0) durationMs = 60 * 60 * 1000;
                                
                                const talkDurationMs = Math.floor(durationMs / sym.talks.length);

                                for (let i = 0; i < sym.talks.length; i++) {
                                    const talk = sym.talks[i];
                                    
                                    let talkStartTime, talkEndTime;
                                    
                                    if (talk.time && talk.time.includes('-')) {
                                        talkStartTime = `${dateStr} ${parseTime(talk.time, sStr)}`;
                                        talkEndTime = `${dateStr} ${parseEndTime(talk.time, eStr)}`;
                                    } else {
                                        const tStartMs = sMs + i * talkDurationMs;
                                        const tEndMs = sMs + (i + 1) * talkDurationMs;
                                        talkStartTime = `${dateStr} ${formatTimeMs(tStartMs)}`;
                                        talkEndTime = `${dateStr} ${formatTimeMs(tEndMs)}`;
                                    }

                                    const talkTitle = `\u00A0\u00A0\u00A0\u00A0\u21B3 ${talk.title || '(No title)'}`;

                                    await query(`
                                        INSERT INTO program_slots (session_id, type, title, presenter_name, start_time, end_time)
                                        VALUES (?, ?, ?, ?, ?, ?)
                                    `, [sessionId, translateType(talk.type || 'Talk'), talkTitle, talk.presenter || null, talkStartTime, talkEndTime]);
                                    slotsCount++;
                                }
                            }
                        }
                    }
                }
            }
        }

        console.log(`Success! Inserted ${sessionsCount} grouped sessions and ${slotsCount} slots.`);
        process.exit(0);
    } catch (error) {
        console.error('Error importing JSON:', error);
        process.exit(1);
    }
}

main();
