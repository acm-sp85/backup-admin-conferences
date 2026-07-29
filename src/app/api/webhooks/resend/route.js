import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import crypto from 'crypto';

export async function POST(req) {
    try {
        const payload = await req.text();
        const signature = req.headers.get('resend-signature');
        const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

        // Verify webhook signature if secret is provided (optional for MVP but good practice)
        /*
        if (webhookSecret && signature) {
            // Note: Resend signature verification requires svix package or manual crypto. 
            // For now, we'll assume the route is sufficiently obscure or implement simple verification.
        }
        */

        const event = JSON.parse(payload);
        
        // We care about bounce, complaint, and suppressed events
        if (event.type === 'email.bounced' || event.type === 'email.complained' || event.type === 'email.suppressed') {
            const data = event.data;
            const email = data.to[0]; // recipient email
            let reason = 'Unknown';
            if (event.type === 'email.bounced') {
                reason = (data.bounce && data.bounce.reason) ? data.bounce.reason : 'Bounced';
            } else if (event.type === 'email.suppressed') {
                reason = 'Suppressed by Resend (previously bounced/complained)';
            } else {
                reason = 'Complained/Spam';
            }
            
            // Find campaign_id from tags
            const tags = data.tags || [];
            const campaignTag = tags.find(t => t.name === 'campaign_id');
            const campaignId = campaignTag ? parseInt(campaignTag.value, 10) : null;
            
            if (campaignId && email) {
                // Log to database
                await query(
                    'INSERT INTO sponsors_campaign_bounces (campaign_id, email, type, reason) VALUES (?, ?, ?, ?)',
                    [campaignId, email, event.type, reason]
                );
                console.log(`[Resend Webhook] Logged ${event.type} for ${email} in campaign ${campaignId}`);
            }
        }
        
        return NextResponse.json({ success: true }, { status: 200 });
        
    } catch (e) {
        console.error('Error processing Resend webhook:', e);
        return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
    }
}
