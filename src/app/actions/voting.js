'use server';

import { query } from '@/lib/db';
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
            currentVotes = reg.votes || {};
        } else {
            const [user] = await query('SELECT votes FROM users WHERE id = ?', [userId]);
            if (!user) return { error: 'User not found' };
            currentVotes = user.votes || {};
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

        // 3. Update each poster's votes_received and points
        // We will process the newVotes object
        for (const [posterId, score] of Object.entries(newVotes)) {
            const [poster] = await query('SELECT votes_received, points FROM posters WHERE id = ?', [posterId]);
            if (poster) {
                const votesReceived = poster.votes_received || {};
                
                // Calculate new points
                const oldScore = votesReceived[userId] || 0;
                const newPoints = (poster.points - oldScore) + score;
                
                // Update votes mapping
                votesReceived[userId] = score;

                await query(
                    'UPDATE posters SET votes_received = ?, points = ? WHERE id = ?',
                    [JSON.stringify(votesReceived), newPoints, posterId]
                );
            }
        }

        revalidatePath('/voting');
        return { success: true };
    } catch (error) {
        console.error('Submit votes error:', error);
        return { error: 'Failed to submit votes' };
    }
}
