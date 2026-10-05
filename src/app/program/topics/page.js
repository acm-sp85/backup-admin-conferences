import { hasAdminAccess } from '@/lib/roles';
import { query } from '@/lib/db';
import DashboardLayout from '@/app/components/DashboardLayout';
import { verifySession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import TopicsManager from '@/app/components/TopicsManager';
import Link from 'next/link';

export default async function ProgramTopicsPage() {
  const session = await verifySession();
  if (!session || (!hasAdminAccess(session.role))) {
    redirect('/login');
  }

  const conferences = await query('SELECT * FROM conferences ORDER BY name ASC');

  return (
    <DashboardLayout>
      <header className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-800">Conference Program</h2>
            <p className="text-[var(--muted)] text-xs mt-0.5">Manage session schedules and generate door signage</p>
          </div>
        </div>
        <div className="flex gap-6 border-b border-slate-200">
          <Link href="/program" className="pb-2 text-slate-500 hover:text-slate-800 font-medium text-sm transition-colors">Schedule</Link>
          <Link href="/program/topics" className="pb-2 border-b-2 border-blue-600 text-blue-600 font-medium text-sm">Topics Tree</Link>
        </div>
      </header>

      <TopicsManager conferences={conferences} />
    </DashboardLayout>
  );
}
