import DashboardLayout from '@/app/components/DashboardLayout';
import { verifySession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ChangePasswordForm from './ChangePasswordForm';

export default async function SettingsPage() {
  const session = await verifySession();
  if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
    redirect('/');
  }

  return (
    <DashboardLayout>
      <header className="mb-6">
        <h2 className="text-xl font-semibold">Account Settings</h2>
        <p className="text-[var(--muted)] text-xs mt-0.5">Manage your personal settings and security</p>
      </header>

      <div className="max-w-md">
        <div className="card p-6">
          <h3 className="text-[14px] font-semibold mb-4">Change Password</h3>
          <ChangePasswordForm />
        </div>
      </div>
    </DashboardLayout>
  );
}
