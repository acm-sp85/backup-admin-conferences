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
        if (isParticipant) {
            if (!conferenceId) return { error: 'Conference ID required for participants' };
            const [reg] = await query('SELECT votes FROM registrations WHERE participant_id = ? AND conference_id = ?', [userId, conferenceId]);
            if (!reg) return { error: 'Registration not found' };
            try {
                currentVotes = typeof reg.votes === 'string' ? JSON.parse(reg.votes) : (reg.votes || {});
            } catch (e) { currentVotes = {}; }
        } else {
            const [user] = await query('SELECT votes FROM users WHERE id = ?', [userId]);
            if (!user) return { error: 'User not found' };
            try {
                currentVotes = typeof user.votes === 'string' ? JSON.parse(user.votes) : (user.votes || {});
            } catch (e) { currentVotes = {}; }
        }

        const combinedVotes = { ...currentVotes, ...newVotes };

        // 2. Update the appropriate table
        if (isParticipant) {
            await query(
                'UPDATE registrations SET votes = ?, has_voted = 1 WHERE participant_id = ? AND conference_id = ?',
                [JSON.stringify(combinedVotes), userId, conferenceId]
            );
        } else {
            await query(
                'UPDATE users SET votes = ?, has_voted = 1 WHERE id = ?',
                [JSON.stringify(combinedVotes), userId]
            );
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
                const score = newVotes[posterId];
                
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
                    
                    // Calculate new points
                    const oldScore = votesReceived[userId] || 0;
                    const newPoints = (poster.points - oldScore) + score;
                    
                    // Update votes mapping
                    votesReceived[userId] = score;

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
        return { success: true };
    } catch (error) {
        console.error('Submit votes error:', error);
        return { error: 'Failed to submit votes' };
    }
}
