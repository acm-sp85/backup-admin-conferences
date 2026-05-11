'use server';

import { query } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import crypto from 'crypto';
import { Resend } from 'resend';
import { headers } from 'next/headers';
import { verifySession, encrypt } from '@/lib/auth';
import { emailTemplates, EMAIL_CONFIG } from '@/lib/email-templates';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function inviteUser(prevState, formData) {
    const email = formData.get('email');
    const role = formData.get('role') || 'admin';
    let firstName = formData.get('firstName');
    let lastName = formData.get('lastName');

    if (!email) return { error: 'Email is required' };

    try {
        // Try to fetch names from participants table if not provided
        if (!firstName || !lastName) {
            const [participant] = await query('SELECT firstName, lastName FROM participants WHERE email = ? LIMIT 1', [email]);
            if (participant) {
                firstName = firstName || participant.firstName;
                lastName = lastName || participant.lastName;
            }
        }

        let userId;

        // 3. Create or update user as invited
        const [existing] = await query('SELECT id FROM users WHERE email = ?', [email]);
        
        if (existing) {
            await query(
                'UPDATE users SET role = ?, firstName = ?, lastName = ? WHERE email = ?',
                [role, firstName, lastName, email]
            );
            userId = existing.id;
        } else {
            const res = await query(
                'INSERT INTO users (email, role, firstName, lastName) VALUES (?, ?, ?, ?)',
                [email, role, firstName, lastName]
            );
            userId = res.insertId;
        }

        // Generate Magic Link
        const token = await encrypt({ 
            userId: userId, 
            role: role, 
            type: 'magic-link' 
        }, '48h');
        
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                        (process.env.VERCEL_ENV === 'production' ? 'https://www.smart-conference.org' : 
                         process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
                         'http://localhost:3000');
        const magicLink = `${baseUrl}/api/auth/callback?token=${token}`;


        // 4. Send invitation email
        console.log(`📧 Sending invitation to ${email}`);
        
        let conference = null;
        // Only use conference-specific branding if it's a regular user
        if (role === 'user') {
            const results = await query('SELECT * FROM conferences WHERE acronym = ?', [process.env.CONFERENCE_ACRONYM || 'SCITO']);
            conference = results[0];
        }

        const template = emailTemplates.userInvitation({
            role,
            magicLink,
            conference
        });

        const { data, error: mailError } = await resend.emails.send({
            from: EMAIL_CONFIG.from,
            to: email,
            subject: template.subject,
            html: template.html
        });

        if (mailError) {
            console.error('❌ Resend Invitation Error:', JSON.stringify(mailError, null, 2));
            return { error: mailError.message };
        }
        console.log('✅ Invitation Sent Successfully:', data);

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
