'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { updateParticipantClusters } from '../actions/participantVoting';

export default function ParticipantTopicSelect({
    participantId,
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
    const popoverRef = useRef(null);

    useEffect(() => {
        setSelected(parseTopics(currentTopics));
    }, [currentTopics]);

    // Close on click outside
    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (e) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
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
        <div className="relative inline-block text-left" ref={popoverRef}>
            {/* Trigger Button & Preview Badges */}
            <div className="flex items-center gap-1.5 flex-wrap max-w-md">
                {selectedObjects.length === 0 ? (
                    <button
                        type="button"
                        onClick={() => setIsOpen(!isOpen)}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-indigo-600 bg-indigo-50/70 border border-indigo-200/60 hover:bg-indigo-100 hover:border-indigo-300 transition-colors flex items-center gap-1.5"
                    >
                        <span className="text-xs leading-none">+</span>
                        <span>Assign Symposia</span>
                    </button>
                ) : (
                    <>
                        <div className="flex items-center gap-1 flex-wrap">
                            {selectedObjects.slice(0, 6).map(t => (
                                <span
                                    key={t.mongo_id}
                                    title={`${t.name} (${t.poster_count || 0} posters)`}
                                    className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 border border-indigo-200 text-indigo-700 cursor-default hover:bg-indigo-100 transition-colors"
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
                            onClick={() => setIsOpen(!isOpen)}
                            className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                            title="Edit Symposia"
                        >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m18 15-6-6-6 6"/>
                            </svg>
                        </button>
                    </>
                )}
            </div>

            {/* Modal / Popover Selector */}
            {isOpen && (
                <div className="fixed md:absolute z-50 top-1/2 left-1/2 md:top-full md:left-0 md:mt-2 -translate-x-1/2 -translate-y-1/2 md:translate-x-0 md:translate-y-0 w-[92vw] max-w-xl md:w-[460px] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[82vh] animate-in fade-in zoom-in-95 duration-150">
                    
                    {/* Header */}
                    <div className="p-3.5 border-b border-slate-150 bg-slate-50/80 flex items-center justify-between gap-3">
                        <div>
                            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                                Assign Symposia / Topics
                            </h4>
                            <p className="text-[10px] text-slate-500 mt-0.5">
                                Select which symposia this reviewer can evaluate
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors text-xs font-bold"
                        >
                            ✕
                        </button>
                    </div>

                    {/* Search & Fast Track Toolbar */}
                    <div className="p-3 border-b border-slate-150 space-y-2.5 bg-white">
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Search symposia (e.g. A2, Perovskites, B3)..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full h-8 pl-8 pr-3 text-xs rounded-lg border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                            />
                            <svg className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
                            </svg>
                        </div>

                        {/* Quick Track Buttons */}
                        <div>
                            <div className="flex items-center justify-between text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                <span>Quick Track Selectors:</span>
                                <div className="flex items-center gap-2">
                                    <button 
                                        type="button" 
                                        onClick={selectAll} 
                                        className="text-indigo-600 hover:underline cursor-pointer"
                                    >
                                        Select All
                                    </button>
                                    <span>•</span>
                                    <button 
                                        type="button" 
                                        onClick={clearAll} 
                                        className="text-rose-500 hover:underline cursor-pointer"
                                    >
                                        Clear
                                    </button>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-1">
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
                                            className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all border cursor-pointer ${
                                                isAllTrackSelected
                                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                                    : isPartiallySelected
                                                    ? 'bg-indigo-50 text-indigo-700 border-indigo-300 ring-1 ring-indigo-300'
                                                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                                            }`}
                                        >
                                            {track}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Scrollable Symposia List */}
                    <div className="overflow-y-auto p-3 space-y-3 flex-1 max-h-[380px]">
                        {Object.keys(filteredTopicsByTrack).length === 0 ? (
                            <div className="text-center py-8 text-slate-400 text-xs italic">
                                No matching symposia found.
                            </div>
                        ) : (
                            Object.entries(filteredTopicsByTrack).map(([trackName, topics]) => (
                                <div key={trackName} className="space-y-1.5">
                                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1">
                                        <span>{trackName}</span>
                                        <span className="text-[9px] text-slate-400 font-normal">
                                            {topics.filter(t => selected.includes(String(t.mongo_id))).length} / {topics.length} selected
                                        </span>
                                    </div>
                                    <div className="space-y-1">
                                        {topics.map(topic => {
                                            const isChecked = selected.includes(String(topic.mongo_id));
                                            return (
                                                <label
                                                    key={topic.mongo_id}
                                                    className={`w-full flex items-center justify-between p-2 rounded-xl border text-left cursor-pointer transition-colors ${
                                                        isChecked
                                                            ? 'bg-indigo-50/70 border-indigo-200 text-slate-900 shadow-sm'
                                                            : 'bg-white border-slate-100 hover:bg-slate-50 text-slate-700'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                                        <input
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            onChange={() => toggleTopic(topic.mongo_id)}
                                                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                                                        />
                                                        {topic.code && (
                                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                                                                isChecked ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                                                            }`}>
                                                                {topic.code}
                                                            </span>
                                                        )}
                                                        <span className="text-[11px] font-medium truncate" title={topic.name}>
                                                            {topic.name}
                                                        </span>
                                                    </div>
                                                    <span className={`text-[10px] font-semibold shrink-0 px-1.5 py-0.5 rounded-full ${
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
                            ))
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-3 border-t border-slate-150 bg-slate-50/80 flex items-center justify-between gap-3">
                        <div className="text-[11px] text-slate-600">
                            <strong>{selected.length}</strong> symposia selected
                            <span className="text-slate-400 ml-1">({totalPostersInSelection} posters)</span>
                            {saving && (
                                <span className="ml-2 text-indigo-600 text-[10px] font-semibold animate-pulse">
                                    Saving...
                                </span>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors cursor-pointer"
                        >
                            Done
                        </button>
                    </div>

                </div>
            )}
        </div>
    );
}
