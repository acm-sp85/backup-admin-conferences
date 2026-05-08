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
        
        // 2. Clear the "has voted" flag and the votes JSON for all participants in this conference
        await query('UPDATE registrations SET has_voted = 0, votes = NULL WHERE conference_id = ?', [conferenceId]);

        revalidatePath('/posters');
        revalidatePath('/voting');
        return { success: true };
    } catch (error) {
        console.error('Reset voting results error:', error);
        throw new Error('Failed to reset voting results');
    }
}
