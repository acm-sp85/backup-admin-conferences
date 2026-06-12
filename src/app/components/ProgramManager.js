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

    // Group sessions by day
    const groupedProgram = program
        .filter(s => showHidden || !s.is_hidden)
        .reduce((groups, session) => {
            const date = new Date(session.start_time).toLocaleDateString('en-GB', { 
                weekday: 'long', day: 'numeric', month: 'long' 
            });
            if (!groups[date]) groups[date] = [];
            groups[date].push(session);
            return groups;
        }, {});

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
                
                <div className="flex gap-2">
                    <button 
                        onClick={() => setIsCustomizing(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                        Customize Door Signs
                    </button>
                    <button 
                        onClick={() => window.open(`/program/print/all?conferenceId=${selectedConfId}`, '_blank')}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                        Print Full Program
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
                        <div key={day} className="space-y-4">
                            <h3 className="text-lg font-bold text-slate-800 border-b pb-2 sticky top-0 bg-[var(--bg)] z-10">{day}</h3>
                            <div className="grid grid-cols-1 gap-4">
                                {sessions.map(session => (
                                    <div key={session.id} className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden group hover:border-blue-300 transition-all ${session.is_hidden ? 'opacity-50 grayscale-[0.5]' : ''}`}>
                                        <div className="p-4 flex justify-between items-start bg-slate-50/50">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    <span className="text-[10px] font-bold uppercase tracking-widest text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                                                        {new Date(session.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })} - {new Date(session.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
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
                                                    {userRole === 'superadmin' && (
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
                                                {session.slots?.map((slot, idx) => (
                                                    <li key={idx} className="flex gap-4 text-xs">
                                                        <span className="text-slate-400 font-mono w-20 flex-shrink-0">
                                                            {new Date(slot.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                                                        </span>
                                                        <div className="flex-1 group/slot relative">
                                                            <div className="font-bold text-slate-800 flex items-center gap-2">
                                                                {slot.title || '(No Title)'}
                                                                {!!slot.is_manual && (
                                                                    <span className="text-[9px] font-bold uppercase tracking-tighter bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded" title="This slot was manually edited and won't be overwritten by sync">Manual</span>
                                                                )}
                                                                {userRole === 'superadmin' && (
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
                                <button type="button" onClick={handleDeleteSlot} className="px-5 py-2 text-sm font-bold text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200 flex items-center gap-2">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                                    Delete Slot
                                </button>
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
