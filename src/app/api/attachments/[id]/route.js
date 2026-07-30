import { query } from '@/lib/db';

export async function GET(request, { params }) {
    const { id } = await params;

    if (!id || isNaN(id)) {
        return new Response('Invalid attachment ID', { status: 400 });
    }

    try {
        const rows = await query('SELECT file_name, file_base64 FROM sponsors_attachments WHERE id = ?', [id]);
        const attachment = rows[0];

        if (!attachment) {
            return new Response('Attachment not found', { status: 404 });
        }

        // The base64 might have a prefix like "data:application/pdf;base64,"
        const base64Data = attachment.file_base64.includes(',') 
            ? attachment.file_base64.split(',')[1] 
            : attachment.file_base64;

        const buffer = Buffer.from(base64Data, 'base64');

        return new Response(buffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="${attachment.file_name}"`,
                'Cache-Control': 'public, max-age=31536000, immutable'
            }
        });
    } catch (error) {
        console.error('Error serving attachment:', error);
        return new Response('Internal Server Error', { status: 500 });
    }
}
