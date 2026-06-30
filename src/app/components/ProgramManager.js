'use client';

import { useState, useEffect } from 'react';
import { getProgram, getConferenceConfig, updateDoorSignConfig, toggleSessionVisibility, updateSessionData, updateSlotData, deleteSlotData } from '../actions/program';

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

// ── CIPIE time slots ────────────────────────────────────────────────────────
const CIPIE_TIME_SLOTS = [
    { id: 'ts1', label: '10:00 – 11:00',  startH: 10, startM: 0,  endH: 11, endM: 0  },
    { id: 'ts2', label: '11:30 – 12:30',  startH: 11, startM: 30, endH: 12, endM: 30 },
    { id: 'ts3', label: '13:30 – 14:15',  startH: 13, startM: 30, endH: 14, endM: 15 },
    { id: 'ts4', label: '17:00 – 18:00',  startH: 17, startM: 0,  endH: 18, endM: 0  },
    { id: 'ts5', label: '18:30 – 20:00',  startH: 18, startM: 30, endH: 20, endM: 0  },
];

function matchSessionToSlot(startTimeStr) {
    const d = new Date(startTimeStr);
    const mins = d.getHours() * 60 + d.getMinutes();
    for (const ts of CIPIE_TIME_SLOTS) {
        const sMin = ts.startH * 60 + ts.startM;
        const eMin = ts.endH * 60 + ts.endM;
        if (mins >= sMin - 15 && mins < eMin + 5) return ts;
    }
    // fallback: closest slot
    let best = CIPIE_TIME_SLOTS[0], bestDiff = Infinity;
    for (const ts of CIPIE_TIME_SLOTS) {
        const diff = Math.abs(mins - (ts.startH * 60 + ts.startM));
        if (diff < bestDiff) { bestDiff = diff; best = ts; }
    }
    return best;
}

export default function ProgramManager({ conferences, userRole }) {
    // Initialize from cookie if available
    const [selectedConfId, setSelectedConfId] = useState(() => {
        if (typeof document !== 'undefined') {
            const match = document.cookie.match(/(?:^|; )last_conference=([^;]*)/);
            const acronym = match ? decodeURIComponent(match[1]) : null;
            if (acronym) {
                const found = conferences.find(c => c.acronym === acronym);
                if (found) return found.id;
            }
        }
        return conferences[0]?.id || '';
    });

    const handleConferenceChange = (id) => {
        setSelectedConfId(id);
        const acronym = conferences.find(c => c.id == id)?.acronym;
        if (acronym) {
            document.cookie = `last_conference=${acronym}; path=/; max-age=31536000`;
        }
    };

    const [program, setProgram] = useState([]);
    const [loading, setLoading] = useState(false);
    const [config, setConfig] = useState(null);
    const [isCustomizing, setIsCustomizing] = useState(false);
    const [showHidden, setShowHidden] = useState(false);
    const [isUpdating, setIsUpdating] = useState(null);
    const [editingSession, setEditingSession] = useState(null);
    const [editingSlot, setEditingSlot] = useState(null);

    useEffect(() => {
        if (selectedConfId) {
            loadData();
        }
    }, [selectedConfId]);

    async function loadData() {
        setLoading(true);
        try {
            const [progData, confData] = await Promise.all([
                getProgram(selectedConfId),
                getConferenceConfig(selectedConfId)
            ]);
            setProgram(progData);
            setConfig(confData);
        } catch (error) {
            console.error('Error loading program:', error);
        } finally {
            setLoading(false);
        }
    }

    const handleSaveConfig = async (e) => {
        e.preventDefault();
        try {
            await updateDoorSignConfig(selectedConfId, config.config, config.bgUrl);
            setIsCustomizing(false);
            alert('Settings saved successfully!');
        } catch (error) {
            alert('Error saving settings: ' + error.message);
        }
    };

    const handleToggleVisibility = async (sessionId, currentHidden) => {
        setIsUpdating(sessionId);
        try {
            await toggleSessionVisibility(sessionId, !currentHidden);
            await loadData();
        } catch (error) {
            alert('Error updating visibility: ' + error.message);
        } finally {
            setIsUpdating(null);
        }
    };

    const handleSaveSession = async (e) => {
        e.preventDefault();
        try {
            await updateSessionData(editingSession.id, { full_session_name: editingSession.full_session_name });
            setEditingSession(null);
            await loadData();
        } catch (error) {
            alert('Error updating session: ' + error.message);
        }
    };

    const handleSaveSlot = async (e) => {
        e.preventDefault();
        try {
            await updateSlotData(editingSlot.id, { 
                title: editingSlot.title, 
                presenter_name: editingSlot.presenter_name, 
                type: editingSlot.type,
                presenter_entity: editingSlot.presenter_entity,
                presenter_country: editingSlot.presenter_country
            });
            setEditingSlot(null);
            await loadData();
        } catch (error) {
            alert('Error updating slot: ' + error.message);
        }
    };

    const handleDeleteSlot = async () => {
        if (!confirm('Are you sure you want to permanently delete this slot?')) return;
        try {
            await deleteSlotData(editingSlot.id);
            setEditingSlot(null);
            await loadData();
        } catch (error) {
            alert('Error deleting slot: ' + error.message);
        }
    };

    const isCipie = Number(selectedConfId) === 11;

    // Group sessions by day
    const groupedProgram = program
        .filter(s => showHidden || !s.is_hidden)
        .reduce((groups, session) => {
            const locale = isCipie ? 'es-ES' : 'en-GB';
            const date = new Date(session.start_time).toLocaleDateString(locale, { 
                weekday: 'long', day: 'numeric', month: 'long' 
            });
            const dayKey = date.charAt(0).toUpperCase() + date.slice(1);
            if (!groups[dayKey]) groups[dayKey] = [];
            groups[dayKey].push(session);
            return groups;
        }, {});

    /**
     * For CIPIE: walk each session's slots, group top-level slot+children pairs
     * by the SLOT's start time, placing them into the correct time bucket.
     * A single session can appear in multiple buckets (split across time blocks).
     *
     * Returns: [{ id, label, sessionGroups: [{ session, slots }] }]
     */
    function groupByTimeSlot(sessions) {
        if (!isCipie) {
            return [{ id: 'all', label: null, sessionGroups: sessions.map(s => ({ session: s, slots: s.slots || [] })) }];
        }

        // buckets keyed by ts.id; each holds a sessionMap: { sessionId -> { session, slots[] } }
        const buckets = {};
        for (const ts of CIPIE_TIME_SLOTS) buckets[ts.id] = { ...ts, sessionMap: {} };
        buckets['other'] = { id: 'other', label: 'Otros horarios', sessionMap: {} };

        for (const session of sessions) {
            const allSlots = session.slots || [];
            let i = 0;
            while (i < allSlots.length) {
                const slot = allSlots[i];
                // Child slots (↳) are collected under their parent — skip as leading entries
                if (slot.title?.includes('\u21B3')) { i++; continue; }

                // Collect this top-level slot + all immediately following children
                const group = [slot];
                let j = i + 1;
                while (j < allSlots.length && allSlots[j].title?.includes('\u21B3')) {
                    group.push(allSlots[j]);
                    j++;
                }
                i = j;

                // Determine time bucket from this slot's own start time
                const ts = matchSessionToSlot(slot.start_time);
                const bucketId = ts ? ts.id : 'other';

                if (!buckets[bucketId].sessionMap[session.id]) {
                    buckets[bucketId].sessionMap[session.id] = { session, slots: [] };
                }
                buckets[bucketId].sessionMap[session.id].slots.push(...group);
            }
        }

        const sortByRoom = groups => [...groups].sort((a, b) => {
            const n = s => parseInt(s.session?.session_name?.match(/SALA\s*(\d+)/i)?.[1] ?? '99');
            return n(a) - n(b);
        });

        return [
            ...CIPIE_TIME_SLOTS.map(ts => ({ ...ts, sessionGroups: sortByRoom(Object.values(buckets[ts.id].sessionMap)) })),
            { id: 'other', label: 'Otros horarios', sessionGroups: sortByRoom(Object.values(buckets['other'].sessionMap)) },
        ].filter(g => g.sessionGroups.length > 0);
    }

    return (
        <div className="space-y-6">
            {/* Top Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-4">
                    <select 
                        className="bg-slate-50 border border-slate-200 text-sm rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500"
                        value={selectedConfId}
                        onChange={(e) => handleConferenceChange(e.target.value)}
                    >
                        {conferences.map(c => (
                            <option key={c.id} value={c.id}>{c.name} ({c.acronym})</option>
                        ))}
                    </select>
                    {!loading && (
                        <div className="text-xs bg-[var(--accent)]/10 px-3 py-1.5 rounded-full text-[var(--muted)]">
                            Total Sessions: <strong className="text-[var(--foreground)] ml-1">{program.length}</strong>
                        </div>
                    )}
                    <button 
                        onClick={() => setShowHidden(!showHidden)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            showHidden 
                            ? 'bg-orange-100 text-orange-700 border border-orange-200' 
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        {showHidden ? 'Showing Hidden' : 'Show Hidden'}
                    </button>
                </div>
                
                <div className="flex gap-2 flex-wrap">
                    <button 
                        onClick={() => setIsCustomizing(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                        Customize Door Signs
                    </button>
                    <button 
                        onClick={() => window.open(`/program/timetable?conferenceId=${selectedConfId}`, '_blank')}
                        className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        View Timetable
                    </button>
                    <button 
                        onClick={() => window.open(`/program/download/all?conferenceId=${selectedConfId}`, '_blank')}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 18 15 15"/></svg>
                        Download Full Program (.doc)
                    </button>
                    <button 
                        onClick={() => window.open(`/program/print/all?conferenceId=${selectedConfId}`, '_blank')}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                        Print All Door Signs
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-20 text-slate-400">Loading program data...</div>
            ) : Object.keys(groupedProgram).length === 0 ? (
                <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300 text-slate-400">
                    No program data found for this conference.
                </div>
            ) : (
                <div className="space-y-12">
                    {Object.entries(groupedProgram).map(([day, sessions]) => (
                        <div key={day} className="space-y-6">
                            <h3 className="text-lg font-bold text-slate-800 border-b pb-2 sticky top-0 bg-[var(--bg)] z-10">{day}</h3>

                            {groupByTimeSlot(sessions).map(tsGroup => (
                                <div key={tsGroup.id} className="space-y-4">
                                    {/* Time-slot pill separator (CIPIE only) */}
                                    {tsGroup.label && (
                                        <div className="flex items-center gap-3">
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-white px-3 py-1 rounded-full whitespace-nowrap shadow-sm"
                                                style={{ backgroundColor: config?.config?.titleColor || '#7c3aed' }}>
                                                {tsGroup.label}
                                            </span>
                                            <div className="flex-1 h-px bg-slate-200" />
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 gap-4">
                                        {tsGroup.sessionGroups.map(({ session, slots }) => (
                                    <div key={session.id} className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden group hover:border-blue-300 transition-all ${session.is_hidden ? 'opacity-50 grayscale-[0.5]' : ''}`}>
                                        <div className="p-4 flex justify-between items-start bg-slate-50/50">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    <span className="text-[10px] font-bold uppercase tracking-widest text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                                                        {(() => {
                                                            const fmt = t => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                                                            if (isCipie && slots.length > 0) {
                                                                const topLevel = slots.filter(s => !s.title?.includes('\u21B3'));
                                                                const first = topLevel[0] || slots[0];
                                                                const last  = topLevel[topLevel.length - 1] || slots[slots.length - 1];
                                                                return first === last
                                                                    ? fmt(first.start_time)
                                                                    : `${fmt(first.start_time)} – ${fmt(last.start_time)}`;
                                                            }
                                                            return `${fmt(session.start_time)} – ${fmt(session.end_time)}`;
                                                        })()}
                                                    </span>
                                                    {!!session.is_hidden && (
                                                        <span className="text-[9px] font-bold uppercase tracking-tighter bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded">Hidden</span>
                                                    )}
                                                    {!!session.is_manual && (
                                                        <span className="text-[9px] font-bold uppercase tracking-tighter bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded">Manual</span>
                                                    )}
                                                </div>
                                                <h4 className="font-bold text-slate-800 text-[15px] leading-snug flex items-center gap-2">
                                                    {session.full_session_name.replace(/\(Chair:.*?\)/, '').trim()}
                                                    {(userRole === 'superadmin' || userRole === 'admin') && (
                                                        <button onClick={() => setEditingSession(session)} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-blue-600 transition-all" title="Edit Session">
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                                                        </button>
                                                    )}
                                                </h4>
                                                {session.full_session_name.includes('(Chair:') && (
                                                    <div className="text-[11px] text-slate-500 italic mt-0.5 flex items-center gap-1.5">
                                                        <div className="w-1 h-1 rounded-full bg-slate-300" />
                                                        Chair: {formatName(session.full_session_name.match(/\(Chair:\s*(.*?)\)/)?.[1])}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <button
                                                    onClick={() => handleToggleVisibility(session.id, session.is_hidden)}
                                                    disabled={isUpdating === session.id}
                                                    className={`opacity-0 group-hover:opacity-100 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider transition-all ${
                                                        session.is_hidden ? 'text-green-600 hover:text-green-700' : 'text-slate-400 hover:text-red-500'
                                                    }`}
                                                >
                                                    {isUpdating === session.id ? (
                                                        <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                                                    ) : session.is_hidden ? (
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                                    ) : (
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                                    )}
                                                    {session.is_hidden ? 'Restore' : 'Hide'}
                                                </button>
                                                {!session.is_hidden && (
                                                    <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-all">
                                                        <a 
                                                            href={`/program/download/${session.id}`}
                                                            target="_blank"
                                                            className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-blue-600 transition-all"
                                                            title="Download editable Word document"
                                                        >
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                                                            .doc
                                                        </a>
                                                        <a 
                                                            href={`/program/print/${session.id}`}
                                                            target="_blank"
                                                            className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-blue-600 hover:text-blue-700 transition-all"
                                                        >
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                                                            Door Sign
                                                        </a>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="p-4 border-t border-slate-100">
                                            <ul className="space-y-3">
                                                {slots.map((slot, idx) => (
                                                    <li key={idx} className="flex gap-4 text-xs">
                                                        <span className="text-slate-400 font-mono w-20 flex-shrink-0">
                                                            {slot.title?.includes('\u00A0\u00A0') ? '' : new Date(slot.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                                                        </span>
                                                        <div className={`flex-1 group/slot relative ${slot.title?.includes('\u21B3') ? 'flex gap-1' : ''}`}>
                                                            {slot.title?.includes('\u21B3') && (
                                                                <div className="shrink-0 flex-none whitespace-pre text-slate-400 font-bold pt-[1px]">
                                                                    {'\u00A0\u00A0\u00A0\u00A0\u21B3'}
                                                                </div>
                                                            )}
                                                            <div className={slot.title?.includes('\u21B3') ? 'flex-1' : ''}>
                                                                <div className="font-bold text-slate-800 flex items-center gap-2">
                                                                    <span>
                                                                        {slot.title?.includes('\u21B3') 
                                                                            ? slot.title.replace('\u00A0\u00A0\u00A0\u00A0\u21B3 ', '') 
                                                                            : slot.title || '(No Title)'}
                                                                    </span>
                                                                    {!!slot.is_manual && (
                                                                        <span className="text-[9px] font-bold uppercase tracking-tighter bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded" title="This slot was manually edited and won't be overwritten by sync">Manual</span>
                                                                    )}
                                                                    {(userRole === 'superadmin' || userRole === 'admin') && (
                                                                        <button onClick={() => setEditingSlot(slot)} className="opacity-0 group-hover/slot:opacity-100 text-slate-400 hover:text-blue-600 transition-all" title="Edit Slot">
                                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                                                                        </button>
                                                                    )}
                                                                </div>
                                                                {slot.presenter_name && (
                                                                    <div className="text-slate-500 mt-0.5">
                                                                        <span className="font-medium text-slate-700">
                                                                            {(() => {
                                                                                let displayName = slot.presenter_name;
                                                                                if (displayName.includes(',')) {
                                                                                    const parts = displayName.split(',');
                                                                                    displayName = `${parts[1].trim()} ${parts[0].trim()}`;
                                                                                }
                                                                                return formatName(displayName);
                                                                            })()}
                                                                        </span>
                                                                        {(slot.presenter_entity || slot.presenter_country) && (
                                                                            <span className="text-slate-400 font-normal">
                                                                                {` (${[slot.presenter_entity, slot.presenter_country].filter(Boolean).join(', ')})`}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                )}
                                                                <div className="text-[10px] text-slate-400 uppercase mt-1 tracking-wider">{slot.type}</div>
                                                            </div>
                                                        </div>
                                                    </li>
                                                ))}
                                                    </ul>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            )}

            {/* Customization Modal */}
            {isCustomizing && config && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in duration-200">
                        <div className="p-6 border-b flex justify-between items-center">
                            <h3 className="text-lg font-bold">Customize Door Signs</h3>
                            <button onClick={() => setIsCustomizing(false)} className="text-slate-400 hover:text-slate-600">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                        </div>
                        <form onSubmit={handleSaveConfig} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Background Image URL</label>
                                <input 
                                    type="text" 
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="https://..."
                                    value={config.bgUrl || ''}
                                    onChange={(e) => setConfig({ ...config, bgUrl: e.target.value })}
                                />
                                <p className="text-[10px] text-slate-400 italic">This image will be used as a full-page background for every door sign PDF.</p>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Title Font Size</label>
                                    <input 
                                        type="text" 
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                                        value={config.config.titleSize}
                                        onChange={(e) => setConfig({ ...config, config: { ...config.config, titleSize: e.target.value } })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Title Color</label>
                                    <div className="flex gap-2">
                                        <input 
                                            type="color" 
                                            className="h-11 w-20 p-1 bg-slate-50 border border-slate-200 rounded-xl"
                                            value={config.config.titleColor}
                                            onChange={(e) => setConfig({ ...config, config: { ...config.config, titleColor: e.target.value } })}
                                        />
                                        <input 
                                            type="text" 
                                            className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                                            value={config.config.titleColor}
                                            onChange={(e) => setConfig({ ...config, config: { ...config.config, titleColor: e.target.value } })}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">List Font Size</label>
                                    <input 
                                        type="text" 
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                                        value={config.config.contentSize}
                                        onChange={(e) => setConfig({ ...config, config: { ...config.config, contentSize: e.target.value } })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Padding (Margin)</label>
                                    <input 
                                        type="text" 
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                                        value={config.config.padding}
                                        onChange={(e) => setConfig({ ...config, config: { ...config.config, padding: e.target.value } })}
                                    />
                                </div>
                            </div>
                        </form>
                        <div className="p-6 border-t bg-slate-50 flex justify-end gap-3">
                            <button onClick={() => setIsCustomizing(false)} className="px-5 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors">
                                Cancel
                            </button>
                            <button onClick={handleSaveConfig} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-lg shadow-blue-200 transition-all">
                                Save Settings
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Session Modal */}
            {editingSession && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200">
                        <div className="p-6 border-b flex justify-between items-center">
                            <h3 className="text-lg font-bold">Edit Session</h3>
                            <button onClick={() => setEditingSession(null)} className="text-slate-400 hover:text-slate-600">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                        </div>
                        <form onSubmit={handleSaveSession} className="p-6 space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Full Session Name</label>
                                <textarea 
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
                                    value={editingSession.full_session_name || ''}
                                    onChange={(e) => setEditingSession({ ...editingSession, full_session_name: e.target.value })}
                                />
                                <p className="text-[10px] text-purple-600 italic mt-1">Editing this will mark it as manual and prevent overwrites during sync.</p>
                            </div>
                            <div className="flex justify-end gap-3 pt-4">
                                <button type="button" onClick={() => setEditingSession(null)} className="px-5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
                                <button type="submit" className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-lg shadow-blue-200 transition-all">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Slot Modal */}
            {editingSlot && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200">
                        <div className="p-6 border-b flex justify-between items-center">
                            <h3 className="text-lg font-bold">Edit Slot</h3>
                            <button onClick={() => setEditingSlot(null)} className="text-slate-400 hover:text-slate-600">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                        </div>
                        <form onSubmit={handleSaveSlot} className="p-6 space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Title</label>
                                <textarea 
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px]"
                                    value={editingSlot.title || ''}
                                    onChange={(e) => setEditingSlot({ ...editingSlot, title: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Presenter Name</label>
                                <input 
                                    type="text"
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                    value={editingSlot.presenter_name || ''}
                                    onChange={(e) => setEditingSlot({ ...editingSlot, presenter_name: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Presenter Entity/Institution</label>
                                    <input 
                                        type="text"
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                        value={editingSlot.presenter_entity || ''}
                                        onChange={(e) => setEditingSlot({ ...editingSlot, presenter_entity: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Presenter Country</label>
                                    <input 
                                        type="text"
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                        value={editingSlot.presenter_country || ''}
                                        onChange={(e) => setEditingSlot({ ...editingSlot, presenter_country: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Type</label>
                                <input 
                                    type="text"
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                    value={editingSlot.type || ''}
                                    onChange={(e) => setEditingSlot({ ...editingSlot, type: e.target.value })}
                                />
                                <p className="text-[10px] text-purple-600 italic mt-1">Editing this will mark the slot as manual and prevent overwrites or deletion during sync.</p>
                            </div>
                            <div className="flex justify-between items-center gap-3 pt-4 border-t mt-4">
                                {userRole === 'superadmin' ? (
                                    <button type="button" onClick={handleDeleteSlot} className="px-5 py-2 text-sm font-bold text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200 flex items-center gap-2">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                                        Delete Slot
                                    </button>
                                ) : (
                                    <div></div>
                                )}
                                <div className="flex gap-3">
                                    <button type="button" onClick={() => setEditingSlot(null)} className="px-5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
                                    <button type="submit" className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-lg shadow-blue-200 transition-all">Save</button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
