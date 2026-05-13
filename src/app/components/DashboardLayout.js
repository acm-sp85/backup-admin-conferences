import { verifySession } from '@/lib/auth';
import { query } from '@/lib/db';
import DashboardShell from './DashboardShell';

export default async function DashboardLayout({ children }) {
  const session = await verifySession();

  let userName = null;
  try {
    if (session?.userId) {
      const results = await query('SELECT firstName, lastName FROM users WHERE id = ?', [session.userId]);
      if (results && results[0]) {
        userName = [results[0].firstName, results[0].lastName].filter(Boolean).join(' ') || null;
      }
    }
  } catch (err) {
    console.error('Error fetching user name for layout:', err);
  }

  const isVoter = session?.role === 'user';

  return (
    <DashboardShell userRole={session?.role} userName={userName} isVoter={isVoter}>
      {children}
    </DashboardShell>
  );
}
