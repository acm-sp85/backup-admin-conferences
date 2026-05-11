'use server';

import { query } from '@/lib/db';
import { verifySession } from '@/lib/auth';
import { Resend } from 'resend';
import { revalidatePath } from 'next/cache';
import crypto from 'crypto';
import { emailTemplates, EMAIL_CONFIG } from '@/lib/email-templates';
import { getEmailTemplate } from '@/lib/email-dispatcher';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendParticipantCheckinQR(registrationId) {
    const session = await verifySession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
        throw new Error('Unauthorized');
    }

    // Get participant and registration details
    const [participant] = await query(`
        SELECT p.email, CONCAT(COALESCE(p.firstName, ''), ' ', COALESCE(p.lastName, '')) as name, 
               c.id as conference_id, c.name as conference_name, c.emails_enabled, t.token
        FROM participants p
        JOIN registrations r ON p.id = r.participant_id
        JOIN conferences c ON r.conference_id = c.id
        LEFT JOIN participant_qr_tokens t ON r.id = t.registration_id
        WHERE r.id = ?
    `, [registrationId]);

    if (!participant) throw new Error('Participant not found');
    if (!participant.token) throw new Error('No QR token found. Please run Sync first.');

    if (!participant.emails_enabled) {
        throw new Error('Communication is currently LOCKED for this conference. Please enable it in Conference Settings first.');
    }

    // Send Email
    const { subject, html } = await getEmailTemplate(participant.conference_id, 'emailCheckin', {
        name: participant.name,
        token: participant.token
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
        'UPDATE participant_qr_tokens SET email_sent_at = NOW() WHERE registration_id = ?',
        [registrationId]
    );

    revalidatePath('/participants');
    return { success: true };
}

export async function validateParticipantTicket(token) {
    const session = await verifySession();
    if (!session) throw new Error('Unauthorized');

    const [ticket] = await query(`
        SELECT t.*, p.firstName, p.lastName, p.email, c.name as conference_name, c.acronym as conference_acronym
        FROM participant_qr_tokens t
        JOIN registrations r ON t.registration_id = r.id
        JOIN participants p ON r.participant_id = p.id
        JOIN conferences c ON r.conference_id = c.id
        WHERE t.token = ?
    `, [token]);

    if (!ticket) return { success: false, error: 'Invalid Token' };

    if (ticket.scanned_at) {
        return { 
            success: false, 
            error: 'Already checked in', 
            scannedAt: ticket.scanned_at,
            attendee: `${ticket.firstName} ${ticket.lastName}`
        };
    }

    await query(
        'UPDATE participant_qr_tokens SET scanned_at = NOW() WHERE token = ?',
        [token]
    );

    return { 
        success: true, 
        attendee: `${ticket.firstName} ${ticket.lastName}`,
        email: ticket.email,
        conference: ticket.conference_name,
        acronym: ticket.conference_acronym
    };
}

export async function resetParticipantCheckin(registrationId) {
    const session = await verifySession();
    if (!session || session.role !== 'superadmin') {
        throw new Error('Unauthorized: Only superadmins can reset scans.');
    }

    await query('UPDATE participant_qr_tokens SET scanned_at = NULL WHERE registration_id = ?', [registrationId]);
    revalidatePath('/participants');
    return { success: true };
}
