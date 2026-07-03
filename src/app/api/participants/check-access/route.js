// src/app/api/participants/check-access/route.js
import { NextResponse } from 'next/server';
import { hasAccess } from '@/lib/db';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(req) {
  try {
    const ip = req.ip || req.headers.get('x-forwarded-for') || '127.0.0.1';
    const rateLimit = await checkRateLimit(ip, 'streaming_check', 5, 60);
    if (!rateLimit.success) {
      return NextResponse.json({ granted: false, message: 'Demasiados intentos. Por favor, espera un minuto.' }, { status: 429 });
    }

    const { email, conference } = await req.json();
    if (!email) {
      return NextResponse.json({ granted: false, message: 'Email required' }, { status: 400 });
    }
    const granted = await hasAccess(email, conference);
    if (granted) {
      const response = NextResponse.json({ granted: true });
      // Set HttpOnly cookie to remember access
      response.cookies.set('accessGranted', 'true', { httpOnly: true, path: '/', maxAge: 60 * 60 * 24 }); // 1 day
      return response;
    }
    return NextResponse.json({ granted: false, message: 'Error de acceso. Revisa que el email sea correcto o contacta con la organización: <a href="mailto:hola@cipie2026.com" style="text-decoration: underline; font-weight: bold;">hola@cipie2026.com</a>' }, { status: 403 });
  } catch (err) {
    console.error('Access check error', err);
    return NextResponse.json({ granted: false, message: 'Error de acceso. Revisa que el email sea correcto o contacta con la organización.' }, { status: 500 });
  }
}
