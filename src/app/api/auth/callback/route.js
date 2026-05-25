import { decrypt, createSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { query } from '@/lib/db';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const next = searchParams.get('next');
  console.log("🔍 AuthCallback GET called with token:", token ? "exists" : "missing", "next:", next);

  if (!token) {
    console.log("🔍 AuthCallback: Redirecting to login due to missing token");
    redirect('/login?error=missing_token');
  }

  const payload = await decrypt(token);
  console.log("🔍 AuthCallback decrypted token payload:", payload);

  if (!payload || payload.type !== 'magic-link') {
    console.log("🔍 AuthCallback: Redirecting to login due to invalid token payload");
    redirect('/login?error=invalid_token');
  }

  if (payload.role === 'admin' || payload.role === 'superadmin') {
    const [user] = await query('SELECT password FROM users WHERE id = ?', [payload.userId]);
    if (user && !user.password) {
      console.log("🔍 AuthCallback: Redirecting to setup-password");
      redirect(`/setup-password?token=${token}`);
    }
  }

  // Convert the temporary magic-link token into a standard session
  console.log("🔍 AuthCallback: Creating session for userId:", payload.userId, "role:", payload.role);
  await createSession(payload.userId, payload.role);

  if (next && next.startsWith('/')) {
    console.log("🔍 AuthCallback: Redirecting to custom next URL:", next);
    redirect(next);
  }

  // Redirect to dashboard or voting depending on role
  if (payload.role === 'user') {
    console.log("🔍 AuthCallback: Redirecting to default user voting");
    redirect('/voting');
  }

  console.log("🔍 AuthCallback: Redirecting to root / dashboard");
  redirect('/');
}
