import { verifySession } from '@/lib/auth';
import Sidebar from './Sidebar';

export default async function DashboardLayout({ children }) {
  const session = await verifySession();

  const isVoter = session?.role === 'user';

  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      {!isVoter && <Sidebar userRole={session?.role} />}
      <main className={`flex-1 ${!isVoter ? 'md:ml-[220px]' : ''} px-4 py-4 md:px-8`}>
        <div className={`page-enter ${isVoter ? 'max-w-[500px] mx-auto pt-2 pb-20' : 'max-w-[1200px]'}`}>
          {children}
        </div>
      </main>
    </div>
  );
}
