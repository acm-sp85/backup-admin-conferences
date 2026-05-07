'use server';

import { query } from '@/lib/db';
import { verifySession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export async function createConference(formData) {
    const session = await verifySession();
    if (!session || session.role !== 'superadmin') {
        return { error: 'Only superadmins can create conferences' };
    }

    const name = formData.get('name');
    const acronym = formData.get('acronym');
    const email = formData.get('email');
    const logo_url = formData.get('logo_url') || null;
    const banner_url = formData.get('banner_url') || null;
    const accent_color = formData.get('accent_color') || '#007aff';

    if (!name || !acronym) {
        return { error: 'Name and Acronym are required' };
    }

    console.log('📝 Creating conference with:', { name, acronym, email, logo_url, banner_url, accent_color });

    try {
        await query(
            'INSERT INTO conferences (name, acronym, email, logo_url, banner_url, accent_color) VALUES (?, ?, ?, ?, ?, ?)',
            [name, acronym, email, logo_url, banner_url, accent_color]
        );
        revalidatePath('/');
        return { success: true };
    } catch (error) {
        console.error('Create conference error:', error);
        return { error: 'Failed to create conference. Acronym might already exist.' };
    }
}

export async function deleteConference(id) {
    const session = await verifySession();
    if (!session || session.role !== 'superadmin') {
        return { error: 'Unauthorized' };
    }

    try {
        await query('DELETE FROM conferences WHERE id = ?', [id]);
        revalidatePath('/');
        return { success: true };
    } catch (error) {
        console.error('Delete conference error:', error);
        return { error: 'Failed to delete conference. It might have linked posters or participants.' };
    }
}

export async function toggleVotingWindow(conferenceId, currentStatus) {
    const session = await verifySession();
    if (!session || session.role !== 'superadmin') {
        return { error: 'Unauthorized' };
    }

    try {
        const newStatus = currentStatus === 1 ? 0 : 1;
        await query(
            'UPDATE conferences SET voting_window_open = ? WHERE id = ?',
            [newStatus, conferenceId]
        );
        revalidatePath('/');
        return { success: true, newStatus };
    } catch (error) {
        console.error('Toggle voting error:', error);
        return { error: 'Failed to update voting window' };
    }
}

export async function updateConference(id, formData) {
    const session = await verifySession();
    if (!session || session.role !== 'superadmin') {
        return { error: 'Unauthorized' };
    }

    const name = formData.get('name');
    const acronym = formData.get('acronym');
    const email = formData.get('email');
    const logo_url = formData.get('logo_url') || null;
    const banner_url = formData.get('banner_url') || null;
    const accent_color = formData.get('accent_color') || '#007aff';

    if (!name || !acronym) {
        return { error: 'Name and Acronym are required' };
    }

    console.log('📝 Updating conference:', id, { name, acronym, email, logo_url, banner_url, accent_color });

    try {
        await query(
            'UPDATE conferences SET name = ?, acronym = ?, email = ?, logo_url = ?, banner_url = ?, accent_color = ? WHERE id = ?',
            [name, acronym, email, logo_url, banner_url, accent_color, id]
        );
        revalidatePath('/');
        return { success: true };
    } catch (error) {
        console.error('Update conference error:', error);
        return { error: 'Failed to update conference. Acronym might be a duplicate.' };
    }
}
