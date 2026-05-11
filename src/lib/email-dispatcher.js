import { query } from '@/lib/db';
import sanitizeHtml from 'sanitize-html';
import { emailTemplates, getBranding, renderHeader } from '@/lib/email-templates';

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
    socialDinnerTickets: 'email_social_dinner_tickets_body',
    emailCheckin: 'email_checkin_body'
  };

  const bodyKey = columnMap[type];
  let html = conf ? conf[bodyKey] : null;

  // If no custom body, fall back to generic template
  if (!html) {
    const generic = emailTemplates[type]({ ...placeholders, conference: conf });
    return { subject: generic.subject, html: generic.html };
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
    'renderHeader(brand)': renderHeader(brand) // Support the exact string the user tried
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
        html = html.replace('</div>', qrHtml + '</div>');
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
