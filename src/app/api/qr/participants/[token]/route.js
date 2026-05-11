import { generateQR } from '@/lib/qr';
import { NextResponse } from 'next/server';

export async function GET(request, { params }) {
    const { token } = await params;
    
    if (!token) {
        return new NextResponse('Missing token', { status: 400 });
    }

    try {
        // For participant check-in, the QR should probably point to a validation URL
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const validationUrl = `${appUrl}/participants/checkin/${token}`;
        
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
