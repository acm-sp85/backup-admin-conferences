// src/app/visualizacion-streaming-cipie-2026/page.js
import EmailAccessModal from '@/app/components/EmailAccessModal';
import { cookies } from 'next/headers';

export default async function StreamingPage() {
  const cookieStore = await cookies();
  const granted = cookieStore.get('accessGranted')?.value === 'true';

  return granted ? (
    <div className="streaming-container">

      {/* Embedded live stream */}
      <iframe
        src="https://www.stream.nanoge.org/embed/cipie-2026-prueba"
        title="CIPIE 2026 stream"
        style={{ width: '100%', height: '100vh', border: 'none' }}
        allowFullScreen
      ></iframe>
      {/* Logout form */}
      <form action="/api/participants/logout" method="POST" style={{ marginTop: '1rem' }}>
        {/* <button type="submit" style={{ padding: '0.5rem 1rem', background: '#e53935', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          Logout
        </button> */}
      </form>
    </div>
  ) : (
    <EmailAccessModal conference="CIPIE26" />
  );
}
