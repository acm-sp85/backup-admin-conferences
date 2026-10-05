'use client';

import { useState, useEffect } from 'react';
import { getTopics } from '../actions/program';

export default function TopicsManager({ conferences }) {
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

    const [topics, setTopics] = useState([]);
    const [loading, setLoading] = useState(false);

    const handleConferenceChange = (id) => {
        setSelectedConfId(id);
        const acronym = conferences.find(c => c.id == id)?.acronym;
        if (acronym) {
            document.cookie = `last_conference=${acronym}; path=/; max-age=31536000`;
        }
    };

    useEffect(() => {
        if (selectedConfId) {
            loadData();
        }
    }, [selectedConfId]);

    async function loadData() {
        setLoading(true);
        try {
            const data = await getTopics(selectedConfId);
            setTopics(data);
        } catch (error) {
            console.error('Error loading topics:', error);
        } finally {
            setLoading(false);
        }
    }

    // Build tree
    const rootTopics = topics.filter(t => !t.parent_mongo_id);
    const subTopicsByParent = topics.reduce((acc, t) => {
        if (t.parent_mongo_id) {
            if (!acc[t.parent_mongo_id]) acc[t.parent_mongo_id] = [];
            acc[t.parent_mongo_id].push(t);
        }
        return acc;
    }, {});

    return (
        <div className="space-y-6">
            {/* Top Bar */}
            <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
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
                        Total Main Topics: <strong className="text-[var(--foreground)] ml-1">{rootTopics.length}</strong>
                    </div>
                )}
            </div>

            {loading ? (
                <div className="text-center py-20 text-slate-400">Loading topics data...</div>
            ) : topics.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300 text-slate-400">
                    No topics found. Have you synced the topics collection?
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-6">
                    <ul className="space-y-6">
                        {rootTopics.map(topic => (
                            <li key={topic.id} className="relative">
                                <div className="flex items-center gap-3">
                                    <div className="w-2.5 h-2.5 rounded-sm bg-blue-600"></div>
                                    <span className="font-semibold text-slate-800 text-lg">{topic.name}</span>
                                </div>
                                {subTopicsByParent[topic.mongo_id] && subTopicsByParent[topic.mongo_id].length > 0 && (
                                    <ul className="mt-4 ml-[4px] pl-7 border-l-2 border-slate-100 space-y-4">
                                        {subTopicsByParent[topic.mongo_id].map(sub => (
                                            <li key={sub.id} className="flex items-center gap-3 relative before:content-[''] before:absolute before:w-5 before:h-[2px] before:bg-slate-100 before:-left-7">
                                                <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div>
                                                <span className="text-slate-600 text-[15px]">{sub.name}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
