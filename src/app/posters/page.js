import { query } from '@/lib/db';
import DashboardLayout from '../components/DashboardLayout';
import { verifySession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import PosterManager from '../components/PosterManager';
import UnifiedPostersView from '../components/UnifiedPostersView';

export default async function PostersPage() {
  const session = await verifySession();
  if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
    redirect('/login');
  }

  const conferences = await query('SELECT * FROM conferences ORDER BY name ASC');
  const allClusters = await query('SELECT * FROM clusters ORDER BY name ASC');

  return (
    <DashboardLayout>
      <header className="mb-2">
        <h2 className="text-xl font-semibold">Posters & Voting</h2>
        <p className="text-[var(--muted)] text-xs mt-0.5">Manage posters, clusters, and participant voting permissions</p>
      </header>

      <UnifiedPostersView conferences={conferences} allClusters={allClusters} />
    </DashboardLayout>
  );
}
