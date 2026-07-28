'use server';
import { hasAdminAccess } from '@/lib/roles';

import { query } from '@/lib/db';
import { verifySession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Utility to enforce permissions
async function requireAdmin() {
    const session = await verifySession();
    if (!session || !hasAdminAccess(session.role)) {
        throw new Error('Unauthorized');
    }
    return session;
}

export async function getCampaigns() {
    await requireAdmin();
    return await query('SELECT * FROM sponsors_campaigns ORDER BY created_at DESC');
}

export async function getCampaign(id) {
    await requireAdmin();
    const campaigns = await query('SELECT * FROM sponsors_campaigns WHERE id = ?', [id]);
    return campaigns[0] || null;
}

export async function createCampaign(data) {
    await requireAdmin();
    const { name, subject, body } = data;
    
    if (!name || !subject) {
        return { error: 'Name and Subject are required' };
    }

    try {
        const result = await query(
            'INSERT INTO sponsors_campaigns (name, subject, body, recipients, status) VALUES (?, ?, ?, ?, ?)',
            [name, subject, body || '', JSON.stringify([]), 'draft']
        );
        revalidatePath('/sponsors');
        return { success: true, id: result.insertId };
    } catch (e) {
        console.error('Error creating campaign:', e);
        return { error: 'Failed to create campaign' };
    }
}

export async function updateCampaign(id, data) {
    await requireAdmin();
    const { name, subject, body } = data;
    
    try {
        await query(
            'UPDATE sponsors_campaigns SET name = ?, subject = ?, body = ? WHERE id = ?',
            [name, subject, body, id]
        );
        revalidatePath(`/sponsors/${id}`);
        revalidatePath('/sponsors');
        return { success: true };
    } catch (e) {
        console.error('Error updating campaign:', e);
        return { error: 'Failed to update campaign' };
    }
}

export async function updateCampaignRecipients(id, recipientsData) {
    await requireAdmin();
    
    try {
        // Assume recipientsData is an array of objects [{email: '...', name: '...'}]
        await query(
            'UPDATE sponsors_campaigns SET recipients = ? WHERE id = ?',
            [JSON.stringify(recipientsData), id]
        );
        revalidatePath(`/sponsors/${id}`);
        return { success: true };
    } catch (e) {
        console.error('Error updating recipients:', e);
        return { error: 'Failed to update recipients' };
    }
}

export async function deleteCampaign(id) {
    await requireAdmin();
    try {
        await query('DELETE FROM sponsors_campaigns WHERE id = ?', [id]);
        revalidatePath('/sponsors');
        return { success: true };
    } catch (e) {
        console.error('Error deleting campaign:', e);
        return { error: 'Failed to delete campaign' };
    }
}

export async function sendCampaign(id) {
    await requireAdmin();
    
    try {
        const campaigns = await query('SELECT * FROM sponsors_campaigns WHERE id = ?', [id]);
        const campaign = campaigns[0];
        
        if (!campaign) return { error: 'Campaign not found' };
        if (campaign.status === 'completed') return { error: 'Campaign already sent' };
        
        let recipients = [];
        if (typeof campaign.recipients === 'string') {
            recipients = JSON.parse(campaign.recipients || '[]');
        } else {
            recipients = campaign.recipients || [];
        }
        
        if (recipients.length === 0) {
            return { error: 'No recipients in this campaign' };
        }
        
        // Update status to sending
        await query("UPDATE sponsors_campaigns SET status = 'sending' WHERE id = ?", [id]);
        
        // Dispatch emails
        const sender = 'Sponsors Nanoge <sponsors@nanoge.org>';
        
        // Dispatch in batches or sequentially. We will do it simple for now.
        let successCount = 0;
        let failCount = 0;
        
        for (const recipient of recipients) {
            if (!recipient.email) continue;
            
            // Interpolation function supporting fallbacks e.g. {name|there}
            const replaceVars = (text) => {
                if (!text) return '';
                return text.replace(/{([^}]+)}/g, (match, expression) => {
                    const parts = expression.split('|');
                    const key = parts[0].trim().toLowerCase();
                    const fallback = parts.slice(1).join('|').trim() || '';
                    
                    if (key === 'name') {
                        return recipient.name || fallback;
                    }
                    if (key === 'company') {
                        return recipient.company || fallback;
                    }
                    if (key === 'email') {
                        return recipient.email; // email is required anyway
                    }
                    return match; // return original if unknown var
                });
            };
            
            const personalizedBody = replaceVars(campaign.body);
            const personalizedSubject = replaceVars(campaign.subject);

            try {
                await resend.emails.send({
                    from: sender,
                    to: recipient.email,
                    subject: personalizedSubject,
                    html: personalizedBody
                });
                successCount++;
                
                // 500ms delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (err) {
                console.error(`Failed to send to ${recipient.email}:`, err);
                failCount++;
            }
        }
        
        await query(
            "UPDATE sponsors_campaigns SET status = 'completed', sent_at = NOW() WHERE id = ?",
            [id]
        );
        revalidatePath(`/sponsors/${id}`);
        revalidatePath('/sponsors');
        
        return { 
            success: true, 
            message: `Campaign sent! ${successCount} succeeded, ${failCount} failed.` 
        };
        
    } catch (e) {
        console.error('Error sending campaign:', e);
        // Try to revert status
        await query("UPDATE sponsors_campaigns SET status = 'draft' WHERE id = ?", [id]);
        return { error: 'Failed to dispatch emails. Status reverted to draft.' };
    }
}
