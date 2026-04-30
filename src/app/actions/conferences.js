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

    if (!name || !acronym) {
        return { error: 'Name and Acronym are required' };
    }

    try {
        await query(
            'INSERT INTO conferences (name, acronym, email) VALUES (?, ?, ?)',
            [name, acronym, email]
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

    if (!name || !acronym) {
        return { error: 'Name and Acronym are required' };
    }

    try {
        await query(
            'UPDATE conferences SET name = ?, acronym = ?, email = ? WHERE id = ?',
            [name, acronym, email, id]
        );
        revalidatePath('/');
        return { success: true };
    } catch (error) {
        console.error('Update conference error:', error);
        return { error: 'Failed to update conference. Acronym might be a duplicate.' };
    }
}
