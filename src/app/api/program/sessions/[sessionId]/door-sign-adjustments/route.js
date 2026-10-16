import { query } from '@/lib/db';
import { verifySession } from '@/lib/auth';
import { hasAdminAccess } from '@/lib/roles';
import { NextResponse } from 'next/server';

export async function POST(req, { params }) {
    try {
        const session = await verifySession();
        if (!session || !hasAdminAccess(session.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { sessionId } = await params;
        const body = await req.json();
        const pageIndex = body.pageIndex !== undefined ? String(body.pageIndex) : '0';
        const updates = body.updates || {};
        if (body.y !== undefined) updates.y = body.y;
        if (body.zoom !== undefined) updates.zoom = body.zoom;

        const [sessionData] = await query(
            `SELECT door_sign_adjustments FROM program_sessions WHERE id = ?`, 
            [sessionId]
        );

        if (!sessionData) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        let currentAdjs = {};
        if (sessionData.door_sign_adjustments) {
            try {
                currentAdjs = typeof sessionData.door_sign_adjustments === 'string'
                    ? JSON.parse(sessionData.door_sign_adjustments)
                    : sessionData.door_sign_adjustments;
            } catch (e) {}
        }

        const currentPageAdjs = currentAdjs[pageIndex] || {};
        currentAdjs[pageIndex] = { ...currentPageAdjs, ...updates };

        await query(
            'UPDATE program_sessions SET door_sign_adjustments = ? WHERE id = ?',
            [JSON.stringify(currentAdjs), sessionId]
        );

        return NextResponse.json({ success: true, adjustments: currentAdjs });
    } catch (error) {
        console.error('API Error saving door sign adjustment:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
