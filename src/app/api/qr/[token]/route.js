import { generateQR } from '@/lib/qr';
import { NextResponse } from 'next/server';

export async function GET(request, { params }) {
    const { token } = await params;
    
    if (!token) {
        return new NextResponse('Missing token', { status: 400 });
    }

    try {
        // Generate the QR code as a data URL
        // The token is the content of the QR code
        const qrDataUrl = await generateQR(token);
        
        // Extract the base64 part
        const base64Data = qrDataUrl.split(',')[1];
        const buffer = Buffer.from(base64Data, 'base64');

        // Return as image/png
        return new NextResponse(buffer, {
            headers: {
                'Content-Type': 'image/png',
                'Cache-Control': 'public, max-age=31536000, immutable', // Cache for a long time
            },
        });
    } catch (error) {
        console.error('QR Generation Error:', error);
        return new NextResponse('Error generating QR', { status: 500 });
    }
}
