import { query } from '@/lib/db';
import DashboardLayout from '../components/DashboardLayout';
import ParticipantsFilter from '../components/ParticipantsFilter';
import StatsInteractive from '../components/StatsInteractive';
import { verifySession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

export default async function StatsPage({ searchParams }) {
  const session = await verifySession();
  if (!session || session.role !== 'superadmin') {
    redirect('/');
  }

  const { conference } = await searchParams;
  const conferences = await query('SELECT id, acronym FROM conferences ORDER BY acronym ASC');

  if (!conference && conferences.length > 0) {
    const cookieStore = await cookies();
    const lastConference = cookieStore.get('last_conference')?.value;
    
    const validCookie = lastConference && conferences.some(c => c.acronym === lastConference);
    if (validCookie) {
      redirect(`/stats?conference=${lastConference}`);
    } else {
      const [latest] = await query('SELECT acronym FROM conferences ORDER BY id DESC LIMIT 1');
      if (latest) redirect(`/stats?conference=${latest.acronym}`);
    }
  }

  const activeConf = conferences.find(c => c.acronym === conference);
  const activeConfId = activeConf?.id;

  if (!activeConfId) {
    return (
      <DashboardLayout>
        <header className="mb-6">
          <h2 className="text-xl font-semibold">Statistics</h2>
        </header>
        <p>No conference found</p>
      </DashboardLayout>
    );
  }

  // 1. Total Registrations
  const [{ total_registrations }] = await query(`
    SELECT COUNT(*) as total_registrations 
    FROM registrations 
    WHERE conference_id = ? AND is_guest = 0
  `, [activeConfId]);

  // 2. Total Checked-in
  const [{ total_checked_in }] = await query(`
    SELECT COUNT(*) as total_checked_in 
    FROM participant_qr_tokens t
    JOIN registrations r ON t.registration_id = r.id
    WHERE r.conference_id = ? AND r.is_guest = 0 AND t.scanned_at IS NOT NULL
  `, [activeConfId]);

  // 3. Total Revenue
  const [{ total_revenue }] = await query(`
    SELECT SUM(amount) as total_revenue
    FROM payments p
    JOIN registrations r ON p.registration_id = r.id
    WHERE r.conference_id = ? AND p.status = 'paid'
  `, [activeConfId]);

  // 4. Country Distribution (All)
  const countriesData = await query(`
    SELECT COALESCE(NULLIF(p.country, ''), 'Not Provided') as country, COUNT(*) as count
    FROM participants p
    JOIN registrations r ON p.id = r.participant_id
    WHERE r.conference_id = ? AND r.is_guest = 0
    GROUP BY country
    ORDER BY count DESC
  `, [activeConfId]);

  // 5. Country Distribution (Checked-in only)
  const countriesDataCheckedIn = await query(`
    SELECT COALESCE(NULLIF(p.country, ''), 'Not Provided') as country, COUNT(*) as count
    FROM participants p
    JOIN registrations r ON p.id = r.participant_id
    JOIN participant_qr_tokens t ON r.id = t.registration_id
    WHERE r.conference_id = ? AND r.is_guest = 0 AND t.scanned_at IS NOT NULL
    GROUP BY country
    ORDER BY count DESC
  `, [activeConfId]);

  return (
    <DashboardLayout>
      <header className="mb-6">
        <h2 className="text-xl font-semibold">Statistics</h2>
        <p className="text-[var(--muted)] text-xs mt-0.5">Overview for {conference}</p>
      </header>

      <ParticipantsFilter conferences={conferences} hideSearch hideStatus />

      <StatsInteractive 
        total_registrations={total_registrations} 
        total_checked_in={total_checked_in} 
        total_revenue={total_revenue} 
        countriesData={countriesData} 
        countriesDataCheckedIn={countriesDataCheckedIn} 
      />
    </DashboardLayout>
  );
}
