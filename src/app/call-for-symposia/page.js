import { verifySession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import DashboardLayout from '@/app/components/DashboardLayout';
import { hasAdminAccess } from '@/lib/roles';
import SymposiaEmbed from './SymposiaEmbed';

export const metadata = {
  title: 'Call for Symposia | Smart Conference Admin',
};

export default async function CallForSymposiaPage() {
  const session = await verifySession();
  if (!session || !hasAdminAccess(session.role)) {
    redirect(session ? '/' : '/login');
  }

  return (
    <DashboardLayout>
      <SymposiaEmbed />
    </DashboardLayout>
  );
}
