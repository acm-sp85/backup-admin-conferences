import { query } from '@/lib/db';
import DashboardLayout from './components/DashboardLayout';
import { verifySession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ConferenceList from './components/ConferenceList';

export default async function HomePage() {
  const session = await verifySession();
  if (!session) redirect('/login');
  
  if (session.role === 'user') {
    redirect('/voting');
  }

  const conferences = await query('SELECT * FROM conferences ORDER BY created_at DESC');

  return (
    <DashboardLayout>
      <ConferenceList 
        initialConferences={conferences} 
        userRole={session.role} 
      />
    </DashboardLayout>
  );
}
