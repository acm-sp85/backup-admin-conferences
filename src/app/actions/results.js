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

        const userIds = Object.keys(votes);
        if (userIds.length === 0) {
            return { 
                success: true, 
                details: [], 
                debug: `No keys found in votes. Raw content was: ${JSON.stringify(poster?.votes_received)}` 
            };
        }

        // 3. Resolve Identities
        let identities = {};
        try {
            // Fetch raw columns and combine in JS for maximum compatibility
            const participants = await query('SELECT id, firstName, lastName, email FROM participants WHERE id IN (?)', [userIds]);
            const admins = await query('SELECT id, firstName, lastName, email, role FROM users WHERE id IN (?)', [userIds]);

            console.log(`[VOTE_DEBUG] Found ${participants.length} participants and ${admins.length} admins`);

            participants.forEach(p => {
                const name = `${p.firstName || ""} ${p.lastName || ""}`.trim() || p.email || "Unnamed Participant";
                identities[p.id] = { ...p, name, type: "participant" };
                identities[String(p.id)] = { ...p, name, type: "participant" };
            });

            admins.forEach(a => {
                const name = `${a.firstName || ""} ${a.lastName || ""}`.trim() || a.email || "Unnamed Admin";
                identities[a.id] = { ...a, name, type: "admin" };
                identities[String(a.id)] = { ...a, name, type: "admin" };
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
                voter: identities[uid] || { name: `Unknown Voter (ID: ${uid})`, email: 'N/A', type: 'unknown' }
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
