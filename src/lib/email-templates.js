/**
 * MASTER EMAIL TEMPLATES FILE
 * 
 * Centralized location for all email communication.
 * Templates now consume 'conference' objects fetched directly from the database.
 */

export const EMAIL_CONFIG = {
    // IMPORTANT: Ensure the domain below is verified in https://resend.com/domains
    from: 'Smart Conference Admin <no-reply@smart-conferences.org>',
    fromConferences: 'Smart Conference <no-reply@smart-conferences.org>',
    fromVoting: 'Smart Conference Voting <no-reply@smart-conferences.org>',
};

/**
 * HELPER: Safe defaults for conference data
 */
export const getBranding = (conf) => {
    let baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.smart-conference.org' || 'https://smart-conference.org';
    if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);

    const formatUrl = (url) => {
        if (!url) return null;
        if (url.startsWith('http')) return url;
        const cleanUrl = url.startsWith('/') ? url : `/${url}`;
        return `${baseUrl}${cleanUrl}`;
    };

    return {
        name: conf?.name || 'Smart Conference Admin',
        email: conf?.email || 'fundacio@scito.org',
        accentColor: conf?.accent_color || '#007aff',
        logo: formatUrl(conf?.logo_url || 'https://www.nanoge.org/img/logo-nanoge.png'),
        banner: formatUrl(conf?.banner_url || 'https://www.nanoge.org/img/cabecera2.png'),
        baseUrl
    };
};

/**
 * HELPER: Simple wrapper for logo if it exists
 */
export const renderHeader = (brand) => {
    let html = '';
    
    // Banner (Wide, at the very top)
    if (brand.banner) {
        html += `
            <div style="margin: -20px -20px 20px -20px;">
                <img src="${brand.banner}" alt="Banner" style="width: 100%; height: auto; display: block; border-radius: 12px 12px 0 0;" />
            </div>
        `;
    }

    // Logo (Centered)
    // if (brand.logo) {
    //     html += `
    //         <div style="text-align: center; margin-bottom: 24px; padding-top: ${brand.banner ? '0' : '20px'};">
    //             <img src="${brand.logo}" alt="${brand.name} Logo" style="max-height: 60px; max-width: 200px;" />
    //         </div>
    //     `;
    // }

    return html;
};

export const emailTemplates = {
    /**
     * Magic Link / Login Email
     */
    magicLink: ({ magicLink, conference }) => {
        const brand = getBranding(conference);
        return {
            subject: `Your Login Link - ${brand.name}`,
            html: `
              <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 12px;">
                ${renderHeader(brand)}
                <h2 style="font-size: 18px; font-weight: 600; margin-bottom: 16px;">Login to ${brand.name} System</h2>
                <p style="font-size: 14px; color: #666; margin-bottom: 24px;">Click the button below to sign in to your account. This link expires in 15 minutes.</p>
                <a href="${magicLink}" style="display: block; background: ${brand.accentColor}; color: white; text-align: center; padding: 12px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">Sign In</a>
                <p style="font-size: 11px; color: #999; margin-top: 24px; text-align: center;">If you didn't request this, you can safely ignore this email.</p>
              </div>
            `,
        };
    },
    
    /**
     * Admin/Staff Invitation Email
     */
    userInvitation: ({ role, magicLink, conference }) => {
        const brand = getBranding(conference);
        return {
            subject: `Invitation to ${brand.name} Dashboard`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
                    ${renderHeader(brand)}
                    <h2 style="color: #1e293b;">You've been invited!</h2>
                    <p style="color: #475569; line-height: 1.6;">
                        You have been invited to join the <strong>${brand.name}</strong> Admin Dashboard as an <strong>${role}</strong>.
                    </p>
                    <p style="margin-top: 30px;">
                        <a href="${magicLink}" style="background-color: ${brand.accentColor}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                            Log In to Dashboard
                        </a>
                    </p>
                    <p style="margin-top: 30px; font-size: 12px; color: #94a3b8;">
                        This link will expire in 48 hours. After that, you can request a new login link at any time from the login page.
                    </p>
                </div>
            `
        };
    },

    /**
     * Social Dinner Tickets (with QR codes)
     */
    socialDinnerTickets: ({ name, conference, qrCodes }) => {
        const brand = getBranding(conference);
        
        return {
            subject: `Your Social Dinner Tickets - ${brand.name}`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                    ${renderHeader(brand)}
                    <h1 style="color: #1d1d1f; font-size: 24px;">Hello ${name},</h1>
                    <p>Here are your tickets for the Social Dinner. Please show these QR codes at the entrance.</p>
                    
                    ${qrCodes.map((qc, idx) => `
                        <div style="margin-bottom: 20px; padding: 20px; background: #f5f5f7; border-radius: 12px; text-align: center;">
                            <img src="${brand.baseUrl}/api/qr/${qc.token}" alt="QR Code" style="width: 240px; height: 240px; margin-bottom: 10px; display: block; margin-left: auto; margin-right: auto;" />
                            <p style="margin: 5px 0; font-weight: bold; color: ${brand.accentColor};">Dietary: ${qc.dietary}</p>
                        </div>
                    `).join('')}
                    
                    <p style="font-size: 12px; color: #86868b; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
                        This is an automated message from ${brand.name}. For support, contact ${brand.email}.
                    </p>
                </div>
            `
        };
    },

    /**
     * Poster Voting Invitation
     */
    posterVotingInvite: ({ name, magicLink, conference }) => {
        const brand = getBranding(conference);
        return {
            subject: `Invitation to Poster Voting - ${brand.name}`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
                    ${renderHeader(brand)}
                    <h2 style="color: #1e293b; margin-bottom: 20px;">Poster Voting Invitation</h2>
                    <p style="color: #475569; line-height: 1.6; margin-bottom: 20px;">
                        Hello ${name || 'Voter'},<br><br>
                        You have been invited to participate in the poster voting process for <strong>${brand.name}</strong>. 
                        Please use the link below to access your assigned clusters and cast your votes.
                    </p>
                    <div style="margin: 30px 0;">
                        <a href="${magicLink}" style="background-color: ${brand.accentColor}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
                            Log In to Vote
                        </a>
                    </div>
                    <p style="color: #64748b; font-size: 13px; margin-top: 30px; border-top: 1px solid #f1f5f9; padding-top: 20px;">
                        <strong>Instructions:</strong><br>
                        1. Log in to the platform using the button above.<br>
                        2. Go to the "Voting" tab to see your assigned posters.<br>
                        3. Rank them from 1 to 10 and save.
                    </p>
                    <p style="margin-top: 20px; font-size: 11px; color: #94a3b8;">
                        This link will expire in 48 hours. After that, you can request a new login link at any time from the login page.
                    </p>
                </div>
            `
        };
    },

    /**
     * Participant Check-in QR (General)
     */
    emailCheckin: ({ name, conference, token }) => {
        const brand = getBranding(conference);
        const checkinBody = conference?.email_checkin_body || getDefaultEmailBody('emailCheckin', conference);
        
        // Inject variables into the custom body if they exist as placeholders
        const htmlBody = checkinBody
            .replace(/\${name}/g, name)
            .replace(/\${conference}/g, brand.name)
            .replace(/\${renderHeader\(brand\)}/g, renderHeader(brand));

        return {
            subject: `Your Check-in QR Code - ${brand.name}`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                    ${renderHeader(brand)}
                    ${htmlBody}
                    
                    <div style="margin: 30px 0; padding: 20px; background: #f5f5f7; border-radius: 12px; text-align: center;">
                        <img src="${brand.baseUrl}/api/qr/participants/${token}" alt="QR Code" style="width: 240px; height: 240px; margin-bottom: 10px; display: block; margin-left: auto; margin-right: auto;" />
                        <p style="margin: 5px 0; font-size: 12px; color: #86868b;">Show this QR code at the registration desk.</p>
                    </div>
                    
                    <p style="font-size: 12px; color: #86868b; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
                        This is an automated message from ${brand.name}. For support, contact ${brand.email}.
                    </p>
                </div>
            `
        };
    }
};

/**
 * Returns the default email body as a string with ${placeholder} syntax
 * for use in the admin dashboard UI.
 */
export const getDefaultEmailBody = (type, conference) => {
    const brand = getBranding(conference);
    
    switch(type) {
        case 'magicLink':
            return `
<div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 12px;">
    \${renderHeader(brand)}
    <h2 style="font-size: 18px; font-weight: 600; margin-bottom: 16px;">Login to \${brand.name} Poster Voting System</h2>
    <p style="font-size: 14px; color: #666; margin-bottom: 24px;">Click the button below to sign in to your account. This link expires in 15 minutes.</p>
    <a href="\${magicLink}" style="display: block; background: \${brand.accentColor}; color: white; text-align: center; padding: 12px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">Sign In</a>
    <p style="font-size: 11px; color: #999; margin-top: 24px; text-align: center;">If you didn't request this, you can safely ignore this email.</p>
</div>
`.replace('\\${renderHeader(brand)}', renderHeader(brand))
 .replace('\\${brand.name}', brand.name)
 .replace('\\${brand.accentColor}', brand.accentColor);

        case 'posterVotingInvite':
            return `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
    \${renderHeader(brand)}
    <h2 style="color: #1e293b; margin-bottom: 20px;">Poster Voting Invitation</h2>
    <p style="color: #475569; line-height: 1.6; margin-bottom: 20px;">
        Hello \${name},<br><br>
        You have been invited to participate in the poster voting process for <strong>\${brand.name}</strong>. 
        Please use the link below to access your assigned clusters and cast your votes.
    </p>
    <div style="margin: 30px 0;">
        <a href="\${magicLink}" style="background-color: \${brand.accentColor}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
            Log In to Vote
        </a>
    </div>
    <p style="color: #64748b; font-size: 13px; margin-top: 30px; border-top: 1px solid #f1f5f9; padding-top: 20px;">
        <strong>Instructions:</strong><br>
        1. Log in to the platform using the button above.<br>
        2. Go to the "Voting" tab to see your assigned posters.<br>
        3. Rank them from 1 to 10 and save.
    </p>
    <p style="margin-top: 20px; font-size: 11px; color: #94a3b8;">
        This link will expire in 48 hours. After that, you can request a new login link at any time from the login page.
    </p>
</div>
`.replace('\\${renderHeader(brand)}', renderHeader(brand))
 .replace('\\${brand.name}', brand.name)
 .replace('\\${brand.accentColor}', brand.accentColor);

        case 'socialDinnerTickets':
            return `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
    \${renderHeader(brand)}
    <h1 style="color: #1d1d1f; font-size: 24px;">Hello \${name},</h1>
    <p>Here are your tickets for the Social Dinner. Please show these QR codes at the entrance.</p>
    <p style="font-size: 12px; color: #86868b; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
        This is an automated message from \${brand.name}. For support, contact \${brand.email}.
    </p>
</div>
`.replace('\\${renderHeader(brand)}', renderHeader(brand))
 .replace('\\${brand.name}', brand.name)
 .replace('\\${brand.email}', brand.email);

        case 'emailCheckin':
            return `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
    \${renderHeader(brand)}
    <h1 style="color: #1d1d1f; font-size: 24px;">Hello \${name},</h1>
    <p>We are looking forward to seeing you at <strong>\${conference}</strong>. Below is your personal QR code for a faster check-in at the registration desk.</p>
</div>`.replace('\\${renderHeader(brand)}', renderHeader(brand))
  .replace('\\${conference}', brand.name);

        default:
            return '';
    }
};
