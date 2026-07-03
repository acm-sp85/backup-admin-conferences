'use server';

import { query } from '@/lib/db';
import { verifySession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import crypto from 'crypto';

export async function searchGlobalParticipants(searchTerm) {
    const session = await verifySession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
        throw new Error('Unauthorized');
    }

    if (!searchTerm || searchTerm.trim().length < 2) return [];

    const cleanSearch = `%${searchTerm.trim()}%`;
    return await query(`
        SELECT id, firstName, lastName, email, entity, country, registration_type
        FROM participants
        WHERE firstName LIKE ? OR lastName LIKE ? OR email LIKE ?
        LIMIT 20
    `, [cleanSearch, cleanSearch, cleanSearch]);
}

export async function registerExistingParticipant(participantId, conferenceId, registrationType) {
    const session = await verifySession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
        throw new Error('Unauthorized');
    }

    if (!participantId || !conferenceId) {
        throw new Error('Missing participant ID or conference ID');
    }

    // Check if they are already registered for this conference
    const [existingReg] = await query(
        'SELECT id FROM registrations WHERE participant_id = ? AND conference_id = ?',
        [participantId, conferenceId]
    );

    if (existingReg) {
        throw new Error('This participant is already registered for this conference');
    }

    // Insert new registration
    const regRes = await query(
        'INSERT INTO registrations (participant_id, conference_id, status, is_manual) VALUES (?, ?, ?, 1)',
        [participantId, conferenceId, 'Registered']
    );
    const regId = regRes.insertId;

    // Generate QR token
    const token = crypto.randomBytes(24).toString('hex');
    await query(
        'INSERT INTO participant_qr_tokens (registration_id, token) VALUES (?, ?)',
        [regId, token]
    );

    // Update participant registration type and set is_manual = 1
    await query(
        'UPDATE participants SET registration_type = ?, is_manual = 1 WHERE id = ?',
        [registrationType || 'Standard', participantId]
    );

    revalidatePath('/participants');
    return { success: true, registrationId: regId };
}

export async function addManualParticipant({ firstName, lastName, email, registration_type, entity, country, conferenceId }) {
    const session = await verifySession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
        throw new Error('Unauthorized');
    }

    if (!email || !conferenceId) {
        throw new Error('Missing email or conference ID');
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check if participant already exists in the database
    const [existingParticipant] = await query(
        'SELECT id FROM participants WHERE email = ?',
        [cleanEmail]
    );

    let participantId;

    if (existingParticipant) {
        participantId = existingParticipant.id;
        // Check if already registered for this conference
        const [existingReg] = await query(
            'SELECT id FROM registrations WHERE participant_id = ? AND conference_id = ?',
            [participantId, conferenceId]
        );
        if (existingReg) {
            throw new Error('A participant with this email is already registered for this conference');
        }

        // Update participant details and mark is_manual = 1
        await query(
            `UPDATE participants 
             SET firstName = ?, lastName = ?, registration_type = ?, entity = ?, country = ?, is_manual = 1 
             WHERE id = ?`,
            [firstName || null, lastName || null, registration_type || 'Standard', entity || null, country || null, participantId]
        );
    } else {
        // Insert new participant and mark is_manual = 1
        const pRes = await query(
            `INSERT INTO participants (firstName, lastName, email, registration_type, entity, country, is_manual) 
             VALUES (?, ?, ?, ?, ?, ?, 1)`,
            [firstName || null, lastName || null, cleanEmail, registration_type || 'Standard', entity || null, country || null]
        );
        participantId = pRes.insertId;
    }

    // Insert registration
    const regRes = await query(
        'INSERT INTO registrations (participant_id, conference_id, status, is_manual) VALUES (?, ?, ?, 1)',
        [participantId, conferenceId, 'Registered']
    );
    const regId = regRes.insertId;

    // Generate QR token
    const token = crypto.randomBytes(24).toString('hex');
    await query(
        'INSERT INTO participant_qr_tokens (registration_id, token) VALUES (?, ?)',
        [regId, token]
    );

    revalidatePath('/participants');
    return { success: true, participantId, registrationId: regId };
}

export async function bulkAddManualParticipants(participantsArray, conferenceId) {
    const session = await verifySession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
        throw new Error('Unauthorized');
    }

    if (!Array.isArray(participantsArray) || !conferenceId) {
        throw new Error('Invalid input');
    }

    let processed = 0;
    let duplicates = 0;
    const errors = [];

    for (const p of participantsArray) {
        try {
            const { firstName, lastName, email, registration_type, entity, country } = p;
            if (!email) {
                errors.push({ row: p, error: 'Missing email' });
                continue;
            }

            const cleanEmail = email.trim().toLowerCase();

            // Check if participant already exists in the database
            const [existingParticipant] = await query(
                'SELECT id FROM participants WHERE email = ?',
                [cleanEmail]
            );

            let participantId;

            if (existingParticipant) {
                participantId = existingParticipant.id;
                // Check if already registered for this conference
                const [existingReg] = await query(
                    'SELECT id FROM registrations WHERE participant_id = ? AND conference_id = ?',
                    [participantId, conferenceId]
                );
                
                if (existingReg) {
                    duplicates++;
                    continue; // skip already registered
                }

                // Update participant details and mark is_manual = 1
                await query(
                    `UPDATE participants 
                     SET firstName = ?, lastName = ?, registration_type = ?, entity = ?, country = ?, is_manual = 1 
                     WHERE id = ?`,
                    [firstName || null, lastName || null, registration_type || 'Standard', entity || null, country || null, participantId]
                );
            } else {
                // Insert new participant and mark is_manual = 1
                const pRes = await query(
                    `INSERT INTO participants (firstName, lastName, email, registration_type, entity, country, is_manual) 
                     VALUES (?, ?, ?, ?, ?, ?, 1)`,
                    [firstName || null, lastName || null, cleanEmail, registration_type || 'Standard', entity || null, country || null]
                );
                participantId = pRes.insertId;
            }

            // Insert registration
            const regRes = await query(
                'INSERT INTO registrations (participant_id, conference_id, status, is_manual) VALUES (?, ?, ?, 1)',
                [participantId, conferenceId, 'Registered']
            );
            const regId = regRes.insertId;

            // Generate QR token
            const token = crypto.randomBytes(24).toString('hex');
            await query(
                'INSERT INTO participant_qr_tokens (registration_id, token) VALUES (?, ?)',
                [regId, token]
            );

            processed++;
        } catch (err) {
            errors.push({ row: p, error: err.message });
        }
    }

    revalidatePath('/participants');
    return { success: true, processed, duplicates, errors };
}

export async function updateParticipantType(participantId, registrationType) {
    const session = await verifySession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
        throw new Error('Unauthorized');
    }

    if (!participantId) {
        throw new Error('Missing participant ID');
    }

    await query(
        'UPDATE participants SET registration_type = ?, is_manual = 1 WHERE id = ?',
        [registrationType, participantId]
    );

    revalidatePath('/participants');
    return { success: true };
}

export async function toggleParticipantRemoved(participantId, conferenceId, isRemoved) {
    const session = await verifySession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
        throw new Error('Unauthorized');
    }

    if (!participantId || !conferenceId) {
        throw new Error('Missing participant ID or conference ID');
    }

    await query(
        'UPDATE registrations SET is_removed = ? WHERE participant_id = ? AND conference_id = ?',
        [isRemoved ? 1 : 0, participantId, conferenceId]
    );

    revalidatePath('/participants');
    return { success: true };
}
