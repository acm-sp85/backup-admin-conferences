export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { query } from '@/lib/db';
import { getConferenceConfig } from '@/app/actions/program';
import { League_Spartan } from 'next/font/google';

const leagueSpartan = League_Spartan({ 
    subsets: ['latin'],
    display: 'swap',
});

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

export default async function ProgramPrintAllPage({ searchParams }) {
    const { conferenceId } = await searchParams;

    if (!conferenceId) return <div>Conference ID required</div>;

    // Fetch conference data
    const [conference] = await query('SELECT name, acronym FROM conferences WHERE id = ?', [conferenceId]);
    if (!conference) return <div>Conference not found</div>;

    // Fetch all sessions for this conference
    const sessions = await query(`
        SELECT * FROM program_sessions 
        WHERE conference_id = ? AND (is_hidden = 0 OR is_hidden IS NULL)
        ORDER BY start_time ASC, session_name ASC
    `, [conferenceId]);

    // Fetch all slots for all sessions at once
    const allSlots = await query(`
        SELECT s.*, 
               t.name as topic_name, 
               p.name as parent_topic_name
        FROM program_slots s
        LEFT JOIN topics t ON s.topic_mongo_id COLLATE utf8mb4_unicode_ci = t.mongo_id COLLATE utf8mb4_unicode_ci
        LEFT JOIN topics p ON t.parent_mongo_id COLLATE utf8mb4_unicode_ci = p.mongo_id COLLATE utf8mb4_unicode_ci
        WHERE s.session_id IN (SELECT id FROM program_sessions WHERE conference_id = ?)
        ORDER BY s.start_time ASC
    `, [conferenceId]);

    // Fetch conference config
    const { config, bgUrl } = await getConferenceConfig(conferenceId);

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col items-center py-10 no-print-bg">
            {/* Floating Print Button */}
            <div className="fixed bottom-8 right-8 z-50 print:hidden flex flex-col gap-2">
                <button 
                    id="print-btn"
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-full shadow-lg transition-colors flex items-center gap-2"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                    Print All Door Signs
                </button>
            </div>

            {sessions.flatMap((session, sIdx) => {
                const sessionSlots = allSlots.filter(slot => slot.session_id === session.id);
                
                let slotGroups = [];
                if (Number(conferenceId) === 11) {
                    const buckets = {};
                    let i = 0;
                    while (i < sessionSlots.length) {
                        const slot = sessionSlots[i];
                        if (slot.title?.includes('\u21B3')) { i++; continue; }

                        const group = [slot];
                        let j = i + 1;
                        while (j < sessionSlots.length && sessionSlots[j].title?.includes('\u21B3')) {
                            group.push(sessionSlots[j]);
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
                    
                    slotGroups = Object.values(buckets).sort((a, b) => new Date(a.slots[0].start_time) - new Date(b.slots[0].start_time));
                } else {
                    slotGroups = [{ id: 'all', label: null, slots: sessionSlots }];
                }

                return slotGroups.map((group, gIdx) => {
                    let adjs = {};
                    if (session.door_sign_adjustments) {
                        try {
                            adjs = typeof session.door_sign_adjustments === 'string'
                                ? JSON.parse(session.door_sign_adjustments)
                                : session.door_sign_adjustments;
                        } catch(e) {}
                    }
                    const pageAdj = adjs[gIdx] || (gIdx === 0 && adjs.y !== undefined ? adjs : null);
                    const savedY = pageAdj?.y !== undefined ? pageAdj.y : null;
                    const savedZoom = pageAdj?.zoom !== undefined ? pageAdj.zoom : null;

                    return (
                        <div 
                            key={`${session.id}-${gIdx}`}
                            className={`bg-white text-black shadow-2xl print:shadow-none print:m-0 mb-10 print:mb-0 session-page ${leagueSpartan.className}`}
                            data-session-id={session.id}
                            data-page-index={gIdx}
                            data-saved-y={savedY !== null ? savedY : ''}
                            data-saved-zoom={savedZoom !== null ? savedZoom : ''}
                            style={{ 
                                width: '210mm',
                                height: '297mm',
                                backgroundImage: bgUrl ? `url(${bgUrl})` : 'none',
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                padding: config.padding || '30px 15px 120px 15px', 
                                position: 'relative',
                                boxSizing: 'border-box',
                                breakAfter: 'page'
                            }}
                        >
                            {/* Interactive Controls (Hidden on Print) */}
                            <div className="print:hidden absolute top-4 right-[-140px] bg-white border border-slate-200 rounded-lg shadow-lg p-3 w-32 flex flex-col gap-3 z-10" style={{ transform: 'translateX(100%)' }}>
                                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Adjust Page</div>
                                <div>
                                    <label className="text-[10px] font-medium text-slate-500 flex justify-between">
                                        <span>Y-Offset</span>
                                        <span className="y-val" suppressHydrationWarning>{savedY !== null ? `${savedY}px` : '0px'}</span>
                                    </label>
                                    <input 
                                        type="range" 
                                        min="-200" 
                                        max="200" 
                                        defaultValue={savedY !== null ? savedY : 0} 
                                        className="slider-y w-full accent-blue-600" 
                                        suppressHydrationWarning 
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-medium text-slate-500 flex justify-between">
                                        <span>Zoom</span>
                                        <span className="zoom-val" suppressHydrationWarning>{savedZoom !== null ? `${savedZoom}%` : '100%'}</span>
                                    </label>
                                    <input 
                                        type="range" 
                                        min="50" 
                                        max="150" 
                                        defaultValue={savedZoom !== null ? savedZoom : 100} 
                                        className="slider-zoom w-full accent-blue-600" 
                                        suppressHydrationWarning 
                                    />
                                </div>
                            </div>

                            <div 
                                className="adjustable-content print-content flex flex-col h-full mt-6" 
                                style={{ 
                                    transformOrigin: 'top center',
                                    ...(savedY !== null || savedZoom !== null ? {
                                        transform: `translateY(${savedY !== null ? savedY : 0}px) scale(${(savedZoom !== null ? savedZoom : 100) / 100})`
                                    } : {})
                                }} 
                                suppressHydrationWarning
                            >
                            {/* Header Section */}
                            <div className="mb-12">
                                <div 
                                    className="font-medium uppercase tracking-widest mb-1 mt-6 text-center"
                                    style={{ fontSize: '16px', color: config.titleColor }}
                                >
                                   {new Date(session.start_time).toLocaleDateString(Number(conferenceId) === 11 ? 'es-ES' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                                </div>
                                
                                <h1 
                                    className="font-bold leading-tight mb-2"
                                    style={{ fontSize: Number(conferenceId) === 11 ? '28px' : (config.titleSize || '48px') }}
                                >
                                    {session.full_session_name.replace(/\(Chair:.*?\)/, '').trim()}
                                </h1>

                                {session.full_session_name.includes('(Chair:') && (
                                    <div 
                                        className="font-medium opacity-80 mb-2 italic"
                                        style={{ fontSize: config.chairSize || '20px', color: config.titleColor }}
                                    >
                                        Chair: {formatName(session.full_session_name.match(/\(Chair:\s*(.*?)\)/)?.[1])}
                                    </div>
                                )}

                                <div className="flex gap-4 items-center">
                                    <div className=" text-white px-4 py-1 font-medium text-xl"
                                    style={{ backgroundColor: config.titleColor }}>
                                        {(() => {
                                            if (Number(conferenceId) === 11 && group.label) {
                                                return group.label;
                                            }
                                            const fmt = t => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                                            if (Number(conferenceId) === 11 && group.slots.length > 0) {
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
                                    {(() => {
                                        if (config.showTopicsInDoorSigns === false) return null;
                                        const sessionTopicSlot = group.slots.find(s => s.topic_name);
                                        if (!sessionTopicSlot) return null;
                                        const topicText = sessionTopicSlot.parent_topic_name 
                                            ? `${sessionTopicSlot.parent_topic_name} > ${sessionTopicSlot.topic_name}` 
                                            : sessionTopicSlot.topic_name;
                                        return (
                                            <div className="text-white px-4 py-1 font-medium text-lg border-l-2 border-white/20"
                                                 style={{ backgroundColor: config.titleColor, opacity: 0.9 }}>
                                                {topicText}
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>

                            {/* Slots Section */}
                            <div className="flex-1">
                                <table className="w-full border-collapse">
                                    <tbody>
                                        {group.slots.map((slot, idx) => (
                                            <tr key={idx} className={Number(conferenceId) === 11 ? (slot.title?.includes('\u2022') && idx > 0 ? "border-t border-black/20" : "") : "border-b border-black/10 last:border-0"}>
                                                <td 
                                                    className="py-1 pr-8 font-medium align-top whitespace-nowrap"
                                                    style={{ fontSize: config.contentSize, color: config.contentColor }}
                                                >
                                                    {slot.title?.includes('\u00A0\u00A0') ? '' : new Date(slot.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                                                </td>
                                                <td className="py-1 align-top">
                                                    <div className={slot.title?.includes('\u21B3') ? 'flex gap-2' : ''}>
                                                        {slot.title?.includes('\u21B3') && (
                                                            <div className="shrink-0 flex-none whitespace-pre opacity-80 pt-[1px]">
                                                                {'\u00A0\u00A0\u00A0\u00A0\u21B3'}
                                                            </div>
                                                        )}
                                                        <div className={slot.title?.includes('\u21B3') ? 'flex-1' : ''}>
                                                            <div 
                                                                className="font-semibold mb-1"
                                                                style={{ fontSize: config.contentSize, color: config.contentColor }}
                                                            >
                                                                {slot.title?.includes('\u21B3') 
                                                                    ? slot.title.replace('\u00A0\u00A0\u00A0\u00A0\u21B3 ', '') 
                                                                    : slot.title || '(No Title)'}
                                                            </div>
                                                            {slot.presenter_name && (
                                                                <div 
                                                                    className="font-normal opacity-85"
                                                                    style={{ fontSize: `calc(${config.contentSize} * 0.8)`, color: config.contentColor }}
                                                                >
                                                                    <span style={{ color: config.titleColor, fontWeight: 'bold' }}>
                                                                        {(() => {
                                                                            let displayName = slot.presenter_name;
                                                                            if (displayName.includes(',')) {
                                                                                const parts = displayName.split(',');
                                                                                displayName = `${parts[1].trim()} ${parts[0].trim()}`;
                                                                            }
                                                                            return formatName(displayName);
                                                                        })()}
                                                                    </span>
                                                                    {((slot.presenter_entity || slot.presenter_country)) && (
                                                                        <span style={{ opacity: 0.8 }}>
                                                                            {` - ${[slot.presenter_entity, slot.presenter_country].filter(Boolean).join(', ')}`}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )}
                                                            <div className="text-[10px] font-bold uppercase tracking-widest mt-2"
                                                            style={{ color: config.contentColor, opacity: 0.6 }}>
                                                                {slot.type}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                );
            });
            })}

            {/* Print Utility: Forces a print dialog and handles scaling & persistent adjustments */}
            <script dangerouslySetInnerHTML={{ __html: `
                (function() {
                    const saveTimeouts = {};
                    const pendingSaves = {};

                    function flushSave(key) {
                        const pending = pendingSaves[key];
                        if (!pending) return;
                        delete pendingSaves[key];
                        clearTimeout(saveTimeouts[key]);

                        fetch('/api/program/sessions/' + pending.sId + '/door-sign-adjustments', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ pageIndex: pending.pIdx, updates: pending.updates }),
                            keepalive: true
                        }).catch(e => console.error('Error saving door sign adjustments:', e));
                    }

                    function flushAllPending() {
                        Object.keys(pendingSaves).forEach(key => flushSave(key));
                    }

                    function savePageAdjustment(sId, pIdx, updates) {
                        const key = sId + '_' + pIdx;
                        if (!pendingSaves[key]) pendingSaves[key] = { sId, pIdx, updates: {} };
                        Object.assign(pendingSaves[key].updates, updates);

                        clearTimeout(saveTimeouts[key]);
                        saveTimeouts[key] = setTimeout(() => {
                            flushSave(key);
                        }, 400);
                    }

                    const tryScaleAll = () => {
                        const pages = document.querySelectorAll('.session-page');
                        pages.forEach(container => {
                            const content = container.querySelector('.adjustable-content');
                            if (!content) return;

                            const sliderY = container.querySelector('.slider-y');
                            const sliderZoom = container.querySelector('.slider-zoom');
                            const yVal = container.querySelector('.y-val');
                            const zoomVal = container.querySelector('.zoom-val');
                            const sessionId = container.dataset.sessionId;
                            const pageIndex = container.dataset.pageIndex || '0';
                            const hasSavedZoom = container.dataset.savedZoom !== '';
                            const hasSavedY = container.dataset.savedY !== '';

                            if (!container.dataset.initialized) {
                                container.dataset.initialized = 'true';
                                if (hasSavedZoom) {
                                    sliderZoom.value = parseInt(container.dataset.savedZoom, 10);
                                }
                                if (hasSavedY) {
                                    sliderY.value = parseInt(container.dataset.savedY, 10);
                                }
                            }

                            let currentScale = 1;
                            if (hasSavedZoom) {
                                currentScale = parseInt(container.dataset.savedZoom, 10) / 100;
                            } else {
                                const style = window.getComputedStyle(container);
                                const paddingY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
                                const paddingX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
                                const availableHeight = container.offsetHeight - paddingY;
                                const availableWidth = container.offsetWidth - paddingX;
                                
                                content.style.transform = 'none';
                                content.style.width = '100%';
                                
                                const contentHeight = content.scrollHeight;
                                const contentWidth = content.scrollWidth;
                                
                                if (contentHeight > availableHeight || contentWidth > availableWidth) {
                                    const scaleH = availableHeight / contentHeight;
                                    const scaleW = availableWidth / contentWidth;
                                    currentScale = Math.min(scaleH, scaleW) - 0.01;
                                } else {
                                    currentScale = 1;
                                }
                                
                                sliderZoom.value = Math.round(currentScale * 100);
                            }

                            const updateTransform = () => {
                                const scale = sliderZoom.value / 100;
                                const yOffset = sliderY.value;
                                
                                if (zoomVal) zoomVal.textContent = sliderZoom.value + '%';
                                if (yVal) yVal.textContent = yOffset + 'px';
                                
                                content.style.transform = 'translateY(' + yOffset + 'px) scale(' + scale + ')';
                            };

                            if (!container.dataset.listenersBound) {
                                container.dataset.listenersBound = 'true';
                                const onYChange = () => {
                                    updateTransform();
                                    container.dataset.savedY = sliderY.value;
                                    savePageAdjustment(sessionId, pageIndex, { y: parseInt(sliderY.value, 10) });
                                };
                                const onZoomChange = () => {
                                    updateTransform();
                                    container.dataset.savedZoom = sliderZoom.value;
                                    savePageAdjustment(sessionId, pageIndex, { zoom: parseInt(sliderZoom.value, 10) });
                                };

                                sliderY.addEventListener('input', onYChange);
                                sliderY.addEventListener('change', onYChange);
                                sliderZoom.addEventListener('input', onZoomChange);
                                sliderZoom.addEventListener('change', onZoomChange);
                            }

                            updateTransform();
                        });
                    };

                    function init() {
                        const printBtn = document.getElementById('print-btn');
                        if (printBtn && !printBtn.dataset.bound) {
                            printBtn.dataset.bound = 'true';
                            printBtn.addEventListener('click', () => {
                                flushAllPending();
                                window.print();
                            });
                        }

                        window.addEventListener('beforeunload', flushAllPending);
                        window.addEventListener('beforeprint', flushAllPending);

                        tryScaleAll();
                        setTimeout(tryScaleAll, 400);
                    }

                    if (document.readyState === 'loading') {
                        document.addEventListener('DOMContentLoaded', init);
                    } else {
                        init();
                    }
                    window.addEventListener('load', tryScaleAll);
                })();
            ` }} />

            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 0;
                    }
                    body {
                        margin: 0;
                        padding: 0;
                        background: white !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .no-print-bg {
                        background: transparent !important;
                        padding: 0 !important;
                        min-height: 0 !important;
                        display: block !important;
                    }
                    .session-page {
                        box-shadow: none !important;
                        margin: 0 !important;
                        width: 210mm !important;
                        height: 297mm !important;
                        page-break-after: always !important;
                        break-after: page !important;
                    }
                }
                .no-print-bg {
                    transition: background 0.3s;
                }
            `}} />
        </div>
    );
}
