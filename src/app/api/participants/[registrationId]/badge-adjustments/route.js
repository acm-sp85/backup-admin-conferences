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

        const { registrationId } = await params;
        const updates = await req.json();

        // Check if the column exists, gracefully fallback
        const currentAdjQuery = await query(
            `SELECT badge_adjustments FROM registrations WHERE id = ?`, 
            [registrationId]
        ).catch(() => null);

        let currentAdjs = {};
        if (currentAdjQuery && currentAdjQuery.length > 0 && currentAdjQuery[0].badge_adjustments) {
            try {
                currentAdjs = typeof currentAdjQuery[0].badge_adjustments === 'string' 
                    ? JSON.parse(currentAdjQuery[0].badge_adjustments)
                    : currentAdjQuery[0].badge_adjustments;
            } catch (e) {}
        }
        
        const newAdjs = { ...currentAdjs, ...updates };
        
        await query(
            'UPDATE registrations SET badge_adjustments = ? WHERE id = ?',
            [JSON.stringify(newAdjs), registrationId]
        );
        
        return NextResponse.json({ success: true });
    } catch (error) {
        if (error.code === 'ER_BAD_FIELD_ERROR') {
            return NextResponse.json({ success: false, error: 'Column missing, skipping save' }, { status: 200 });
        }
        console.error('API Error saving badge adjustment:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
