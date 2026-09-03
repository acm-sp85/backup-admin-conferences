import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { Resend } from 'resend';

export const maxDuration = 60; // Max execution time for Vercel Hobby

const resend = new Resend(process.env.RESEND_API_KEY);

async function toggleGitlabSchedule(active) {
    if (process.env.GITLAB_API_TOKEN && process.env.GITLAB_PROJECT_ID && process.env.GITLAB_SCHEDULE_ID) {
        try {
            const gitlabUrl = `https://gitlab.scito.org/api/v4/projects/${process.env.GITLAB_PROJECT_ID}/pipeline_schedules/${process.env.GITLAB_SCHEDULE_ID}`;
            await fetch(gitlabUrl, {
                method: 'PUT',
                headers: {
                    'PRIVATE-TOKEN': process.env.GITLAB_API_TOKEN,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ active })
            });
        } catch (err) {
            console.error(`Failed to toggle GitLab schedule to ${active}:`, err);
        }
    }
}

export async function GET(request) {
    if (process.env.CRON_SECRET) {
        const authHeader = request.headers.get('authorization');
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
    }

    try {
        const pendingItems = await query(`
            SELECT q.*, c.subject, c.body 
            FROM sponsors_campaign_queue q
            JOIN sponsors_campaigns c ON q.campaign_id = c.id
            WHERE q.status = 'pending' 
            ORDER BY q.created_at ASC 
            LIMIT 50
        `);

        if (!pendingItems || pendingItems.length === 0) {
            await toggleGitlabSchedule(false);
            return NextResponse.json({ message: 'No pending emails in the queue. Schedule deactivated.' });
        }

        let successCount = 0;
        let failCount = 0;
        const processedCampaignIds = new Set();

        for (const item of pendingItems) {
            processedCampaignIds.add(item.campaign_id);
            
            // Interpolation function
            const replaceVars = (text, recipient) => {
                if (!text) return '';
                let previous = '';
                let current = text;
                while (current !== previous && /{([^{}]+)}/.test(current)) {
                    previous = current;
                    current = current.replace(/{([^{}]+)}/g, (match, expression) => {
                        const parts = expression.split('|');
                        const key = parts[0].trim().toLowerCase();
                        const fallback = parts.slice(1).join('|').trim() || '';
                        
                        if (key === 'name') return recipient.name || fallback;
                        if (key === 'company') return recipient.company || fallback;
                        if (key === 'email') return recipient.email || fallback; 
                        return match;
                    });
                }
                return current;
            };

            const recipient = { email: item.recipient_email, name: item.recipient_name, company: item.recipient_company };
            const personalizedBody = replaceVars(item.body, recipient);
            const personalizedSubject = replaceVars(item.subject, recipient);

            try {
                // The Resend SDK resolves normally unless there is a network error, 
                // but validation errors are returned inside the object.
                const { error } = await resend.emails.send({
                    from: 'Sponsors Nanoge <sponsors@nanoge.org>',
                    to: recipient.email,
                    bcc: 'sponsors-enviados@nanoge.org',
                    subject: personalizedSubject,
                    html: personalizedBody,
                    tags: [{ name: 'campaign_id', value: String(item.campaign_id) }]
                });
                
                if (error) {
                    console.error(`Resend API error for ${recipient.email}:`, error);
                    failCount++;
                    await query(`UPDATE sponsors_campaign_queue SET status = 'failed', error_message = ? WHERE id = ?`, [error.message || 'Resend error', item.id]);
                } else {
                    successCount++;
                    await query(`UPDATE sponsors_campaign_queue SET status = 'sent' WHERE id = ?`, [item.id]);
                }
            } catch (err) {
                console.error(`Failed to send to ${recipient.email}:`, err);
                failCount++;
                await query(`UPDATE sponsors_campaign_queue SET status = 'failed', error_message = ? WHERE id = ?`, [err.message || 'Unknown error', item.id]);
            }
            
            // Sleep for 0.5s to drip-feed emails and protect reputation
            await new Promise(r => setTimeout(r, 500));
        }

        for (const campaignId of processedCampaignIds) {
            const remaining = await query(`
                SELECT COUNT(*) as count 
                FROM sponsors_campaign_queue 
                WHERE campaign_id = ? AND status = 'pending'
            `, [campaignId]);
            
            if (remaining[0].count === 0 || remaining[0].count === '0') {
                await query("UPDATE sponsors_campaigns SET status = 'completed', sent_at = NOW() WHERE id = ?", [campaignId]);
            }
        }
        
        const totalRemaining = await query(`SELECT COUNT(*) as count FROM sponsors_campaign_queue WHERE status = 'pending'`);
        if (totalRemaining[0].count === 0 || totalRemaining[0].count === '0') {
            await toggleGitlabSchedule(false);
        }

        return NextResponse.json({
            message: `Processed ${pendingItems.length} items.`,
            successCount,
            failCount
        });

    } catch (e) {
        console.error('Error in cron job process-sponsors-queue:', e);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
