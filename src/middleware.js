import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const secretKey = process.env.SESSION_SECRET || 'a-very-long-and-secure-fallback-secret-key-123';
const encodedKey = new TextEncoder().encode(secretKey);

// Routes that don't require authentication
const PUBLIC_PATHS = [
  '/login',
  '/setup-password',
  '/api/auth/callback',
];

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // Always allow public paths and Next.js internals / static assets
  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next();
  }

  // Verify session cookie
  const sessionCookie = request.cookies.get('session')?.value;

  if (sessionCookie) {
    try {
      await jwtVerify(sessionCookie, encodedKey, { algorithms: ['HS256'] });
      return NextResponse.next();
    } catch {
      // Invalid / expired token — fall through to redirect
    }
  }

  // Not authenticated → redirect to /login
  const loginUrl = new URL('/login', request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Run on all routes except static files
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
