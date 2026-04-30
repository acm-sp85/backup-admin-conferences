'use server';

import { query } from '@/lib/db';

export async function debugVotes(posterId) {
    try {
        const [poster] = await query('SELECT id, points, votes_received FROM posters WHERE id = ?', [posterId]);
        console.log('--- DEBUG VOTE DATA ---');
        console.log('Poster ID:', posterId);
        console.log('Raw votes_received type:', typeof poster?.votes_received);
        console.log('Raw votes_received content:', poster?.votes_received);
        
        if (poster?.votes_received) {
            try {
                const parsed = typeof poster.votes_received === 'string' 
                    ? JSON.parse(poster.votes_received) 
                    : poster.votes_received;
                console.log('Parsed Keys:', Object.keys(parsed));
            } catch (e) {
                console.log('JSON Parse Error:', e.message);
            }
        }
        return { success: true, raw: poster?.votes_received };
    } catch (e) {
        console.error('Debug query failed:', e.message);
        return { error: e.message };
    }
}
