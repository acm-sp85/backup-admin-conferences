'use server';

import { query } from '@/lib/db';
import { verifySession } from '@/lib/auth';
import { Resend } from 'resend';
import { revalidatePath } from 'next/cache';
import { EMAIL_CONFIG } from '@/lib/email-templates';
import { getEmailTemplate } from '@/lib/email-dispatcher';
import { resolveEmail } from '@/lib/email-resolver';

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Send a Certificate of Participation email to a single participant.
 * Requires the participant to be checked-in (scanned_at IS NOT NULL).
 */
export async function sendCertificateEmail(registrationId) {
    const session = await verifySession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
        throw new Error('Unauthorized');
    }

    // Fetch participant, conference, and check-in data
    const [participant] = await query(`
        SELECT 
            p.email, p.email_alias, p.firstName, p.lastName,
            p.registration_type, p.entity, p.entity_address, p.entity_zip, p.entity_city, p.entity_country,
            CONCAT(COALESCE(p.firstName, ''), ' ', COALESCE(p.lastName, '')) as name,
            c.id as conference_id, c.name as conference_name, c.emails_enabled,
            c.sponsor_list, c.conference_address, c.signature_image, c.text_under_signature, c.conference_full_name,
            t.token, t.scanned_at, t.cert_sent_at,
            pay.group_name as payment_group
        FROM participants p
        JOIN registrations r ON p.id = r.participant_id
        JOIN conferences c ON r.conference_id = c.id
        LEFT JOIN participant_qr_tokens t ON r.id = t.registration_id
        LEFT JOIN (
            SELECT registration_id, group_name 
            FROM payments 
            WHERE group_name IS NOT NULL AND group_name != ''
            ORDER BY created_at DESC 
            LIMIT 1
        ) pay ON r.id = pay.registration_id
        WHERE r.id = ?
    `, [registrationId]);

    if (!participant) throw new Error('Participant not found');
    
    if (!participant.scanned_at) {
        throw new Error('Cannot send certificate: participant has not checked in.');
    }

    if (!participant.emails_enabled) {
        throw new Error('Communication is currently LOCKED for this conference. Please enable it in Conference Settings first.');
    }

    // Determine the best institution/group name available
    const institution = participant.entity || participant.payment_group || '';
    
    // Determine registration type from payment group or participant field
    const registrationType = participant.payment_group || participant.registration_type || '';

    // Fetch start and end dates from program_sessions
    const [datesRow] = await query(`
        SELECT MIN(start_time) as start_date, MAX(end_time) as end_date 
        FROM program_sessions 
        WHERE conference_id = ?
    `, [participant.conference_id]);

    let conferenceDates = '';
    if (datesRow && datesRow.start_date && datesRow.end_date) {
        const start = new Date(datesRow.start_date);
        const end = new Date(datesRow.end_date);
        
        const startDay = start.getDate();
        const startMonth = start.toLocaleDateString('en-GB', { month: 'long' });
        const startYear = start.getFullYear();
        
        const endDay = end.getDate();
        const endMonth = end.toLocaleDateString('en-GB', { month: 'long' });
        const endYear = end.getFullYear();
        
        if (startYear !== endYear) {
            conferenceDates = `${startDay} ${startMonth} ${startYear} to ${endDay} ${endMonth} ${endYear}`;
        } else if (startMonth !== endMonth) {
            conferenceDates = `${startDay} ${startMonth} to ${endDay} ${endMonth} ${startYear}`;
        } else if (startDay !== endDay) {
            conferenceDates = `${startDay} to ${endDay} ${startMonth} ${startYear}`;
        } else {
            conferenceDates = `${startDay} ${startMonth} ${startYear}`;
        }
    }

    // Fetch Posters
    const posters = await query('SELECT id, title, authors FROM posters WHERE conference_id = ?', [participant.conference_id]);
    
    // Fetch Program Slots
    const slots = await query('SELECT id, type, title, presenter_name FROM program_slots WHERE session_id IN (SELECT id FROM program_sessions WHERE conference_id = ?)', [participant.conference_id]);

    const compareNames = (presenter, firstName, lastName) => {
        if (!presenter || !firstName || !lastName) return false;
        
        const presenterClean = presenter.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const firstClean = firstName.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const lastClean = lastName.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
        // Case 1: Presenter contains a comma (usually "LastName, FirstName")
        if (presenterClean.includes(',')) {
            const parts = presenterClean.split(',');
            const presLast = parts[0].trim();
            const presFirst = parts[1] ? parts[1].trim() : '';
            
            // Check if last names are equal, and first name matches or is a prefix/suffix
            if (presLast === lastClean && (presFirst.includes(firstClean) || firstClean.includes(presFirst))) {
                return true;
            }
            // Sometimes lastName in the DB contains multiple surnames but only one matches:
            if (lastClean.includes(presLast) && presLast.length > 2 && (presFirst.includes(firstClean) || firstClean.includes(presFirst))) {
                return true;
            }
        }
        
        // Case 2: No comma, check direct combinations
        const option1 = `${firstClean} ${lastClean}`;
        const option2 = `${lastClean} ${firstClean}`;
        if (presenterClean === option1 || presenterClean === option2) {
            return true;
        }
        
        // Case 3: Fuzzy check - both first and last name appear somewhere in the presenter string
        if (presenterClean.includes(firstClean) && presenterClean.includes(lastClean)) {
            return true;
        }
        
        return false;
    };

    const presentations = [];
    const fName = participant.firstName || '';
    const lName = participant.lastName || '';
    
    // Check slots
    for (const slot of slots) {
        if (slot.presenter_name && compareNames(slot.presenter_name, fName, lName)) {
            presentations.push(slot.title);
        }
    }
    
    // Check posters (only primary author)
    for (const poster of posters) {
        let authors = [];
        try {
            authors = typeof poster.authors === 'string' ? JSON.parse(poster.authors) : poster.authors;
        } catch (e) {}
        
        if (Array.isArray(authors) && authors.length > 0) {
            const primaryAuthor = authors[0];
            let aName = '';
            if (typeof primaryAuthor === 'string') {
                aName = primaryAuthor;
            } else if (primaryAuthor.name) {
                aName = primaryAuthor.name;
            }
            
            if (aName && compareNames(aName, fName, lName)) {
                presentations.push(poster.title);
            }
        }
    }

    // Build email
    const { subject, html } = await getEmailTemplate(participant.conference_id, 'certificate', {
        name: participant.name,
        institution,
        entityAddress: participant.entity_address,
        entityZip: participant.entity_zip,
        entityCity: participant.entity_city,
        entityCountry: participant.entity_country,
        registrationType,
        checkinDate: participant.scanned_at,
        today: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
        conference: participant.conference_name,
        sponsorList: participant.sponsor_list,
        conferenceAddress: participant.conference_address,
        signatureImage: participant.signature_image,
        textUnderSignature: participant.text_under_signature,
        conferenceFullName: participant.conference_full_name,
        conferenceDates,
        presentations
    });

    const { error } = await resend.emails.send({
        from: EMAIL_CONFIG.fromConferences,
        to: [resolveEmail(participant)],
        subject,
        html
    });

    if (error) {
        console.error('Resend Error (Certificate):', error);
        throw new Error(error.message);
    }

    // Update cert_sent_at
    await query(
        'UPDATE participant_qr_tokens SET cert_sent_at = NOW() WHERE registration_id = ?',
        [registrationId]
    );

    revalidatePath('/participants');
    return { success: true };
}
