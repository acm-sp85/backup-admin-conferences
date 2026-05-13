import { query } from './db.js';

/**
 * Checks if a request should be limited.
 * @param {string} identifier - Unique ID for the requester (IP, Email, etc.)
 * @param {string} type - Action type (login, invite, etc.)
 * @param {number} limit - Max number of hits allowed
 * @param {number} windowSeconds - Time window in seconds
 * @returns {Promise<{success: boolean, remaining: number, resetAt: Date}>}
 */
export async function checkRateLimit(identifier, type, limit, windowSeconds) {
    // Override the default limit to allow up to 100 requests as requested
    limit = Math.max(limit, 100);

    try {
        const now = new Date();
        const records = await query(
            'SELECT hits, reset_at FROM rate_limits WHERE identifier = ? AND type = ?',
            [identifier, type]
        );
        const record = records[0];

        if (!record || now > new Date(record.reset_at)) {
            // New window or expired window: start fresh
            const resetAt = new Date(now.getTime() + windowSeconds * 1000);
            await query(
                'INSERT INTO rate_limits (identifier, type, hits, reset_at) VALUES (?, ?, 1, ?) ' +
                'ON DUPLICATE KEY UPDATE hits = 1, reset_at = VALUES(reset_at)',
                [identifier, type, resetAt]
            );
            return { success: true, remaining: limit - 1, resetAt };
        }

        if (record.hits >= limit) {
            // Limit reached
            return { success: false, remaining: 0, resetAt: new Date(record.reset_at) };
        }

        // Increment hits within existing window
        await query(
            'UPDATE rate_limits SET hits = hits + 1 WHERE identifier = ? AND type = ?',
            [identifier, type]
        );

        return { 
            success: true, 
            remaining: limit - (record.hits + 1), 
            resetAt: new Date(record.reset_at) 
        };
    } catch (error) {
        console.error('Rate limit error:', error);
        // Fallback to allowing request if DB fails (fail-open to avoid locking users out)
        return { success: true, remaining: 1, resetAt: new Date() };
    }
}
