'use server';

import { query } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import crypto from 'crypto';
import { Resend } from 'resend';
import { headers } from 'next/headers';
import { verifySession, encrypt } from '@/lib/auth';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function inviteUser(prevState, formData) {
    const email = formData.get('email');
    const role = formData.get('role') || 'admin';

    if (!email) return { error: 'Email is required' };

    try {
        let userId;

        // 3. Create or update user as invited
        const [existing] = await query('SELECT id FROM users WHERE email = ?', [email]);
        
        if (existing) {
            await query(
                'UPDATE users SET role = ? WHERE email = ?',
                [role, email]
            );
            userId = existing.id;
        } else {
            const [res] = await query(
                'INSERT INTO users (email, role) VALUES (?, ?)',
                [email, role]
            );
            userId = res.insertId;
        }

        // Generate Magic Link
        const token = await encrypt({ 
            userId: userId, 
            role: role, 
            type: 'magic-link' 
        }, '48h');
        
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const magicLink = `${baseUrl}/api/auth/callback?token=${token}`;

        // 4. Send invitation email
        const { data, error: mailError } = await resend.emails.send({
            from: 'SCITO Admin <no-reply@scitoevents.com>',
            to: email,
            subject: 'Invitation to SCITO Admin Dashboard',
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 12px;">
                    <h2 style="color: #1e293b;">You've been invited!</h2>
                    <p style="color: #475569; line-height: 1.6;">
                        You have been invited to join the SCITO Admin Dashboard as an <strong>${role}</strong>.
                    </p>
                    <p style="margin-top: 30px;">
                        <a href="${magicLink}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                            Log In to Dashboard
                        </a>
                    </p>
                    <p style="margin-top: 30px; font-size: 12px; color: #94a3b8;">
                        This link will expire in 48 hours. After that, you can request a new login link at any time from the login page.
                    </p>
                </div>
            `
        });

        if (mailError) {
            console.error('Resend error:', mailError);
            return { error: mailError.message };
        }

        console.log(`📧 Invitation email sent to ${email}`);

        revalidatePath('/users');
        return { success: true };
    } catch (error) {
        console.error('Invitation error:', error);
        return { error: 'Failed to invite user: ' + error.message };
    }
}



export async function deleteUser(userId) {
    const session = await verifySession();
    if (session?.role !== 'superadmin') {
        return { error: 'Unauthorized' };
    }

    try {
        await query('DELETE FROM users WHERE id = ?', [userId]);
        revalidatePath('/users');
        return { success: true };
    } catch (error) {
        return { error: 'Failed to delete user' };
    }
}

export async function updateUserRole(userId, newRole) {
    const session = await verifySession();
    if (session?.role !== 'superadmin') {
        return { error: 'Unauthorized' };
    }

    try {
        console.log(`Attempting to update user ${userId} to role: ${newRole}`);
        const result = await query('UPDATE users SET role = ? WHERE id = ?', [newRole, userId]);
        console.log('Update result:', result);
        revalidatePath('/users');
        return { success: true };
    } catch (error) {
        console.error('DATABASE ERROR during role update:', error);
        return { error: 'Database error: ' + error.message };
    }
}

export async function updateUserClusters(userId, clustersArray) {
    const session = await verifySession();
    if (session?.role !== 'superadmin') {
        return { error: 'Unauthorized' };
    }

    try {
        await query('UPDATE users SET cluster_for_review = ? WHERE id = ?', [JSON.stringify(clustersArray), userId]);
        revalidatePath('/users');
        return { success: true };
    } catch (error) {
        return { error: 'Failed to update user clusters' };
    }
}
