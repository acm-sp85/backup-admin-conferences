'use client';

import { useState, useEffect } from 'react';
import { getVotersForConference } from '../actions/participantVoting';

export default function VoterStatusModal({ isOpen, onClose, conferenceId, userRole }) {
    const [voters, setVoters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState('all'); // 'all', 'voted', 'missing'

    useEffect(() => {
        if (isOpen && conferenceId) {
            setLoading(true);
            setSearch('');
            setActiveTab('all');
            getVotersForConference(conferenceId)
                .then(data => {
                    setVoters(data || []);
                    setLoading(false);
                })
                .catch(err => {
                    console.error(err);
                    setLoading(false);
                });
        }
    }, [isOpen, conferenceId]);

    if (!isOpen) return null;

    const totalCount = voters.length;
    const votedCount = voters.filter(v => v.has_voted).length;
    const missingCount = totalCount - votedCount;

    const filteredVoters = voters.filter(v => {
        const matchesSearch = 
            v.name.toLowerCase().includes(search.toLowerCase()) || 
            v.email.toLowerCase().includes(search.toLowerCase());
        
        if (!matchesSearch) return false;

        if (activeTab === 'voted') return v.has_voted;
        if (activeTab === 'missing') return !v.has_voted;
        return true;
    });

    const getInitials = (name) => {
        if (!name) return '?';
        const parts = name.split(' ');
        return parts.map(p => p[0]).join('').substring(0, 2).toUpperCase();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div 
                className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 border-b border-slate-100 shrink-0">
                    <div className="flex justify-between items-start gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-[11px] font-black bg-[var(--accent)] text-white px-2 py-0.5 rounded-md shadow-sm font-mono tracking-tighter uppercase">Voter Turnout</span>
                                <h3 className="text-xl font-black text-slate-900">Participation Analytics</h3>
                            </div>
                            <p className="text-xs text-slate-400 font-medium">Track who has completed their voting and who is still missing.</p>
                        </div>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 bg-slate-50 hover:bg-slate-100 rounded-full transition-all">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                        </button>
                    </div>

                    {/* Stats Row */}
                    <div className="grid grid-cols-3 gap-3 mt-5">
                        <button 
                            onClick={() => setActiveTab('all')} 
                            className={`p-3 rounded-2xl border text-left transition-all ${
                                activeTab === 'all' 
                                ? 'bg-slate-900 border-slate-900 text-white shadow-lg shadow-slate-900/10' 
                                : 'bg-slate-50 hover:bg-slate-100 border-slate-100 text-slate-600'
                            }`}
                        >
                            <div className="text-[9px] font-black uppercase tracking-wider opacity-60">All Voters</div>
                            <div className="text-xl font-black mt-0.5">{totalCount}</div>
                        </button>
                        <button 
                            onClick={() => setActiveTab('voted')} 
                            className={`p-3 rounded-2xl border text-left transition-all ${
                                activeTab === 'voted' 
                                ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-600/10' 
                                : 'bg-emerald-50/50 hover:bg-emerald-50 border-emerald-100/50 text-emerald-700'
                            }`}
                        >
                            <div className="text-[9px] font-black uppercase tracking-wider opacity-85">Voted</div>
                            <div className="text-xl font-black mt-0.5">{votedCount}</div>
                        </button>
                        <button 
                            onClick={() => setActiveTab('missing')} 
                            className={`p-3 rounded-2xl border text-left transition-all ${
                                activeTab === 'missing' 
                                ? 'bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-500/10' 
                                : 'bg-amber-50/50 hover:bg-amber-50 border-amber-100/50 text-amber-700'
                            }`}
                        >
                            <div className="text-[9px] font-black uppercase tracking-wider opacity-85">Missing</div>
                            <div className="text-xl font-black mt-0.5">{missingCount}</div>
                        </button>
                    </div>

                    {/* Search bar */}
                    <div className="relative mt-4">
                        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                        <input
                            type="text"
                            placeholder="Filter voters by name or email..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-semibold focus:outline-none focus:bg-white focus:border-[var(--accent)] transition-all"
                        />
                        {search && (
                            <button onClick={() => setSearch('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase tracking-widest text-[var(--accent)] hover:text-slate-600 transition-colors">
                                Clear
                            </button>
                        )}
                    </div>
                </div>

                {/* Content Area */}
                <div className="overflow-y-auto flex-1 p-6 min-h-[300px]">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
                            <div className="w-8 h-8 border-4 border-slate-200 border-t-[var(--accent)] rounded-full animate-spin"></div>
                            <span className="text-[10px] font-bold uppercase tracking-widest">Compiling Voter Roll...</span>
                        </div>
                    ) : filteredVoters.length === 0 ? (
                        <div className="text-center py-20">
                            <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                <svg width="20" height="20" className="text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
                            </div>
                            <div className="text-slate-400 text-xs italic">No matching voter records found.</div>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredVoters.map((voter) => (
                                <div key={voter.id} className="flex items-center gap-3 p-3 bg-slate-50/50 hover:bg-slate-50 rounded-2xl border border-slate-100/60 transition-all">
                                    {/* Initials Avatar */}
                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shadow-sm text-white shrink-0 ${
                                        voter.has_voted 
                                        ? 'bg-gradient-to-tr from-emerald-600 to-teal-500' 
                                        : 'bg-gradient-to-tr from-slate-400 to-slate-500'
                                    }`}>
                                        {getInitials(voter.name)}
                                    </div>

                                    {/* Voter Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold text-xs text-slate-900 truncate">{voter.name}</div>
                                        <div className="text-[10px] text-slate-400 truncate mt-0.5">{voter.email}</div>
                                    </div>

                                    {/* Badge Status */}
                                    <div className="shrink-0 flex items-center gap-2">
                                        <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                            voter.has_voted 
                                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                                            : 'bg-amber-50 text-amber-600 border border-amber-100'
                                        }`}>
                                            {voter.has_voted ? (
                                                <>
                                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                                                    Voted
                                                </>
                                            ) : (
                                                <>
                                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                                    Missing
                                                </>
                                            )}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-50 border-t border-slate-100 text-center shrink-0">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Authorized Voter Audit System • Smart Conference Admin</span>
                </div>
            </div>
        </div>
    );
}
