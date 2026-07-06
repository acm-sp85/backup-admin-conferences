import { query } from './db';
import { verifySession } from './auth';

/**
 * Logs an administrative action to the audit_logs table.
 * Designed to fail silently so that it never disrupts the main transaction.
 * 
 * @param {string} actionType - E.g., 'CREATE', 'UPDATE', 'DELETE', 'SEND_EMAIL'
 * @param {string} entityType - E.g., 'ACTIVITY', 'PAYMENT', 'USER'
 * @param {string|number} entityId - The ID of the item modified
 * @param {object} details - Any additional JSON context (before/after states, notes, etc.)
 */
export async function logAction(actionType, entityType, entityId, details = null) {
    try {
        const session = await verifySession();
        if (!session || !session.userId) return;

        // auth.js doesn't expose session.email, so we must fetch it
        const [user] = await query('SELECT email FROM users WHERE id = ?', [session.userId]);
        if (!user || !user.email) return;

        await query(
            'INSERT INTO audit_logs (admin_email, action_type, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)',
            [
                user.email,
                actionType,
                entityType,
                entityId ? String(entityId) : null,
                details ? JSON.stringify(details) : null
            ]
        );
    } catch (e) {
        // Fail silently as requested, but log to the server console for debugging if needed
        console.error('[Audit Logger] Failed to log action:', e.message);
    }
}
