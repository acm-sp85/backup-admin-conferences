'use server';
import { hasAdminAccess } from '@/lib/roles';
import { query } from '@/lib/db';
import { verifySession } from '@/lib/auth';

export async function getAbstractsData(conferenceId) {
    const session = await verifySession();
    if (!session || (!hasAdminAccess(session.role))) {
        throw new Error('Unauthorized');
    }

    // 1. Fetch Program Slots (Orals) with Session Info
    const slots = await query(`
        SELECT 
            ps.id as slot_id, 
            ps.type as slot_type, 
            ps.title, 
            ps.authors, 
            ps.content, 
            ps.toc,
            ps.start_time as slot_start_time,
            ps.presenter_name,
            ps.presenter_entity,
            sess.id as session_id,
            sess.full_session_name,
            sess.start_time as session_start_time
        FROM program_slots ps
        JOIN program_sessions sess ON ps.session_id = sess.id
        WHERE sess.conference_id = ? AND ps.type IN ('oral', 'invited', 'keynote', 'plenary')
        ORDER BY sess.start_time ASC, ps.start_time ASC
    `, [conferenceId]);

    // 2. Fetch Posters with Cluster Info
    const posters = await query(`
        SELECT 
            p.id as poster_id, 
            p.title, 
            p.authors, 
            p.content, 
            p.toc, 
            p.code,
            c.name as cluster_name,
            conf.base_url
        FROM posters p 
        LEFT JOIN clusters c ON p.cluster_id = c.id 
        JOIN conferences conf ON p.conference_id = conf.id
        WHERE p.conference_id = ? 
        ORDER BY c.name ASC, p.code ASC, p.title ASC
    `, [conferenceId]);

    // Transform and unify them
    const items = [];
    
    // Add Orals
    let currentSessionId = null;
    let oralCounter = 0;
    let currentSessionPrefix = '';

    slots.forEach(s => {
        if (s.session_id !== currentSessionId) {
            currentSessionId = s.session_id;
            oralCounter = 0;
            
            const name = s.full_session_name || s.session_name || '';
            const match = name.match(/(?:Session|S)\s*([\d\.]+)/i);
            if (match) {
                // E.g. "Session 1" -> "1.", "Session 2.1" -> "2.1."
                currentSessionPrefix = match[1].endsWith('.') ? match[1] : match[1] + '.';
            } else {
                currentSessionPrefix = '';
            }
        }
        oralCounter++;

        items.push({
            id: 'oral_' + s.slot_id,
            type: 'oral',
            title: s.title,
            authors: s.authors || s.presenter_name,
            institution: s.presenter_entity,
            content: s.content,
            toc: s.toc,
            code: `${currentSessionPrefix}${oralCounter}`,
            session_start_time: s.session_start_time,
            slot_start_time: s.slot_start_time,
            groupInfo: s.full_session_name || 'General Session',
            sortKey: (s.session_start_time || '') + '_' + (s.slot_start_time || '')
        });
    });

    // Add Posters
    posters.forEach(p => {
        items.push({
            id: 'poster_' + p.poster_id,
            type: 'poster',
            title: p.title,
            authors: p.authors,
            content: p.content,
            toc: p.toc,
            base_url: p.base_url,
            groupInfo: p.cluster_name || 'Posters',
            sortKey: 'z_' + (p.cluster_name || '') + '_' + (p.code || '')
        });
    });

    const [conf] = await query('SELECT book_of_abstracts_state FROM conferences WHERE id = ?', [conferenceId]);
    let savedState = null;
    if (conf?.book_of_abstracts_state) {
        try {
            savedState = typeof conf.book_of_abstracts_state === 'string'
                ? JSON.parse(conf.book_of_abstracts_state)
                : conf.book_of_abstracts_state;
        } catch (e) {
            console.error('Failed to parse book_of_abstracts_state', e);
        }
    }

    return { items, savedState };
}

export async function saveBookOfAbstractsState(conferenceId, state) {
    const session = await verifySession();
    if (!session || (!hasAdminAccess(session.role))) {
        throw new Error('Unauthorized');
    }
    await query('UPDATE conferences SET book_of_abstracts_state = ? WHERE id = ?', [JSON.stringify(state), conferenceId]);
    return { success: true };
}

export async function fetchPosterImage(url) {
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        return {
            base64: buffer.toString('base64'),
            mimeType: res.headers.get('content-type') || 'image/jpeg'
        };
    } catch (e) {
        console.error('Failed to fetch image proxy:', e);
        return null;
    }
}
