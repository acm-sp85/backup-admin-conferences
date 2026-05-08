// src/lib/email-dispatcher.js

import { query } from '@/lib/db';
import sanitizeHtml from 'sanitize-html';
import { emailTemplates } from '@/lib/email-templates';

// Simple per-request in-memory cache
const cache = new Map();

/**
 * Retrieve email subject and HTML for a given conference and email type.
 * If custom body is defined in the conferences table, it is used (subject stays generic).
 * Placeholders are interpolated using ${placeholder} syntax.
 *
 * @param {number} conferenceId - ID of the conference
 * @param {string} type - one of 'magicLink', 'posterVotingInvite', 'socialDinnerTickets'
 * @param {Object} placeholders - key/value pairs for interpolation
 * @returns {Promise<{subject:string, html:string}>}
 */
export async function getEmailTemplate(conferenceId, type, placeholders = {}) {
  let conf = null;
  if (conferenceId) {
    conf = cache.get(conferenceId);
    if (!conf) {
      const rows = await query('SELECT * FROM conferences WHERE id = ?', [conferenceId]);
      conf = rows[0];
      if (conf) cache.set(conferenceId, conf);
    }
  }

  const bodyKey = `email_${type}_body`;
  let html = conf ? conf[bodyKey] : null;

  // If no custom body, fall back to generic template
  if (!html) {
    const generic = emailTemplates[type]({ ...placeholders, conference: conf });
    return { subject: generic.subject, html: generic.html };
  }

  // Interpolate placeholders in custom body
  Object.entries(placeholders).forEach(([k, v]) => {
    const re = new RegExp('\\$\\{' + k + '\\}', 'g');
    html = html.replace(re, v);
  });

  // Sanitize custom HTML (best‑practice)
  html = sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'style']),
    allowedAttributes: {
      a: ['href', 'name', 'target'],
      img: ['src', 'alt', 'style'],
      '*': ['style']
    }
  });

  // Subject remains generic, derived from the built‑in template
  const generic = emailTemplates[type]({ ...placeholders, conference: conf });
  return { subject: generic.subject, html };
}
