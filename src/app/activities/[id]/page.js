import { query } from '@/lib/db';
import DashboardLayout from '../../components/DashboardLayout';
import { verifySession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Camera } from 'lucide-react';
import ActivityAttendeesManager from '../../components/ActivityAttendeesManager';

export default async function ActivityDetailsPage({ params }) {
    const session = await verifySession();
    if (!session || session.role === 'user') {
        redirect(session ? '/voting' : '/login');
    }

    const { id } = await params;

    const [activity] = await query(`
        SELECT a.*, c.acronym as conference_acronym 
        FROM extra_activities a
        JOIN conferences c ON a.conference_id = c.id
        WHERE a.id = ?
    `, [id]);

    if (!activity) {
        return (
            <DashboardLayout>
                <div className="p-10 text-center">Activity not found.</div>
            </DashboardLayout>
        );
    }

    const attendees = await query(`
        SELECT * FROM extra_activity_attendees
        WHERE activity_id = ?
        ORDER BY created_at DESC
    `, [id]);

    const totalCheckedIn = attendees.filter(a => a.scanned_at).length;

    return (
        <DashboardLayout>
            <div className="mb-4">
                <Link href={`/activities?conference=${activity.conference_acronym}`} className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] flex items-center gap-1 w-fit">
                    <ArrowLeft className="w-3 h-3" /> Back to Activities
                </Link>
            </div>

            <header className="mb-6 flex justify-between items-center bg-[var(--card)] p-5 rounded-xl border border-[var(--border)]">
                <div>
                    <h2 className="text-2xl font-bold">{activity.name}</h2>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-[var(--muted)]">
                        <span>Conference: {activity.conference_acronym}</span>
                        {activity.date && (
                            <>
                                <span>&bull;</span>
                                <span>{new Date(activity.date).toLocaleString()}</span>
                            </>
                        )}
                    </div>
                    {activity.description && (
                        <p className="text-sm mt-2 max-w-2xl text-[var(--muted)]">{activity.description}</p>
                    )}
                </div>
                
                <div className="flex flex-col items-end gap-3">
                    <Link 
                        href={`/activities/${id}/scanner`}
                        className="flex items-center gap-2 px-5 py-2.5 bg-black text-white rounded-xl text-sm font-bold shadow-lg shadow-black/20 hover:bg-slate-800 transition-all"
                    >
                        <Camera className="w-4 h-4" />
                        Open Scanner
                    </Link>
                    <div className="flex gap-2">
                        <div className="text-xs bg-[var(--accent)]/10 px-3 py-1.5 rounded-full text-[var(--accent)] font-medium">
                            Total Attendees: <strong>{attendees.length}</strong>
                        </div>
                        <div className="text-xs bg-green-50 px-3 py-1.5 rounded-full text-green-700 font-medium border border-green-200">
                            Checked-in: <strong>{totalCheckedIn}</strong>
                        </div>
                    </div>
                </div>
            </header>

            <ActivityAttendeesManager 
                activityId={id} 
                conferenceId={activity.conference_id} 
                initialAttendees={attendees} 
                activityName={activity.name}
                initialCustomEmailText={activity.custom_email_text}
            />

        </DashboardLayout>
    );
}
