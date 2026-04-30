'use client';

import { useState } from 'react';
import { createCluster, updateCluster, deleteCluster } from '../actions/posters';

export default function ClusterManager({ conferenceId, clusters, onUpdate }) {
    const [open, setOpen] = useState(false);
    const [newClusterName, setNewClusterName] = useState('');
    const [newClusterColor, setNewClusterColor] = useState('#0071e3');
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState('');
    const [editColor, setEditColor] = useState('#0071e3');
    const [loading, setLoading] = useState(false);

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!newClusterName.trim()) return;
        setLoading(true);
        const res = await createCluster(conferenceId, newClusterName, newClusterColor);
        if (res.success) { setNewClusterName(''); onUpdate(); }
        else alert(res.error);
        setLoading(false);
    };

    const handleUpdate = async (id) => {
        setLoading(true);
        const res = await updateCluster(id, editName, editColor);
        if (res.success) { setEditingId(null); onUpdate(); }
        else alert(res.error);
        setLoading(false);
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete this cluster? Posters assigned to it will become unassigned.')) return;
        setLoading(true);
        const res = await deleteCluster(id);
        if (res.success) onUpdate();
        else alert(res.error);
        setLoading(false);
    };

    return (
        <>
            <button 
                onClick={() => setOpen(true)}
                className="btn-primary inline-flex items-center gap-1.5"
                style={{background:'var(--accent)'}}
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                Edit Clusters
            </button>

            {/* Modal Backdrop */}
            {open && (
                <div 
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm"
                    onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
                >
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
                            <h3 className="text-sm font-semibold text-[var(--foreground)]">Manage Clusters</h3>
                            <button 
                                onClick={() => setOpen(false)}
                                className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors p-1"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="px-5 py-4 max-h-[60vh] overflow-y-auto">
                            {/* Add New */}
                            <form onSubmit={handleCreate} className="flex gap-2 mb-5">
                                <input 
                                    type="color"
                                    value={newClusterColor}
                                    onChange={(e) => setNewClusterColor(e.target.value)}
                                    className="w-8 h-8 rounded cursor-pointer border-0 p-0 overflow-hidden bg-transparent"
                                />
                                <input 
                                    type="text" 
                                    placeholder="New cluster name..."
                                    value={newClusterName}
                                    onChange={(e) => setNewClusterName(e.target.value)}
                                    className="input-base flex-1"
                                />
                                <button disabled={loading} className="btn-primary disabled:opacity-50">Add</button>
                            </form>

                            {/* List */}
                            {clusters.length === 0 ? (
                                <p className="text-xs text-[var(--muted)] text-center py-6">No clusters yet. Create one above.</p>
                            ) : (
                                <div className="space-y-1">
                                    {clusters.map(cluster => (
                                        <div key={cluster.id} className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-[var(--bg)] group transition-colors">
                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                                {editingId === cluster.id ? (
                                                    <div className="flex items-center gap-2 w-full">
                                                        <input 
                                                            type="color"
                                                            value={editColor}
                                                            onChange={(e) => setEditColor(e.target.value)}
                                                            className="w-6 h-6 rounded cursor-pointer border-0 p-0 overflow-hidden bg-transparent"
                                                        />
                                                        <input 
                                                            type="text"
                                                            value={editName}
                                                            onChange={(e) => setEditName(e.target.value)}
                                                            onKeyDown={(e) => { 
                                                                if (e.key === 'Enter') handleUpdate(cluster.id);
                                                                if (e.key === 'Escape') setEditingId(null);
                                                            }}
                                                            autoFocus
                                                            className="input-base flex-1"
                                                            style={{borderColor:'var(--accent)'}}
                                                        />
                                                        <button 
                                                            onClick={() => handleUpdate(cluster.id)}
                                                            className="p-1.5 text-[#34c759] hover:bg-[#e8faf0] rounded-md transition-colors"
                                                            title="Save"
                                                        >
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                                        </button>
                                                        <button 
                                                            onClick={() => setEditingId(null)}
                                                            className="p-1.5 text-[var(--muted)] hover:bg-[var(--bg)] rounded-md transition-colors"
                                                            title="Cancel"
                                                        >
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div 
                                                        className="flex items-center gap-2 cursor-pointer flex-1 min-w-0"
                                                        onClick={() => { 
                                                            setEditingId(cluster.id); 
                                                            setEditName(cluster.name); 
                                                            setEditColor(cluster.color || '#0071e3'); 
                                                        }}
                                                    >
                                                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: cluster.color || '#0071e3' }} />
                                                        <span className="text-xs font-medium text-[var(--foreground)] truncate">{cluster.name}</span>
                                                    </div>
                                                )}
                                            </div>

                                            {editingId !== cluster.id && (
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2">
                                                    <button 
                                                        onClick={() => { setEditingId(cluster.id); setEditName(cluster.name); setEditColor(cluster.color || '#0071e3'); }}
                                                        className="p-1.5 rounded text-[var(--muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-light)] transition-colors"
                                                        title="Edit"
                                                    >
                                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDelete(cluster.id)}
                                                        className="p-1.5 rounded text-[var(--muted)] hover:text-[#ff3b30] hover:bg-[#fff5f5] transition-colors"
                                                        title="Delete"
                                                    >
                                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="px-5 py-3 border-t border-[var(--border)] bg-[#fafafa] flex justify-between items-center">
                            <span className="text-[10px] font-medium text-[var(--muted)]">{clusters.length} cluster{clusters.length !== 1 ? 's' : ''}</span>
                            <button 
                                onClick={() => setOpen(false)} 
                                className="btn-primary text-[11px]"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
