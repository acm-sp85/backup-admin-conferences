import { NextResponse } from 'next/server';
import { decrypt } from '@/lib/auth';

// 1. Specify public routes (all others are protected)
const publicRoutes = ['/login', '/signup', '/db-admin', '/setup-password']; // Temporary: Allow db-admin for verification

export default async function proxy(req) {
  // 2. Check if the current route is public
  const path = req.nextUrl.pathname;
  const isPublicRoute = publicRoutes.some(route => path.startsWith(route));
  const isProtectedRoute = !isPublicRoute;

  // 3. Decrypt the session from the cookie
  const cookie = req.cookies.get('session')?.value;
  const session = await decrypt(cookie);

  // 4. Redirect to /login if the user is not authenticated
  if (isProtectedRoute && !session?.userId) {
    return NextResponse.redirect(new URL('/login', req.nextUrl));
  }

  // 5. Redirect to / if the user is already authenticated and tries to access login/signup
  if (isPublicRoute && session?.userId && path !== '/db-admin') {
    return NextResponse.redirect(new URL('/', req.nextUrl));
  }

  return NextResponse.next();
}

// Routes Middleware should not run on
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)'],
};
