import { query } from '@/lib/db';
export async function GET() {
    try {
        await query('ALTER TABLE sponsors_attachments ADD COLUMN url TEXT DEFAULT NULL');
        return new Response('Migration complete');
    } catch (e) {
        return new Response(e.message);
    }
}
