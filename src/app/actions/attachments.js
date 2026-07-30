'use server';
import { query } from '@/lib/db';
import { verifySession } from '@/lib/auth';
import { hasAdminAccess } from '@/lib/roles';
import { revalidatePath } from 'next/cache';

export async function getAttachments() {
    const session = await verifySession();
    if (!session || (!hasAdminAccess(session.role))) throw new Error('Unauthorized');
    
    // Auto-migrate to support URLs (ignore error if column already exists)
    try {
        await query('ALTER TABLE sponsors_attachments ADD COLUMN url TEXT DEFAULT NULL');
    } catch (e) {}

    // We only fetch the ID, file_name, and url to save bandwidth. We don't need the base64 here.
    return await query('SELECT id, file_name, url, created_at FROM sponsors_attachments ORDER BY created_at DESC');
}

export async function uploadAttachment(formData) {
    const session = await verifySession();
    if (!session || (!hasAdminAccess(session.role))) throw new Error('Unauthorized');
    
    const file = formData.get('file');
    if (!file) return { error: 'No file provided' };
    
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Data = `data:${file.type};base64,${buffer.toString('base64')}`;
    const fileName = file.name;
    
    await query(
        'INSERT INTO sponsors_attachments (file_name, file_base64) VALUES (?, ?)',
        [fileName, base64Data]
    );
    
    revalidatePath('/sponsors');
    return { success: true };
}

export async function addLinkAttachment(fileName, url) {
    const session = await verifySession();
    if (!session || (!hasAdminAccess(session.role))) throw new Error('Unauthorized');
    
    await query(
        'INSERT INTO sponsors_attachments (file_name, url) VALUES (?, ?)',
        [fileName, url]
    );
    
    revalidatePath('/sponsors');
    return { success: true };
}

export async function deleteAttachment(id) {
    const session = await verifySession();
    if (!session || (!hasAdminAccess(session.role))) throw new Error('Unauthorized');
    
    await query('DELETE FROM sponsors_attachments WHERE id = ?', [id]);
    
    revalidatePath('/sponsors');
    return { success: true };
}
