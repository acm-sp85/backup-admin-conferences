import { query } from '@/lib/db';
import { getConferenceConfig } from '@/app/actions/program';
import { League_Spartan } from 'next/font/google';

const leagueSpartan = League_Spartan({ subsets: ['latin'], display: 'swap' });

// CIPIE-specific time slots (conference_id = 11)
const CIPIE_TIME_SLOTS = [
    { id: 'ts1', label: '10:00 – 11:00',  startH: 10, startM: 0,  endH: 11, endM: 0  },
    { id: 'ts2', label: '11:30 – 12:30',  startH: 11, startM: 30, endH: 12, endM: 30 },
    { id: 'ts3', label: '13:30 – 14:15',  startH: 13, startM: 30, endH: 14, endM: 15 },
    { id: 'ts4', label: '17:00 – 18:00',  startH: 17, startM: 0,  endH: 18, endM: 0  },
    { id: 'ts5', label: '18:30 – 20:00',  startH: 18, startM: 30, endH: 20, endM: 0  },
];

const CIPIE_ROOMS = ['SALA 1', 'SALA 2', 'SALA 3', 'SALA 4', 'SALA 5', 'SALA 6'];

/** Match a slot's start time to the correct predefined time slot. */
function matchToTimeSlot(startTimeStr) {
    const d = new Date(startTimeStr);
    const mins = d.getHours() * 60 + d.getMinutes();

    for (const ts of CIPIE_TIME_SLOTS) {
        const sMin = ts.startH * 60 + ts.startM;
        const eMin = ts.endH * 60 + ts.endM;
        // Within range with 15 min tolerance on start
        if (mins >= sMin - 15 && mins < eMin + 5) return ts;
    }
    // Fallback: nearest slot
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

export default async function TimetablePage({ searchParams }) {
    const { conferenceId } = await searchParams;
    if (!conferenceId) return <p className="p-8 text-red-500">conferenceId param required.</p>;

    const [conf] = await query('SELECT name, acronym, id FROM conferences WHERE id = ?', [conferenceId]);
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

    const sessionById = Object.fromEntries(sessions.map(s => [s.id, s]));

    // ── Build the grid ──────────────────────────────────────────────────────────
    // grid[dayISO] = { label, slots: { [tsId]: { [room]: { theme, chair, groups[] } } } }
    // A "group" is: { header: programSlot, children: programSlot[] }
    const grid = {};
    const dayOrder = [];

    function initDay(dayISO, dayLabel) {
        if (grid[dayISO]) return;
        dayOrder.push(dayISO);
        grid[dayISO] = { label: dayLabel, slots: {} };
        for (const ts of CIPIE_TIME_SLOTS) {
            grid[dayISO].slots[ts.id] = {};
            for (const r of CIPIE_ROOMS) {
                grid[dayISO].slots[ts.id][r] = null;
            }
        }
    }

    for (const session of sessions) {
        const room = extractRoom(session.session_name);
        if (!room) continue; // skip non-room sessions (e.g. online / keynotes)

        const d = new Date(session.start_time);
        const dayISO = d.toISOString().slice(0, 10);
        const rawLabel = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
        const dayLabel = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1);
        initDay(dayISO, dayLabel);

        const theme = extractTheme(session.full_session_name);
        const chair = extractChair(session.full_session_name);

        // Get slots for this session, sorted by start_time
        const sSlots = allSlots
            .filter(sl => sl.session_id === session.id)
            .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

        // Walk the slots: group header+children, assign to the correct time slot bucket
        let i = 0;
        while (i < sSlots.length) {
            const slot = sSlots[i];
            const isChild = slot.title?.includes('\u21B3'); // ↳

            if (!isChild) {
                const ts = matchToTimeSlot(slot.start_time);
                if (!ts) { i++; continue; }

                const group = { header: slot, children: [] };

                // Collect all immediately following children
                let j = i + 1;
                while (j < sSlots.length && sSlots[j].title?.includes('\u21B3')) {
                    group.children.push(sSlots[j]);
                    j++;
                }
                i = j;

                // Place in grid cell
                if (!grid[dayISO].slots[ts.id][room]) {
                    grid[dayISO].slots[ts.id][room] = { theme, chair, groups: [] };
                }
                grid[dayISO].slots[ts.id][room].groups.push(group);
            } else {
                i++; // orphan child – skip
            }
        }
    }

    const isCipie = Number(conferenceId) === 11;

    return (
        <div className={`min-h-screen bg-slate-50 ${leagueSpartan.className}`}>

            {/* ── Top navigation bar ── */}
            <div className="bg-white shadow-sm border-b border-slate-200 px-6 py-4 print:hidden">
                <div className="max-w-[1500px] mx-auto flex items-center justify-between gap-4">
                    <div>
                        <h1 className="text-lg font-bold text-slate-900 leading-tight">{conf.name}</h1>
                        <p className="text-xs text-slate-400 mt-0.5">Programa por franjas horarias • {conf.acronym}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <a
                            href={`/program/download/all?conferenceId=${conferenceId}`}
                            target="_blank"
                            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg shadow-sm hover:opacity-90 transition-opacity"
                            style={{ backgroundColor: titleColor }}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                <polyline points="14 2 14 8 20 8"/>
                                <line x1="12" y1="18" x2="12" y2="12"/>
                                <polyline points="9 15 12 18 15 15"/>
                            </svg>
                            Descargar Programa (.doc)
                        </a>
                    </div>
                </div>
            </div>

            {/* ── Main content ── */}
            <div className="max-w-[1500px] mx-auto px-4 py-8 space-y-14">

                {!isCipie && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800 text-sm">
                        ⚠️ The time-slot configuration is tuned for CIPIE. For other conferences the grid will show sessions matched to the nearest slot based on start time.
                    </div>
                )}

                {dayOrder.map(dayISO => {
                    const day = grid[dayISO];

                    return (
                        <section key={dayISO}>
                            {/* Day header */}
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-1.5 h-8 rounded-full" style={{ backgroundColor: titleColor }} />
                                <h2 className="text-2xl font-bold uppercase tracking-widest text-slate-800">
                                    {day.label}
                                </h2>
                                <div className="flex-1 h-px bg-slate-200" />
                            </div>

                            {/* Time slot sections */}
                            <div className="space-y-8">
                                {CIPIE_TIME_SLOTS.map(ts => {
                                    const hasAny = CIPIE_ROOMS.some(r => day.slots[ts.id]?.[r]);
                                    if (!hasAny) return null;

                                    return (
                                        <div key={ts.id}>
                                            {/* Time slot label */}
                                            <div className="flex items-center gap-3 mb-3">
                                                <div
                                                    className="text-white font-bold text-sm px-5 py-1.5 rounded-full whitespace-nowrap shadow-sm"
                                                    style={{ backgroundColor: titleColor }}
                                                >
                                                    {ts.label}
                                                </div>
                                                <div className="flex-1 border-t border-slate-200" />
                                            </div>

                                            {/* 6-room grid */}
                                            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${CIPIE_ROOMS.length}, 1fr)` }}>
                                                {CIPIE_ROOMS.map(room => {
                                                    const cell = day.slots[ts.id]?.[room];

                                                    return (
                                                        <div
                                                            key={room}
                                                            className={`rounded-xl border flex flex-col overflow-hidden transition-all ${
                                                                cell
                                                                    ? 'bg-white border-slate-200 shadow-sm'
                                                                    : 'bg-slate-50/70 border-slate-100 opacity-50'
                                                            }`}
                                                        >
                                                            {/* Room header pill */}
                                                            <div
                                                                className="py-1.5 px-3 text-[10px] font-bold uppercase tracking-widest text-center border-b"
                                                                style={{
                                                                    backgroundColor: titleColor + '18',
                                                                    color: titleColor,
                                                                    borderColor: titleColor + '30',
                                                                }}
                                                            >
                                                                {room}
                                                            </div>

                                                            {cell ? (
                                                                <div className="p-3 flex-1 flex flex-col gap-2.5">
                                                                    {/* Thematic area */}
                                                                    <div className="pb-2 border-b border-slate-100">
                                                                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wide leading-tight mb-0.5">
                                                                            {cell.theme}
                                                                        </p>
                                                                        {cell.chair && (
                                                                            <p className="text-[9px] italic text-slate-400">
                                                                                Chair: {fmtName(cell.chair)}
                                                                            </p>
                                                                        )}
                                                                    </div>

                                                                    {/* Slot groups */}
                                                                    <div className="flex flex-col gap-2.5">
                                                                        {cell.groups.map((grp, gi) => (
                                                                            <div
                                                                                key={gi}
                                                                                className={gi > 0 ? 'pt-2 border-t border-slate-100' : ''}
                                                                            >
                                                                                {/* Header slot */}
                                                                                {grp.header && (
                                                                                    <div className="text-[10px] font-bold text-slate-800 leading-snug">
                                                                                        {grp.header.title?.replace('\u2022 ', '') || ''}
                                                                                    </div>
                                                                                )}

                                                                                {/* Presenter (single-talk: no children) */}
                                                                                {grp.header?.presenter_name && grp.children.length === 0 && (
                                                                                    <div className="text-[9px] text-slate-500 mt-0.5">
                                                                                        {fmtName(grp.header.presenter_name)}
                                                                                        {grp.header.presenter_entity && (
                                                                                            <span className="text-slate-400"> · {grp.header.presenter_entity}</span>
                                                                                        )}
                                                                                    </div>
                                                                                )}

                                                                                {/* Child talks */}
                                                                                {grp.children.length > 0 && (
                                                                                    <ul className="mt-1.5 space-y-1.5">
                                                                                        {grp.children.map((child, ci) => (
                                                                                            <li
                                                                                                key={ci}
                                                                                                className="pl-2.5 border-l-2 border-slate-200"
                                                                                            >
                                                                                                <span className="text-[10px] font-medium text-slate-700 block leading-snug">
                                                                                                    {child.title?.replace('\u00A0\u00A0\u00A0\u00A0\u21B3 ', '') || ''}
                                                                                                </span>
                                                                                                {child.presenter_name && (
                                                                                                    <span className="text-[9px] text-slate-400">
                                                                                                        {fmtName(child.presenter_name)}
                                                                                                        {child.presenter_entity && ` · ${child.presenter_entity}`}
                                                                                                    </span>
                                                                                                )}
                                                                                            </li>
                                                                                        ))}
                                                                                    </ul>
                                                                                )}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="flex-1 flex items-center justify-center text-slate-300 text-lg py-6">
                                                                    —
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    );
                })}
            </div>

            {/* ── Print styles ── */}
            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    @page { size: A3 landscape; margin: 10mm; }
                    body { font-size: 8pt; }
                    .print\\:hidden { display: none !important; }
                }
            `}} />
        </div>
    );
}
