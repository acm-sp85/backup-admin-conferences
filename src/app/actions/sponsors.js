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
    return await query(`
        SELECT c.*, 
        (SELECT COUNT(*) FROM sponsors_campaign_bounces b WHERE b.campaign_id = c.id) as bounce_count
        FROM sponsors_campaigns c 
        ORDER BY c.created_at DESC
    `);
}

export async function getCampaign(id) {
    await requireAdmin();
    const campaigns = await query(`
        SELECT *
        FROM sponsors_campaigns
        WHERE id = ?
    `, [id]);
    return campaigns[0] || null;
}

export async function getCampaignBounces(campaignId) {
    await requireAdmin();
    try {
        const bounces = await query('SELECT * FROM sponsors_campaign_bounces WHERE campaign_id = ? ORDER BY created_at DESC', [campaignId]);
        return bounces;
    } catch (e) {
        console.error('Error fetching bounces:', e);
        return []; // return empty array if table doesn't exist yet or error
    }
}

export async function syncCampaignBounces(campaignId) {
    await requireAdmin();
    try {
        // Fetch the campaign recipients
        const campaign = await getCampaign(campaignId);
        if (!campaign || !campaign.recipients) return { error: 'Campaign not found' };
        
        const recipients = typeof campaign.recipients === 'string' 
            ? JSON.parse(campaign.recipients) 
            : campaign.recipients;
            
        const recipientEmails = recipients.map(r => r.email);
        
        // Fetch recent emails from Resend API
        const response = await resend.emails.list();
        if (response.error || !response.data?.data) return { error: 'Failed to fetch from Resend' };
        
        // Filter for failures belonging to our recipients
        const failedEmails = response.data.data.filter(e => 
            recipientEmails.includes(e.to[0]) && 
            ['bounced', 'complained', 'suppressed'].includes(e.last_event)
        );
        
        // Log them if they don't exist
        const existingBounces = await getCampaignBounces(campaignId);
        const existingEmails = existingBounces.map(b => b.email);
        
        let addedCount = 0;
        for (const failure of failedEmails) {
            const email = failure.to[0];
            if (!existingEmails.includes(email)) {
                let reason = 'Manual Sync';
                if (failure.last_event === 'suppressed') reason = 'Suppressed by Resend';
                if (failure.last_event === 'bounced') reason = 'Bounced';
                if (failure.last_event === 'complained') reason = 'Complained/Spam';
                
                await query(
                    'INSERT INTO sponsors_campaign_bounces (campaign_id, email, type, reason) VALUES (?, ?, ?, ?)',
                    [campaignId, email, 'email.' + failure.last_event, reason]
                );
                addedCount++;
                existingEmails.push(email); // prevent duplicates in the loop
            }
        }
        
        revalidatePath(`/sponsors/${campaignId}`);
        return { success: true, addedCount };
    } catch (e) {
        console.error('Error syncing bounces:', e);
        return { error: 'Failed to sync bounces' };
    }
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

export async function updateCampaignStatus(id, status) {
    await requireAdmin();
    try {
        if (status === 'completed') {
            await query("UPDATE sponsors_campaigns SET status = ?, sent_at = NOW() WHERE id = ?", [status, id]);
        } else if (status === 'queued') {
            await query("UPDATE sponsors_campaigns SET status = ? WHERE id = ?", [status, id]);
        } else {
            await query("UPDATE sponsors_campaigns SET status = ? WHERE id = ?", [status, id]);
        }
        revalidatePath(`/sponsors/${id}`);
        revalidatePath('/sponsors');
        return { success: true };
    } catch (e) {
        console.error('Error updating campaign status:', e);
        return { error: 'Failed to update status' };
    }
}

export async function sendSingleCampaignEmail(id, recipient) {
    await requireAdmin();
    
    try {
        const campaigns = await query(`
            SELECT *
            FROM sponsors_campaigns
            WHERE id = ?
        `, [id]);
        const campaign = campaigns[0];
        
        if (!campaign) return { error: 'Campaign not found' };
        if (!recipient || !recipient.email) return { error: 'Invalid recipient' };
        
        const sender = 'Sponsors Nanoge <sponsors@nanoge.org>';
        
        // Interpolation function supporting nested fallbacks e.g. {name|{company|there}}
        const replaceVars = (text) => {
            if (!text) return '';
            let previous = '';
            let current = text;
            
            // Evaluate innermost {vars} recursively until no more changes
            while (current !== previous && /{([^{}]+)}/.test(current)) {
                previous = current;
                current = current.replace(/{([^{}]+)}/g, (match, expression) => {
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
                        return recipient.email || fallback; 
                    }
                    return match; // return original if unknown var
                });
            }
            return current;
        };
        
        const personalizedBody = replaceVars(campaign.body);
        const personalizedSubject = replaceVars(campaign.subject);

        await resend.emails.send({
            from: sender,
            to: recipient.email,
            bcc: 'sponsors-enviados@nanoge.org',
            subject: personalizedSubject,
            html: personalizedBody,
            tags: [{ name: 'campaign_id', value: String(id) }]
        });
        
        return { success: true };
        
    } catch (e) {
        console.error(`Failed to send to ${recipient?.email}:`, e);
        return { error: `Failed to dispatch email to ${recipient?.email}` };
    }
}

export async function enqueueCampaign(id, recipients) {
    await requireAdmin();
    
    if (!recipients || recipients.length === 0) return { error: 'No recipients provided' };
    
    try {
        // Enqueue all recipients
        const values = recipients.map(r => [
            id, 
            r.email, 
            r.name || '', 
            r.company || '',
            'pending'
        ]);
        
        // Insert in batches if very large, but mysql2/promise query handles multiple values fine up to reasonable limits
        await query(
            'INSERT INTO sponsors_campaign_queue (campaign_id, recipient_email, recipient_name, recipient_company, status) VALUES ?',
            [values]
        );
        
        // Update campaign status
        await updateCampaignStatus(id, 'queued');
        return { success: true };
    } catch (e) {
        console.error('Error enqueueing campaign:', e);
        return { error: 'Failed to enqueue campaign' };
    }
}

export async function getCampaignProgress(id) {
    await requireAdmin();
    
    try {
        const results = await query(`
            SELECT status, COUNT(*) as count 
            FROM sponsors_campaign_queue 
            WHERE campaign_id = ? 
            GROUP BY status
        `, [id]);
        
        let pending = 0;
        let sent = 0;
        let failed = 0;
        
        for (const row of results) {
            if (row.status === 'pending') pending = Number(row.count);
            if (row.status === 'sent') sent = Number(row.count);
            if (row.status === 'failed') failed = Number(row.count);
        }
        
        return { 
            pending, 
            sent, 
            failed,
            total: pending + sent + failed 
        };
    } catch (e) {
        console.error('Error fetching campaign progress:', e);
        return { pending: 0, sent: 0, failed: 0, total: 0 };
    }
}
