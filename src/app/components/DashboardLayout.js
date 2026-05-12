import { verifySession } from '@/lib/auth';
import DashboardShell from './DashboardShell';

export default async function DashboardLayout({ children }) {
  const session = await verifySession();

  const isVoter = session?.role === 'user';

  return (
    <DashboardShell userRole={session?.role} isVoter={isVoter}>
      {children}
    </DashboardShell>
  );
}
