import { query } from '@/lib/db';
import { verifySession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function MigratePage() {
    const session = await verifySession();
    if (!session || session.role !== 'superadmin') {
        return <div>Unauthorized. Only superadmins can run migrations.</div>;
    }

    const results = [];
    
    try {
        await query(`ALTER TABLE participant_qr_tokens ADD COLUMN is_manual BOOLEAN DEFAULT 0`);
        results.push('✅ Added is_manual to participant_qr_tokens');
    } catch (e) {
        results.push(`ℹ️ participant_qr_tokens: ${e.message}`);
    }

    try {
        await query(`ALTER TABLE social_dinner_tickets ADD COLUMN is_manual BOOLEAN DEFAULT 0`);
        results.push('✅ Added is_manual to social_dinner_tickets');
    } catch (e) {
        results.push(`ℹ️ social_dinner_tickets: ${e.message}`);
    }

    try {
        await query(`ALTER TABLE registrations ADD COLUMN is_guest BOOLEAN NOT NULL DEFAULT 0`);
        results.push('✅ Added is_guest to registrations');
    } catch (e) {
        results.push(`ℹ️ registrations.is_guest: ${e.message}`);
    }

    return (
        <div className="p-10 font-mono text-sm">
            <h1 className="text-xl font-bold mb-4">Database Migration</h1>
            <ul className="space-y-2">
                {results.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
            <div className="mt-8">
                <a href="/participants" className="text-blue-600 underline">Go back to Participants</a>
            </div>
        </div>
    );
}
