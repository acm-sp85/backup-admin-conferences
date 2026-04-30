'use client';

import { useState, useEffect } from 'react';
import { getVoteDetails } from '../actions/results';

export default function VoteDetailsModal({ isOpen, onClose, poster }) {
    const [details, setDetails] = useState([]);
    const [loading, setLoading] = useState(true);
    const [debug, setDebug] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen && poster) {
            setLoading(true);
            setDebug('');
            setError('');
            getVoteDetails(poster.id).then(res => {
                if (res.error) {
                    setError(res.error);
                } else if (res.success) {
                    setDetails(res.details);
                    if (res.debug) setDebug(res.debug);
                }
                setLoading(false);
            });
        }
    }, [isOpen, poster]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div 
                className="bg-white w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-6 border-b border-slate-100 shrink-0">
                    <div className="flex justify-between items-start gap-4">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded uppercase">{poster?.code}</span>
                                <h3 className="text-lg font-bold text-slate-900 truncate">Vote Accountability</h3>
                            </div>
                            <p className="text-[11px] text-slate-400 font-medium truncate">{poster?.title}</p>
                        </div>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                        </button>
                    </div>
                </div>

                <div className="overflow-y-auto flex-1 p-6">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
                            <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin"></div>
                            <span className="text-xs font-bold uppercase tracking-widest">Loading Identities...</span>
                        </div>
                    ) : error ? (
                        <div className="text-center py-20">
                            <div className="text-red-500 text-xs font-bold mb-2 flex items-center justify-center gap-2">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                Connection Error
                            </div>
                            <div className="text-slate-500 text-[10px] bg-red-50 p-4 rounded-2xl border border-red-100 font-mono break-all">{error}</div>
                        </div>
                    ) : details.length === 0 ? (
                        <div className="text-center py-20">
                            <div className="text-slate-400 text-xs italic mb-4">No individual vote records found.</div>
                            {debug && (
                                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-[10px] font-mono text-slate-500 text-left break-all">
                                    <div className="font-bold text-slate-400 mb-1 uppercase tracking-widest">Debug Info:</div>
                                    {debug}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {details.map((vote, i) => (
                                <div key={i} className="flex items-center gap-4 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                                    <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-lg font-black text-blue-600 shadow-sm shrink-0">
                                        {vote.value}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-sm text-slate-900 truncate">{vote.voter.name}</span>
                                            <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${
                                                vote.voter.type === 'admin' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'
                                            }`}>
                                                {vote.voter.type}
                                            </span>
                                        </div>
                                        <div className="text-[10px] text-slate-400 truncate">{vote.voter.email}</div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Recorded</div>
                                        <div className="text-[10px] font-medium text-slate-600">
                                            {new Date(vote.timestamp).toLocaleDateString()}
                                            <span className="block opacity-50 text-[9px]">{new Date(vote.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-100 text-center shrink-0">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Integrity Report • SCITO Admin</span>
                </div>
            </div>
        </div>
    );
}
