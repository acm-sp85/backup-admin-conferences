'use server';

import { query } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { createSession, deleteSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { checkRateLimit } from '@/lib/rate-limit';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email.' }).trim(),
  password: z.string().min(1, { message: 'Password is required.' }).trim(),
});

export async function login(prevState, formData) {
  // Rate limiting (5 attempts per 15 minutes)
  const headerList = await headers();
  const ip = headerList.get('x-forwarded-for')?.split(',')[0] || 'unknown';
  const { success, resetAt } = await checkRateLimit(ip, 'login', 5, 900);

  if (!success) {
    return {
      message: `Too many login attempts. Please try again after ${resetAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
    };
  }

  // Validate form fields
  const validatedFields = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  const { email, password } = validatedFields.data;

  try {
    // Find user in DB
    const users = await query('SELECT * FROM users WHERE email = ?', [email]);
    const user = users[0];

    if (!user) {
      return {
        message: 'Invalid email or password.',
      };
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return {
        message: 'Invalid email or password.',
      };
    }

    // Create session
    await createSession(user.id, user.role);
    
    if (user.role === 'user') {
        redirect('/voting');
    }
  } catch (error) {
    if (error.digest?.startsWith('NEXT_REDIRECT')) throw error;
    
    console.error('--- LOGIN ERROR DEBUG ---');
    console.error('Error message:', error.message);
    return { message: `Error: ${error.message}` };
  }

  redirect('/');
}

export async function logout() {
  await deleteSession();
  redirect('/');
}
