import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const secretKey = process.env.SESSION_SECRET || 'a-very-long-and-secure-fallback-secret-key-123';
const encodedKey = new TextEncoder().encode(secretKey);

// 1. Specify public routes (all others are protected)
const PUBLIC_PATHS = [
  '/login',
  '/setup-password',
  '/api/auth/callback',
];

export default async function proxy(request) {
  const { pathname } = request.nextUrl;

  // 2. Always allow public paths and Next.js internals / static assets
  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/api/qr') // Allow QR images to be viewed without login
  ) {
    return NextResponse.next();
  }

  // 3. Verify session cookie
  const sessionCookie = request.cookies.get('session')?.value;

  if (sessionCookie) {
    try {
      await jwtVerify(sessionCookie, encodedKey, { algorithms: ['HS256'] });
      return NextResponse.next();
    } catch {
      // Invalid / expired token — fall through to redirect
    }
  }

  // 4. Not authenticated → redirect to /login
  const loginUrl = new URL('/login', request.url);
  return NextResponse.redirect(loginUrl);
}

// Routes Proxy should not run on
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

