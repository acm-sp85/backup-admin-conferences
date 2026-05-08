'use server';

import { query } from '@/lib/db';
import { verifySession } from '@/lib/auth';
import { Resend } from 'resend';
import { generateQR } from '@/lib/qr';
import { revalidatePath } from 'next/cache';
import crypto from 'crypto';
import { emailTemplates, EMAIL_CONFIG } from '@/lib/email-templates';
import { getEmailTemplate } from '@/lib/email-dispatcher';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function syncSocialDinnerTickets() {
    const session = await verifySession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
        throw new Error('Unauthorized');
    }

    // Get all payments with Social Dinner tickets
    const payments = await query(`
        SELECT id, registration_id, tickets_info 
        FROM payments 
        WHERE tickets_info LIKE '%Social Dinner%'
    `);

    let newTickets = 0;

    for (const pay of payments) {
        let tickets = [];
        try {
            tickets = typeof pay.tickets_info === 'string' ? JSON.parse(pay.tickets_info) : pay.tickets_info;
        } catch (e) { continue; }

        if (!Array.isArray(tickets)) continue;

        for (let i = 0; i < tickets.length; i++) {
            const ticket = tickets[i];
            const name = ticket.name || (ticket.ticket_data && ticket.ticket_data.name);
            
            if (name === 'Social Dinner') {
                // Check if this specific ticket already has a token
                const [existing] = await query(
                    'SELECT id FROM social_dinner_tickets WHERE payment_id = ? AND ticket_index = ?',
                    [pay.id, i]
                );

                if (!existing) {
                    const token = crypto.randomBytes(24).toString('hex');
                    await query(
                        'INSERT INTO social_dinner_tickets (registration_id, payment_id, ticket_index, token) VALUES (?, ?, ?, ?)',
                        [pay.registration_id, pay.id, i, token]
                    );
                    newTickets++;
                }
            }
        }
    }

    revalidatePath('/social-dinner');
    return { success: true, newTickets };
}

export async function sendSocialDinnerQR(registrationId) {
    const session = await verifySession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
        throw new Error('Unauthorized');
    }

    // Get participant and their tickets
    const [participant] = await query(`
        SELECT p.email, CONCAT(COALESCE(p.firstName, ''), ' ', COALESCE(p.lastName, '')) as name, c.acronym as conference
        FROM participants p
        JOIN registrations r ON p.id = r.participant_id
        JOIN conferences c ON r.conference_id = c.id
        WHERE r.id = ?
    `, [registrationId]);

    if (!participant) throw new Error('Participant not found');

    const tickets = await query(`
        SELECT t.token, t.id, p.tickets_info, t.ticket_index
        FROM social_dinner_tickets t
        JOIN payments p ON t.payment_id = p.id
        WHERE t.registration_id = ?
    `, [registrationId]);

    if (tickets.length === 0) throw new Error('No tickets found. Please run Sync first.');

    // Generate QRs
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    
    const qrCodes = await Promise.all(tickets.map(async (t) => {
        const validationUrl = `${appUrl}/social-dinner/checkin/${t.token}`;
        const qrBase64 = await generateQR(validationUrl);
        
        // Parse dietary preference
        let dietary = 'Regular';
        try {
            const allTickets = typeof t.tickets_info === 'string' ? JSON.parse(t.tickets_info) : t.tickets_info;
            const ticketData = allTickets[t.ticket_index];
            if (ticketData.option !== undefined && ticketData.ticket_data?.options) {
                dietary = ticketData.ticket_data.options[ticketData.option] || dietary;
            }
        } catch (e) {}

        return { qr: qrBase64, dietary, token: t.token };
    }));


    // Fetch conference details for branding
    const results = await query('SELECT id FROM conferences WHERE acronym = ?', [participant.conference]);
    const conference = results[0];

    // Send Email
    const { subject, html } = await getEmailTemplate(conference?.id, 'socialDinnerTickets', {
        name: participant.name,
        qrCodes
    });

    const { error } = await resend.emails.send({
        from: EMAIL_CONFIG.fromConferences,
        to: [participant.email],
        subject,
        html
    });

    if (error) {
        console.error('Resend Error:', error);
        throw new Error(error.message);
    }

    // Update email_sent_at
    await query(
        'UPDATE social_dinner_tickets SET email_sent_at = NOW() WHERE registration_id = ?',
        [registrationId]
    );

    revalidatePath('/social-dinner');
    return { success: true };
}

export async function validateTicket(token) {
    const session = await verifySession();
    if (!session) throw new Error('Unauthorized');

    const [ticket] = await query(`
        SELECT t.*, p.firstName, p.lastName, p.email, c.acronym as conference, pay.tickets_info, pay.status as payment_status
        FROM social_dinner_tickets t
        JOIN registrations r ON t.registration_id = r.id
        JOIN participants p ON r.participant_id = p.id
        JOIN conferences c ON r.conference_id = c.id
        JOIN payments pay ON t.payment_id = pay.id
        WHERE t.token = ?
    `, [token]);

    if (!ticket) return { success: false, error: 'Invalid Token' };

    if (ticket.scanned_at) {
        return { 
            success: false, 
            error: 'Ticket already scanned', 
            scannedAt: ticket.scanned_at,
            attendee: `${ticket.firstName} ${ticket.lastName}`
        };
    }

    // Parse dietary preference
    let dietary = 'Regular';
    try {
        const allTickets = typeof ticket.tickets_info === 'string' ? JSON.parse(ticket.tickets_info) : ticket.tickets_info;
        const ticketData = allTickets[ticket.ticket_index];
        if (ticketData.option !== undefined && ticketData.ticket_data?.options) {
            dietary = ticketData.ticket_data.options[ticketData.option] || dietary;
        }
    } catch (e) {}

    await query(
        'UPDATE social_dinner_tickets SET scanned_at = NOW() WHERE token = ?',
        [token]
    );

    return { 
        success: true, 
        attendee: `${ticket.firstName} ${ticket.lastName}`,
        email: ticket.email,
        conference: ticket.conference,
        dietary,
        paymentStatus: ticket.payment_status
    };
}

export async function resetTicketScan(ticketId) {
    const session = await verifySession();
    if (!session || session.role !== 'superadmin') {
        throw new Error('Unauthorized: Only superadmins can reset scans.');
    }

    await query('UPDATE social_dinner_tickets SET scanned_at = NULL WHERE id = ?', [ticketId]);
    revalidatePath('/social-dinner');
    return { success: true };
}
