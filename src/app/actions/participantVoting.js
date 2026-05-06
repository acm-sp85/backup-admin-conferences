'use server';

import { query } from '@/lib/db';
import { verifySession } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import crypto from 'crypto';
import { Resend } from 'resend';

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
            c.voting_window_open
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
        const [participant] = await query(`
            SELECT p.firstName, p.lastName, p.email, r.cluster_for_review 
            FROM participants p
            JOIN registrations r ON p.id = r.participant_id
            WHERE p.id = ? AND r.conference_id = ?
        `, [participantId, conferenceId]);
        
        if (!participant) return { error: 'Participant/Registration not found' };

        // 2. Ensure user exists in users table
        const [existingUser] = await query('SELECT id FROM users WHERE email = ?', [participant.email]);
        let userId;

        if (existingUser) {
            await query(
                'UPDATE users SET cluster_for_review = ?, firstName = ?, lastName = ? WHERE email = ?',
                [participant.cluster_for_review, participant.firstName, participant.lastName, participant.email]
            );
            userId = existingUser.id;
        } else {
            const res = await query(
                'INSERT INTO users (email, role, cluster_for_review, firstName, lastName) VALUES (?, ?, ?, ?, ?)',
                [participant.email, 'user', participant.cluster_for_review, participant.firstName, participant.lastName]
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
        await resend.emails.send({
            from: 'SCITO Voting <no-reply@scitoevents.com>',
            to: participant.email,
            subject: 'Invitation to Poster Voting',
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 12px;">
                    <h2 style="color: #1e293b; margin-bottom: 20px;">Poster Voting Invitation</h2>
                    <p style="color: #475569; line-height: 1.6; margin-bottom: 20px;">
                        Hello ${participant.firstName || 'Voter'},<br><br>
                        You have been invited to participate in the poster voting process. 
                        Please use the link below to access your assigned clusters and cast your votes.
                    </p>
                    <div style="margin: 30px 0;">
                        <a href="${magicLink}" style="background-color: #0071e3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
                            Log In to Vote
                        </a>
                    </div>
                    <p style="color: #64748b; font-size: 13px; margin-top: 30px; border-top: 1px solid #f1f5f9; pt-20">
                        <strong>Instructions:</strong><br>
                        1. Log in to the platform using the button above.<br>
                        2. Go to the "Voting" tab to see your assigned posters.<br>
                        3. Rank them from 1 to 10 and save.
                    </p>
                    <p style="margin-top: 20px; font-size: 11px; color: #94a3b8;">
                        This link will expire in 48 hours. After that, you can request a new login link at any time from the login page.
                    </p>
                </div>
            `
        });

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
