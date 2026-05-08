'use server';

import { query } from '@/lib/db';
import { verifySession } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import crypto from 'crypto';
import { Resend } from 'resend';
import { emailTemplates, EMAIL_CONFIG } from '@/lib/email-templates';
import { getEmailTemplate } from '@/lib/email-dispatcher';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function searchConferenceParticipants(conferenceId, search) {
    const session = await verifySession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
        throw new Error('Unauthorized');
    }

    if (!search || search.length < 2) return [];

    return await query(`
        SELECT p.id, CONCAT(COALESCE(p.firstName, ''), ' ', COALESCE(p.lastName, '')) as name, p.email, p.cluster_for_review
        FROM participants p
        JOIN registrations r ON p.id = r.participant_id
        WHERE r.conference_id = ? AND (p.firstName LIKE ? OR p.lastName LIKE ? OR p.email LIKE ?)
        LIMIT 10
    `, [conferenceId, `%${search}%`, `%${search}%`, `%${search}%`]);
}

export async function getVotersForConference(conferenceId) {
    const session = await verifySession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
        throw new Error('Unauthorized');
    }

    return await query(`
        SELECT 
            p.id, 
            CONCAT(COALESCE(p.firstName, ''), ' ', COALESCE(p.lastName, '')) as name, 
            p.email, 
            r.cluster_for_review, 
            r.has_voted
        FROM participants p
        JOIN registrations r ON p.id = r.participant_id
        WHERE r.conference_id = ? AND r.cluster_for_review IS NOT NULL
        ORDER BY p.firstName ASC, p.lastName ASC
    `, [conferenceId]);
}

export async function updateParticipantClusters(participantId, clustersArray, conferenceId) {
    const session = await verifySession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
        return { error: 'Unauthorized' };
    }

    if (!conferenceId) return { error: 'Conference ID is required' };

    try {
        const clustersJson = JSON.stringify(clustersArray || []);
        
        // 1. Update registrations table (Specific to this conference)
        await query(
            'UPDATE registrations SET cluster_for_review = ? WHERE participant_id = ? AND conference_id = ?',
            [clustersJson, participantId, conferenceId]
        );

        // 2. Get email and names to sync with users table
        const [participant] = await query('SELECT firstName, lastName, email FROM participants WHERE id = ?', [participantId]);
        if (!participant) return { error: 'Participant not found' };

        const fullName = `${participant.firstName || ''} ${participant.lastName || ''}`.trim() || 'Voter';

        // 3. Sync to users table
        await query(`
            INSERT INTO users (email, role, cluster_for_review, firstName, lastName) 
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE cluster_for_review = VALUES(cluster_for_review)
        `, [participant.email, 'user', clustersJson, participant.firstName, participant.lastName]);

        revalidatePath('/posters');
        revalidatePath('/voting');
        return { success: true };
    } catch (error) {
        console.error('Update participant clusters error:', error);
        return { error: 'Failed to update clusters' };
    }
}

export async function removeVoter(participantId, conferenceId) {
    const session = await verifySession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
        return { error: 'Unauthorized' };
    }

    try {
        await query(
            'UPDATE registrations SET cluster_for_review = NULL, has_voted = 0, votes = NULL WHERE participant_id = ? AND conference_id = ?',
            [participantId, conferenceId]
        );
        revalidatePath('/voting');
        return { success: true };
    } catch (error) {
        console.error('Remove voter error:', error);
        return { error: 'Failed to remove voter' };
    }
}

export async function getParticipantByToken(token) {
    // Look for participant via registration token
    const [row] = await query(`
        SELECT 
            p.id, 
            CONCAT(COALESCE(p.firstName, ''), ' ', COALESCE(p.lastName, '')) as name,
            p.email,
            r.conference_id, 
            r.cluster_for_review, 
            r.has_voted, 
            r.votes,
            c.acronym as conference_acronym, 
            c.email as conference_email,
            c.voting_window_open,
            c.voting_validation_enabled,
            c.voting_instructions
        FROM participants p
        JOIN registrations r ON p.id = r.participant_id
        JOIN conferences c ON r.conference_id = c.id
        WHERE r.check_in_token = ?
    `, [token]);

    if (row && typeof row.cluster_for_review === 'string') {
        try {
            row.cluster_for_review = JSON.parse(row.cluster_for_review);
        } catch (e) {
            row.cluster_for_review = [];
        }
    }
    if (row && typeof row.votes === 'string') {
        try {
            row.votes = JSON.parse(row.votes);
        } catch (e) {
            row.votes = {};
        }
    }

    return row || null;
}

export async function sendVoterInvite(participantId, conferenceId) {
    const session = await verifySession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
        return { error: 'Unauthorized' };
    }

    if (!conferenceId) return { error: 'Conference ID is required' };

    // Rate limiting: 50 invites per hour per admin
    const { success, resetAt } = await checkRateLimit(`admin-${session.userId}`, 'invite', 50, 3600);
    if (!success) {
        return { error: `Invitation limit reached. Please try again after ${resetAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.` };
    }

    try {
        // 1. Get participant details and REGISTRATION-specific cluster data
        const participants = await query(`
            SELECT p.firstName, p.lastName, p.email as participant_email, r.cluster_for_review, c.*
            FROM participants p
            JOIN registrations r ON p.id = r.participant_id
            JOIN conferences c ON r.conference_id = c.id
            WHERE p.id = ? AND r.conference_id = ?
        `, [participantId, conferenceId]);
        const participant = participants[0];
        
        if (!participant) return { error: 'Participant/Registration not found' };
        
        // 1.5 Safety Check: Is communication enabled for this conference?
        if (!participant.emails_enabled) {
            return { error: 'Communication is currently LOCKED for this conference. Please enable it in Conference Settings first.' };
        }

        // 2. Ensure user exists in users table
        const [existingUser] = await query('SELECT id FROM users WHERE email = ?', [participant.participant_email]);
        let userId;

        if (existingUser) {
            await query(
                'UPDATE users SET cluster_for_review = ?, firstName = ?, lastName = ? WHERE email = ?',
                [participant.cluster_for_review, participant.firstName, participant.lastName, participant.participant_email]
            );
            userId = existingUser.id;
        } else {
            const res = await query(
                'INSERT INTO users (email, role, cluster_for_review, firstName, lastName) VALUES (?, ?, ?, ?, ?)',
                [participant.participant_email, 'user', participant.cluster_for_review, participant.firstName, participant.lastName]
            );
            userId = res.insertId;
        }

        // 3. Generate Magic Link (48 hours expiry for invitations)
        const { encrypt } = require('@/lib/auth');
        const token = await encrypt({ 
            userId: userId, 
            role: 'user', 
            type: 'magic-link' 
        }, '48h');
        
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
        const magicLink = `${baseUrl}/api/auth/callback?token=${token}`;


        // 4. Send email
        console.log(`📧 Sending Voting Invite to ${participant.participant_email} from ${EMAIL_CONFIG.fromVoting}`);
        const { subject, html } = await getEmailTemplate(conferenceId, 'posterVotingInvite', {
            name: participant.firstName,
            magicLink
        });

        const { data, error } = await resend.emails.send({
            from: EMAIL_CONFIG.fromVoting,
            to: participant.participant_email,
            subject,
            html
        });

        if (error) {
            console.error('❌ Resend Voting Error:', JSON.stringify(error, null, 2));
            return { error: error.message };
        }
        console.log('✅ Voting Invite Sent Successfully:', data);

        return { success: true };
    } catch (error) {
        console.error('Invite error:', error);
        return { error: 'Failed to send invitation: ' + error.message };
    }
}

export async function toggleVoterStatus(participantId, conferenceId) {
    const session = await verifySession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
        return { error: 'Unauthorized' };
    }

    if (!conferenceId) return { error: 'Conference ID is required' };

    try {
        const [reg] = await query('SELECT cluster_for_review FROM registrations WHERE participant_id = ? AND conference_id = ?', [participantId, conferenceId]);
        
        if (!reg || reg.cluster_for_review === null) {
            // Promote to voter for THIS conference
            return await updateParticipantClusters(participantId, [], conferenceId);
        } else {
            // Remove from voters for THIS conference
            return await removeVoter(participantId, conferenceId);
        }
    } catch (error) {
        console.error('Toggle voter status error:', error);
        return { error: 'Failed to toggle voter status' };
    }
}
