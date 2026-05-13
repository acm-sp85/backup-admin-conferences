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

export async function manualCheckinParticipant(registrationId) {
    const session = await verifySession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
        throw new Error('Unauthorized');
    }

    await query(
        'UPDATE participant_qr_tokens SET scanned_at = NOW(), is_manual = 1 WHERE registration_id = ? AND scanned_at IS NULL',
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

    // Check for pending balance
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
            conference: ticket.conference_name,
            acronym: ticket.conference_acronym
        };
    }

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

    await query('UPDATE participant_qr_tokens SET scanned_at = NULL, is_manual = 0 WHERE registration_id = ?', [registrationId]);
    revalidatePath('/participants');
    return { success: true };
}

export async function getBadgeConfig(conferenceId) {
    const [conf] = await query('SELECT badge_config, badge_bg FROM conferences WHERE id = ?', [conferenceId]);
    
    let config = {
        nameSize: '24px',
        nameColor: '#000000',
        instSize: '16px',
        instColor: '#666666',
        qrSize: '120px',
        padding: '10mm'
    };

    if (conf?.badge_config) {
        try {
            config = typeof conf.badge_config === 'string' 
                ? JSON.parse(conf.badge_config) 
                : conf.badge_config;
        } catch (e) { }
    }

    return { config, bgUrl: conf?.badge_bg };
}

export async function updateBadgeConfig(conferenceId, config, bgUrl) {
    const session = await verifySession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
        throw new Error('Unauthorized');
    }

    await query(
        'UPDATE conferences SET badge_config = ?, badge_bg = ? WHERE id = ?',
        [JSON.stringify(config), bgUrl, conferenceId]
    );

    revalidatePath('/participants');
    return { success: true };
}
