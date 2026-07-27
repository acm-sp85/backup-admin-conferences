// src/app/visualizacion-streaming-cipie-2026/page.js
import EmailAccessModal from '@/app/components/EmailAccessModal';
import { cookies } from 'next/headers';

export default async function StreamingPage() {
  const cookieStore = await cookies();
  const granted = cookieStore.get('accessGranted')?.value === 'true';

  return granted ? (
    <div className="streaming-container">




    </div>
  ) : (
    <EmailAccessModal conference="CIPIE26" />
  );
}
