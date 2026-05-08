'use client';

import { useState, useEffect } from 'react';
import { getPostersForConference, getClustersForConference, updatePosterCluster, bulkUpdatePosterClusters } from '../actions/posters';
import ClusterManager from './ClusterManager';

export default function PosterManager({ conferences, selectedConference, onConferenceChange }) {
    const [posters, setPosters] = useState([]);
    const [clusters, setClusters] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [selectedPosterIds, setSelectedPosterIds] = useState([]);
    const [bulkClusterId, setBulkClusterId] = useState('');
    const [isBulkUpdating, setIsBulkUpdating] = useState(false);
    const [sortConfig, setSortConfig] = useState({ key: 'code', direction: 'asc' });

    const [selectedPoster, setSelectedPoster] = useState(null);

    const fetchData = async () => {
        if (!selectedConference) return;
        setLoading(true);
        try {
            const [postersData, clustersData] = await Promise.all([
                getPostersForConference(selectedConference),
                getClustersForConference(selectedConference)
            ]);
            setPosters(postersData);
            setClusters(clustersData);
            setSelectedPosterIds([]); // Reset selection on data change
        } catch (err) {
            console.error(err);
        }
        setLoading(false);
    };

    useEffect(() => { fetchData(); }, [selectedConference]);

    const handleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const handleClusterChange = async (posterId, clusterId) => {
        // Optimistic Update: Update local state immediately
        const selectedCluster = clusters.find(c => c.id == clusterId);
        setPosters(prev => prev.map(p => 
            p.id === posterId 
            ? { ...p, cluster_id: clusterId, cluster_color: selectedCluster?.color, cluster_name: selectedCluster?.name } 
            : p
        ));

        // Background Update
        const res = await updatePosterCluster(posterId, clusterId);
        if (!res.success) {
            fetchData();
            alert('Failed to save cluster change: ' + res.error);
        }
    };

    const handleBulkClusterChange = async () => {
        if (!bulkClusterId) return;
        setIsBulkUpdating(true);
        
        const finalClusterId = bulkClusterId === 'unassign' ? null : bulkClusterId;
        const res = await bulkUpdatePosterClusters(selectedPosterIds, finalClusterId);
        if (res.success) {
            await fetchData();
            setBulkClusterId('');
            setSelectedPosterIds([]);
        } else {
            alert('Bulk update failed: ' + res.error);
        }
        setIsBulkUpdating(false);
    };

    const togglePosterSelection = (id) => {
        setSelectedPosterIds(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const toggleAllSelection = () => {
        if (selectedPosterIds.length === sortedPosters.length) {
            setSelectedPosterIds([]);
        } else {
            setSelectedPosterIds(sortedPosters.map(p => p.id));
        }
    };

    const filteredPosters = posters.filter(p => 
        p.title.toLowerCase().includes(search.toLowerCase()) || 
        (p.code && p.code.toLowerCase().includes(search.toLowerCase()))
    );

    const sortedPosters = [...filteredPosters].sort((a, b) => {
        let aVal = a[sortConfig.key] || '';
        let bVal = b[sortConfig.key] || '';
        
        if (sortConfig.key === 'cluster_name') {
            aVal = clusters.find(c => c.id == a.cluster_id)?.name || '';
            bVal = clusters.find(c => c.id == b.cluster_id)?.name || '';
        }

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

    const SortIcon = ({ column }) => {
        if (sortConfig.key !== column) return <span className="opacity-100 ml-1 text-[10px]">↕</span>;
        return <span className="ml-1 text-[var(--accent)] text-[10px]">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
    };

    return (
        <div className="space-y-3 relative pb-20">
            {/* Toolbar */}
            <div className="card p-3 flex flex-col md:flex-row gap-3 justify-between items-center">
                <div className="flex gap-2 w-full md:w-auto items-center">
                    <select 
                        value={selectedConference}
                        onChange={(e) => onConferenceChange(e.target.value)}
                        className="input-base font-semibold"
                    >
                        {conferences.map(c => (
                            <option key={c.id} value={c.id}>{c.acronym}</option>
                        ))}
                    </select>
                    <input 
                        type="text"
                        placeholder="Search posters..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="input-base flex-1 min-w-[200px]"
                    />
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-xs bg-[var(--accent)]/10 px-3 py-1.5 rounded-full text-[var(--muted)]">
                        Total Results: <strong className="text-[var(--foreground)] ml-1">{filteredPosters.length}</strong>
                    </div>
                    <ClusterManager conferenceId={selectedConference} clusters={clusters} onUpdate={fetchData} />
                </div>
            </div>

            {/* Table */}
            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            <th style={{width: 40}}>
                                <input 
                                    type="checkbox" 
                                    checked={selectedPosterIds.length > 0 && selectedPosterIds.length === sortedPosters.length}
                                    onChange={toggleAllSelection}
                                    className="w-4 h-4 rounded border-slate-300 text-[var(--accent)] focus:ring-[var(--accent)]"
                                />
                            </th>
                            <th 
                                style={{width:90}} 
                                className="cursor-pointer hover:bg-slate-50 transition-colors"
                                onClick={() => handleSort('code')}
                            >
                                Code <SortIcon column="code" />
                            </th>
                            <th 
                                className="cursor-pointer hover:bg-slate-50 transition-colors"
                                onClick={() => handleSort('title')}
                            >
                                Poster Details <SortIcon column="title" />
                            </th>
                            <th 
                                style={{width:160}}
                                className="cursor-pointer hover:bg-slate-50 transition-colors"
                                onClick={() => handleSort('cluster_name')}
                            >
                                Cluster <SortIcon column="cluster_name" />
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="4" className="text-center text-[var(--muted)] py-8 text-xs">Loading...</td></tr>
                        ) : sortedPosters.length === 0 ? (
                            <tr><td colSpan="4" className="text-center text-[var(--muted)] py-8 text-xs">No posters found.</td></tr>
                        ) : (
                            sortedPosters.map(poster => (
                                <tr key={poster.id} className={selectedPosterIds.includes(poster.id) ? 'bg-blue-50/30' : ''}>
                                    <td>
                                        <input 
                                            type="checkbox" 
                                            checked={selectedPosterIds.includes(poster.id)}
                                            onChange={() => togglePosterSelection(poster.id)}
                                            className="w-4 h-4 rounded border-slate-300 text-[var(--accent)] focus:ring-[var(--accent)]"
                                        />
                                    </td>
                                    <td className="cursor-pointer" onClick={() => setSelectedPoster(poster)}>
                                        <span className="badge" style={{background:'var(--accent-light)', color:'var(--accent)', fontFamily:'monospace'}}>
                                            {poster.code || '—'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2 cursor-pointer group" onClick={() => setSelectedPoster(poster)}>
                                        <div className="font-medium text-[var(--foreground)] leading-tight group-hover:text-[var(--accent)] transition-colors">{poster.title}</div>
                                        <div className="text-[10px] text-[var(--muted)] mt-0.5">ID: {poster.id}</div>
                                        {poster.content && (
                                            <div className="text-[9px] text-slate-400 mt-1 line-clamp-1 italic">
                                                {poster.content.replace(/<[^>]*>?/gm, '').substring(0, 100)}...
                                            </div>
                                        )}
                                    </td>
                                    <td>
                                        <select 
                                            value={poster.cluster_id || ''}
                                            onChange={(e) => handleClusterChange(poster.id, e.target.value)}
                                            className="input-base w-full"
                                            style={poster.cluster_id ? {background: poster.cluster_color || 'var(--accent)', color:'#fff', borderColor: poster.cluster_color || 'var(--accent)'} : {}}
                                        >
                                            <option value="">Unassigned</option>
                                            {clusters.map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Bulk Actions Toolbar */}
            {selectedPosterIds.length > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-4 duration-300">
                    <div className="bg-slate-900 text-white rounded-2xl shadow-2xl p-4 flex items-center gap-6 border border-slate-800 backdrop-blur-md bg-opacity-90">
                        <div className="flex items-center gap-3 pr-6 border-r border-slate-700">
                            <div className="w-8 h-8 rounded-full bg-[var(--accent)] flex items-center justify-center text-xs font-bold">
                                {selectedPosterIds.length}
                            </div>
                            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Selected</div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Assign Cluster:</div>
                            <select 
                                value={bulkClusterId}
                                onChange={(e) => setBulkClusterId(e.target.value)}
                                className="bg-slate-800 border-slate-700 text-white rounded-lg text-xs px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--accent)] min-w-[160px]"
                            >
                                <option value="">Select Cluster...</option>
                                <option value="unassign">Unassign All</option>
                                {clusters.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                            <button 
                                onClick={handleBulkClusterChange}
                                disabled={!bulkClusterId || isBulkUpdating}
                                className="bg-[var(--accent)] hover:bg-blue-600 disabled:opacity-50 text-white px-6 py-2 rounded-lg text-xs font-bold transition-all active:scale-95"
                            >
                                {isBulkUpdating ? 'Applying...' : 'Apply to Selection'}
                            </button>
                            <button 
                                onClick={() => setSelectedPosterIds([])}
                                className="text-slate-400 hover:text-white px-2 py-2 transition-colors"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Details Modal */}
            {selectedPoster && (
                <div 
                    className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
                    onClick={() => setSelectedPoster(null)}
                >
                    <div 
                        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
                            <div className="flex items-center gap-3">
                                {selectedPoster.code && (
                                    <span className="badge" style={{background:'var(--accent-light)', color:'var(--accent)', fontFamily:'monospace'}}>
                                        {selectedPoster.code}
                                    </span>
                                )}
                                <h3 className="text-sm font-semibold text-[var(--foreground)]">Poster Details</h3>
                            </div>
                            <button 
                                onClick={() => setSelectedPoster(null)}
                                className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors p-1"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="px-6 py-6 overflow-y-auto space-y-6">
                            <div>
                                <label className="block text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest mb-2">Title</label>
                                <h2 className="text-lg font-semibold text-[var(--foreground)] leading-tight">
                                    {selectedPoster.title}
                                </h2>
                            </div>

                            {selectedPoster.authors && (
                                <div>
                                    <label className="block text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest mb-2">Authors</label>
                                    <div className="flex flex-wrap gap-1.5">
                                        {(() => {
                                            try {
                                                const authors = typeof selectedPoster.authors === 'string' ? JSON.parse(selectedPoster.authors) : selectedPoster.authors;
                                                return Array.isArray(authors) ? authors.map((a, i) => (
                                                    <span key={i} className="px-2 py-1 bg-slate-50 border border-slate-100 rounded text-[11px] text-slate-600">
                                                        {typeof a === 'string' ? a : `${a.firstName || ''} ${a.lastName || ''}`.trim() || a.name || 'Unknown Author'}
                                                    </span>
                                                )) : <span className="text-xs text-slate-500 italic">No authors listed</span>;
                                            } catch (e) {
                                                return <span className="text-xs text-slate-500 italic">Error parsing authors</span>;
                                            }
                                        })()}
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest mb-2">Abstract / Content</label>
                                <div 
                                    className="text-xs text-slate-600 leading-relaxed html-content bg-slate-50 p-4 rounded-lg border border-slate-100"
                                    dangerouslySetInnerHTML={{ __html: selectedPoster.content || '<span class="italic opacity-50">No content available</span>' }}
                                />
                            </div>

                            <div className="flex gap-6 border-t border-slate-100 pt-4 mt-2">
                                <div>
                                    <label className="block text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest mb-1">Internal ID</label>
                                    <code className="text-[10px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">{selectedPoster.id}</code>
                                </div>
                                {selectedPoster.mongo_id && (
                                    <div>
                                        <label className="block text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest mb-1">Source ID (Mongo)</label>
                                        <code className="text-[10px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">{selectedPoster.mongo_id}</code>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 border-t border-[var(--border)] bg-[#fafafa] flex justify-end">
                            <button 
                                onClick={() => setSelectedPoster(null)} 
                                className="btn-primary"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
