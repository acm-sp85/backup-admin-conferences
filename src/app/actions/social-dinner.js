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
        SELECT t.token, t.id, p.tickets_info, t.ticket_index, t.is_manual
        FROM social_dinner_tickets t
        LEFT JOIN payments p ON t.payment_id = p.id
        WHERE t.registration_id = ? AND t.is_hidden = 0
    `, [registrationId]);

    if (tickets.length === 0) throw new Error('No dinner tickets found for this participant.');

    // Generate QRs
    const headersList = await (await import('next/headers')).headers();
    const host = headersList.get('host');
    const protocol = host?.includes('localhost') ? 'http' : 'https';
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;
    
    const qrCodes = await Promise.all(tickets.map(async (t) => {
        const validationUrl = `${baseUrl}/social-dinner/checkin/${t.token}`;
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


    // Fetch conference details for branding and safety check
    const [conference] = await query('SELECT id, emails_enabled FROM conferences WHERE acronym = ?', [participant.conference]);
    
    if (!conference?.emails_enabled) {
        throw new Error('Communication is currently LOCKED for this conference. Please enable it in Conference Settings first.');
    }

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

export async function manualCheckinSocialDinner(ticketId) {
    const session = await verifySession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
        throw new Error('Unauthorized');
    }

    await query(
        'UPDATE social_dinner_tickets SET scanned_at = NOW() WHERE id = ? AND scanned_at IS NULL',
        [ticketId]
    );

    revalidatePath('/social-dinner');
    return { success: true };
}

export async function addManualSocialDinnerTicket(registrationId) {
    const session = await verifySession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
        throw new Error('Unauthorized');
    }

    const token = crypto.randomBytes(24).toString('hex');
    await query(
        'INSERT INTO social_dinner_tickets (registration_id, payment_id, ticket_index, token, is_manual) VALUES (?, NULL, NULL, ?, 1)',
        [registrationId, token]
    );

    revalidatePath('/social-dinner');
    return { success: true };
}

export async function removeSocialDinnerTicket(ticketId) {
    const session = await verifySession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
        throw new Error('Unauthorized');
    }

    // Check if it's a manual or sync ticket
    const [ticket] = await query('SELECT is_manual, payment_id FROM social_dinner_tickets WHERE id = ?', [ticketId]);
    if (!ticket) return { error: 'Ticket not found' };

    if (ticket.payment_id === null) {
        // Pure manual ticket - delete it
        await query('DELETE FROM social_dinner_tickets WHERE id = ?', [ticketId]);
    } else {
        // Sync ticket - hide it and mark as manual to prevent sync from bringing it back or deleting it
        await query('UPDATE social_dinner_tickets SET is_manual = 1, is_hidden = 1 WHERE id = ?', [ticketId]);
    }

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
        LEFT JOIN payments pay ON t.payment_id = pay.id
        WHERE t.token = ?
    `, [token]);

    if (!ticket) return { success: false, error: 'Invalid Token' };

    // Check for pending balance for the WHOLE registration
    const payments = await query('SELECT amount, balance, status FROM payments WHERE registration_id = ?', [ticket.registration_id]);
    const totalDebt = payments.reduce((sum, pay) => {
        const b = pay.balance !== null ? Number(pay.balance) : (pay.status?.toLowerCase() !== 'paid' ? Number(pay.amount) : 0);
        return sum + b;
    }, 0);

    if (totalDebt > 0) {
        return {
            success: false,
            hasDebt: true,
            error: 'Pending Balance',
            debtAmount: totalDebt,
            attendee: `${ticket.firstName} ${ticket.lastName}`,
            email: ticket.email,
            conference: ticket.conference,
            paymentStatus: ticket.payment_status,
            isManual: !!ticket.is_manual
        };
    }

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
        paymentStatus: ticket.payment_status,
        isManual: !!ticket.is_manual
    };
}

export async function resetTicketScan(ticketId) {
    const session = await verifySession();
    if (!session || session.role !== 'superadmin') {
        throw new Error('Unauthorized: Only superadmins can reset scans.');
    }

    await query('UPDATE social_dinner_tickets SET scanned_at = NULL, is_manual = 0 WHERE id = ?', [ticketId]);
    revalidatePath('/social-dinner');
    return { success: true };
}

export async function searchConferenceParticipants(conferenceAcronym, searchTerm) {
    const session = await verifySession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
        throw new Error('Unauthorized');
    }

    const participants = await query(`
        SELECT p.id as participant_id, r.id as registration_id, 
               CONCAT(COALESCE(p.firstName, ''), ' ', COALESCE(p.lastName, '')) as name, 
               p.email
        FROM participants p
        JOIN registrations r ON p.id = r.participant_id
        JOIN conferences c ON r.conference_id = c.id
        WHERE c.acronym = ? AND (p.firstName LIKE ? OR p.lastName LIKE ? OR p.email LIKE ?)
        LIMIT 10
    `, [conferenceAcronym, `%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`]);

    return participants;
}

export async function addGuestAndSocialDinnerTicket(name, email, conferenceAcronym) {
    const session = await verifySession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
        throw new Error('Unauthorized');
    }

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedName || !trimmedEmail) throw new Error('Name and email are required.');

    // Split name into first / last
    const spaceIdx = trimmedName.indexOf(' ');
    const firstName = spaceIdx === -1 ? trimmedName : trimmedName.slice(0, spaceIdx);
    const lastName  = spaceIdx === -1 ? '' : trimmedName.slice(spaceIdx + 1);

    const [conference] = await query('SELECT id FROM conferences WHERE acronym = ?', [conferenceAcronym]);
    if (!conference) throw new Error('Conference not found');

    // Check if participant already exists
    let [participant] = await query('SELECT id FROM participants WHERE email = ?', [trimmedEmail]);
    let participantId;

    if (participant) {
        participantId = participant.id;
        // Update name if it was empty or different? For now just use existing ID
    } else {
        // Create a minimal participant record
        const pResult = await query(
            'INSERT INTO participants (firstName, lastName, email) VALUES (?, ?, ?)',
            [firstName, lastName, trimmedEmail]
        );
        participantId = pResult.insertId;
    }

    // Check if registration already exists for this conference
    let [registration] = await query('SELECT id FROM registrations WHERE participant_id = ? AND conference_id = ?', [participantId, conference.id]);
    let registrationId;

    if (registration) {
        registrationId = registration.id;
        // Ensure it's marked as guest if it wasn't?
        await query('UPDATE registrations SET is_guest = 1 WHERE id = ?', [registrationId]);
    } else {
        // Create registration flagged as guest so it is hidden from participant metrics
        const rResult = await query(
            'INSERT INTO registrations (participant_id, conference_id, is_guest) VALUES (?, ?, 1)',
            [participantId, conference.id]
        );
        registrationId = rResult.insertId;
    }

    // Create one manual social dinner ticket
    const token = crypto.randomBytes(24).toString('hex');
    await query(
        'INSERT INTO social_dinner_tickets (registration_id, payment_id, ticket_index, token, is_manual) VALUES (?, NULL, NULL, ?, 1)',
        [registrationId, token]
    );

    revalidatePath('/social-dinner');
    return { success: true };
}
