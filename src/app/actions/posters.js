'use server';

import { query } from '@/lib/db';
import { verifySession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export async function getPostersForConference(conferenceId) {
    const session = await verifySession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
        throw new Error('Unauthorized');
    }

    return await query(`
        SELECT p.*, c.name as cluster_name, c.color as cluster_color
        FROM posters p 
        LEFT JOIN clusters c ON p.cluster_id = c.id 
        WHERE p.conference_id = ? 
        ORDER BY p.code ASC, p.title ASC
    `, [conferenceId]);
}

export async function updatePosterCluster(posterId, clusterId) {
    const session = await verifySession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
        return { error: 'Unauthorized' };
    }

    try {
        await query('UPDATE posters SET cluster_id = ? WHERE id = ?', [clusterId || null, posterId]);
        revalidatePath('/posters');
        return { success: true };
    } catch (error) {
        console.error('Update poster cluster error:', error);
        return { error: 'Failed to update poster cluster' };
    }
}

export async function bulkUpdatePosterClusters(posterIds, clusterId) {
    const session = await verifySession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
        return { error: 'Unauthorized' };
    }

    if (!Array.isArray(posterIds) || posterIds.length === 0) {
        return { error: 'No posters selected' };
    }

    try {
        const placeholders = posterIds.map(() => '?').join(',');
        await query(`UPDATE posters SET cluster_id = ? WHERE id IN (${placeholders})`, [clusterId || null, ...posterIds]);
        revalidatePath('/posters');
        return { success: true };
    } catch (error) {
        console.error('Bulk update poster clusters error:', error);
        return { error: 'Failed to update posters' };
    }
}

export async function getClustersForConference(conferenceId) {
    const session = await verifySession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
        throw new Error('Unauthorized');
    }

    return await query('SELECT * FROM clusters WHERE conference_id = ? ORDER BY name ASC', [conferenceId]);
}

export async function createCluster(conferenceId, name, color = '#0071e3') {
    const session = await verifySession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
        return { error: 'Unauthorized' };
    }

    try {
        await query('INSERT INTO clusters (conference_id, name, color) VALUES (?, ?, ?)', [conferenceId, name, color]);
        revalidatePath('/posters');
        return { success: true };
    } catch (error) {
        return { error: 'Failed to create cluster' };
    }
}

export async function updateCluster(clusterId, name, color) {
    const session = await verifySession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
        return { error: 'Unauthorized' };
    }

    try {
        await query('UPDATE clusters SET name = ?, color = ? WHERE id = ?', [name, color, clusterId]);
        revalidatePath('/posters');
        return { success: true };
    } catch (error) {
        return { error: 'Failed to update cluster' };
    }
}

export async function deleteCluster(clusterId) {
    const session = await verifySession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
        return { error: 'Unauthorized' };
    }

    try {
        await query('DELETE FROM clusters WHERE id = ?', [clusterId]);
        revalidatePath('/posters');
        return { success: true };
    } catch (error) {
        return { error: 'Failed to delete cluster' };
    }
}

export async function resetVotingResults(conferenceId) {
    const session = await verifySession();
    if (!session || session.role !== 'superadmin') {
        throw new Error('Unauthorized: Only superadmins can reset voting results.');
    }

    try {
        // 1. Clear the scores and vote tallies on the posters
        await query('UPDATE posters SET votes_received = NULL, points = 0 WHERE conference_id = ?', [conferenceId]);
        
        // 2. Clear the "has voted" flag and the votes JSON for all registrations in this conference
        await query('UPDATE registrations SET has_voted = 0, votes = NULL WHERE conference_id = ?', [conferenceId]);

        // 3. Clear the "has voted" flag in the users table for all people registered to this conference
        // We match by email between participants and users
        await query(`
            UPDATE users u
            JOIN participants p ON u.email = p.email
            JOIN registrations r ON p.id = r.participant_id
            SET u.has_voted = 0, u.votes = NULL
            WHERE r.conference_id = ?
        `, [conferenceId]);

        revalidatePath('/posters');
        revalidatePath('/voting');
        return { success: true };
    } catch (error) {
        console.error('Reset voting results error:', error);
        throw new Error('Failed to reset voting results');
    }
}

export async function resetParticipantVotes(participantId, conferenceId) {
    const session = await verifySession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
        return { error: 'Unauthorized' };
    }

    try {
        // 1. Get the current votes for this participant in this conference
        const [reg] = await query(
            'SELECT votes, participant_id FROM registrations WHERE participant_id = ? AND conference_id = ?',
            [participantId, conferenceId]
        );

        if (!reg || !reg.votes) {
            // Already reset or never voted
            return { success: true };
        }

        let userVotes = {};
        try {
            userVotes = typeof reg.votes === 'string' ? JSON.parse(reg.votes) : reg.votes;
        } catch (e) { userVotes = {}; }

        // 2. We need to find the User ID used as the key in posters table
        // The submission logic uses the login ID. We'll find it by email.
        const [participant] = await query('SELECT email FROM participants WHERE id = ?', [participantId]);
        const [user] = await query('SELECT id FROM users WHERE email = ?', [participant.email]);
        const voterKey = user ? user.id : participantId; // Fallback to participantId

        // 3. Update each poster to subtract these points
        const { getConnection } = require('@/lib/db');
        const pool = await getConnection();
        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

            for (const [posterId, score] of Object.entries(userVotes)) {
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
                    } catch (e) {}

                    if (votesReceived[voterKey]) {
                        const oldScore = votesReceived[voterKey];
                        const newPoints = Math.max(0, poster.points - oldScore);
                        delete votesReceived[voterKey];

                        await connection.execute(
                            'UPDATE posters SET votes_received = ?, points = ? WHERE id = ?',
                            [JSON.stringify(votesReceived), newPoints, posterId]
                        );
                    }
                }
            }

            // 4. Clear the flags in registrations and users
            await connection.execute(
                'UPDATE registrations SET has_voted = 0, votes = NULL WHERE participant_id = ? AND conference_id = ?',
                [participantId, conferenceId]
            );

            if (user) {
                await connection.execute(
                    'UPDATE users SET has_voted = 0, votes = NULL WHERE id = ?',
                    [user.id]
                );
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
        console.error('Reset participant votes error:', error);
        return { error: 'Failed to reset votes: ' + error.message };
    }
}
