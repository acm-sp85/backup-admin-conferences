// src/app/api/participants/check-access/route.js
import { NextResponse } from 'next/server';
import { hasAccess } from '@/lib/db';

export async function POST(req) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ granted: false, message: 'Email required' }, { status: 400 });
    }
    const granted = await hasAccess(email);
    if (granted) {
      const response = NextResponse.json({ granted: true });
      // Set HttpOnly cookie to remember access
      response.cookies.set('accessGranted', 'true', { httpOnly: true, path: '/', maxAge: 60 * 60 * 24 }); // 1 day
      return response;
    }
    return NextResponse.json({ granted: false, message: 'Acceso denegado. Consulta con la organización si tienes alguna duda. O revisa que el email sea correcto.' }, { status: 403 });
  } catch (err) {
    console.error('Access check error', err);
    return NextResponse.json({ granted: false, message: 'Server error' }, { status: 500 });
  }
}
