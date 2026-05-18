'use server';

import { query } from '@/lib/db';
import { verifySession } from '@/lib/auth';

export async function getVoteDetails(posterId) {
    const session = await verifySession();
    if (!session) return { error: 'Unauthorized' };

    try {
        // 1. Get raw votes from poster cache
        const rows = await query('SELECT id, points, votes_received FROM posters WHERE id = ?', [posterId]);
        const poster = rows[0];
        let votes = {};
        
        // Log to a file we can definitely read
        const debugInfo = `Poster ${posterId} | Raw: ${JSON.stringify(poster?.votes_received)} | Type: ${typeof poster?.votes_received}`;
        await query('SELECT 1'); // Just to ensure connection is alive
        
        if (poster && poster.votes_received) {
            try {
                let raw = poster.votes_received;
                // Double-parse in case it's stored as a stringified JSON string
                if (typeof raw === 'string') {
                    votes = JSON.parse(raw);
                    if (typeof votes === 'string') votes = JSON.parse(votes);
                } else {
                    votes = raw;
                }
            } catch(e) {
                console.error(`[VOTE_DEBUG] JSON Error:`, e.message);
            }
        }

        // 2. DEEP SCAN FALLBACK: If cache is empty or sparse, scan registrations
        try {
            const allRegistrations = await query('SELECT participant_id, votes FROM registrations WHERE votes IS NOT NULL');
            allRegistrations.forEach(reg => {
                try {
                    const regVotes = typeof reg.votes === 'string' ? JSON.parse(reg.votes) : reg.votes;
                    const score = regVotes[posterId] || regVotes[String(posterId)];
                    if (score !== undefined) {
                        if (!votes[reg.participant_id] && !votes[String(reg.participant_id)]) {
                            votes[reg.participant_id] = { value: score, timestamp: null };
                        }
                    }
                } catch(e) {}
            });
        } catch (e) {
            console.warn('[VOTE_DEBUG] Registration scan failed:', e.message);
        }

        const userIds = Object.keys(votes).filter(id => id && id !== 'null' && id !== 'undefined');
        if (userIds.length === 0) {
            return { 
                success: true, 
                details: [], 
                debug: `No valid keys found in votes.` 
            };
        }

        // 3. Resolve Identities
        let identities = {};
        try {
            const placeholders = userIds.map(() => '?').join(',');
            const participants = await query(`SELECT id, firstName, lastName, email FROM participants WHERE id IN (${placeholders})`, userIds);
            const users = await query(`
                SELECT id, firstName, lastName, email, role 
                FROM users 
                WHERE id IN (${placeholders}) 
                   OR email IN (SELECT email FROM participants WHERE id IN (${placeholders}))
            `, [...userIds, ...userIds]);

            participants.forEach(p => {
                const name = `${p.firstName || ""} ${p.lastName || ""}`.trim() || p.email || `Participant ${p.id}`;
                identities[String(p.id)] = { id: p.id, name, email: p.email, type: "participant" };
            });

            users.forEach(u => {
                const name = `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email || `User ${u.id}`;
                // If this user matches an email of a participant we already found, 
                // we prefer the user identity but keep the ID mapping
                identities[String(u.id)] = { id: u.id, name, email: u.email, type: u.role || "voter" };
                
                // Also map by participant ID if they are linked by email
                const linkedParticipant = participants.find(p => p.email === u.email);
                if (linkedParticipant) {
                    identities[String(linkedParticipant.id)] = { id: linkedParticipant.id, name, email: u.email, type: u.role || "voter" };
                }
            });
        } catch (e) {
            console.warn('[VOTE_DEBUG] Identity resolution failed:', e.message);
        }

        // 4. Map and Format
        const details = userIds.map(uid => {
            const voteData = votes[uid];
            const value = typeof voteData === 'object' ? voteData.value : voteData;
            const timestamp = typeof voteData === 'object' ? voteData.timestamp : null;

            return {
                value,
                timestamp,
                voter: identities[String(uid)] || { id: uid, name: `Unknown (ID: ${uid})`, email: 'Email not found', type: 'unknown' }
            };
        }).sort((a, b) => {
            if (!a.timestamp) return 1;
            if (!b.timestamp) return -1;
            return new Date(b.timestamp) - new Date(a.timestamp);
        });

        return { success: true, details, count: userIds.length };
    } catch (error) {
        console.error('Get vote details error:', error);
        return { error: `Server Error: ${error.message}` };
    }
}
