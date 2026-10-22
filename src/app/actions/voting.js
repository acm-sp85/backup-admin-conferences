'use server';

import { query, getConnection } from '@/lib/db';
import { verifySession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export async function submitVotes(userId, newVotes, isParticipant = false, conferenceId = null) {
    if (!isParticipant) {
        const session = await verifySession();
        if (!session || session.id !== userId) {
            return { error: 'Unauthorized' };
        }
    }

    try {
        // 1. Identify which table and record to update
        let currentVotes = {};
        let participantEmail = null;
        let voterKey = userId;

        if (isParticipant) {
            if (!conferenceId) return { error: 'Conference ID required for participants' };
            const [reg] = await query(`
                SELECT r.votes, p.email 
                FROM registrations r 
                JOIN participants p ON r.participant_id = p.id 
                WHERE r.participant_id = ? AND r.conference_id = ?
            `, [userId, conferenceId]);
            if (!reg) return { error: 'Registration not found' };
            participantEmail = reg.email;
            try {
                currentVotes = typeof reg.votes === 'string' ? JSON.parse(reg.votes) : (reg.votes || {});
            } catch (e) { currentVotes = {}; }

            if (participantEmail) {
                const [usr] = await query('SELECT id FROM users WHERE email = ?', [participantEmail]);
                if (usr) voterKey = usr.id;
            }
        } else {
            const [user] = await query('SELECT id, email, votes FROM users WHERE id = ?', [userId]);
            if (!user) return { error: 'User not found' };
            participantEmail = user.email;
            try {
                currentVotes = typeof user.votes === 'string' ? JSON.parse(user.votes) : (user.votes || {});
            } catch (e) { currentVotes = {}; }
            voterKey = user.id;
        }

        const combinedVotes = { ...currentVotes, ...newVotes };

        // 2. Update the appropriate table(s)
        if (isParticipant) {
            await query(
                'UPDATE registrations SET votes = ?, has_voted = 1 WHERE participant_id = ? AND conference_id = ?',
                [JSON.stringify(combinedVotes), userId, conferenceId]
            );
            if (participantEmail) {
                await query(
                    'UPDATE users SET votes = ?, has_voted = 1 WHERE email = ?',
                    [JSON.stringify(combinedVotes), participantEmail]
                );
            }
        } else {
            await query(
                'UPDATE users SET votes = ?, has_voted = 1 WHERE id = ?',
                [JSON.stringify(combinedVotes), userId]
            );
            if (participantEmail) {
                if (conferenceId) {
                    await query(`
                        UPDATE registrations r 
                        JOIN participants p ON r.participant_id = p.id 
                        SET r.votes = ?, r.has_voted = 1 
                        WHERE p.email = ? AND r.conference_id = ?
                    `, [JSON.stringify(combinedVotes), participantEmail, conferenceId]);
                } else {
                    await query(`
                        UPDATE registrations r 
                        JOIN participants p ON r.participant_id = p.id 
                        SET r.votes = ?, r.has_voted = 1 
                        WHERE p.email = ?
                    `, [JSON.stringify(combinedVotes), participantEmail]);
                }
            }
        }

        // 3. Update each poster's votes_received and points within a transaction
        // to handle concurrent votes without overwriting each other.
        const pool = await getConnection();
        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

            // Sort poster IDs to prevent deadlocks when locking multiple rows
            const sortedPosterIds = Object.keys(newVotes).sort((a, b) => String(a).localeCompare(String(b)));

            for (const posterId of sortedPosterIds) {
                const score = Number(newVotes[posterId]);
                if (isNaN(score) || score < 1 || score > 10) continue;
                
                // Use FOR UPDATE to lock the row for the duration of the transaction
                const [rows] = await connection.execute(
                    'SELECT votes_received, points FROM posters WHERE id = ? FOR UPDATE', 
                    [posterId]
                );
                const poster = rows[0];
                
                if (poster) {
                    let votesReceived = {};
                    try {
                        votesReceived = typeof poster.votes_received === 'string' 
                            ? JSON.parse(poster.votes_received) 
                            : (poster.votes_received || {});
                    } catch (e) { votesReceived = {}; }
                    
                    // Accurately read old score from voterKey or legacy userId
                    const oldScore = Number(votesReceived[voterKey] ?? votesReceived[userId] ?? 0) || 0;
                    const currentPoints = Number(poster.points) || 0;
                    // Safely recalculate points: subtract old score, add new score
                    const newPoints = Math.max(0, (currentPoints - oldScore) + score);
                    
                    // Update votes mapping
                    votesReceived[voterKey] = score;
                    if (voterKey !== userId && votesReceived[userId] !== undefined) {
                        delete votesReceived[userId];
                    }

                    await connection.execute(
                        'UPDATE posters SET votes_received = ?, points = ? WHERE id = ?',
                        [JSON.stringify(votesReceived), newPoints, posterId]
                    );
                }
            }

            await connection.commit();
        } catch (txnError) {
            await connection.rollback();
            throw txnError;
        } finally {
            connection.release();
        }

        revalidatePath('/voting');
        revalidatePath('/posters');
        return { success: true };
    } catch (error) {
        console.error('Submit votes error:', error);
        return { error: 'Failed to submit votes' };
    }
}
