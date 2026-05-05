'use server';

import { query } from '@/lib/db';
import { createSession, deleteSession, encrypt } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { checkRateLimit } from '@/lib/rate-limit';
import { z } from 'zod';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const loginSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email.' }).trim(),
  password: z.string().optional(), // Make password optional as we transition to Magic Link
});

export async function requestMagicLink(prevState, formData) {
  const headerList = await headers();
  const ip = headerList.get('x-forwarded-for')?.split(',')[0] || 'unknown';
  const host = headerList.get('host');
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';

  // Rate limiting (5 attempts per 15 minutes)
  const { success, resetAt } = await checkRateLimit(ip, 'magic-link', 5, 900);

  if (!success) {
    return {
      message: `Too many requests. Please try again after ${resetAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
    };
  }

  const email = formData.get('email')?.toString().toLowerCase().trim();
  
  if (!email || !z.string().email().safeParse(email).success) {
    return { errors: { email: 'Please enter a valid email address.' } };
  }

  try {
    // 1. Check if user exists
    const users = await query('SELECT id, email, role FROM users WHERE email = ?', [email]);
    const user = users[0];

    if (user) {
      // 2. Generate short-lived magic token (15 mins)
      const token = await encrypt({ 
        userId: user.id, 
        role: user.role, 
        type: 'magic-link' 
      }, '15m');

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
      const magicLink = `${baseUrl}/api/auth/callback?token=${token}`;

      // 3. Send Email
      const { data, error } = await resend.emails.send({
        from: 'SCITO Admin <no-reply@scitoevents.com>',
        to: email,
        subject: 'Your Login Link - SCITO Admin',
        html: `
          <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 12px;">
            <h2 style="font-size: 18px; font-weight: 600; margin-bottom: 16px;">Login to SCITO Admin</h2>
            <p style="font-size: 14px; color: #666; margin-bottom: 24px;">Click the button below to sign in to your account. This link expires in 15 minutes.</p>
            <a href="${magicLink}" style="display: block; background: #007aff; color: white; text-align: center; padding: 12px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">Sign In</a>
            <p style="font-size: 11px; color: #999; margin-top: 24px; text-align: center;">If you didn't request this, you can safely ignore this email.</p>
          </div>
        `,
      });

      if (error) {
        console.error('❌ Resend Error:', error);
        return { message: 'Failed to send email. Please try again later.' };
      }
    }

    return { 
      success: true, 
      message: 'If an account exists for this email, you will receive a login link shortly.' 
    };

  } catch (error) {
    console.error('Magic Link Error:', error);
    return { message: 'Something went wrong. Please try again later.' };
  }
}

export async function logout() {
  await deleteSession();
  redirect('/');
}
