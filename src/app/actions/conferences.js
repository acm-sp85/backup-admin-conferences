'use server';

import { query } from '@/lib/db';
import { verifySession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { logAction } from '@/lib/logger';

export async function createConference(formData) {
    const session = await verifySession();
    if (!session || session.role !== 'superadmin') {
        return { error: 'Only superadmins can create conferences' };
    }

    const name = formData.get('name');
    const acronym = formData.get('acronym');
    const email = formData.get('email');
    const logo_url = formData.get('logo_url') || null;
    const banner_url = formData.get('banner_url') || null;
    const accent_color = formData.get('accent_color') || '#007aff';
    const sponsor_list = formData.get('sponsor_list') || null;
    const conference_address = formData.get('conference_address') || null;
    const signature_image = formData.get('signature_image') || null;
    const text_under_signature = formData.get('text_under_signature') || null;
    const conference_full_name = formData.get('conference_full_name') || null;
    const start_date = formData.get('start_date');
    const end_date = formData.get('end_date');
    const social_dinner_date = formData.get('social_dinner_date') || null;
    const social_dinner_location = formData.get('social_dinner_location') || null;
    const social_dinner_time = formData.get('social_dinner_time') || null;
    const social_dinner_timezone = formData.get('social_dinner_timezone') || null;
    const social_dinner_maps_url = formData.get('social_dinner_maps_url') || null;
    const registration_venue = formData.get('registration_venue') || null;
    const registration_starts_at = formData.get('registration_starts_at') || null;
    const registration_notes = formData.get('registration_notes') || null;
    const registration_maps_url = formData.get('registration_maps_url') || null;
    const email_from_domain = formData.get('email_from_domain') || '@scitoevents.com';
    const poster_voting_mode = formData.get('poster_voting_mode') || 'clusters';

    if (!name || !acronym || !start_date || !end_date) {
        return { error: 'Name, Acronym, Start Date, and End Date are required' };
    }

    try {
        await query(
            'INSERT INTO conferences (name, acronym, email, logo_url, banner_url, accent_color, email_magic_link_body, email_poster_voting_invite_body, email_social_dinner_tickets_body, email_checkin_body, email_certificate_body, certificate_orientation, certificate_background_image, voting_validation_enabled, voting_instructions, emails_enabled, badge_bg, badge_config, sponsor_list, conference_address, signature_image, text_under_signature, conference_full_name, start_date, end_date, social_dinner_date, social_dinner_location, social_dinner_time, social_dinner_timezone, social_dinner_maps_url, registration_venue, registration_starts_at, registration_notes, registration_maps_url, email_from_domain, poster_voting_mode) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
              name,
              acronym,
              email,
              logo_url,
              banner_url,
              accent_color,
              formData.get('email_magic_link_body') || null,
              formData.get('email_poster_voting_invite_body') || null,
              formData.get('email_social_dinner_tickets_body') || null,
              formData.get('email_checkin_body') || null,
              formData.get('email_certificate_body') || null,
              formData.get('certificate_orientation') || 'portrait',
              formData.get('certificate_background_image') || null,
              formData.get('voting_validation_enabled') === 'on' ? 1 : 0,
              formData.get('voting_instructions') || null,
              formData.get('emails_enabled') === 'on' ? 1 : 0,
              formData.get('badge_bg') || null,
              formData.get('badge_config') || null,
              sponsor_list,
              conference_address,
              signature_image,
              text_under_signature,
              conference_full_name,
              start_date,
              end_date,
              social_dinner_date,
              social_dinner_location,
              social_dinner_time,
              social_dinner_timezone,
              social_dinner_maps_url,
              registration_venue,
              registration_starts_at,
              registration_notes,
              registration_maps_url,
              email_from_domain,
              poster_voting_mode
            ]
          );
        await logAction('CREATE', 'CONFERENCE', null, { acronym, name });
        revalidatePath('/');
        return { success: true };
    } catch (error) {
        console.error('Create conference error:', error);
        return { error: 'Failed to create conference. Acronym might already exist.' };
    }
}

export async function deleteConference(id) {
    const session = await verifySession();
    if (!session || session.role !== 'superadmin') {
        return { error: 'Unauthorized' };
    }

    try {
        await query('DELETE FROM conferences WHERE id = ?', [id]);
        await logAction('DELETE', 'CONFERENCE', id);
        revalidatePath('/');
        return { success: true };
    } catch (error) {
        console.error('Delete conference error:', error);
        return { error: 'Failed to delete conference. It might have linked posters or participants.' };
    }
}

export async function toggleVotingWindow(conferenceId, currentStatus) {
    const session = await verifySession();
    if (!session || session.role !== 'superadmin') {
        return { error: 'Unauthorized' };
    }

    try {
        const newStatus = currentStatus === 1 ? 0 : 1;
        await query(
            'UPDATE conferences SET voting_window_open = ? WHERE id = ?',
            [newStatus, conferenceId]
        );
        revalidatePath('/');
        return { success: true, newStatus };
    } catch (error) {
        console.error('Toggle voting error:', error);
        return { error: 'Failed to update voting window' };
    }
}

export async function toggleEmailsEnabled(conferenceId, currentStatus) {
    const session = await verifySession();
    if (!session || session.role !== 'superadmin') {
        return { error: 'Unauthorized' };
    }

    try {
        const newStatus = currentStatus === 1 ? 0 : 1;
        await query(
            'UPDATE conferences SET emails_enabled = ? WHERE id = ?',
            [newStatus, conferenceId]
        );
        revalidatePath('/');
        return { success: true, newStatus };
    } catch (error) {
        console.error('Toggle emails error:', error);
        return { error: 'Failed to update communication status' };
    }
}

export async function updateConference(id, formData) {
    const session = await verifySession();
    if (!session || (session.role !== 'superadmin' && session.role !== 'admin')) {
        return { error: 'Unauthorized' };
    }

    const name = formData.get('name');
    const acronym = formData.get('acronym');
    const email = formData.get('email');
    const logo_url = formData.get('logo_url') || null;
    const banner_url = formData.get('banner_url') || null;
    const accent_color = formData.get('accent_color') || '#007aff';
    const sponsor_list = formData.get('sponsor_list') || null;
    const conference_address = formData.get('conference_address') || null;
    const signature_image = formData.get('signature_image') || null;
    const text_under_signature = formData.get('text_under_signature') || null;
    const conference_full_name = formData.get('conference_full_name') || null;
    const start_date = formData.get('start_date');
    const end_date = formData.get('end_date');
    const social_dinner_date = formData.get('social_dinner_date') || null;
    const social_dinner_location = formData.get('social_dinner_location') || null;
    const social_dinner_time = formData.get('social_dinner_time') || null;
    const social_dinner_timezone = formData.get('social_dinner_timezone') || null;
    const social_dinner_maps_url = formData.get('social_dinner_maps_url') || null;
    const registration_venue = formData.get('registration_venue') || null;
    const registration_starts_at = formData.get('registration_starts_at') || null;
    const registration_notes = formData.get('registration_notes') || null;
    const registration_maps_url = formData.get('registration_maps_url') || null;
    const email_from_domain = formData.get('email_from_domain') || '@scitoevents.com';

    const poster_voting_mode = formData.get('poster_voting_mode') || 'clusters';

    if (!name || !acronym || !start_date || !end_date) {
        return { error: 'Name, Acronym, Start Date, and End Date are required' };
    }

    try {
        await query(
            'UPDATE conferences SET name = ?, acronym = ?, email = ?, logo_url = ?, banner_url = ?, accent_color = ?, email_magic_link_body = ?, email_poster_voting_invite_body = ?, email_social_dinner_tickets_body = ?, email_checkin_body = ?, email_certificate_body = ?, certificate_orientation = ?, certificate_background_image = ?, voting_validation_enabled = ?, voting_instructions = ?, emails_enabled = ?, badge_bg = ?, badge_config = ?, sponsor_list = ?, conference_address = ?, signature_image = ?, text_under_signature = ?, conference_full_name = ?, start_date = ?, end_date = ?, social_dinner_date = ?, social_dinner_location = ?, social_dinner_time = ?, social_dinner_timezone = ?, social_dinner_maps_url = ?, registration_venue = ?, registration_starts_at = ?, registration_notes = ?, registration_maps_url = ?, email_from_domain = ?, poster_voting_mode = ? WHERE id = ?',
            [
              name,
              acronym,
              email,
              logo_url,
              banner_url,
              accent_color,
              formData.get('email_magic_link_body') || null,
              formData.get('email_poster_voting_invite_body') || null,
              formData.get('email_social_dinner_tickets_body') || null,
              formData.get('email_checkin_body') || null,
              formData.get('email_certificate_body') || null,
              formData.get('certificate_orientation') || 'portrait',
              formData.get('certificate_background_image') || null,
              formData.get('voting_validation_enabled') === 'on' ? 1 : 0,
              formData.get('voting_instructions') || null,
              formData.get('emails_enabled') === 'on' ? 1 : 0,
              formData.get('badge_bg') || null,
              formData.get('badge_config') || null,
              sponsor_list,
              conference_address,
              signature_image,
              text_under_signature,
              conference_full_name,
              start_date,
              end_date,
              social_dinner_date,
              social_dinner_location,
              social_dinner_time,
              social_dinner_timezone,
              social_dinner_maps_url,
              registration_venue,
              registration_starts_at,
              registration_notes,
              registration_maps_url,
              email_from_domain,
              poster_voting_mode,
              id
            ]
          );
        await logAction('UPDATE', 'CONFERENCE', id, { name, acronym });
        revalidatePath('/');
        return { success: true };
    } catch (error) {
        console.error('Update conference error:', error);
        return { error: 'Failed to update conference. Acronym might be a duplicate.' };
    }
}

export async function getConferenceTopics(conferenceId) {
    if (!conferenceId) return [];

    try {
        const rows = await query(`
            SELECT mongo_id, name FROM topics WHERE conference_id = ? AND parent_mongo_id IS NULL
            UNION
            SELECT DISTINCT
                COALESCE(parent.mongo_id, t.mongo_id) as mongo_id,
                COALESCE(parent.name, t.name) as name
            FROM posters p
            JOIN topics t ON p.topic_mongo_id COLLATE utf8mb4_unicode_ci = t.mongo_id COLLATE utf8mb4_unicode_ci
            LEFT JOIN topics parent ON t.parent_mongo_id COLLATE utf8mb4_unicode_ci = parent.mongo_id COLLATE utf8mb4_unicode_ci
            WHERE p.conference_id = ? AND p.topic_mongo_id IS NOT NULL
        `, [conferenceId, conferenceId]);

        // Get poster counts per symposium for helpful UI badges
        const countRows = await query(`
            SELECT 
                COALESCE(parent.mongo_id, t.mongo_id) as symposium_mongo_id,
                COUNT(p.id) as poster_count
            FROM posters p
            JOIN topics t ON p.topic_mongo_id COLLATE utf8mb4_unicode_ci = t.mongo_id COLLATE utf8mb4_unicode_ci
            LEFT JOIN topics parent ON t.parent_mongo_id COLLATE utf8mb4_unicode_ci = parent.mongo_id COLLATE utf8mb4_unicode_ci
            WHERE p.conference_id = ? AND p.topic_mongo_id IS NOT NULL
            GROUP BY symposium_mongo_id
        `, [conferenceId]);

        const countsMap = new Map();
        countRows.forEach(c => {
            if (c.symposium_mongo_id) {
                countsMap.set(c.symposium_mongo_id, Number(c.poster_count) || 0);
            }
        });

        // Format and categorize topics
        const formatted = rows.map(r => {
            const cleanName = (r.name || '').replace(/\s+/g, ' ').trim();
            // Extract code like "A1", "B2", "E4", "C3"
            const codeMatch = cleanName.match(/^([A-Za-z]\d+)/);
            const code = codeMatch ? codeMatch[1].toUpperCase() : null;
            const track = code ? `Track ${code[0]}` : 'Other';

            return {
                mongo_id: r.mongo_id,
                name: cleanName,
                code: code || cleanName.substring(0, 10),
                track: track,
                poster_count: countsMap.get(r.mongo_id) || 0
            };
        });

        // Sort by code / name
        formatted.sort((a, b) => {
            if (a.track !== b.track) {
                if (a.track === 'Other') return 1;
                if (b.track === 'Other') return -1;
                return a.track.localeCompare(b.track);
            }
            return (a.code || a.name).localeCompare(b.code || b.name, undefined, { numeric: true, sensitivity: 'base' });
        });

        return formatted;
    } catch (error) {
        console.error('getConferenceTopics error:', error);
        return [];
    }
}

export async function getRegistrationTypes(conferenceId) {
    const session = await verifySession();
    if (!session) {
        throw new Error('Unauthorized');
    }
    try {
        let rows = [];
        if (conferenceId) {
            rows = await query(
                `SELECT DISTINCT p.registration_type 
                 FROM participants p 
                 JOIN registrations r ON p.id = r.participant_id 
                 WHERE r.conference_id = ? AND p.registration_type IS NOT NULL AND p.registration_type != ''
                 ORDER BY p.registration_type ASC`,
                [conferenceId]
            );
        }
        
        if (rows.length === 0) {
            rows = await query(
                `SELECT DISTINCT registration_type 
                 FROM participants 
                 WHERE registration_type IS NOT NULL AND registration_type != ''
                 ORDER BY registration_type ASC`
            );
        }
        
        return rows.map(r => r.registration_type);
    } catch (error) {
        console.error('Error fetching registration types:', error);
        return [];
    }
}

export async function updateConferenceNotes(id, notes) {
    const session = await verifySession();
    if (!session || (session.role !== 'superadmin' && session.role !== 'admin')) {
        return { error: 'Unauthorized' };
    }

    try {
        await query(
            'UPDATE conferences SET notes = ? WHERE id = ?',
            [notes || null, id]
        );
        revalidatePath('/');
        return { success: true };
    } catch (error) {
        console.error('Update conference notes error:', error);
        return { error: 'Failed to update notes.' };
    }
}
