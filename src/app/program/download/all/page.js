import { query } from '@/lib/db';
import { getConferenceConfig } from '@/app/actions/program';

// ── CIPIE time slots (conference_id = 11) ──────────────────────────────────────
const CIPIE_TIME_SLOTS = [
    { id: 'ts1', label: '10:00 – 11:00',  startH: 10, startM: 0,  endH: 11, endM: 0  },
    { id: 'ts2', label: '11:30 – 12:30',  startH: 11, startM: 30, endH: 12, endM: 30 },
    { id: 'ts3', label: '13:30 – 14:15',  startH: 13, startM: 30, endH: 14, endM: 15 },
    { id: 'ts4', label: '17:00 – 18:00',  startH: 17, startM: 0,  endH: 18, endM: 0  },
    { id: 'ts5', label: '18:30 – 20:00',  startH: 18, startM: 30, endH: 20, endM: 0  },
];

const CIPIE_ROOMS = ['SALA 1', 'SALA 2', 'SALA 3', 'SALA 4', 'SALA 5', 'SALA 6'];

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

function extractRoom(sessionName) {
    const m = sessionName?.match(/^(SALA \d+)/i);
    return m ? m[1].toUpperCase() : null;
}

function extractChair(fullName) {
    const m = fullName?.match(/\(Chair:\s*(.*?)\)/);
    return m ? m[1] : null;
}

function extractTheme(fullName) {
    return fullName
        ?.replace(/^SALA \d+:\s*/i, '')
        ?.replace(/\(Chair:.*?\)/g, '')
        ?.trim() || '';
}

function fmtName(raw) {
    if (!raw) return '';
    let n = raw.trim();
    if (n.includes(',')) {
        const parts = n.split(',');
        n = `${parts[1]?.trim()} ${parts[0]?.trim()}`;
    }
    return n.split(/\s+/)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
}

export default async function DownloadAllPage({ searchParams }) {
    const { conferenceId } = await searchParams;
    if (!conferenceId) return <p className="p-8 text-red-500">conferenceId param required.</p>;

    const [conf] = await query('SELECT name, acronym FROM conferences WHERE id = ?', [conferenceId]);
    if (!conf) return <p className="p-8 text-red-500">Conference not found.</p>;

    const sessions = await query(`
        SELECT * FROM program_sessions
        WHERE conference_id = ? AND (is_hidden = 0 OR is_hidden IS NULL)
        ORDER BY start_time ASC
    `, [conferenceId]);

    const allSlots = sessions.length > 0 ? await query(`
        SELECT ps.* FROM program_slots ps
        INNER JOIN program_sessions s ON ps.session_id = s.id
        WHERE s.conference_id = ? AND (s.is_hidden = 0 OR s.is_hidden IS NULL)
        ORDER BY ps.start_time ASC
    `, [conferenceId]) : [];

    const { config } = await getConferenceConfig(conferenceId);
    const titleColor = config.titleColor || '#1e40af';

    // ── Build same grid as timetable page ─────────────────────────────────────
    const grid = {};
    const dayOrder = [];

    function initDay(dayISO, dayLabel) {
        if (grid[dayISO]) return;
        dayOrder.push(dayISO);
        grid[dayISO] = { label: dayLabel, slots: {} };
        for (const ts of CIPIE_TIME_SLOTS) {
            grid[dayISO].slots[ts.id] = {};
            for (const r of CIPIE_ROOMS) grid[dayISO].slots[ts.id][r] = null;
        }
    }

    for (const session of sessions) {
        const room = extractRoom(session.session_name);
        if (!room) continue;

        const d = new Date(session.start_time);
        const dayISO = d.toISOString().slice(0, 10);
        const rawLabel = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
        initDay(dayISO, rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1));

        const theme = extractTheme(session.full_session_name);
        const chair = extractChair(session.full_session_name);

        const sSlots = allSlots
            .filter(sl => sl.session_id === session.id)
            .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

        let i = 0;
        while (i < sSlots.length) {
            const slot = sSlots[i];
            if (slot.title?.includes('\u21B3')) { i++; continue; }

            const ts = matchToTimeSlot(slot.start_time);
            if (!ts) { i++; continue; }

            const group = { header: slot, children: [] };
            let j = i + 1;
            while (j < sSlots.length && sSlots[j].title?.includes('\u21B3')) {
                group.children.push(sSlots[j]);
                j++;
            }
            i = j;

            if (!grid[dayISO].slots[ts.id][room]) {
                grid[dayISO].slots[ts.id][room] = { theme, chair, groups: [] };
            }
            grid[dayISO].slots[ts.id][room].groups.push(group);
        }
    }

    // ── Build Word-compatible HTML ─────────────────────────────────────────────
    const htmlContent = `
<html xmlns:o='urn:schemas-microsoft-com:office:office'
      xmlns:w='urn:schemas-microsoft-com:office:word'
      xmlns='http://www.w3.org/TR/REC-html40'>
<head>
<meta charset="utf-8">
<title>${conf.name} – Programa Completo</title>
<style>
    body          { font-family: Arial, sans-serif; margin: 40pt; color: #1a1a1a; }
    h1            { font-size: 22pt; color: ${titleColor}; margin-bottom: 4pt; }
    .subtitle     { font-size: 11pt; color: #666; margin-bottom: 30pt; }
    h2            { font-size: 17pt; color: ${titleColor}; text-transform: uppercase;
                    letter-spacing: 2pt; margin-top: 40pt; margin-bottom: 12pt;
                    padding-bottom: 6pt; border-bottom: 2pt solid ${titleColor}; }
    h3            { font-size: 13pt; color: ${titleColor}; margin-top: 22pt; margin-bottom: 4pt; }
    h4            { font-size: 11pt; font-weight: bold; margin-top: 16pt; margin-bottom: 2pt; color: #1a1a1a; }
    .room-theme   { font-size: 9pt; color: #555; margin-bottom: 2pt; font-style: italic; }
    .chair        { font-size: 9pt; color: #777; margin-bottom: 6pt; }
    table         { width: 100%; border-collapse: collapse; margin-top: 6pt; }
    td            { padding: 5pt 8pt; border-bottom: 1pt solid #eeeeee; vertical-align: top; }
    .slot-title   { font-weight: bold; font-size: 10pt; color: #1a1a1a; }
    .slot-child   { font-size: 10pt; color: #2a2a2a; }
    .presenter    { font-size: 9pt; color: #555; font-style: italic; margin-top: 1pt; }
    .indent       { padding-left: 18pt; border-left: 2pt solid #ddd; margin-left: 8pt; }
    .page-break   { page-break-before: always; }
</style>
</head>
<body>
    <h1>${conf.name}</h1>
    <div class="subtitle">Programa Completo &bull; ${conf.acronym}</div>

    ${dayOrder.map((dayISO, di) => {
        const day = grid[dayISO];
        const pageBreakClass = di > 0 ? 'class="page-break"' : '';

        return `
        <h2 ${pageBreakClass}>${day.label}</h2>

        ${CIPIE_TIME_SLOTS.map(ts => {
            const hasAny = CIPIE_ROOMS.some(r => day.slots[ts.id]?.[r]);
            if (!hasAny) return '';

            return `
            <h3>${ts.label}</h3>

            ${CIPIE_ROOMS.map(room => {
                const cell = day.slots[ts.id]?.[room];
                if (!cell) return '';

                return `
                <h4>${room}</h4>
                ${cell.theme ? `<div class="room-theme">${cell.theme}</div>` : ''}
                ${cell.chair ? `<div class="chair">Chair: ${fmtName(cell.chair)}</div>` : ''}
                <table>
                <tbody>
                ${cell.groups.map(grp => `
                    ${grp.header ? `
                    <tr>
                        <td class="slot-title">${grp.header.title?.replace('\u2022 ', '') || ''}</td>
                    </tr>
                    ${grp.header.presenter_name && grp.children.length === 0 ? `
                    <tr>
                        <td class="presenter">
                            ${fmtName(grp.header.presenter_name)}${grp.header.presenter_entity ? ' &ndash; ' + grp.header.presenter_entity : ''}
                        </td>
                    </tr>
                    ` : ''}
                    ` : ''}
                    ${grp.children.map(child => `
                    <tr>
                        <td class="indent">
                            <div class="slot-child">${child.title?.replace('\u00A0\u00A0\u00A0\u00A0\u21B3 ', '') || ''}</div>
                            ${child.presenter_name ? `
                            <div class="presenter">
                                ${fmtName(child.presenter_name)}${child.presenter_entity ? ' &ndash; ' + child.presenter_entity : ''}
                            </div>` : ''}
                        </td>
                    </tr>
                    `).join('')}
                `).join('')}
                </tbody>
                </table>
                `;
            }).join('')}
            `;
        }).join('')}
        `;
    }).join('')}

</body>
</html>`;

    const filename = `${conf.acronym}_Programa_Completo.doc`;

    return (
        <>
            <div className="min-h-screen flex flex-col items-center justify-center gap-4 font-sans bg-slate-50 p-20 text-center">
                <div className="w-12 h-12 rounded-full flex items-center justify-center mb-2"
                    style={{ backgroundColor: titleColor + '22' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={titleColor} strokeWidth="2.5">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                        <line x1="12" y1="18" x2="12" y2="12"/>
                        <polyline points="9 15 12 18 15 15"/>
                    </svg>
                </div>
                <h2 className="text-xl font-bold text-slate-800">Generando documento Word…</h2>
                <p className="text-slate-400 text-sm">La descarga comenzará automáticamente.</p>
                <a
                    id="dl"
                    href={`data:application/msword;charset=utf-8,${encodeURIComponent(htmlContent)}`}
                    download={filename}
                    className="hidden"
                >dl</a>
            </div>
            <script dangerouslySetInnerHTML={{ __html: `
                setTimeout(function() {
                    document.getElementById('dl').click();
                    setTimeout(function() { window.close(); }, 1500);
                }, 600);
            `}} />
        </>
    );
}
