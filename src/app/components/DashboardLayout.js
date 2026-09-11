import { verifySession } from '@/lib/auth';
import { query } from '@/lib/db';
import DashboardShell from './DashboardShell';

export default async function DashboardLayout({ children }) {
  const session = await verifySession();

  let userName = null;
  let nextConference = null;

  try {
    if (session?.userId) {
      const results = await query('SELECT firstName, lastName FROM users WHERE id = ?', [session.userId]);
      if (results && results[0]) {
        userName = [results[0].firstName, results[0].lastName].filter(Boolean).join(' ') || null;
      }
    }

    // Fetch the next upcoming conference
    const confs = await query(`
      SELECT acronym, start_date, accent_color 
      FROM global_calendar 
      WHERE start_date >= CURDATE() 
      ORDER BY start_date ASC 
      LIMIT 1
    `);
    
    if (confs && confs[0]) {
      const conf = confs[0];
      const daysLeft = Math.ceil((new Date(conf.start_date) - new Date()) / (1000 * 60 * 60 * 24));
      nextConference = {
        acronym: conf.acronym,
        start_date: conf.start_date,
        accent_color: conf.accent_color,
        daysLeft: daysLeft >= 0 ? daysLeft : 0
      };
    }
  } catch (err) {
    console.error('Error fetching data for layout:', err);
  }

  const isVoter = session?.role === 'user';

  return (
    <DashboardShell userRole={session?.role} userName={userName} isVoter={isVoter} nextConference={nextConference}>
      {children}
    </DashboardShell>
  );
}
