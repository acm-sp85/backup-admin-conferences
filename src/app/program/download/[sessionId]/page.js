import { query } from '@/lib/db';
import { getConferenceConfig } from '@/app/actions/program';

const formatName = (name) => {
    if (!name) return '';
    return name
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join('-');
};

export default async function DownloadDocPage({ params }) {
    const { sessionId } = await params;

    // Fetch session data
    const [session] = await query(`
        SELECT s.*, c.name as conference_name, c.id as conference_id
        FROM program_sessions s
        JOIN conferences c ON s.conference_id = c.id
        WHERE s.id = ?
    `, [sessionId]);

    if (!session) return <div>Session not found</div>;

    // Fetch slots
    const slots = await query(`
        SELECT * FROM program_slots 
        WHERE session_id = ? 
        ORDER BY start_time ASC
    `, [sessionId]);

    const { config } = await getConferenceConfig(session.conference_id);

    // Group slots if it's CIPIE
    let slotGroups = [];
    if (Number(session.conference_id) === 11) {
        const CIPIE_TIME_SLOTS = [
            { id: 'ts1', label: '10:00 – 11:00',  startH: 10, startM: 0,  endH: 11, endM: 0  },
            { id: 'ts2', label: '11:30 – 12:30',  startH: 11, startM: 30, endH: 12, endM: 30 },
            { id: 'ts3', label: '13:30 – 14:15',  startH: 13, startM: 30, endH: 14, endM: 15 },
            { id: 'ts4', label: '17:00 – 18:00',  startH: 17, startM: 0,  endH: 18, endM: 0  },
            { id: 'ts5', label: '18:30 – 20:00',  startH: 18, startM: 30, endH: 20, endM: 0  },
        ];

        function matchToTimeSlot(startTimeStr) {
            const d = new Date(startTimeStr);
            const mins = d.getHours() * 60 + d.getMinutes();
            for (const ts of CIPIE_TIME_SLOTS) {
                const sMin = ts.startH * 60 + ts.startM;
                const eMin = ts.endH * 60 + ts.endM;
                if (mins >= sMin - 15 && mins < eMin + 5) return ts;
            }
            let best = CIPIE_TIME_SLOTS[0], bestDiff = Infinity;
            for (const ts of CIPIE_TIME_SLOTS) {
                const diff = Math.abs(mins - (ts.startH * 60 + ts.startM));
                if (diff < bestDiff) { bestDiff = diff; best = ts; }
            }
            return best;
        }

        const buckets = {};
        let i = 0;
        while (i < slots.length) {
            const slot = slots[i];
            if (slot.title?.includes('\u21B3')) { i++; continue; }

            const group = [slot];
            let j = i + 1;
            while (j < slots.length && slots[j].title?.includes('\u21B3')) {
                group.push(slots[j]);
                j++;
            }
            i = j;

            const ts = matchToTimeSlot(slot.start_time);
            const bucketId = ts ? ts.id : 'other';

            if (!buckets[bucketId]) {
                buckets[bucketId] = { id: bucketId, label: ts ? ts.label : null, slots: [] };
            }
            buckets[bucketId].slots.push(...group);
        }
        
        // Convert to array of arrays, ordered by the first slot's start time
        slotGroups = Object.values(buckets).sort((a, b) => new Date(a.slots[0].start_time) - new Date(b.slots[0].start_time));
    } else {
        slotGroups = [{ id: 'all', label: null, slots: slots }];
    }

    // Prepare HTML content for Word
    const htmlContent = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
        <meta charset="utf-8">
        <title>${session.full_session_name}</title>
        <style>
            body { font-family: 'Arial', sans-serif; }
            .page-break { page-break-before: always; }
            .header { margin-bottom: 30pt; }
            .conf-name { font-size: 12pt; color: #666; text-transform: uppercase; margin-bottom: 5pt; }
            .session-title { font-size: ${Number(session.conference_id) === 11 ? '20pt' : '28pt'}; font-weight: bold; margin-bottom: 10pt; color: ${config.titleColor || '#000000'}; }
            .time-box { background-color: ${config.titleColor || '#333'}; color: #ffffff; padding: 10pt; font-size: 14pt; font-weight: bold; display: inline-block; }
            table.main-table { width: 100%; border-collapse: collapse; margin-top: 20pt; }
            .main-table > tbody > tr > td { padding: 15pt 10pt; border-bottom: 1pt solid #eeeeee; vertical-align: top; }
            .main-table > tbody > tr.border-top > td { border-top: 1pt solid #dddddd; }
            .slot-time { font-weight: bold; width: 80pt; font-size: 12pt; }
            .slot-title { font-weight: bold; font-size: 12pt; margin-bottom: 3pt; }
            .slot-presenter { font-style: italic; color: #555; font-size: 10pt; }
            .presenter-name { color: ${config.titleColor || '#000000'}; font-weight: bold; }
            .presenter-institution { color: #555; font-weight: normal; }
            .slot-type { font-size: 8pt; text-transform: uppercase; color: #666; margin-top: 5pt; font-weight: bold; }
            .nested-container { width: 100%; border: none; border-collapse: collapse; }
            .nested-arrow { width: 15pt; vertical-align: top; padding: 0; padding-top: 1pt; font-weight: bold; color: #666; border: none; }
            .nested-content { vertical-align: top; padding: 0; border: none; }
        </style>
    </head>
    <body>
        ${slotGroups.map((group, pageIdx) => `
            <div class="${pageIdx > 0 ? 'page-break' : ''}">
                <div class="header">
                    <div class="conf-name">${session.conference_name} - ${new Date(session.start_time).toLocaleDateString(Number(session.conference_id) === 11 ? 'es-ES' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
                    <div class="session-title">${session.full_session_name.replace(/\(Chair:.*?\)/, '').trim()}</div>
                    ${session.full_session_name.includes('(Chair:') ? `
                        <div style="font-size: 16pt; font-style: italic; color: #555; margin-bottom: 15pt;">
                            Chair: ${formatName(session.full_session_name.match(/\(Chair:\s*(.*?)\)/)?.[1])}
                        </div>
                    ` : ''}
                    <div class="time-box">
                        ${(() => {
                            if (Number(session.conference_id) === 11 && group.label) {
                                return group.label;
                            }
                            const fmt = t => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                            if (Number(session.conference_id) === 11 && group.slots.length > 0) {
                                const topLevel = group.slots.filter(s => !s.title?.includes('\u21B3'));
                                const first = topLevel[0] || group.slots[0];
                                const last  = topLevel[topLevel.length - 1] || group.slots[group.slots.length - 1];
                                return first === last
                                    ? fmt(first.start_time)
                                    : `${fmt(first.start_time)} – ${fmt(last.start_time)}`;
                            }
                            return `${fmt(session.start_time)} - ${fmt(session.end_time)}`;
                        })()}
                    </div>
                </div>
        
                <table class="main-table">
                    <tbody>
                        ${group.slots.map((slot, idx) => `
                            <tr class="${Number(session.conference_id) === 11 && slot.title?.includes('\u2022') && idx > 0 ? 'border-top' : ''}">
                                <td class="slot-time">${slot.title?.includes('\u00A0\u00A0') ? '' : new Date(slot.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</td>
                                <td>
                                    ${slot.title?.includes('\u21B3') ? `
                                    <table class="nested-container">
                                        <tbody>
                                            <tr>
                                                <td class="nested-arrow">&#8627;</td>
                                                <td class="nested-content">
                                    ` : ''}
                                                <div class="slot-title">${slot.title?.includes('\u21B3') ? slot.title.replace('\u00A0\u00A0\u00A0\u00A0\u21B3 ', '') : (slot.title || '(No Title)')}</div>
                                                ${(() => {
                                                    if (!slot.presenter_name) return '';
                                                    let displayName = slot.presenter_name;
                                                    if (displayName.includes(',')) {
                                                        const parts = displayName.split(',');
                                                        displayName = `${parts[1].trim()} ${parts[0].trim()}`;
                                                    }
                                                    const formatted = formatName(displayName);
                                                    const nameSpan = `<span class="presenter-name">${formatted}</span>`;
                                                    const instText = [slot.presenter_entity, slot.presenter_country].filter(Boolean).join(', ');
                                                    const instSpan = instText ? `<span class="presenter-institution"> - ${instText}</span>` : '';
                                                    return `<div class="slot-presenter">${nameSpan}${instSpan}</div>`;
                                                })()}
                                                <div class="slot-type">${slot.type}</div>
                                    ${slot.title?.includes('\u21B3') ? `
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                    ` : ''}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `).join('')}
    </body>
    </html>
    `;

    return (
        <>
            <div className="p-20 text-center font-sans">
                <h2 className="text-xl font-bold mb-4">Generating Word Document...</h2>
                <p className="text-slate-500">Your download should start automatically.</p>
                <a 
                    id="download-link"
                    href={`data:application/msword;charset=utf-8,${encodeURIComponent(htmlContent)}`}
                    download={`${session.session_name}_DoorSign.doc`}
                    className="hidden"
                >Download</a>
            </div>
            <script dangerouslySetInnerHTML={{ __html: `
                setTimeout(() => {
                    document.getElementById('download-link').click();
                    setTimeout(() => window.close(), 1000);
                }, 500);
            `}} />
        </>
    );
}
