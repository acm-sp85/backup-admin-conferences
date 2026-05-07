import QRCode from 'qrcode';

export async function generateQR(text) {
    try {
        return await QRCode.toDataURL(text, {
            width: 400,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#ffffff',
            },
        });
    } catch (err) {
        console.error('Error generating QR code:', err);
        throw err;
    }
}
