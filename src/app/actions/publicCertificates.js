'use server';

import { query } from '@/lib/db';
import { encrypt } from '@/lib/auth';
import { Resend } from 'resend';
import { EMAIL_CONFIG, getBranding, renderHeader } from '@/lib/email-templates';

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Validates the email and returns available completed conferences for that participant.
 */
export async function checkEmailForCertificates(email) {
    if (!email || typeof email !== 'string') {
        return { error: 'Invalid email address.' };
    }

    // Find participant in any completed conference with scanned_at
    const rows = await query(`
        SELECT DISTINCT c.id, c.name, c.conference_full_name, c.logo_url, c.end_date, r.id as registration_id, p.id as participant_id
        FROM participants p
        JOIN registrations r ON p.id = r.participant_id
        JOIN conferences c ON r.conference_id = c.id
        JOIN participant_qr_tokens t ON r.id = t.registration_id
        WHERE p.email = ? AND t.scanned_at IS NOT NULL AND c.end_date <= NOW()
    `, [email.trim().toLowerCase()]);

    if (rows.length === 0) {
        return { error: 'No certificates found for this email. Ensure you have checked in at a completed conference.' };
    }

    return { conferences: rows };
}

/**
 * Sends an email with a secure token link to view the certificate.
 */
export async function sendPublicCertificateEmail(email, conferenceId, registrationId) {
    console.log('Sending certificate email...', { email, conferenceId, registrationId });
    // Generate JWT
    const token = await encrypt({ conferenceId, registrationId }, '30d');
    
    // Get conference details
    const [conf] = await query('SELECT * FROM conferences WHERE id = ?', [conferenceId]);
    console.log('Found conference:', conf?.name);
    if (!conf) return { error: 'Conference not found' };

    const brand = getBranding(conf);
    
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const certificateUrl = `${baseUrl}/certificates/${token}`;

    const isSpanish = conf.name.toUpperCase().includes('CIPIE');
    
    const textConfig = {
        title: isSpanish ? 'Tu Certificado de Participación' : 'Your Certificate of Participation',
        p1: isSpanish 
            ? `Gracias por participar en <strong>${conf.name}</strong>. Puedes ver y descargar tu Certificado de Participación haciendo clic en el botón de abajo.`
            : `Thank you for participating in <strong>${conf.name}</strong>. You can view and download your Certificate of Participation by clicking the button below.`,
        btn: isSpanish ? 'Ver Certificado' : 'View Certificate',
        footer: isSpanish 
            ? 'Este enlace caducará en 30 días. Si lo necesitas después, puedes solicitar un nuevo enlace.' 
            : 'This link will expire in 30 days. If you need it after that, you can request a new link.',
        subject: isSpanish
            ? `${conf.name} - Certificado de Participación`
            : `${conf.name} - Certificate of Participation`
    };

    const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
            ${renderHeader(brand)}
            <h2 style="color: #1e293b; margin-bottom: 20px;">${textConfig.title}</h2>
            <p style="color: #475569; line-height: 1.6; margin-bottom: 20px;">
                ${textConfig.p1}
            </p>
            <div style="margin: 30px 0;">
                <a href="${certificateUrl}" style="background-color: ${brand.accentColor}; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block;">
                    ${textConfig.btn}
                </a>
            </div>
            <p style="margin-top: 20px; font-size: 11px; color: #94a3b8;">
                ${textConfig.footer}
            </p>
        </div>
    `;

    const { error } = await resend.emails.send({
        from: EMAIL_CONFIG.fromConferences,
        to: [email.trim().toLowerCase()],
        subject: textConfig.subject,
        html
    });

    if (error) {
        console.error('Resend Error (Public Certificate):', error);
        return { error: 'Failed to send the email. Please try again later.' };
    }

    return { success: true };
}
