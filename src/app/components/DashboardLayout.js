import { verifySession } from '@/lib/auth';
import { query } from '@/lib/db';
import DashboardShell from './DashboardShell';

export default async function DashboardLayout({ children }) {
  const session = await verifySession();

  let userName = null;
  if (session?.userId) {
    const [user] = await query('SELECT firstName, lastName FROM users WHERE id = ?', [session.userId]);
    if (user) {
      userName = [user.firstName, user.lastName].filter(Boolean).join(' ') || null;
    }
  }

  const isVoter = session?.role === 'user';

  return (
    <DashboardShell userRole={session?.role} userName={userName} isVoter={isVoter}>
      {children}
    </DashboardShell>
  );
}
