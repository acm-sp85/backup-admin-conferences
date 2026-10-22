'use client';

import { useState, useTransition, useEffect } from 'react';
import { updateActiveVotingCluster } from '../actions/conferences';

export default function ActiveVotingDaySelector({ conference, clusters = [], onUpdate }) {
    const [isPending, startTransition] = useTransition();
    const [selectedClusterId, setSelectedClusterId] = useState(conference?.active_voting_cluster_id ?? null);
    const [feedback, setFeedback] = useState('');

    useEffect(() => {
        setSelectedClusterId(conference?.active_voting_cluster_id ?? null);
    }, [conference?.id, conference?.active_voting_cluster_id]);

    if (!conference) return null;

    // Filter clusters to only those belonging to this conference
    const confClusters = clusters.filter(c => Number(c.conference_id) === Number(conference.id));

    // If conference has no clusters, don't clutter the UI
    if (confClusters.length === 0) return null;

    const activeCluster = confClusters.find(c => Number(c.id) === Number(selectedClusterId));

    const handleSelectDay = (clusterId) => {
        if (selectedClusterId === clusterId || isPending) return;

        setSelectedClusterId(clusterId);
        setFeedback('Saving...');

        startTransition(async () => {
            const res = await updateActiveVotingCluster(conference.id, clusterId);
            if (res.success) {
                setFeedback('Saved');
                setTimeout(() => setFeedback(''), 2000);
                if (onUpdate) {
                    onUpdate({
                        ...conference,
                        active_voting_cluster_id: clusterId
                    });
                }
            } else {
                setFeedback('Error');
                setSelectedClusterId(conference.active_voting_cluster_id ?? null);
                setTimeout(() => setFeedback(''), 2500);
            }
        });
    };

    return (
        <div className="card p-3 sm:p-4 bg-white border border-[var(--border)] rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Left: Clear, consistent status */}
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm shrink-0 border border-blue-100">
                    📅
                </div>
                <div>
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider">
                            Active Voting Day ({conference.acronym})
                        </span>
                        {feedback && (
                            <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                {feedback}
                            </span>
                        )}
                    </div>
                    <div className="text-xs text-[var(--foreground)] mt-0.5">
                        Voters currently see:{' '}
                        {activeCluster ? (
                            <strong className="text-blue-600 font-bold ml-1">
                                {activeCluster.name} Posters Only
                            </strong>
                        ) : (
                            <strong className="text-slate-700 font-bold ml-1">
                                All Posters (No Filter)
                            </strong>
                        )}
                    </div>
                </div>
            </div>

            {/* Right: Clean segmented control buttons */}
            <div className="inline-flex items-center p-1 bg-slate-100/80 rounded-xl border border-slate-200/60 gap-1 self-start md:self-auto">
                <button
                    type="button"
                    onClick={() => handleSelectDay(null)}
                    disabled={isPending}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        selectedClusterId === null
                            ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80'
                            : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                    Show All
                </button>

                {confClusters.map((cluster) => {
                    const isSelected = Number(cluster.id) === Number(selectedClusterId);
                    return (
                        <button
                            key={cluster.id}
                            type="button"
                            onClick={() => handleSelectDay(cluster.id)}
                            disabled={isPending}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                isSelected
                                    ? 'bg-blue-600 text-white shadow-sm border border-blue-700'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <span 
                                className="w-2 h-2 rounded-full" 
                                style={{ backgroundColor: isSelected ? '#ffffff' : (cluster.color || '#3b82f6') }}
                            />
                            <span>{cluster.name}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
