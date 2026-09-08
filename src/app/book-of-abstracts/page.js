import { hasAdminAccess } from '@/lib/roles';
import { query } from '@/lib/db';
import DashboardLayout from '../components/DashboardLayout';
import { verifySession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import BookOfAbstractsManager from '../components/BookOfAbstractsManager';

export default async function BookOfAbstractsPage() {
  const session = await verifySession();
  if (!session || (!hasAdminAccess(session.role))) {
    redirect('/login');
  }

  const conferences = await query('SELECT * FROM conferences ORDER BY name ASC');

  return (
    <DashboardLayout>
      <header className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Book of Abstracts</h2>
          <p className="text-[var(--muted)] text-xs mt-0.5">Generate and manage the Book of Abstracts document</p>
        </div>
      </header>

      <BookOfAbstractsManager conferences={conferences} userRole={session.role} />
    </DashboardLayout>
  );
}
