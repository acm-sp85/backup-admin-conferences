import { query } from '@/lib/db';
import sanitizeHtml from 'sanitize-html';
import { emailTemplates, getBranding, renderHeader } from '@/lib/email-templates';
import { formatSocialDinnerDate, formatRegistrationDate } from '@/lib/date-formatter';

/**
 * Retrieve email subject and HTML for a given conference and email type.
 */
export async function getEmailTemplate(conferenceId, type, placeholders = {}) {
  let conf = null;
  if (conferenceId) {
    const rows = await query('SELECT * FROM conferences WHERE id = ?', [conferenceId]);
    conf = rows[0];
  }

  const columnMap = {
    magicLink: 'email_magic_link_body',
    posterVotingInvite: 'email_poster_voting_invite_body',
    customVotingInvite: 'custom_voting_invite_body',
    socialDinnerTickets: 'email_social_dinner_tickets_body',
    emailCheckin: 'email_checkin_body',
    certificate: 'email_certificate_body'
  };

  const bodyKey = columnMap[type];
  let html = conf ? conf[bodyKey] : null;

  // If no custom body, fall back to generic template
  if (!html) {
    const generic = emailTemplates[type]({ ...placeholders, conference: conf });
    return { subject: generic.subject, html: generic.html };
  }

  // Clean up registration details for checkin email templates (whether custom or default)
  if (type === 'emailCheckin') {
    const venueVal = (conf?.registration_venue || placeholders?.conference?.registration_venue || '').trim();
    const startsAtVal = (conf?.registration_starts_at || placeholders?.conference?.registration_starts_at || '').trim();
    const notesVal = (conf?.registration_notes || placeholders?.conference?.registration_notes || '').trim();
    const hasNotes = notesVal && notesVal.toLowerCase() !== 'none';
    const hasRegistration = venueVal || startsAtVal || hasNotes;

    if (!hasRegistration) {
      html = html.replace(/<!-- registration_details_start -->[\s\S]*?<!-- registration_details_end -->/gi, '');
    } else {
      const stripPlaceholder = (content, placeholder) => {
        const tagRegex = new RegExp('<(p|li|tr|td|span)[^>]*>(?:(?!<\\/\\1>)[\\s\\S])*?\\$\\{' + placeholder + '\\}(?:(?!<\\/\\1>)[\\s\\S])*?<\\/\\1>', 'gi');
        let newContent = content.replace(tagRegex, '');
        const lineRegex = new RegExp('^[^\\n]*\\$\\{' + placeholder + '\\}[^\\n]*\\n?', 'gim');
        newContent = newContent.replace(lineRegex, '');
        return newContent;
      };

      if (!venueVal) {
        html = stripPlaceholder(html, 'registration_venue');
      }
      if (!startsAtVal) {
        html = stripPlaceholder(html, 'registration_starts_at');
      }
      if (!hasNotes) {
        html = stripPlaceholder(html, 'registration_notes');
      }
    }
  }

  // 1. Prepare rich branding placeholders
  const brand = getBranding(conf);
  const richPlaceholders = {
    ...placeholders,
    header: renderHeader(brand),
    conferenceName: brand.name,
    conferenceEmail: brand.email,
    accentColor: brand.accentColor,
    logoUrl: brand.logo,
    bannerUrl: brand.banner,
    conference: brand.name, // Add this for consistency with emailCheckin default body
    // Support legacy/intuitive ${brand.xxx} syntax by flattening
    'brand.name': brand.name,
    'brand.email': brand.email,
    'brand.accentColor': brand.accentColor,
    'renderHeader(brand)': renderHeader(brand), // Support the exact string the user tried
    
    // Social Dinner Placeholders
    social_dinner_date: formatSocialDinnerDate(
        conf?.social_dinner_date || placeholders?.conference?.social_dinner_date || '',
        conf?.social_dinner_time || placeholders?.conference?.social_dinner_time || '',
        conf?.social_dinner_timezone || placeholders?.conference?.social_dinner_timezone || ''
    ) || 'TBD',
    social_dinner_location: (() => {
        const mapsUrl = conf?.social_dinner_maps_url || placeholders?.conference?.social_dinner_maps_url || '';
        const locationText = conf?.social_dinner_location || placeholders?.conference?.social_dinner_location || '';
        return (mapsUrl && !locationText.includes('<a'))
            ? `<a href="${mapsUrl}" target="_blank" style="color: #0071e3; text-decoration: underline;">${locationText}</a>`
            : (locationText || 'TBD');
    })(),
    'conference.social_dinner_date': formatSocialDinnerDate(
        conf?.social_dinner_date || placeholders?.conference?.social_dinner_date || '',
        conf?.social_dinner_time || placeholders?.conference?.social_dinner_time || '',
        conf?.social_dinner_timezone || placeholders?.conference?.social_dinner_timezone || ''
    ) || 'TBD',
    'conference.social_dinner_location': (() => {
        const mapsUrl = conf?.social_dinner_maps_url || placeholders?.conference?.social_dinner_maps_url || '';
        const locationText = conf?.social_dinner_location || placeholders?.conference?.social_dinner_location || '';
        return (mapsUrl && !locationText.includes('<a'))
            ? `<a href="${mapsUrl}" target="_blank" style="color: #0071e3; text-decoration: underline;">${locationText}</a>`
            : (locationText || 'TBD');
    })(),
    
    // Registration Details Placeholders
    registration_venue: (() => {
        const venueText = conf?.registration_venue || placeholders?.conference?.registration_venue || '';
        const mapsUrl = conf?.registration_maps_url || placeholders?.conference?.registration_maps_url || '';
        return (mapsUrl && !venueText.includes('<a'))
            ? `<a href="${mapsUrl}" target="_blank" style="color: #0071e3; text-decoration: underline;">${venueText}</a>`
            : (venueText || 'TBD');
    })(),
    registration_starts_at: formatRegistrationDate(conf?.registration_starts_at || placeholders?.conference?.registration_starts_at || '') || 'TBD',
    registration_notes: conf?.registration_notes || placeholders?.conference?.registration_notes || 'None'
  };

  // 2. Interpolate placeholders
  Object.entries(richPlaceholders).forEach(([k, v]) => {
    let value = v;
    
    // Special handling for QR codes array
    if (k === 'qrCodes' && Array.isArray(v)) {
      value = v.map((qc) => `
        <div style="margin-bottom: 20px; padding: 20px; background: #f5f5f7; border-radius: 12px; text-align: center;">
            <img src="${brand.baseUrl}/api/qr/${qc.token}" alt="QR Code" style="width: 240px; height: 240px; margin-bottom: 10px; display: block; margin-left: auto; margin-right: auto;" />
            <p style="margin: 5px 0; font-weight: bold; color: ${brand.accentColor};">Dietary: ${qc.dietary}</p>
        </div>
      `).join('');
    }

    const re = new RegExp('\\$\\{' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\}', 'g');
    html = html.replace(re, value);
  });

  // 3. Fallback for social dinner tickets
  if (type === 'socialDinnerTickets' && !html.includes('api/qr/')) {
     const qrHtml = placeholders.qrCodes?.map((qc) => `
        <div style="margin-bottom: 20px; padding: 20px; background: #f5f5f7; border-radius: 12px; text-align: center;">
            <img src="${brand.baseUrl}/api/qr/${qc.token}" alt="QR Code" style="width: 240px; height: 240px; margin-bottom: 10px; display: block; margin-left: auto; margin-right: auto;" />
            <p style="margin: 5px 0; font-weight: bold; color: ${brand.accentColor};">Dietary: ${qc.dietary}</p>
        </div>
     `).join('') || '';
     
     if (qrHtml) {
        if (html.includes('</div>')) {
            const lastIdx = html.lastIndexOf('</div>');
            html = html.substring(0, lastIdx) + qrHtml + html.substring(lastIdx);
        } else {
            html += qrHtml;
        }
     }
  }

  // 4. Fallback for participant check-in
  if (type === 'emailCheckin' && !html.includes('api/qr/participants')) {
      const qrHtml = `
        <div style="margin: 30px 0; padding: 20px; background: #f5f5f7; border-radius: 12px; text-align: center;">
            <img src="${brand.baseUrl}/api/qr/participants/${placeholders.token}" alt="QR Code" style="width: 240px; height: 240px; margin-bottom: 10px; display: block; margin-left: auto; margin-right: auto;" />
            <p style="margin: 5px 0; font-size: 12px; color: #86868b;">Show this QR code at the registration desk.</p>
        </div>
      `;
      // Append before the last div or just append
      if (html.includes('</div>')) {
          const lastIdx = html.lastIndexOf('</div>');
          html = html.substring(0, lastIdx) + qrHtml + html.substring(lastIdx);
      } else {
          html += qrHtml;
      }
  }

  // Sanitize
  html = sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'style']),
    allowedAttributes: {
      a: ['href', 'name', 'target'],
      img: ['src', 'alt', 'style'],
      '*': ['style']
    }
  });

  const generic = emailTemplates[type]({ ...placeholders, conference: conf });
  return { subject: generic.subject, html };
}
