// src/app/api/participants/logout/route.js
import { NextResponse } from 'next/server';

export async function POST() {
  // Clear the HttpOnly access cookie
  const response = NextResponse.redirect('https://app.scitoevents.com/CIPIE2026/home');
  response.cookies.set('accessGranted', '', {
    httpOnly: true,
    path: '/',
    maxAge: 0, // expire immediately
  });
  return response;
}
