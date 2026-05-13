'use server';

import { query } from '@/lib/db';
import { createSession, deleteSession, encrypt, decrypt, verifySession } from '@/lib/auth';
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
    const users = await query('SELECT id, email, role, password FROM users WHERE email = ?', [email]);
    const user = users[0];
    const password = formData.get('password')?.toString();

    if (user) {
      if (password && (user.role === 'admin' || user.role === 'superadmin')) {
        const bcrypt = require('bcryptjs');
        if (!user.password) {
          return { message: 'No password set. Please use the magic link first to setup.' };
        }
        const isValid = await bcrypt.compare(password, user.password);
        if (isValid) {
          await createSession(user.id, user.role);
          redirect('/');
        } else {
          return { errors: { password: 'Invalid password.' } };
        }
      }
      // 2. Generate short-lived magic token (15 mins)
      const token = await encrypt({ 
        userId: user.id, 
        role: user.role, 
        type: 'magic-link' 
      }, '15m');

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                      (process.env.VERCEL_ENV === 'production' ? 'https://www.smart-conference.org' || 'https://smart-conference.org' : 
                       process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
                       'http://localhost:3000');
      const magicLink = `${baseUrl}/api/auth/callback?token=${token}`;


      // 3. Send Email
      console.log(`📧 Attempting to send magic link to: ${email}`);
      
      let conferenceId = null;
      // Only use conference-specific branding if the user is a regular 'user' (voter)
      // and we have a specific conference acronym defined in the environment.
      if (user.role === 'user') {
        const results = await query('SELECT id FROM conferences WHERE acronym = ?', [process.env.CONFERENCE_ACRONYM || 'SmartConferences']);
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
    // Next.js redirect() throws internally — must re-throw it
    if (error?.digest?.startsWith('NEXT_REDIRECT')) throw error;
    console.error('Magic Link Error:', error);
    return { message: 'Something went wrong. Please try again later.' };
  }
}

export async function logout() {
  await deleteSession();
  redirect('/');
}

export async function setupAdminPassword(token, formData) {
  const password = formData.get('password')?.toString();
  const confirmPassword = formData.get('confirmPassword')?.toString();

  if (!password || password.length < 8) {
    return { error: 'Password must be at least 8 characters long.' };
  }
  if (password !== confirmPassword) {
    return { error: 'Passwords do not match.' };
  }

  const payload = await decrypt(token);
  if (!payload || payload.type !== 'magic-link' || (payload.role !== 'admin' && payload.role !== 'superadmin')) {
    return { error: 'Invalid or expired token.' };
  }

  try {
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);
    await query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, payload.userId]);

    await createSession(payload.userId, payload.role);
  } catch (error) {
    console.error('Setup Password Error:', error);
    return { error: 'Failed to set password.' };
  }

  redirect('/');
}

export async function updatePassword(prevState, formData) {
  const session = await verifySession();
  if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
    return { error: 'Unauthorized' };
  }

  const password = formData.get('password')?.toString();
  const confirmPassword = formData.get('confirmPassword')?.toString();

  if (!password || password.length < 8) {
    return { error: 'Password must be at least 8 characters long.' };
  }
  if (password !== confirmPassword) {
    return { error: 'Passwords do not match.' };
  }

  try {
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);
    await query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, session.userId]);
    return { success: true, message: 'Password updated successfully.' };
  } catch (error) {
    console.error('Update Password Error:', error);
    return { error: 'Failed to update password.' };
  }
}
