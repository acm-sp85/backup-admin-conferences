'use client';

import { useState, useEffect } from 'react';
import { getPostersForConference } from '../actions/posters';
import VoteDetailsModal from './VoteDetailsModal';

export default function VotingResults({ conferences }) {
    const [selectedConference, setSelectedConference] = useState(conferences[0]?.id || '');
    const [posters, setPosters] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedPosterDetails, setSelectedPosterDetails] = useState(null);

    const fetchData = async () => {
        if (!selectedConference) return;
        setLoading(true);
        try {
            const data = await getPostersForConference(selectedConference);
            // Calculate score for sorting
            const processData = data.map(p => {
                let votesCount = 0;
                try {
                    const votes = typeof p.votes_received === 'string' ? JSON.parse(p.votes_received) : (p.votes_received || {});
                    votesCount = Object.keys(votes).length;
                } catch(e) {}
                const points = p.points || 0;
                p.calculatedScore = votesCount > 0 ? (points / votesCount) : 0;
                p.votesCount = votesCount;
                return p;
            });
            // Sort by calculated score descending
            const sortedData = processData.sort((a, b) => b.calculatedScore - a.calculatedScore);
            setPosters(sortedData);
        } catch (err) {
            console.error(err);
        }
        setLoading(false);
    };

    useEffect(() => { fetchData(); }, [selectedConference]);

    return (
        <div className="space-y-3">
            {/* Toolbar - Matches other tabs */}
            <div className="card p-3 flex flex-col md:flex-row gap-3 justify-between items-center">
                <div className="flex gap-2 w-full md:w-auto items-center">
                    <select 
                        value={selectedConference}
                        onChange={(e) => setSelectedConference(e.target.value)}
                        className="input-base font-semibold"
                    >
                        {conferences.map(c => (
                            <option key={c.id} value={c.id}>{c.acronym}</option>
                        ))}
                    </select>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-xs bg-[var(--accent)]/10 px-3 py-1.5 rounded-full text-[var(--muted)]">
                        Total Results: <strong className="text-[var(--foreground)] ml-1">{posters.length}</strong>
                    </div>
                    <button 
                        onClick={fetchData}
                        className="p-1.5 text-[var(--muted)] hover:text-[var(--accent)] transition-colors"
                        title="Refresh Results"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                    </button>
                </div>
            </div>

            {/* Table - Standard Styling */}
            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            <th style={{width: 50}}>Rank</th>
                            <th style={{width: 80}}>Code</th>
                            <th>Poster Details</th>
                            <th style={{width: 100}} className="text-center">Votes</th>
                            <th style={{width: 100}} className="text-center">Score</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="5" className="text-center text-[var(--muted)] py-8 text-xs">Calculating rankings...</td></tr>
                        ) : posters.length === 0 ? (
                            <tr><td colSpan="5" className="text-center text-[var(--muted)] py-8 text-xs">No data available.</td></tr>
                        ) : (
                            posters.map((poster, index) => {
                                const rank = index + 1;
                                const isTopThree = rank <= 3;

                                return (
                                    <tr key={poster.id}>
                                        <td>
                                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs ${
                                                rank === 1 ? 'bg-yellow-100 text-yellow-700' :
                                                rank === 2 ? 'bg-slate-100 text-slate-500' :
                                                rank === 3 ? 'bg-orange-100 text-orange-700' :
                                                'text-[var(--muted)]'
                                            }`}>
                                                {rank}
                                            </div>
                                        </td>
                                        <td>
                                            {poster.code ? (
                                                <span className="badge" style={{background:'var(--accent-light)', color:'var(--accent)', fontFamily:'monospace'}}>
                                                    {poster.code}
                                                </span>
                                            ) : '—'}
                                        </td>
                                        <td className="px-4 py-2">
                                            <div className="font-medium text-[var(--foreground)] leading-tight">{poster.title}</div>
                                            <div className="flex gap-2 mt-1">
                                                <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded uppercase tracking-tighter">
                                                    {poster.cluster_name || 'Unassigned'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="text-center">
                                            <button 
                                                onClick={() => setSelectedPosterDetails(poster)}
                                                className="w-full h-full min-h-[40px] font-bold text-[var(--accent)] hover:bg-[var(--accent-light)] rounded-lg transition-colors underline underline-offset-4 decoration-dotted"
                                            >
                                                {poster.votesCount}
                                            </button>
                                        </td>
                                        <td className="text-center">
                                            <span className="font-black text-[var(--accent)] text-base">
                                                {poster.calculatedScore.toFixed(2)}
                                            </span>
                                            <div className="text-[9px] text-[var(--muted)] mt-0.5">
                                                ({poster.points || 0} pts)
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            <VoteDetailsModal 
                isOpen={!!selectedPosterDetails} 
                poster={selectedPosterDetails}
                onClose={() => setSelectedPosterDetails(null)}
            />
        </div>
    );
}
