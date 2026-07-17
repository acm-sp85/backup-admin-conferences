/**
 * MASTER EMAIL TEMPLATES FILE
 * 
 * Centralized location for all email communication.
 * Templates now consume 'conference' objects fetched directly from the database.
 */
import { formatSocialDinnerDate, formatRegistrationDate } from './date-formatter';

export const EMAIL_CONFIG = {
    // IMPORTANT: Ensure the domain below is verified in https://resend.com/domains
    from: process.env.EMAIL_FROM || 'Smart Conference Admin <no-reply@smart-conference.org>',
    fromConferences: process.env.EMAIL_FROM_CONFERENCES || 'Smart Conference <no-reply@smart-conference.org>',
    fromVoting: process.env.EMAIL_FROM_VOTING || 'Smart Conference Voting <no-reply@smart-conference.org>',
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
            subject: `${brand.name} -Your Login Link`,
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
        const isAdmin = role === 'admin' || role === 'superadmin';
        return {
            subject: isAdmin
                ? `Set up your Admin account – ${brand.name}`
                : `Invitation to ${brand.name} Dashboard`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
                    ${renderHeader(brand)}
                    <h2 style="color: #1e293b;">${isAdmin ? 'Create your admin password' : "You've been invited!"}</h2>
                    <p style="color: #475569; line-height: 1.6;">
                        ${isAdmin
                            ? `You have been granted <strong>${role}</strong> access to the <strong>${brand.name}</strong> Admin Dashboard. Click the button below to set up your password and access your account.`
                            : `You have been invited to join the <strong>${brand.name}</strong> Admin Dashboard as a <strong>${role}</strong>.`
                        }
                    </p>
                    <p style="margin-top: 30px;">
                        <a href="${magicLink}" style="background-color: ${brand.accentColor}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                            ${isAdmin ? 'Set Up Password' : 'Log In to Dashboard'}
                        </a>
                    </p>
                    <p style="margin-top: 30px; font-size: 12px; color: #94a3b8;">
                        This link will expire in 48 hours.${isAdmin ? ' Once you set your password, you can log in directly from the login page at any time.' : ' After that, you can request a new login link at any time from the login page.'}
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
            subject: `Entradas a la Cena de Gala - ${brand.name}`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                    ${renderHeader(brand)}
                    <h1 style="color: #1d1d1f; font-size: 24px;">Hello ${name},</h1>
                    <p>Here are your tickets for the Social Dinner. Please show these QR codes at the entrance.</p>
                    
                    ${qrCodes.map((qc, idx) => `
                        <div style="margin-top: 20px; margin-bottom: 20px; padding: 20px; background: #f5f5f7; border-radius: 12px; text-align: center;">
                            <img src="${brand.baseUrl}/api/qr/${qc.token}" alt="QR Code" style="width: 240px; height: 240px; margin-bottom: 10px; display: block; margin-left: auto; margin-right: auto;" />
                            <p style="margin: 5px 0; font-weight: bold; color: ${brand.accentColor};">Dietary: ${qc.dietary}</p>
                        </div>
                    `).join('')}
                    <p style="font-size: 12px; color: #86868b; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
                        The social dinner will take place on ${formatSocialDinnerDate(conference?.social_dinner_date, conference?.social_dinner_time, conference?.social_dinner_timezone) || 'TBD'} at ${conference?.social_dinner_maps_url ? `<a href="${conference.social_dinner_maps_url}" target="_blank" style="color: #0071e3; text-decoration: underline;">${conference.social_dinner_location || 'TBD'}</a>` : (conference?.social_dinner_location || 'TBD')}
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
            subject: `${brand.name} - Invitation to Poster Voting`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
                    ${renderHeader(brand)}
                    <h2 style="color: #1e293b; margin-bottom: 20px;">Poster Voting Invitation</h2>
                    <p style="color: #475569; line-height: 1.6; margin-bottom: 20px;">
                        Hello ${name || 'Voter'},<br><br>
                        You have been invited to participate in the poster voting process for <strong>${brand.name}</strong>. 
                        Please use the link below to access your assigned posters and cast your votes.
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
     * Custom Voting Invitation
     */
    customVotingInvite: ({ name, votingLink, conference }) => {
        const brand = getBranding(conference);
        return {
            subject: `${brand.name} - Rating the oral presentations at ${brand.name}`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
                    ${renderHeader(brand)}
                    <h2 style="color: #1e293b; margin-bottom: 20px;">Rating oral presentations</h2>
                    <p style="color: #475569; line-height: 1.6; margin-bottom: 20px;">
                        Hello ${name || 'Voter'},<br><br>
                        You have been selected to participate in the voting process for the <strong>Best Student Presentation Award</strong> at ${brand.name}.
                    </p>
                    <div style="margin: 30px 0;">
                        <a href="${votingLink}" style="background-color: ${brand.accentColor}; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block;">
                            Open Voting Portal
                        </a>
                    </div>
                    <p style="color: #64748b; font-size: 13px; margin-top: 30px; border-top: 1px solid #f1f5f9; padding-top: 20px;">
                        <strong>Instructions:</strong><br>
                        1. Click the button above to access your personal voting portal.<br>
                        2. Review the assigned presentations.<br>
                        3. Rate from 1 to 10 (1 = lowest, 10 = highest).<br>
                        4. Submit your votes when ready.
                    </p>
                    <p style="margin-top: 20px; font-size: 11px; color: #94a3b8;">
                        This link is unique to you. Please do not share it with others.
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
        
        const venueVal = (conference?.registration_venue || '').trim();
        const startsAtVal = (conference?.registration_starts_at || '').trim();
        const notesVal = (conference?.registration_notes || '').trim();
        const hasNotes = notesVal && notesVal.toLowerCase() !== 'none';
        
        const regVenueHtml = (conference?.registration_maps_url && !conference.registration_venue?.includes('<a'))
            ? `<a href="${conference.registration_maps_url}" target="_blank" style="color: #0071e3; text-decoration: underline;">${conference.registration_venue}</a>`
            : venueVal;

        let processedBody = checkinBody;
        const hasRegistration = venueVal || startsAtVal || hasNotes;
        
        if (!hasRegistration) {
            processedBody = processedBody.replace(/<!-- registration_details_start -->[\s\S]*?<!-- registration_details_end -->/gi, '');
        } else {
            const stripPlaceholder = (content, placeholder) => {
                const tagRegex = new RegExp('<(p|li|tr|td|span)[^>]*>(?:(?!<\\/\\1>)[\\s\\S])*?\\$\\{' + placeholder + '\\}(?:(?!<\\/\\1>)[\\s\\S])*?<\\/\\1>', 'gi');
                let newContent = content.replace(tagRegex, '');
                const lineRegex = new RegExp('^[^\\n]*\\$\\{' + placeholder + '\\}[^\\n]*\\n?', 'gim');
                newContent = newContent.replace(lineRegex, '');
                return newContent;
            };

            if (!venueVal) {
                processedBody = stripPlaceholder(processedBody, 'registration_venue');
            } else {
                processedBody = processedBody.replace(/\${registration_venue}/g, regVenueHtml);
            }
            if (!startsAtVal) {
                processedBody = stripPlaceholder(processedBody, 'registration_starts_at');
            } else {
                processedBody = processedBody.replace(/\${registration_starts_at}/g, formatRegistrationDate(conference?.registration_starts_at) || '');
            }
            if (!hasNotes) {
                processedBody = stripPlaceholder(processedBody, 'registration_notes');
            } else {
                processedBody = processedBody.replace(/\${registration_notes}/g, notesVal);
            }
        }

        // Inject variables into the custom body if they exist as placeholders
        const htmlBody = processedBody
            .replace(/\${name}/g, name)
            .replace(/\${conference}/g, brand.name)
            .replace(/\${renderHeader\(brand\)}/g, renderHeader(brand));

        return {
            subject: `${brand.name} - Your Check-in QR Code`,
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
    },

    /**
     * Certificate of Participation
     */
    certificate: ({ name, conference, registrationType, institution, entityAddress, entityZip, entityCity, entityCountry, checkinDate, sponsorList, conferenceAddress, signatureImage, textUnderSignature, conferenceFullName, conferenceDates, presentations = [] }) => {
        const brand = getBranding(conference);
        const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
        const confName = brand.name;
        const isSpanish = confName && confName.toUpperCase().includes('CIPIE');

        let displayRegistrationType = registrationType;
        if (isSpanish) {
            const typeMapping = {
                'Industrial': 'como sponsor',
                'Participantes': 'como asistente',
                'Coordinador de simposio Waved': 'como coordinador/a de simposio',
                'Streaming': 'de forma remota',
                'Simposio/Taller Plenario': 'como participante en simposio o taller plenario',
                'Coordinadores/as Área de trabajo': 'como coordinador/a de área',
                'Comité Organizador y presidencias ejecutivas': 'como parte del comité organizador y presidencias ejecutivas',
                'Estudiantes / Jubilados / Desempleados': 'como asistente',
            };
            displayRegistrationType = typeMapping[registrationType] || registrationType;
        }

        // Parse and build sponsors block
        let sponsorsHtml = '';
        if (sponsorList) {
           try {
                const sponsors = typeof sponsorList === 'string' ? JSON.parse(sponsorList) : sponsorList;
                if (Array.isArray(sponsors) && sponsors.length > 0) {
                    const logosList = sponsors
                        .map(s => {
                            if (s.logoUrl) {
                                return `<img src="${s.logoUrl}" alt="${s.name}" width="70" height="25" style="max-height: 25px; max-width: 70px; object-fit: contain; margin: 6px 10px; display: inline-block; vertical-align: middle;" />`;
                            }
                            return `<span style="font-size: 8px; font-weight: bold; color: #64748b; margin: 6px 10px; display: inline-block; vertical-align: middle;">${s.name}</span>`;
                        })
                        .join('');
                    
                    sponsorsHtml = `
                        <div style="margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 14px; text-align: center;">
                            <p style="font-size: 7px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 6px 0;">Organized & Supported By</p>
                            <div style="text-align: center; line-height: 25px;">
                                ${logosList}
                            </div>
                        </div>
                    `;
                }
            } catch (e) {
                console.error("Error parsing sponsor list for template:", e);
            }
        }

        if (conference?.email_certificate_body) {
            const presentationsHtml = presentations && presentations.length > 0 ? `
                <div style="margin-top: 12px; border-top: 1px solid #e2e8f0; padding-top: 12px;">
                    <p style="margin: 0 0 6px 0; font-size: 14px; color: #334155; line-height: 1.7;">
                        <strong>${name}</strong> ${isSpanish ? 'ha presentado:' : 'has presented:'}
                    </p>
                    <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #334155; line-height: 1.6;">
                        ${presentations.map(pres => `<li>${(isSpanish && pres.type.toLowerCase() === 'poster') ? 'Póster' : pres.type} ${isSpanish ? 'con título' : 'contribution entitled'} <strong>"${pres.title}"</strong>.</li>`).join('')}
                    </ul>
                </div>
            ` : '';

            const signatureHtml = signatureImage ? `<img src="${signatureImage}" style="max-height: 65px; display: block; margin: 8px 0;" alt="Signature" />` : '';
            const textUnderSignatureHtml = textUnderSignature 
                ? `<p style="font-size: 13px; color: #1e293b; font-weight: 600; margin: 5px 0 0 0; line-height: 1.4;">${textUnderSignature.replace(/\n/g, '<br>')}</p>` 
                : `<p style="font-size: 13px; color: #1e293b; font-weight: 600; margin: 8px 0 0 0;">${confName} ${isSpanish ? 'Comité Organizador' : 'Organizing Committee'}</p>`;

            const locationStr = [entityZip, entityCity].filter(Boolean).join(' ') + (entityCountry ? (entityZip || entityCity ? ', ' : '') + entityCountry : '');

            let customHtml = conference.email_certificate_body
                .replace(/\$\{name\}/g, name || '')
                .replace(/\$\{conference\}/g, brand.name || '')
                .replace(/\$\{today\}/g, today || '')
                .replace(/\$\{renderHeader\(brand\)\}/g, renderHeader(brand) || '')
                .replace(/\$\{brand\.accentColor\}/g, brand.accentColor || '')
                .replace(/\$\{brand\.email\}/g, brand.email || '')
                .replace(/\$\{institution\}/g, institution || '')
                .replace(/\$\{entityAddress\}/g, entityAddress || '')
                .replace(/\$\{entityLocation\}/g, locationStr || '')
                .replace(/\$\{registrationType\}/g, displayRegistrationType || '')
                .replace(/\$\{conferenceFullName\}/g, conferenceFullName || '')
                .replace(/\$\{conferenceAddress\}/g, conferenceAddress ? conferenceAddress.replace(/\n/g, '<br>') : '')
                .replace(/\$\{conferenceAddressInline\}/g, conferenceAddress ? conferenceAddress.replace(/\n/g, ', ') : '')
                .replace(/\$\{conferenceDates\}/g, conferenceDates || '')
                .replace(/\$\{signatureHtml\}/g, signatureHtml || '')
                .replace(/\$\{textUnderSignatureHtml\}/g, textUnderSignatureHtml || '')
                .replace(/\$\{sponsorsHtml\}/g, sponsorsHtml || '')
                .replace(/\$\{presentationsHtml\}/g, presentationsHtml || '');
            
            // Clean up empty paragraphs/spans that might be left behind if a variable is empty
            // This is optional but helpful if they put variables in their own tags.
            
            return {
                subject: `Certificate of Participation - ${confName}`,
                html: customHtml
            };
        }

        return {
            subject: `Certificate of Participation - ${confName}`,
            html: `
                <div style="font-family: 'Georgia', 'Times New Roman', serif; max-width: 700px; margin: 0 auto; padding: 0; border: 2px solid ${brand.accentColor}; border-radius: 4px;">
                    ${renderHeader(brand)}
                    <div style="padding: 40px 40px 30px 40px;">
                        <h1 style="text-align: center; color: ${brand.accentColor}; font-size: 26px; font-weight: 700; margin: 0 0 8px 0; letter-spacing: 1px;">${isSpanish ? 'CERTIFICADO DE PARTICIPACIÓN' : 'CERTIFICATE OF PARTICIPATION'}</h1>
                        <div style="text-align: center; border-bottom: 2px solid ${brand.accentColor}; padding-bottom: 20px; margin-bottom: 30px;">
                            <p style="color: #64748b; font-size: 13px; margin: 0;">${today}</p>
                        </div>

                        <table style="width: 100%; margin-bottom: 30px;" cellpadding="0" cellspacing="0">
                            <tr>
                                <td style="width: 50%; vertical-align: top; padding-right: 20px;">
                                    <p style="font-size: 18px; font-weight: 700; color: #1e293b; margin: 0 0 4px 0;">${name}</p>
                                    ${institution ? `<p style="font-size: 13px; color: #64748b; margin: 0 0 2px 0;">${institution}</p>` : ''}
                                    ${entityAddress ? `<p style="font-size: 12px; color: #64748b; margin: 0 0 2px 0;">${entityAddress}</p>` : ''}
                                    ${(entityZip || entityCity || entityCountry) ? `<p style="font-size: 12px; color: #64748b; margin: 0;">${[[entityZip, entityCity].filter(Boolean).join(' '), entityCountry].filter(Boolean).join(', ')}</p>` : ''}
                                </td>
                                <td style="width: 50%; vertical-align: top; padding-left: 20px; border-left: 1px solid #e2e8f0;">
                                    <p style="font-size: 11px; font-weight: 700; color: ${brand.accentColor}; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 6px 0;">${isSpanish ? 'Este certificado acredita la participación en:' : 'This certifies participation at:'}</p>
                                    <p style="font-size: 12px; font-weight: 700; color: #1e293b; margin: 0 0 4px 0;">${confName}${conferenceFullName ? ` - ${conferenceFullName}` : ''}</p>
                                    ${conferenceAddress ? `<p style="font-size: 12px; color: #64748b; margin: 0; line-height: 1.4;">${conferenceAddress.replace(/\n/g, '<br>')}</p>` : ''}
                                </td>
                            </tr>
                        </table>

                        <div style="background: #f8fafc; border-radius: 8px; padding: 24px; margin-bottom: 30px; border: 1px solid #e2e8f0;">
                            <p style="font-size: 14px; color: #334155; line-height: 1.7; margin: 0;">
                                ${isSpanish ? 'El presente documento certifica que' : 'This letter certifies that'} <strong>${name}</strong>
                                ${displayRegistrationType ? ` ${isSpanish ? 'participó como' : 'participated as'} <strong>${displayRegistrationType}</strong> ` : ` ${isSpanish ? 'participó' : 'participated'} `}
                                &nbsp;${isSpanish ? 'en' : 'at the'} <strong>${conferenceFullName ? `${conferenceFullName} - ${confName}` : confName}</strong>${conferenceAddress ? `${isSpanish ? ', celebrado en' : ', celebrated at'} <strong>${conferenceAddress.replace(/\n/g, ', ')}</strong>` : ''}${conferenceDates ? ` ${isSpanish ? 'del' : 'from'} <strong>${conferenceDates}</strong>` : ''}.
                            </p>
                            ${presentations && presentations.length > 0 ? `
                                <div style="margin-top: 12px; border-top: 1px solid #e2e8f0; padding-top: 12px;">
                                    <p style="margin: 0 0 6px 0; font-size: 14px; color: #334155; line-height: 1.7;">
                                        <strong>${name}</strong> ${isSpanish ? 'ha presentado:' : 'has presented:'}
                                    </p>
                                    <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #334155; line-height: 1.6;">
                                        ${presentations.map(pres => `<li>${pres.type} ${isSpanish ? 'con título' : 'contribution entitled'} <strong>"${pres.title}"</strong>.</li>`).join('')}
                                    </ul>
                                </div>
                            ` : ''}
                        </div>

                        <div style="margin-bottom: 30px;">
                            <p style="font-size: 13px; color: #475569; margin: 0;">${isSpanish ? 'Atentamente,' : 'Sincerely,'}</p>
                            ${signatureImage ? `<img src="${signatureImage}" style="max-height: 65px; display: block; margin: 8px 0;" alt="Signature" />` : ''}
                            ${textUnderSignature 
                                ? `<p style="font-size: 13px; color: #1e293b; font-weight: 600; margin: 5px 0 0 0; line-height: 1.4;">${textUnderSignature.replace(/\n/g, '<br>')}</p>` 
                                : `<p style="font-size: 13px; color: #1e293b; font-weight: 600; margin: 8px 0 0 0;">${confName} ${isSpanish ? 'Comité Organizador' : 'Organizing Committee'}</p>`
                            }
                        </div>

                        ${sponsorsHtml}

                        <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; text-align: center; margin-top: 20px;">
                            <p style="font-size: 11px; color: #94a3b8; margin: 0;">
                                ${isSpanish ? 'Este es un certificado automático de' : 'This is an automated certificate from'} ${confName}. ${isSpanish ? 'Para soporte, contacta a' : 'For support, contact'} ${brand.email}.
                            </p>
                        </div>
                    </div>
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
`.replace('${renderHeader(brand)}', renderHeader(brand))
 .replace('${brand.name}', brand.name)
 .replace('${brand.accentColor}', brand.accentColor);

        case 'posterVotingInvite':
            return `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
    \${renderHeader(brand)}
    <h2 style="color: #1e293b; margin-bottom: 20px;">Poster Voting Invitation</h2>
    <p style="color: #475569; line-height: 1.6; margin-bottom: 20px;">
        Hello \${name},<br><br>
        You have been invited to participate in the poster voting process for <strong>\${brand.name}</strong>. 
        Please use the link below to access your assigned posters and cast your votes.
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
`.replace('${renderHeader(brand)}', renderHeader(brand))
 .replace('${brand.name}', brand.name)
 .replace('${brand.accentColor}', brand.accentColor);

        case 'customVotingInvite':
            return `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
    \${renderHeader(brand)}
    <h2 style="color: #1e293b; margin-bottom: 20px;">You're Invited to Vote!</h2>
    <p style="color: #475569; line-height: 1.6; margin-bottom: 20px;">
        Hello \${name},<br><br>
        You have been selected to participate in the voting process for <strong>\${brand.name}</strong>. 
        A curated selection of presentations has been assigned to you for evaluation.
    </p>
    <div style="margin: 30px 0;">
        <a href="\${votingLink}" style="background-color: \${brand.accentColor}; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block;">
            Open Voting Portal
        </a>
    </div>
    <p style="color: #64748b; font-size: 13px; margin-top: 30px; border-top: 1px solid #f1f5f9; padding-top: 20px;">
        <strong>Instructions:</strong><br>
        1. Click the button above to access your personal voting portal.<br>
        2. Review the assigned presentations.<br>
        3. Rate each one from 1 to 10 (1 = lowest, 10 = highest).<br>
        4. Submit your votes when ready.
    </p>
    <p style="margin-top: 20px; font-size: 11px; color: #94a3b8;">
        This link is unique to you. Please do not share it with others.
    </p>
</div>
`.replace('${renderHeader(brand)}', renderHeader(brand))
 .replace('${brand.name}', brand.name)
 .replace('${brand.accentColor}', brand.accentColor);

        case 'socialDinnerTickets':
            return `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
    \${renderHeader(brand)}
    <h1 style="color: #1d1d1f; font-size: 24px;">Hello \${name},</h1>
    <p>Here are your tickets for the Social Dinner. Please show this QR at the entrance.</p>
    <p style="font-size: 12px; color: #86868b; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
        The social dinner will take place on \${social_dinner_date} at \${social_dinner_location}
    </p>
</div>
`.replace('${renderHeader(brand)}', renderHeader(brand));

        case 'emailCheckin':
            return `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
    \${renderHeader(brand)}
    <h1 style="color: #1d1d1f; font-size: 24px;">Hello \${name},</h1>
    <p>We are looking forward to seeing you at <strong>\${conference}</strong>. Below is your personal QR code for a faster check-in at the registration desk.</p>
    <!-- registration_details_start -->
    <div style="margin-top: 20px; border-top: 1px solid #eee; padding-top: 20px;">
        <h3 style="margin-bottom: 8px; font-size: 14px; color: #1e293b;">Registration Details:</h3>
        <p style="margin: 4px 0; font-size: 13px; color: #475569;"><strong>Venue:</strong> \${registration_venue}</p>
        <p style="margin: 4px 0; font-size: 13px; color: #475569;"><strong>Starts at:</strong> \${registration_starts_at}</p>
        <p style="margin: 4px 0; font-size: 13px; color: #475569;"><strong>Notes:</strong> \${registration_notes}</p>
    </div>
    <!-- registration_details_end -->
</div>`.replace('${renderHeader(brand)}', renderHeader(brand))
  .replace('${conference}', brand.name);

        case 'certificate':
            return `
<div style="font-family: 'Georgia', 'Times New Roman', serif; max-width: 700px; margin: 0 auto; padding: 0; border: 2px solid \${brand.accentColor}; border-radius: 4px;">
    \${renderHeader(brand)}
    <div style="padding: 40px 40px 30px 40px;">
        <h1 style="text-align: center; color: \${brand.accentColor}; font-size: 26px; font-weight: 700; margin: 0 0 8px 0; letter-spacing: 1px;">CERTIFICATE OF PARTICIPATION</h1>
        <div style="text-align: center; border-bottom: 2px solid \${brand.accentColor}; padding-bottom: 20px; margin-bottom: 30px;">
            <p style="color: #64748b; font-size: 13px; margin: 0;">\${today}</p>
        </div>

        <table style="width: 100%; margin-bottom: 30px;" cellpadding="0" cellspacing="0">
            <tr>
                <td style="width: 50%; vertical-align: top; padding-right: 20px;">
                    <p style="font-size: 18px; font-weight: 700; color: #1e293b; margin: 0 0 4px 0;">\${name}</p>
                    <p style="font-size: 13px; color: #64748b; margin: 0 0 2px 0;">\${institution}</p>
                    <p style="font-size: 12px; color: #64748b; margin: 0 0 2px 0;">\${entityAddress}</p>
                    <p style="font-size: 12px; color: #64748b; margin: 0;">\${entityLocation}</p>
                </td>
                <td style="width: 50%; vertical-align: top; padding-left: 20px; border-left: 1px solid #e2e8f0;">
                    <p style="font-size: 11px; font-weight: 700; color: \${brand.accentColor}; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 6px 0;">This certifies participation at:</p>
                    <p style="font-size: 12px; font-weight: 700; color: #1e293b; margin: 0 0 4px 0;">\${conference} - \${conferenceFullName}</p>
                    <p style="font-size: 12px; color: #64748b; margin: 0; line-height: 1.4;">\${conferenceAddress}</p>
                </td>
            </tr>
        </table>

        <div style="background: #f8fafc; border-radius: 8px; padding: 24px; margin-bottom: 30px; border: 1px solid #e2e8f0;">
            <p style="font-size: 14px; color: #334155; line-height: 1.7; margin: 0;">
                This letter certifies that <strong>\${name}</strong> participated as <strong>\${registrationType}</strong> 
                at the <strong>\${conferenceFullName} - \${conference}</strong>, celebrated at <strong>\${conferenceAddressInline}</strong> from <strong>\${conferenceDates}</strong>.
            </p>
            \${presentationsHtml}
        </div>

        <div style="margin-bottom: 30px;">
            <p style="font-size: 13px; color: #475569; margin: 0;">Sincerely,</p>
            \${signatureHtml}
            \${textUnderSignatureHtml}
        </div>

        \${sponsorsHtml}

        <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; text-align: center; margin-top: 20px;">
            <p style="font-size: 11px; color: #94a3b8; margin: 0;">
                This is an automated certificate from \${conference}. For support, contact \${brand.email}.
            </p>
        </div>
    </div>
</div>`.replace(/\$\{renderHeader\(brand\)\}/g, renderHeader(brand))
  .replace(/\$\{brand\.accentColor\}/g, brand.accentColor)
  .replace(/\$\{brand\.email\}/g, brand.email)
  .replace(/\$\{conference\}/g, brand.name);

        default:
            return '';
    }
};
