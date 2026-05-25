'use server';

import { query } from '@/lib/db';
import { verifySession } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { revalidatePath } from 'next/cache';
import { Resend } from 'resend';
import { emailTemplates, EMAIL_CONFIG } from '@/lib/email-templates';
import { getEmailTemplate } from '@/lib/email-dispatcher';

const resend = new Resend(process.env.RESEND_API_KEY);

// ============================================
// GROUPS (equivalent to clusters for poster voting)
// ============================================

export async function getCustomVotingGroups(conferenceId) {
    const session = await verifySession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
        throw new Error('Unauthorized');
    }

    return await query(
        'SELECT * FROM custom_voting_groups WHERE conference_id = ? ORDER BY name ASC',
        [conferenceId]
    );
}

export async function createCustomVotingGroup(conferenceId, name, color = '#7c3aed') {
    const session = await verifySession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
        return { error: 'Unauthorized' };
    }

    try {
        const result = await query(
            'INSERT INTO custom_voting_groups (conference_id, name, color) VALUES (?, ?, ?)',
            [conferenceId, name, color]
        );
        revalidatePath('/posters');
        return { success: true, id: result.insertId };
    } catch (error) {
        console.error('Create custom voting group error:', error);
        return { error: 'Failed to create group' };
    }
}

export async function updateCustomVotingGroup(groupId, name, color) {
    const session = await verifySession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
        return { error: 'Unauthorized' };
    }

    try {
        await query(
            'UPDATE custom_voting_groups SET name = ?, color = ? WHERE id = ?',
            [name, color, groupId]
        );
        revalidatePath('/posters');
        return { success: true };
    } catch (error) {
        console.error('Update custom voting group error:', error);
        return { error: 'Failed to update group' };
    }
}

export async function deleteCustomVotingGroup(groupId) {
    const session = await verifySession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
        return { error: 'Unauthorized' };
    }

    try {
        await query('DELETE FROM custom_voting_groups WHERE id = ?', [groupId]);
        revalidatePath('/posters');
        return { success: true };
    } catch (error) {
        console.error('Delete custom voting group error:', error);
        return { error: 'Failed to delete group' };
    }
}

// ============================================
// ITEMS (program slots assigned to groups)
// ============================================

export async function getCustomVotingItems(groupId) {
    const session = await verifySession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
        throw new Error('Unauthorized');
    }

    return await query(`
        SELECT cvi.*, ps.title, ps.presenter_name, ps.type, ps.start_time, ps.end_time,
               pss.session_name, pss.full_session_name
        FROM custom_voting_items cvi
        JOIN program_slots ps ON cvi.slot_id = ps.id
        JOIN program_sessions pss ON ps.session_id = pss.id
        WHERE cvi.group_id = ?
        ORDER BY ps.start_time ASC
    `, [groupId]);
}

export async function getCustomVotingItemsByConference(conferenceId) {
    const session = await verifySession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
        throw new Error('Unauthorized');
    }

    return await query(`
        SELECT cvi.*, cvg.name as group_name, cvg.color as group_color,
               ps.title, ps.presenter_name, ps.type, ps.start_time, ps.end_time,
               pss.session_name, pss.full_session_name
        FROM custom_voting_items cvi
        JOIN custom_voting_groups cvg ON cvi.group_id = cvg.id
        JOIN program_slots ps ON cvi.slot_id = ps.id
        JOIN program_sessions pss ON ps.session_id = pss.id
        WHERE cvg.conference_id = ?
        ORDER BY cvg.name ASC, ps.start_time ASC
    `, [conferenceId]);
}

export async function addCustomVotingItem(groupId, slotId) {
    const session = await verifySession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
        return { error: 'Unauthorized' };
    }

    try {
        await query(
            'INSERT INTO custom_voting_items (group_id, slot_id) VALUES (?, ?)',
            [groupId, slotId]
        );
        revalidatePath('/posters');
        return { success: true };
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return { error: 'This presentation is already in the group' };
        }
        console.error('Add custom voting item error:', error);
        return { error: 'Failed to add item' };
    }
}

export async function removeCustomVotingItem(itemId) {
    const session = await verifySession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
        return { error: 'Unauthorized' };
    }

    try {
        await query('DELETE FROM custom_voting_items WHERE id = ?', [itemId]);
        revalidatePath('/posters');
        return { success: true };
    } catch (error) {
        console.error('Remove custom voting item error:', error);
        return { error: 'Failed to remove item' };
    }
}

// ============================================
// PROGRAM SLOTS LOOKUP (for the picker UI)
// ============================================

export async function getProgramSlotsForConference(conferenceId) {
    const session = await verifySession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
        throw new Error('Unauthorized');
    }

    return await query(`
        SELECT ps.id, ps.title, ps.presenter_name, ps.type, ps.start_time, ps.end_time,
               pss.session_name, pss.full_session_name, pss.id as session_id
        FROM program_slots ps
        JOIN program_sessions pss ON ps.session_id = pss.id
        WHERE pss.conference_id = ? AND ps.title IS NOT NULL AND ps.title != ''
        ORDER BY pss.start_time ASC, ps.start_time ASC
    `, [conferenceId]);
}

// ============================================
// VOTER MANAGEMENT
// ============================================

export async function getCustomVotersForConference(conferenceId) {
    const session = await verifySession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
        throw new Error('Unauthorized');
    }

    return await query(`
        SELECT 
            p.id, 
            CONCAT(COALESCE(p.firstName, ''), ' ', COALESCE(p.lastName, '')) as name, 
            p.email, 
            r.custom_voting_group, 
            COALESCE(r.has_custom_voted, 0) as has_custom_voted
        FROM participants p
        JOIN registrations r ON p.id = r.participant_id
        WHERE r.conference_id = ? AND r.custom_voting_group IS NOT NULL
        ORDER BY p.firstName ASC, p.lastName ASC
    `, [conferenceId]);
}

export async function searchConferenceParticipantsForCustomVoting(conferenceId, search) {
    const session = await verifySession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
        throw new Error('Unauthorized');
    }

    if (!search || search.length < 2) return [];

    return await query(`
        SELECT p.id, CONCAT(COALESCE(p.firstName, ''), ' ', COALESCE(p.lastName, '')) as name, p.email, r.custom_voting_group
        FROM participants p
        JOIN registrations r ON p.id = r.participant_id
        WHERE r.conference_id = ? AND (p.firstName LIKE ? OR p.lastName LIKE ? OR p.email LIKE ?)
        LIMIT 10
    `, [conferenceId, `%${search}%`, `%${search}%`, `%${search}%`]);
}

export async function updateCustomVoterGroups(participantId, groupsArray, conferenceId) {
    const session = await verifySession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
        return { error: 'Unauthorized' };
    }

    if (!conferenceId) return { error: 'Conference ID is required' };

    try {
        const groupsJson = JSON.stringify(groupsArray || []);
        
        await query(
            'UPDATE registrations SET custom_voting_group = ? WHERE participant_id = ? AND conference_id = ?',
            [groupsJson, participantId, conferenceId]
        );

        revalidatePath('/posters');
        return { success: true };
    } catch (error) {
        console.error('Update custom voter groups error:', error);
        return { error: 'Failed to update groups' };
    }
}

export async function removeCustomVoter(participantId, conferenceId) {
    const session = await verifySession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
        return { error: 'Unauthorized' };
    }

    try {
        await query(
            'UPDATE registrations SET custom_voting_group = NULL, has_custom_voted = 0, custom_votes = NULL WHERE participant_id = ? AND conference_id = ?',
            [participantId, conferenceId]
        );
        revalidatePath('/posters');
        return { success: true };
    } catch (error) {
        console.error('Remove custom voter error:', error);
        return { error: 'Failed to remove voter' };
    }
}

export async function addAllCheckedInAttendeesToCustomVoting(conferenceId) {
    const session = await verifySession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
        return { error: 'Unauthorized' };
    }

    try {
        // We want to initialize custom_voting_group to '[]' for checked-in attendees 
        // who don't already have it set.
        await query(`
            UPDATE registrations r
            JOIN participant_qr_tokens t ON r.id = t.registration_id
            SET r.custom_voting_group = '[]' 
            WHERE r.conference_id = ? 
            AND t.scanned_at IS NOT NULL 
            AND r.custom_voting_group IS NULL
        `, [conferenceId]);
        
        revalidatePath('/posters');
        return { success: true };
    } catch (error) {
        console.error('Add all checked-in attendees error:', error);
        return { error: 'Failed to add attendees' };
    }
}

// ============================================
// VOTING (participant-facing)
// ============================================

export async function getCustomVotingParticipantByToken(token) {
    const [row] = await query(`
        SELECT 
            p.id, 
            CONCAT(COALESCE(p.firstName, ''), ' ', COALESCE(p.lastName, '')) as name,
            p.email,
            r.conference_id, 
            r.custom_voting_group, 
            r.has_custom_voted, 
            r.custom_votes,
            c.acronym as conference_acronym, 
            c.email as conference_email,
            c.voting_window_open,
            c.custom_voting_instructions
        FROM participants p
        JOIN registrations r ON p.id = r.participant_id
        JOIN conferences c ON r.conference_id = c.id
        JOIN participant_qr_tokens t ON r.id = t.registration_id
        WHERE t.token = ?
    `, [token]);

    if (row && typeof row.custom_voting_group === 'string') {
        try {
            row.custom_voting_group = JSON.parse(row.custom_voting_group);
        } catch (e) {
            row.custom_voting_group = [];
        }
    }
    if (row && typeof row.custom_votes === 'string') {
        try {
            row.custom_votes = JSON.parse(row.custom_votes);
        } catch (e) {
            row.custom_votes = {};
        }
    }

    return row || null;
}

export async function submitCustomVotes(userId, votes, conferenceId) {
    if (!conferenceId) return { error: 'Conference ID required' };

    try {
        // 1. Get current votes
        const [reg] = await query(
            'SELECT custom_votes FROM registrations WHERE participant_id = ? AND conference_id = ?',
            [userId, conferenceId]
        );
        if (!reg) return { error: 'Registration not found' };

        let currentVotes = {};
        try {
            currentVotes = typeof reg.custom_votes === 'string' ? JSON.parse(reg.custom_votes) : (reg.custom_votes || {});
        } catch (e) { currentVotes = {}; }

        const combinedVotes = { ...currentVotes, ...votes };

        // 2. Save votes to registrations
        await query(
            'UPDATE registrations SET custom_votes = ?, has_custom_voted = 1 WHERE participant_id = ? AND conference_id = ?',
            [JSON.stringify(combinedVotes), userId, conferenceId]
        );

        revalidatePath('/voting');
        revalidatePath('/posters');
        return { success: true };
    } catch (error) {
        console.error('Submit custom votes error:', error);
        return { error: 'Failed to submit votes' };
    }
}

// ============================================
// RESULTS
// ============================================

export async function getCustomVotingResults(conferenceId) {
    const session = await verifySession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
        throw new Error('Unauthorized');
    }

    // Get all items with their group info
    const items = await query(`
        SELECT cvi.id as item_id, cvi.slot_id, cvg.id as group_id, cvg.name as group_name, cvg.color as group_color,
               ps.title, ps.presenter_name, ps.type, ps.start_time, ps.end_time,
               pss.session_name
        FROM custom_voting_items cvi
        JOIN custom_voting_groups cvg ON cvi.group_id = cvg.id
        JOIN program_slots ps ON cvi.slot_id = ps.id
        JOIN program_sessions pss ON ps.session_id = pss.id
        WHERE cvg.conference_id = ?
        ORDER BY cvg.name ASC, ps.start_time ASC
    `, [conferenceId]);

    // Get all custom votes for this conference
    const registrations = await query(
        'SELECT participant_id, custom_votes FROM registrations WHERE conference_id = ? AND custom_votes IS NOT NULL',
        [conferenceId]
    );

    // Build a map: slot_id -> { totalPoints, voteCount, voters: { participantId: score } }
    const voteMap = {};
    registrations.forEach(reg => {
        try {
            const votes = typeof reg.custom_votes === 'string' ? JSON.parse(reg.custom_votes) : (reg.custom_votes || {});
            Object.entries(votes).forEach(([slotId, score]) => {
                if (!voteMap[slotId]) voteMap[slotId] = { totalPoints: 0, voteCount: 0, voters: {} };
                voteMap[slotId].totalPoints += score;
                voteMap[slotId].voteCount += 1;
                voteMap[slotId].voters[reg.participant_id] = score;
            });
        } catch (e) {}
    });

    // Merge results
    const results = items.map(item => {
        const votes = voteMap[item.slot_id] || { totalPoints: 0, voteCount: 0, voters: {} };
        return {
            ...item,
            points: votes.totalPoints,
            votesCount: votes.voteCount,
            calculatedScore: votes.voteCount > 0 ? (votes.totalPoints / votes.voteCount) : 0,
            voters: votes.voters
        };
    });

    // Sort by score descending
    results.sort((a, b) => b.calculatedScore - a.calculatedScore);

    return results;
}

export async function resetCustomVotingResults(conferenceId) {
    const session = await verifySession();
    if (!session || session.role !== 'superadmin') {
        return { error: 'Unauthorized - superadmin only' };
    }

    try {
        await query(
            'UPDATE registrations SET custom_votes = NULL, has_custom_voted = 0 WHERE conference_id = ?',
            [conferenceId]
        );
        revalidatePath('/posters');
        return { success: true };
    } catch (error) {
        console.error('Reset custom voting results error:', error);
        return { error: 'Failed to reset results' };
    }
}

// ============================================
// INVITATIONS
// ============================================

export async function sendCustomVoterInvite(participantId, conferenceId) {
    const session = await verifySession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
        return { error: 'Unauthorized' };
    }

    if (!conferenceId) return { error: 'Conference ID is required' };

    const { success: rateLimitOk, resetAt } = await checkRateLimit(`admin-${session.userId}`, 'custom-invite', 1000, 3600);
    if (!rateLimitOk) {
        return { error: `Invitation limit reached. Please try again after ${resetAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.` };
    }

    try {
        // 1. Get participant + conference details
        const participants = await query(`
            SELECT p.firstName, p.lastName, p.email as participant_email, r.custom_voting_group, c.*
            FROM participants p
            JOIN registrations r ON p.id = r.participant_id
            JOIN conferences c ON r.conference_id = c.id
            WHERE p.id = ? AND r.conference_id = ?
        `, [participantId, conferenceId]);
        const participant = participants[0];
        
        if (!participant) return { error: 'Participant/Registration not found' };
        
        if (!participant.emails_enabled) {
            return { error: 'Communication is currently LOCKED for this conference. Please enable it in Conference Settings first.' };
        }

        // 2. Look up the participant's QR token for the voting URL
        const [tokenRow] = await query(`
            SELECT t.token
            FROM participant_qr_tokens t
            JOIN registrations r ON t.registration_id = r.id
            WHERE r.participant_id = ? AND r.conference_id = ?
        `, [participantId, conferenceId]);

        if (!tokenRow) {
            return { error: 'No QR token found for this participant. They may need a check-in QR first.' };
        }

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                        (process.env.VERCEL_ENV === 'production' ? 'https://www.smart-conference.org' || 'https://smart-conference.org' : 
                         process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
                         'http://localhost:3000');
        const votingLink = `${baseUrl}/voting/custom/v?t=${tokenRow.token}`;

        // 3. Send email
        console.log(`📧 Sending Custom Voting Invite to ${participant.participant_email} from ${EMAIL_CONFIG.fromVoting}`);
        const { subject, html } = await getEmailTemplate(conferenceId, 'customVotingInvite', {
            name: participant.firstName,
            votingLink
        });

        const { data, error } = await resend.emails.send({
            from: EMAIL_CONFIG.fromVoting,
            to: participant.participant_email,
            subject,
            html
        });

        if (error) {
            console.error('❌ Resend Custom Voting Error:', JSON.stringify(error, null, 2));
            return { error: error.message };
        }
        console.log('✅ Custom Voting Invite Sent Successfully:', data);

        return { success: true };
    } catch (error) {
        console.error('Custom voting invite error:', error);
        return { error: 'Failed to send invitation: ' + error.message };
    }
}

export async function resetCustomVoterVotes(participantId, conferenceId) {
    const session = await verifySession();
    if (!session || session.role !== 'superadmin') {
        return { error: 'Unauthorized - superadmin only' };
    }

    try {
        await query(
            'UPDATE registrations SET custom_votes = NULL, has_custom_voted = 0 WHERE participant_id = ? AND conference_id = ?',
            [participantId, conferenceId]
        );
        revalidatePath('/posters');
        return { success: true };
    } catch (error) {
        console.error('Reset custom voter votes error:', error);
        return { error: 'Failed to reset votes' };
    }
}
