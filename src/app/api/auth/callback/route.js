import { decrypt, createSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { query } from '@/lib/db';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const next = searchParams.get('next');

  if (!token) {
    redirect('/login?error=missing_token');
  }

  const payload = await decrypt(token);

  if (!payload || payload.type !== 'magic-link') {
    redirect('/login?error=invalid_token');
  }

  if (payload.role === 'admin' || payload.role === 'superadmin') {
    const [user] = await query('SELECT password FROM users WHERE id = ?', [payload.userId]);
    if (user && !user.password) {
      redirect(`/setup-password?token=${token}`);
    }
  }

  // Convert the temporary magic-link token into a standard session
  await createSession(payload.userId, payload.role);

  if (next && next.startsWith('/')) {
    redirect(next);
  }

  // Redirect to dashboard or voting depending on role
  if (payload.role === 'user') {
    redirect('/voting');
  }

  redirect('/');
}
