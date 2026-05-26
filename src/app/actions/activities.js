'use server';

import { query } from '@/lib/db';
import { verifySession } from '@/lib/auth';
import { Resend } from 'resend';
import { generateQR } from '@/lib/qr';
import { revalidatePath } from 'next/cache';
import crypto from 'crypto';
import { EMAIL_CONFIG, getBranding, renderHeader } from '@/lib/email-templates';
import { resolveEmail } from '@/lib/email-resolver';

const resend = new Resend(process.env.RESEND_API_KEY);

// -----------------------------------------------------------------------------
// ACTIVITIES
// -----------------------------------------------------------------------------

export async function createActivity(conferenceId, name, date, description) {
    const session = await verifySession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) throw new Error('Unauthorized');

    await query(
        'INSERT INTO extra_activities (conference_id, name, date, description, custom_email_text) VALUES (?, ?, ?, ?, ?)',
        [conferenceId, name, date || null, description || null, null]
    );

    revalidatePath('/activities');
    return { success: true };
}

export async function updateActivity(activityId, name, date, description) {
    const session = await verifySession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) throw new Error('Unauthorized');

    await query(
        'UPDATE extra_activities SET name = ?, date = ?, description = ? WHERE id = ?',
        [name, date || null, description || null, activityId]
    );

    revalidatePath('/activities');
    revalidatePath(`/activities/${activityId}`);
    return { success: true };
}

export async function updateActivityEmailText(activityId, customEmailText) {
    const session = await verifySession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) throw new Error('Unauthorized');

    await query(
        'UPDATE extra_activities SET custom_email_text = ? WHERE id = ?',
        [customEmailText || null, activityId]
    );

    revalidatePath(`/activities/${activityId}`);
    return { success: true };
}

export async function deleteActivity(activityId) {
    const session = await verifySession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) throw new Error('Unauthorized');

    await query('DELETE FROM extra_activities WHERE id = ?', [activityId]);

    revalidatePath('/activities');
    return { success: true };
}

// -----------------------------------------------------------------------------
// ATTENDEES
// -----------------------------------------------------------------------------

export async function addAttendeeManual(activityId, participantId, name, email) {
    const session = await verifySession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) throw new Error('Unauthorized');

    // Check if already in this activity
    const [existing] = await query('SELECT id FROM extra_activity_attendees WHERE activity_id = ? AND email = ?', [activityId, email]);
    if (existing) {
        throw new Error('Attendee is already added to this activity.');
    }

    const token = crypto.randomBytes(24).toString('hex');
    await query(
        'INSERT INTO extra_activity_attendees (activity_id, participant_id, name, email, qr_token, is_manual) VALUES (?, ?, ?, ?, ?, 1)',
        [activityId, participantId || null, name, email, token]
    );

    revalidatePath(`/activities/${activityId}`);
    return { success: true };
}

export async function importCSVAttendees(activityId, conferenceId, emailsList) {
    const session = await verifySession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) throw new Error('Unauthorized');

    if (!emailsList || emailsList.length === 0) return { success: true, count: 0 };

    // Fetch existing participants for this conference to map names
    const conferenceParticipants = await query(`
        SELECT p.id as participant_id, p.email, CONCAT(COALESCE(p.firstName, ''), ' ', COALESCE(p.lastName, '')) as name
        FROM participants p
        JOIN registrations r ON p.id = r.participant_id
        WHERE r.conference_id = ?
    `, [conferenceId]);

    const participantMap = new Map(conferenceParticipants.map(p => [p.email.toLowerCase(), p]));

    let count = 0;
    for (const email of emailsList) {
        const cleanEmail = email.trim().toLowerCase();
        if (!cleanEmail) continue;

        // Check if already in this activity
        const [existing] = await query('SELECT id FROM extra_activity_attendees WHERE activity_id = ? AND email = ?', [activityId, cleanEmail]);
        if (existing) continue;

        let pId = null;
        let name = cleanEmail.split('@')[0]; // Default to email prefix if not found

        const confParticipant = participantMap.get(cleanEmail);
        if (confParticipant) {
            pId = confParticipant.participant_id;
            name = confParticipant.name || name;
        }

        const token = crypto.randomBytes(24).toString('hex');
        await query(
            'INSERT INTO extra_activity_attendees (activity_id, participant_id, name, email, qr_token, is_manual) VALUES (?, ?, ?, ?, ?, 0)',
            [activityId, pId, name, cleanEmail, token]
        );
        count++;
    }

    revalidatePath(`/activities/${activityId}`);
    return { success: true, count };
}

export async function removeAttendee(attendeeId, activityId) {
    const session = await verifySession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) throw new Error('Unauthorized');

    await query('DELETE FROM extra_activity_attendees WHERE id = ?', [attendeeId]);
    revalidatePath(`/activities/${activityId}`);
    return { success: true };
}

// -----------------------------------------------------------------------------
// CHECK-IN & QR
// -----------------------------------------------------------------------------

export async function manualCheckinActivity(attendeeId, activityId) {
    const session = await verifySession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) throw new Error('Unauthorized');

    await query(
        'UPDATE extra_activity_attendees SET scanned_at = NOW(), is_manual = 1 WHERE id = ? AND scanned_at IS NULL',
        [attendeeId]
    );

    revalidatePath(`/activities/${activityId}`);
    return { success: true };
}

export async function resetCheckinActivity(attendeeId, activityId) {
    const session = await verifySession();
    if (!session || session.role !== 'superadmin') throw new Error('Unauthorized: Only superadmins can reset scans.');

    await query('UPDATE extra_activity_attendees SET scanned_at = NULL, is_manual = 0 WHERE id = ?', [attendeeId]);
    revalidatePath(`/activities/${activityId}`);
    return { success: true };
}

export async function validateActivityTicket(activityId, token) {
    const session = await verifySession();
    if (!session) throw new Error('Unauthorized');

    const [attendee] = await query(`
        SELECT a.*, act.name as activity_name 
        FROM extra_activity_attendees a
        JOIN extra_activities act ON a.activity_id = act.id
        WHERE a.qr_token = ? AND a.activity_id = ?
    `, [token, activityId]);

    if (!attendee) return { success: false, error: 'Invalid Token or Token is for another activity' };

    if (attendee.scanned_at) {
        return { 
            success: false, 
            error: 'Ticket already scanned', 
            scannedAt: attendee.scanned_at,
            attendee: attendee.name
        };
    }

    await query(
        'UPDATE extra_activity_attendees SET scanned_at = NOW() WHERE qr_token = ?',
        [token]
    );

    return { 
        success: true, 
        attendee: `${attendee.name}${attendee.tickets_count > 1 ? ` (${attendee.tickets_count} tickets)` : ''}`,
        email: attendee.email,
        activity: attendee.activity_name
    };
}

export async function sendActivityQREmail(attendeeId, activityId) {
    const session = await verifySession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) throw new Error('Unauthorized');

    const [attendee] = await query(`
        SELECT a.name, a.email, a.qr_token, a.tickets_count, act.name as activity_name, act.custom_email_text, 
               c.id as conference_id, c.name as conference_name, c.email as conference_email,
               c.logo_url, c.banner_url, c.accent_color,
               p.email_alias
        FROM extra_activity_attendees a
        JOIN extra_activities act ON a.activity_id = act.id
        JOIN conferences c ON act.conference_id = c.id
        LEFT JOIN participants p ON a.participant_id = p.id
        WHERE a.id = ?
    `, [attendeeId]);

    if (!attendee) throw new Error('Attendee not found');

    const brand = getBranding({
        name: attendee.conference_name,
        email: attendee.conference_email,
        logo_url: attendee.logo_url,
        banner_url: attendee.banner_url,
        accent_color: attendee.accent_color
    });

    const headersList = await (await import('next/headers')).headers();
    const host = headersList.get('host');
    const protocol = host?.includes('localhost') ? 'http' : 'https';
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;
    
    const validationUrl = `${baseUrl}/activities/${activityId}/checkin/${attendee.qr_token}`;
    const qrBase64 = await generateQR(validationUrl);

    const headerHtml = renderHeader(brand);
    const ticketsLabel = attendee.tickets_count > 1 ? ` (${attendee.tickets_count} tickets)` : '';
    const subject = `Your QR Ticket${attendee.tickets_count > 1 ? 's' : ''} for ${attendee.activity_name}${ticketsLabel} - ${brand.name}`;
    const customMessageHtml = attendee.custom_email_text 
        ? `<div style="margin-top: 15px; margin-bottom: 25px; padding: 15px; border-left: 4px solid ${brand.accentColor}; background-color: #f8fafc; color: #334155; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${attendee.custom_email_text}</div>` 
        : '';

    const registrationDetails = attendee.tickets_count > 1 
        ? `You have <strong>${attendee.tickets_count} tickets</strong> registered for <strong>${attendee.activity_name}</strong> at <strong>${brand.name}</strong>.`
        : `You are registered for <strong>${attendee.activity_name}</strong> at <strong>${brand.name}</strong>.`;

    const qrDescription = attendee.tickets_count > 1
        ? `Show this QR code at the entrance to check-in your ${attendee.tickets_count} tickets.`
        : `Show this QR code to check-in to this activity.`;

    const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px; color: #0f172a;">
            ${headerHtml}
            <h2 style="color: #1d1d1f; font-size: 20px; margin-bottom: 15px;">Hello ${attendee.name},</h2>
            <p style="font-size: 14px; line-height: 1.5;">${registrationDetails}</p>
            ${customMessageHtml}
            <p style="font-size: 14px; line-height: 1.5; margin-top: 15px;">Please present the QR code below at the entrance for scanning:</p>
            
            <div style="margin: 30px 0; padding: 20px; background: #f5f5f7; border-radius: 12px; text-align: center;">
                <img src="${qrBase64}" alt="QR Code" style="width: 240px; height: 240px; margin-bottom: 10px; display: block; margin-left: auto; margin-right: auto;" />
                <p style="margin: 5px 0; font-size: 12px; color: #86868b;">${qrDescription}</p>
            </div>
            
            <p style="font-size: 12px; color: #86868b; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px; text-align: center;">
                This is an automated message from ${brand.name}. For support, contact <a href="mailto:${brand.email}" style="color: ${brand.accentColor}; text-decoration: none;">${brand.email}</a>.
            </p>
        </div>
    `;

    const { error } = await resend.emails.send({
        from: EMAIL_CONFIG.fromConferences,
        to: [resolveEmail(attendee)],
        subject,
        html
    });

    if (error) {
        console.error('Resend Error:', error);
        throw new Error(error.message);
    }

    await query('UPDATE extra_activity_attendees SET email_sent_at = NOW() WHERE id = ?', [attendeeId]);
    revalidatePath(`/activities/${activityId}`);
    return { success: true };
}

export async function searchConferenceParticipantsLocal(conferenceId, searchTerm) {
    const session = await verifySession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) throw new Error('Unauthorized');

    const participants = await query(`
        SELECT p.id as participant_id, 
               CONCAT(COALESCE(p.firstName, ''), ' ', COALESCE(p.lastName, '')) as name, 
               p.email
        FROM participants p
        JOIN registrations r ON p.id = r.participant_id
        WHERE r.conference_id = ? AND (p.firstName LIKE ? OR p.lastName LIKE ? OR p.email LIKE ?)
        LIMIT 10
    `, [conferenceId, `%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`]);

    return participants;
}

export async function updateAttendeeTicketsCount(attendeeId, newCount) {
    const session = await verifySession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) throw new Error('Unauthorized');

    if (newCount < 1) throw new Error('Ticket count must be at least 1');

    await query(
        'UPDATE extra_activity_attendees SET tickets_count = ? WHERE id = ?',
        [newCount, attendeeId]
    );

    const [attendee] = await query('SELECT activity_id FROM extra_activity_attendees WHERE id = ?', [attendeeId]);
    if (attendee) {
        revalidatePath(`/activities/${attendee.activity_id}`);
    }
    return { success: true };
}
