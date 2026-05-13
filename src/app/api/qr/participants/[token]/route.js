import { generateQR } from '@/lib/qr';
import { NextResponse } from 'next/server';

export async function GET(request, { params }) {
    const { token } = await params;
    
    if (!token) {
        return new NextResponse('Missing token', { status: 400 });
    }

    try {
        // Detect the base URL automatically if not set
        const host = request.headers.get('host');
        const protocol = host?.includes('localhost') ? 'http' : 'https';
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;
        
        const validationUrl = `${baseUrl}/participants/checkin/${token}`;
        
        const qrDataUrl = await generateQR(validationUrl);
        
        const base64Data = qrDataUrl.split(',')[1];
        const buffer = Buffer.from(base64Data, 'base64');

        return new NextResponse(buffer, {
            headers: {
                'Content-Type': 'image/png',
                'Cache-Control': 'public, max-age=31536000, immutable',
            },
        });
    } catch (error) {
        console.error('QR Generation Error:', error);
        return new NextResponse('Error generating QR', { status: 500 });
    }
}
