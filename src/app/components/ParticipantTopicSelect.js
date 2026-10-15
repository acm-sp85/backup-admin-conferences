'use client';

import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { updateParticipantClusters } from '../actions/participantVoting';

export default function ParticipantTopicSelect({
    participantId,
    participantName,
    conferenceId,
    currentTopics,
    allTopics = [],
    onUpdate
}) {
    const parseTopics = (val) => {
        if (!val) return [];
        if (Array.isArray(val)) return val.map(String);
        if (typeof val === 'string') {
            try {
                const parsed = JSON.parse(val);
                return Array.isArray(parsed) ? parsed.map(String) : [];
            } catch (e) {
                return [];
            }
        }
        return [];
    };

    const [selected, setSelected] = useState(() => parseTopics(currentTopics));
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [saving, setSaving] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        setSelected(parseTopics(currentTopics));
    }, [currentTopics]);

    // Lock body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            const originalOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            return () => {
                document.body.style.overflow = originalOverflow;
            };
        }
    }, [isOpen]);

    // Close on Escape key
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') setIsOpen(false);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    // Group topics by Track
    const { tracks, topicsByTrack, topicMap } = useMemo(() => {
        const byTrack = {};
        const map = new Map();

        allTopics.forEach(t => {
            map.set(String(t.mongo_id), t);
            const trackName = t.track || 'Other';
            if (!byTrack[trackName]) byTrack[trackName] = [];
            byTrack[trackName].push(t);
        });

        const trackList = Object.keys(byTrack).sort((a, b) => {
            if (a === 'Other') return 1;
            if (b === 'Other') return -1;
            return a.localeCompare(b);
        });

        return { tracks: trackList, topicsByTrack: byTrack, topicMap: map };
    }, [allTopics]);

    // Filter topics by search
    const filteredTopicsByTrack = useMemo(() => {
        if (!search.trim()) return topicsByTrack;
        const q = search.toLowerCase().trim();
        const res = {};

        Object.entries(topicsByTrack).forEach(([track, list]) => {
            const matched = list.filter(t => 
                (t.code && t.code.toLowerCase().includes(q)) ||
                (t.name && t.name.toLowerCase().includes(q))
            );
            if (matched.length > 0) res[track] = matched;
        });

        return res;
    }, [topicsByTrack, search]);

    // Save selection to DB
    const persistSelection = async (newSelection) => {
        setSaving(true);
        try {
            const res = await updateParticipantClusters(participantId, newSelection, conferenceId);
            if (res.success) {
                if (onUpdate) onUpdate();
            } else if (res.error) {
                alert(res.error);
                setSelected(parseTopics(currentTopics));
            }
        } catch (err) {
            console.error('Failed to update participant topics:', err);
            alert('Failed to save assigned topics');
            setSelected(parseTopics(currentTopics));
        } finally {
            setSaving(false);
        }
    };

    // Toggle individual topic
    const toggleTopic = (mongoId) => {
        const id = String(mongoId);
        const next = selected.includes(id)
            ? selected.filter(s => s !== id)
            : [...selected, id];
        setSelected(next);
        persistSelection(next);
    };

    // Quick Action: Toggle entire Track
    const toggleTrack = (trackName) => {
        const trackItems = topicsByTrack[trackName] || [];
        const trackIds = trackItems.map(t => String(t.mongo_id));
        const allTrackSelected = trackIds.length > 0 && trackIds.every(id => selected.includes(id));

        let next;
        if (allTrackSelected) {
            // Deselect entire track
            next = selected.filter(id => !trackIds.includes(id));
        } else {
            // Select entire track (add missing ones)
            const toAdd = trackIds.filter(id => !selected.includes(id));
            next = [...selected, ...toAdd];
        }
        setSelected(next);
        persistSelection(next);
    };

    // Quick Action: Select All / Clear All
    const selectAll = () => {
        const allIds = allTopics.map(t => String(t.mongo_id));
        setSelected(allIds);
        persistSelection(allIds);
    };

    const clearAll = () => {
        setSelected([]);
        persistSelection([]);
    };

    // Stats
    const selectedObjects = selected.map(id => topicMap.get(id)).filter(Boolean);
    const totalPostersInSelection = selectedObjects.reduce((acc, t) => acc + (t.poster_count || 0), 0);

    return (
        <div className="inline-block text-left">
            {/* Table Trigger Button & Badges */}
            <div className="flex items-center gap-1.5 flex-wrap max-w-md">
                {selectedObjects.length === 0 ? (
                    <button
                        type="button"
                        onClick={() => setIsOpen(true)}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-indigo-600 bg-indigo-50/80 border border-indigo-200/70 hover:bg-indigo-100 hover:border-indigo-300 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                        <span className="text-xs leading-none">+</span>
                        <span>Assign Symposia</span>
                    </button>
                ) : (
                    <>
                        <div 
                            className="flex items-center gap-1 flex-wrap cursor-pointer"
                            onClick={() => setIsOpen(true)}
                            title="Click to edit symposia"
                        >
                            {selectedObjects.slice(0, 6).map(t => (
                                <span
                                    key={t.mongo_id}
                                    title={`${t.name} (${t.poster_count || 0} posters)`}
                                    className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition-colors shadow-2xs"
                                >
                                    {t.code || t.name.slice(0, 4)}
                                </span>
                            ))}
                            {selectedObjects.length > 6 && (
                                <span
                                    title={selectedObjects.slice(6).map(t => t.code || t.name).join(', ')}
                                    className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200"
                                >
                                    +{selectedObjects.length - 6} more
                                </span>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsOpen(true)}
                            className="p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                            title="Edit Symposia"
                        >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m18 15-6-6-6 6"/>
                            </svg>
                        </button>
                    </>
                )}
            </div>

            {/* Portal Modal Dialog - Never clipped by table containers or row boundaries */}
            {isOpen && mounted && createPortal(
                <div 
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
                    onClick={() => setIsOpen(false)}
                >
                    <div 
                        className="w-full max-w-xl max-h-[85vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="p-4 border-b border-slate-150 bg-slate-50/80 flex items-center justify-between gap-3 shrink-0">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                                    <h4 className="text-sm font-bold text-slate-900 tracking-tight">
                                        Assign Symposia / Topics
                                    </h4>
                                </div>
                                <p className="text-xs text-slate-500 mt-1">
                                    {participantName ? (
                                        <>Configuring voting rights for <strong className="text-slate-800">{participantName}</strong></>
                                    ) : (
                                        'Select which symposia this reviewer can evaluate'
                                    )}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors flex items-center justify-center text-sm font-bold cursor-pointer"
                                title="Close"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Search & Fast Track Toolbar */}
                        <div className="p-3.5 border-b border-slate-150 space-y-3 bg-white shrink-0">
                            {/* Search bar */}
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Search symposia (e.g. A2, Perovskites, B3)..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="w-full h-9 pl-9 pr-8 text-xs rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                                    autoFocus
                                />
                                <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
                                </svg>
                                {search && (
                                    <button 
                                        type="button"
                                        onClick={() => setSearch('')}
                                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 text-xs cursor-pointer font-bold"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>

                            {/* Quick Track Buttons */}
                            <div>
                                <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                    <span>Quick Track Selectors:</span>
                                    <div className="flex items-center gap-2">
                                        <button 
                                            type="button" 
                                            onClick={selectAll} 
                                            className="text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                                        >
                                            Select All
                                        </button>
                                        <span>•</span>
                                        <button 
                                            type="button" 
                                            onClick={clearAll} 
                                            className="text-rose-500 hover:text-rose-700 hover:underline cursor-pointer"
                                        >
                                            Clear All
                                        </button>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {tracks.map(track => {
                                        const trackItems = topicsByTrack[track] || [];
                                        const trackIds = trackItems.map(t => String(t.mongo_id));
                                        const isAllTrackSelected = trackIds.length > 0 && trackIds.every(id => selected.includes(id));
                                        const isPartiallySelected = !isAllTrackSelected && trackIds.some(id => selected.includes(id));

                                        return (
                                            <button
                                                key={track}
                                                type="button"
                                                onClick={() => toggleTrack(track)}
                                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border cursor-pointer ${
                                                    isAllTrackSelected
                                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                                        : isPartiallySelected
                                                        ? 'bg-indigo-50 text-indigo-700 border-indigo-300 ring-1 ring-indigo-300'
                                                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                                                }`}
                                            >
                                                {track}
                                                {isAllTrackSelected && <span className="ml-1 text-[10px]">✓</span>}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Scrollable Symposia List */}
                        <div className="overflow-y-auto p-4 space-y-4 flex-1">
                            {Object.keys(filteredTopicsByTrack).length === 0 ? (
                                <div className="text-center py-12 text-slate-400 text-xs italic">
                                    No matching symposia found for "{search}".
                                </div>
                            ) : (
                                Object.entries(filteredTopicsByTrack).map(([trackName, topics]) => {
                                    const selectedInTrack = topics.filter(t => selected.includes(String(t.mongo_id))).length;
                                    return (
                                        <div key={trackName} className="space-y-1.5">
                                            <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 uppercase tracking-wider px-1">
                                                <span>{trackName}</span>
                                                <span className="text-[10px] text-slate-400 font-semibold normal-case">
                                                    {selectedInTrack} of {topics.length} selected
                                                </span>
                                            </div>
                                            <div className="space-y-1">
                                                {topics.map(topic => {
                                                    const isChecked = selected.includes(String(topic.mongo_id));
                                                    return (
                                                        <label
                                                            key={topic.mongo_id}
                                                            className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                                                                isChecked
                                                                    ? 'bg-indigo-50/80 border-indigo-200 text-slate-900 shadow-2xs ring-1 ring-indigo-500/20'
                                                                    : 'bg-white border-slate-150 hover:bg-slate-50 text-slate-700'
                                                            }`}
                                                        >
                                                            <div className="flex items-center gap-3 min-w-0 pr-3">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isChecked}
                                                                    onChange={() => toggleTopic(topic.mongo_id)}
                                                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer shrink-0"
                                                                />
                                                                {topic.code && (
                                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black shrink-0 font-mono ${
                                                                        isChecked 
                                                                            ? 'bg-indigo-600 text-white' 
                                                                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                                                                    }`}>
                                                                        {topic.code}
                                                                    </span>
                                                                )}
                                                                <span className="text-xs font-medium leading-tight" title={topic.name}>
                                                                    {topic.name}
                                                                </span>
                                                            </div>
                                                            <span className={`text-[10px] font-semibold shrink-0 px-2 py-0.5 rounded-full ${
                                                                topic.poster_count > 0 
                                                                    ? 'bg-slate-100 text-slate-600' 
                                                                    : 'text-slate-350'
                                                            }`}>
                                                                {topic.poster_count} {topic.poster_count === 1 ? 'poster' : 'posters'}
                                                            </span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-3.5 border-t border-slate-150 bg-slate-50/80 flex items-center justify-between gap-3 shrink-0">
                            <div className="text-xs text-slate-600">
                                <strong className="text-slate-900">{selected.length}</strong> symposia selected
                                <span className="text-slate-400 ml-1.5 font-normal">({totalPostersInSelection} posters)</span>
                                {saving && (
                                    <span className="ml-2.5 text-indigo-600 text-[11px] font-semibold animate-pulse">
                                        Saving changes...
                                    </span>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
