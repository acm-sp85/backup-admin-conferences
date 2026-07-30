'use server';
import { query } from '@/lib/db';
import { verifySession } from '@/lib/auth';
import { hasAdminAccess } from '@/lib/roles';
import { revalidatePath } from 'next/cache';

export async function getAttachments() {
    const session = await verifySession();
    if (!session || (!hasAdminAccess(session.role))) throw new Error('Unauthorized');
    
    // We only fetch the ID and file_name to save bandwidth. We don't need the base64 here.
    return await query('SELECT id, file_name, created_at FROM sponsors_attachments ORDER BY created_at DESC');
}

export async function uploadAttachment(fileName, base64Data) {
    const session = await verifySession();
    if (!session || (!hasAdminAccess(session.role))) throw new Error('Unauthorized');
    
    await query(
        'INSERT INTO sponsors_attachments (file_name, file_base64) VALUES (?, ?)',
        [fileName, base64Data]
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
