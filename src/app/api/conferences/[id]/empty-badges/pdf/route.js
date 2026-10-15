import { query } from '@/lib/db';
import { verifySession } from '@/lib/auth';
import { hasAdminAccess } from '@/lib/roles';
import { jsPDF } from 'jspdf';

export async function GET(request, { params }) {
    try {
        const session = await verifySession();
        if (!session || !hasAdminAccess(session.role)) {
            return new Response('Unauthorized', { status: 401 });
        }

        const { id } = await params;
        const [conference] = await query('SELECT * FROM conferences WHERE id = ?', [id]);
        if (!conference) {
            return new Response('Conference not found', { status: 404 });
        }

        const url = new URL(request.url);
        const bgIndexParam = url.searchParams.get('bgIndex');
        const bgParam = url.searchParams.get('bg');
        const showTrim = url.searchParams.get('trim') !== '0';

        let config = {};
        if (conference.badge_config) {
            try {
                config = typeof conference.badge_config === 'string'
                    ? JSON.parse(conference.badge_config)
                    : conference.badge_config;
            } catch (e) {
                console.error('Error parsing badge_config:', e);
            }
        }

        const parseDimMm = (val, defaultValMm) => {
            const str = String(val || '').trim();
            if (!str) return defaultValMm;
            const num = parseFloat(str) || 0;
            if (str.endsWith('cm')) return num * 10;
            if (str.endsWith('in')) return num * 25.4;
            if (str.endsWith('px')) return num * 0.264583;
            return num; // default mm
        };

        const widthMm = parseDimMm(config.width, 80);
        const heightMm = parseDimMm(config.height, 98);
        const bleedMm = parseDimMm(config.bleed, 3);

        const totalWidthMm = widthMm + bleedMm * 2;
        const totalHeightMm = heightMm + bleedMm * 2;

        const customBackgrounds = config.customBackgrounds || [];
        const backgroundsToRender = [];

        if (bgParam === 'default') {
            if (conference.badge_bg) {
                backgroundsToRender.push({ url: conference.badge_bg, label: 'Default Background' });
            }
        } else if (bgIndexParam !== null && bgIndexParam !== undefined) {
            const idx = parseInt(bgIndexParam, 10);
            if (customBackgrounds[idx]?.url) {
                backgroundsToRender.push({ 
                    url: customBackgrounds[idx].url, 
                    label: `Custom Background ${idx + 1}` 
                });
            }
        } else {
            // Include all configured backgrounds
            if (conference.badge_bg) {
                backgroundsToRender.push({ url: conference.badge_bg, label: 'Default Background' });
            }
            customBackgrounds.forEach((bg, idx) => {
                if (bg.url) {
                    backgroundsToRender.push({ 
                        url: bg.url, 
                        label: `Custom Background ${idx + 1}` 
                    });
                }
            });
        }

        // If no background image found at all, generate at least one blank page
        if (backgroundsToRender.length === 0) {
            backgroundsToRender.push({ url: null, label: 'Blank Badge' });
        }

        const orientation = totalWidthMm > totalHeightMm ? 'landscape' : 'portrait';
        const doc = new jsPDF({
            orientation,
            unit: 'mm',
            format: [totalWidthMm, totalHeightMm]
        });

        for (let i = 0; i < backgroundsToRender.length; i++) {
            if (i > 0) {
                doc.addPage([totalWidthMm, totalHeightMm], orientation);
            }

            const item = backgroundsToRender[i];
            if (item.url) {
                try {
                    const res = await fetch(item.url);
                    if (res.ok) {
                        const arrayBuf = await res.arrayBuffer();
                        const buf = Buffer.from(arrayBuf);
                        const contentType = res.headers.get('content-type') || '';
                        const format = contentType.includes('png') || item.url.toLowerCase().endsWith('.png') ? 'PNG' : 'JPEG';
                        const dataUrl = `data:${contentType || 'image/jpeg'};base64,` + buf.toString('base64');
                        doc.addImage(dataUrl, format, 0, 0, totalWidthMm, totalHeightMm);
                    }
                } catch (fetchErr) {
                    console.error('Error fetching badge image for PDF:', fetchErr);
                }
            }

            // Draw dashed trim lines if requested
            if (showTrim && bleedMm > 0) {
                doc.setLineDashPattern([1.5, 1.5], 0);
                doc.setDrawColor(180, 180, 180);
                doc.setLineWidth(0.2);
                doc.rect(bleedMm, bleedMm, widthMm, heightMm);
            }
        }

        const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
        const safeAcronym = (conference.acronym || 'conference').replace(/[^a-zA-Z0-9_-]/g, '_');
        const filename = `${safeAcronym}-empty-badges.pdf`;

        return new Response(pdfBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Cache-Control': 'no-store'
            }
        });
    } catch (error) {
        console.error('Error generating empty badges PDF:', error);
        return new Response('Error generating empty badges PDF', { status: 500 });
    }
}
