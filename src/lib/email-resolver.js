/**
 * Email Resolver Utility
 * 
 * Centralized logic for determining which email address to send system
 * communications to. If a participant has an email_alias set, emails
 * are redirected there instead of the primary email.
 * 
 * Usage:
 *   import { resolveEmail } from '@/lib/email-resolver';
 *   const sendTo = resolveEmail(participant);
 */

/**
 * Returns the effective email address for sending communications.
 * If the participant/object has a non-empty email_alias, use that;
 * otherwise fall back to the primary email.
 * 
 * Accepts any object with `email` and optionally `email_alias` properties.
 * This includes raw DB rows from participants, or custom objects with
 * aliased column names (e.g., participant_email / participant_email_alias).
 * 
 * @param {Object} entity - An object with `email` and optionally `email_alias`
 * @returns {string} The email address to send to
 */
export function resolveEmail(entity) {
  if (!entity) return null;
  
  // Support both direct column names and aliased versions
  const alias = entity.email_alias || entity.participant_email_alias;
  const primary = entity.email || entity.participant_email;
  
  // Only use alias if it's a non-empty string different from primary
  if (alias && typeof alias === 'string' && alias.trim() && alias.trim().toLowerCase() !== primary?.trim().toLowerCase()) {
    return alias.trim();
  }
  
  return primary;
}
