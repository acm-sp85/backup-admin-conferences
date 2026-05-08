'use server';

import { query } from '@/lib/db';
import { createSession, deleteSession, encrypt } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { checkRateLimit } from '@/lib/rate-limit';
import { z } from 'zod';
import { Resend } from 'resend';
import { emailTemplates, EMAIL_CONFIG } from '@/lib/email-templates';
import { getEmailTemplate } from '@/lib/email-dispatcher';

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
      console.log(`📧 Attempting to send magic link to: ${email}`);
      
      let conferenceId = null;
      // Only use conference-specific branding if the user is a regular 'user' (voter)
      // and we have a specific conference acronym defined in the environment.
      if (user.role === 'user') {
        const results = await query('SELECT id FROM conferences WHERE acronym = ?', [process.env.CONFERENCE_ACRONYM || 'SCITO']);
        conferenceId = results[0]?.id;
      }

      const { subject, html } = await getEmailTemplate(conferenceId, 'magicLink', { magicLink });
      
      const { data, error } = await resend.emails.send({
        from: EMAIL_CONFIG.from,
        to: email,
        subject,
        html,
      });

      if (error) {
        console.error('❌ Resend Error Details:', JSON.stringify(error, null, 2));
        return { message: 'Failed to send email. Please try again later.' };
      }
      console.log('✅ Resend Success:', data);
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
