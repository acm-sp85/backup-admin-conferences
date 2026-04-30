import { query } from '@/lib/db';
import DashboardLayout from '../components/DashboardLayout';
import { verifySession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ProgramManager from '../components/ProgramManager';

export default async function ProgramPage() {
  const session = await verifySession();
  if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
    redirect('/login');
  }

  const conferences = await query('SELECT * FROM conferences ORDER BY name ASC');

  return (
    <DashboardLayout>
      <header className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Conference Program</h2>
          <p className="text-[var(--muted)] text-xs mt-0.5">Manage session schedules and generate door signage</p>
        </div>
      </header>

      <ProgramManager conferences={conferences} />
    </DashboardLayout>
  );
}
