import { query } from '@/lib/db';
import DashboardLayout from '../components/DashboardLayout';
import ActivitiesFilter from '../components/ActivitiesFilter';
import ActivitiesManager from '../components/ActivitiesManager';
import { verifySession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

export default async function ActivitiesPage({ searchParams }) {
  const session = await verifySession();
  if (!session || session.role === 'user') {
    redirect(session ? '/voting' : '/login');
  }

  const { conference } = await searchParams;
  const conferences = await query('SELECT id, acronym FROM conferences ORDER BY acronym ASC');

  // Persistence: If no conference in URL, check cookie
  if (!conference && conferences.length > 0) {
    const cookieStore = await cookies();
    const lastConference = cookieStore.get('last_conference')?.value;
    
    const validCookie = lastConference && conferences.some(c => c.acronym === lastConference);
    
    if (validCookie) {
      redirect(`/activities?conference=${lastConference}`);
    } else {
      const [latest] = await query('SELECT acronym FROM conferences ORDER BY id DESC LIMIT 1');
      if (latest) {
        redirect(`/activities?conference=${latest.acronym}`);
      }
    }
  }

  const activeConf = conferences.find(c => c.acronym === conference);
  const activeConfId = activeConf?.id;

  let activities = [];
  if (activeConfId) {
    activities = await query(`
      SELECT a.*, (SELECT COUNT(*) FROM extra_activity_attendees WHERE activity_id = a.id) as attendee_count
      FROM extra_activities a
      WHERE a.conference_id = ?
      ORDER BY a.date ASC, a.created_at DESC
    `, [activeConfId]);
  }

  return (
    <DashboardLayout>
      <header className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Conference Activities</h2>
          <p className="text-[var(--muted)] text-xs mt-0.5">Manage extra activities and their dedicated QR check-ins</p>
        </div>
      </header>

      <ActivitiesFilter conferences={conferences} />

      {activeConfId ? (
        <ActivitiesManager activities={activities} conferenceId={activeConfId} />
      ) : (
        <div className="card p-10 text-center text-sm text-[var(--muted)]">
          Please select a conference to manage its activities.
        </div>
      )}

    </DashboardLayout>
  );
}
