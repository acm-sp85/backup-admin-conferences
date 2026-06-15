'use server';

import { query } from '@/lib/db';
import { verifySession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

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

    if (!name || !acronym || !start_date || !end_date) {
        return { error: 'Name, Acronym, Start Date, and End Date are required' };
    }

    try {
        await query(
            'INSERT INTO conferences (name, acronym, email, logo_url, banner_url, accent_color, email_magic_link_body, email_poster_voting_invite_body, email_social_dinner_tickets_body, email_checkin_body, voting_validation_enabled, voting_instructions, emails_enabled, badge_bg, badge_config, sponsor_list, conference_address, signature_image, text_under_signature, conference_full_name, start_date, end_date, social_dinner_date, social_dinner_location, social_dinner_time, social_dinner_timezone, social_dinner_maps_url, registration_venue, registration_starts_at, registration_notes, registration_maps_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
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
              registration_maps_url
            ]
          );
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

    if (!name || !acronym || !start_date || !end_date) {
        return { error: 'Name, Acronym, Start Date, and End Date are required' };
    }

    try {
        await query(
            'UPDATE conferences SET name = ?, acronym = ?, email = ?, logo_url = ?, banner_url = ?, accent_color = ?, email_magic_link_body = ?, email_poster_voting_invite_body = ?, email_social_dinner_tickets_body = ?, email_checkin_body = ?, voting_validation_enabled = ?, voting_instructions = ?, emails_enabled = ?, badge_bg = ?, badge_config = ?, sponsor_list = ?, conference_address = ?, signature_image = ?, text_under_signature = ?, conference_full_name = ?, start_date = ?, end_date = ?, social_dinner_date = ?, social_dinner_location = ?, social_dinner_time = ?, social_dinner_timezone = ?, social_dinner_maps_url = ?, registration_venue = ?, registration_starts_at = ?, registration_notes = ?, registration_maps_url = ? WHERE id = ?',
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
              id
            ]
          );
        revalidatePath('/');
        return { success: true };
    } catch (error) {
        console.error('Update conference error:', error);
        return { error: 'Failed to update conference. Acronym might be a duplicate.' };
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

