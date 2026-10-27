import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import crypto from 'crypto';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, X-API-Key, Content-Type',
};

function validateApiKey(request) {
  const authHeader = request.headers.get('authorization') || '';
  const apiKeyHeader = request.headers.get('x-api-key') || '';

  const token = authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : apiKeyHeader.trim();

  const expectedKey = process.env.PROGRAM_API_KEY;
  if (!expectedKey || !token) {
    return false;
  }

  const tokenBuf = Buffer.from(token);
  const keyBuf = Buffer.from(expectedKey);

  if (tokenBuf.length !== keyBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(tokenBuf, keyBuf);
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function GET(request, { params }) {
  // 1. Authenticate with timing-safe API key validation
  if (!validateApiKey(request)) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Missing or invalid API key' },
      { status: 401, headers: CORS_HEADERS }
    );
  }

  try {
    // 2. Extract conference acronym and query options
    const { acronym } = await params;
    const searchParams = request.nextUrl.searchParams;
    const rawAbstracts = searchParams.get('abstracts') ?? searchParams.get('include_abstracts');
    const includeAbstracts = rawAbstracts === 'true' || rawAbstracts === '1';

    // 3. Look up conference by acronym
    const conferences = await query(
      `SELECT id, name, acronym, start_date, end_date 
       FROM conferences 
       WHERE acronym = ? 
       LIMIT 1`,
      [acronym]
    );

    if (!conferences || conferences.length === 0) {
      return NextResponse.json(
        { error: 'Not Found', message: `Conference '${acronym}' not found` },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const conference = conferences[0];

    // 4. Batch query 1: All visible sessions for the conference
    const sessions = await query(
      `SELECT id, session_name, full_session_name, start_time, end_time 
       FROM program_sessions 
       WHERE conference_id = ? AND is_hidden = 0 
       ORDER BY start_time ASC, id ASC`,
      [conference.id]
    );

    // Build symposium -> room dictionary from all conference sessions (e.g. 'Opening B1 - Room 2')
    const allConferenceSessions = await query(
      `SELECT session_name, full_session_name 
       FROM program_sessions 
       WHERE conference_id = ?`,
      [conference.id]
    );

    const symposiumRooms = {};
    for (const s of allConferenceSessions) {
      const text = `${s.session_name || ''} ${s.full_session_name || ''}`;
      const m = text.match(/Opening\s+([A-Z0-9]+)\s*-\s*(Room\s*\d+|SALA\s*\d+|Auditorium)/i);
      if (m) {
        symposiumRooms[m[1].toUpperCase()] = m[2].replace(/Room\s*/i, 'Room ').trim();
      }
    }

    function resolveSessionRoom(sess) {
      const text = `${sess.full_session_name || ''} ${sess.session_name || ''}`;

      // 1. Direct match in session name (e.g. 'Opening B1 - Room 2', 'Plenary Session - Auditorium', 'SALA 1')
      const directMatch = text.match(/(Room\s*\d+|SALA\s*\d+|Auditorium)/i);
      if (directMatch) {
        return directMatch[1].replace(/Room\s*/i, 'Room ').trim();
      }

      // 2. Symposium code match (e.g. 'Session B2.1.1', 'B1.2.2', 'Closing B5', 'Session A6.1.3')
      const codeMatch = text.match(/(?:Session\s+|Closing\s+|Opening\s+)?([A-Z]\d+)(?:\.\d+)*/i);
      if (codeMatch && symposiumRooms[codeMatch[1].toUpperCase()]) {
        return symposiumRooms[codeMatch[1].toUpperCase()];
      }

      return null;
    }

    // 5. Batch query 2: All slots with resolved topics for these sessions
    const slots = await query(
      `SELECT s.id, s.session_id, s.type, s.title, s.presenter_name, s.presenter_entity, 
              s.presenter_country, s.start_time, s.end_time, s.authors, ${includeAbstracts ? 's.content,' : ''} s.code,
              t.name as topic_name, p.name as parent_topic_name
       FROM program_slots s
       JOIN program_sessions ps ON s.session_id = ps.id
       LEFT JOIN topics t ON s.topic_mongo_id COLLATE utf8mb4_unicode_ci = t.mongo_id COLLATE utf8mb4_unicode_ci
       LEFT JOIN topics p ON t.parent_mongo_id COLLATE utf8mb4_unicode_ci = p.mongo_id COLLATE utf8mb4_unicode_ci
       WHERE ps.conference_id = ?
       ORDER BY s.start_time ASC, s.id ASC`,
      [conference.id]
    );

    // Group slots by session_id in memory
    const slotsBySession = new Map();
    for (const slot of slots) {
      if (!slotsBySession.has(slot.session_id)) {
        slotsBySession.set(slot.session_id, []);
      }

      let parsedAuthors = null;
      if (slot.authors) {
        try {
          parsedAuthors = JSON.parse(slot.authors);
        } catch {
          parsedAuthors = slot.authors;
        }
      }

      slotsBySession.get(slot.session_id).push({
        id: slot.id,
        type: slot.type || null,
        title: slot.title || '',
        code: slot.code || null,
        start_time: slot.start_time,
        end_time: slot.end_time,
        presenter: {
          name: slot.presenter_name || null,
          entity: slot.presenter_entity || null,
          country: slot.presenter_country || null,
        },
        authors: parsedAuthors,
        ...(includeAbstracts ? { abstract: slot.content || null } : {}),
        topic: slot.topic_name || null,
        parent_topic: slot.parent_topic_name || null,
      });
    }

    // Combine sessions and their nested slots
    const sessionsWithSlots = sessions.map((sess) => ({
      id: sess.id,
      session_name: sess.session_name,
      full_session_name: sess.full_session_name,
      room: resolveSessionRoom(sess),
      start_time: sess.start_time,
      end_time: sess.end_time,
      slots_count: (slotsBySession.get(sess.id) || []).length,
      slots: slotsBySession.get(sess.id) || [],
    }));

    return NextResponse.json(
      {
        conference: {
          id: conference.id,
          name: conference.name,
          acronym: conference.acronym,
          start_date: conference.start_date,
          end_date: conference.end_date,
        },
        summary: {
          total_sessions: sessionsWithSlots.length,
          total_slots: slots.length,
        },
        sessions: sessionsWithSlots,
      },
      {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      }
    );
  } catch (error) {
    console.error('API Error fetching conference program:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to retrieve program data' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
