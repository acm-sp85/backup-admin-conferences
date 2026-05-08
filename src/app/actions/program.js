'use server';

import { query } from '@/lib/db';
import { verifySession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export async function getProgram(conferenceId) {
    const session = await verifySession();
    if (!session) throw new Error('Unauthorized');

    const sessions = await query(`
        SELECT * FROM program_sessions 
        WHERE conference_id = ? 
        ORDER BY start_time ASC
    `, [conferenceId]);

    // Fetch slots for each session
    const sessionsWithSlots = await Promise.all(sessions.map(async (s) => {
        const slots = await query(`
            SELECT * FROM program_slots 
            WHERE session_id = ? 
            ORDER BY start_time ASC
        `, [s.id]);
        return { ...s, slots };
    }));

    return sessionsWithSlots;
}

export async function updateDoorSignConfig(conferenceId, config, bgUrl) {
    const session = await verifySession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
        throw new Error('Unauthorized');
    }

    await query(
        'UPDATE conferences SET door_sign_config = ?, door_sign_bg = ? WHERE id = ?',
        [JSON.stringify(config), bgUrl, conferenceId]
    );

    revalidatePath('/program');
    return { success: true };
}

export async function getConferenceConfig(conferenceId) {
    const [conf] = await query('SELECT door_sign_config, door_sign_bg FROM conferences WHERE id = ?', [conferenceId]);
    
    let config = {
        titleSize: '48px',
        titleColor: '#000000',
        contentSize: '18px',
        contentColor: '#333333',
        chairSize: '24px',
        padding: '60px'
    };

    if (conf?.door_sign_config) {
        try {
            config = typeof conf.door_sign_config === 'string' 
                ? JSON.parse(conf.door_sign_config) 
                : conf.door_sign_config;
        } catch (e) { }
    }

    return { config, bgUrl: conf?.door_sign_bg };
}

export async function toggleSessionVisibility(sessionId, isHidden) {
    const session = await verifySession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
        throw new Error('Unauthorized');
    }

    await query(
        'UPDATE program_sessions SET is_hidden = ? WHERE id = ?',
        [isHidden ? 1 : 0, sessionId]
    );

    revalidatePath('/program');
    return { success: true };
}
