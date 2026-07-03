import { verifySession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { query } from '@/lib/db';
import ActivityQRScanner from '@/app/components/ActivityQRScanner';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function ActivityScannerPage({ params }) {
    const session = await verifySession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
        redirect('/login');
    }

    const { id } = await params;

    const [activity] = await query('SELECT name FROM extra_activities WHERE id = ?', [id]);

    if (!activity) {
        return <div className="p-10 text-center">Activity not found.</div>;
    }

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <Link 
                        href={`/activities/${id}`}
                        className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-slate-600" />
                    </Link>
                    <h1 className="font-semibold text-slate-900">Scanner</h1>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    <span className="text-xs font-medium text-slate-600">System Online</span>
                </div>
            </div>
            
            <ActivityQRScanner activityId={id} activityName={activity.name} />
        </div>
    );
}
