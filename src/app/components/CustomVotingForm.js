'use client';

import { useState, useTransition, useEffect } from 'react';
import { submitCustomVotes } from '../actions/customVoting';

export default function CustomVotingForm({ activeGroups, items, initialVotes, userId, conferenceId, conferenceEmail, hasVoted = false, votingValidationEnabled = true }) {
  const [votes, setVotes] = useState(initialVotes || {});
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [isTocExpanded, setIsTocExpanded] = useState(false);

  useEffect(() => {
    setIsTocExpanded(false);
  }, [selectedItem]);

  // Parse authors helper
  const getAuthors = (item) => {
    if (!item.authors) return [];
    try {
      return typeof item.authors === 'string' ? JSON.parse(item.authors) : item.authors;
    } catch(e) { return []; }
  };

  // Group items by custom voting group
  const itemsByGroup = items.reduce((acc, item) => {
    if (!acc[item.group_id]) acc[item.group_id] = [];
    acc[item.group_id].push(item);
    return acc;
  }, {});

  const [missingItemIds, setMissingItemIds] = useState([]);

  const handleVoteChange = (itemId, value) => {
    if (hasVoted) return; // Prevent changes if already voted
    setVotes(prev => ({
      ...prev,
      [itemId]: parseInt(value)
    }));
    // Remove from missing if it was there
    if (missingItemIds.includes(itemId)) {
      setMissingItemIds(prev => prev.filter(id => id !== itemId));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (hasVoted) return;
    setError('');
    setSuccess('');
    setMissingItemIds([]);

    startTransition(async () => {
      const res = await submitCustomVotes(userId, votes, conferenceId);
      if (res.error) {
        setError(res.error);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setSuccess('Votes submitted successfully!');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <div className="p-3 bg-[#fff5f5] text-[#ff3b30] text-xs font-semibold rounded-xl border border-[#ff3b30]/10">{error}</div>}
      {success && <div className="p-3 bg-[#e8faf0] text-[#34c759] text-xs font-semibold rounded-xl border border-[#34c759]/10">{success}</div>}

      {!!hasVoted && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col items-center text-center gap-2 mt-4">
          <div className="w-8 h-8 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center">
             <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <div className="text-[13px] font-bold text-amber-900">Votes Locked</div>
          <p className="text-[11px] text-amber-700 max-w-[280px]">
            Your submission is final. If you need to make amendments, please contact the organizers at:
            <a href={`mailto:${conferenceEmail}`} className="block mt-1 font-bold text-amber-900 underline underline-offset-2">
              {conferenceEmail}
            </a>
          </p>
        </div>
      )}

      {activeGroups.map(group => {
        const groupItems = itemsByGroup[group.id] || [];
        if (groupItems.length === 0) return null;
        
        return (
          <div key={group.id} className="space-y-4">
            <div className="flex items-center gap-2 px-1">
                <div className="w-1 h-4 rounded-full" style={{backgroundColor: group.color}}></div>
                <h3 className="font-bold text-[13px] text-[var(--foreground)] uppercase tracking-tight">
                    {group.name}
                </h3>
            </div>
            
            <div className="space-y-3">
              {groupItems.map(item => {
                const currentVote = votes[item.slot_id] || 0;
                const isMissing = missingItemIds.includes(item.slot_id);

                return (
                  <div key={item.slot_id} className={`card overflow-hidden flex flex-col transition-all ${isMissing ? 'ring-2 ring-[#ff3b30] shadow-[0_0_15px_rgba(255,59,48,0.2)]' : ''}`}>
                    <div className="p-4 cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => setSelectedItem(item)}>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex-1">
                            <div className="text-[10px] font-bold text-indigo-600 mb-1 uppercase tracking-wide flex items-center justify-between">
                                <span>{item.session_name}</span>
                                {item.content && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded flex items-center gap-1">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                    View Abstract
                                </span>}
                            </div>
                            <h4 className="font-bold text-[14px] text-[var(--foreground)] leading-tight mb-2 hover:text-[var(--accent)] transition-colors">
                                {item.title}
                            </h4>
                            <p className="text-[11px] text-[var(--muted)] font-medium">
                                {item.presenter_name || 'Presenter TBA'}
                            </p>
                        </div>
                      </div>
                    </div>

                    <div className="p-2 sm:p-4 pt-0 space-y-2 border-t border-[var(--border)] mt-2 bg-slate-50/50">
                        <div className="flex justify-between items-center pt-3">
                            <span className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">Your Score</span>
                            <span className={`text-[12px] font-bold ${currentVote > 0 ? 'text-[var(--accent)]' : 'text-[var(--muted)]'}`}>
                                {currentVote > 0 ? currentVote : 'Not Rated'}
                            </span>
                        </div>
                        <div className="grid grid-cols-10 gap-0.5 pt-3">
                            {[1,2,3,4,5,6,7,8,9,10].map(n => (
                                <button
                                    key={n}
                                    type="button"
                                    onClick={() => handleVoteChange(item.slot_id, n)}
                                    className={`h-9 rounded-lg text-[11px] font-bold transition-all border flex items-center justify-center ${
                                        currentVote === n 
                                        ? 'bg-[var(--accent)] border-[var(--accent)] text-white shadow-sm scale-110 z-10' 
                                        : 'bg-white border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
                                    }`}
                                >
                                    {n}
                                </button>
                            ))}
                        </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {!hasVoted && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-[var(--border)] z-40">
          <div className="max-w-[500px] mx-auto">
              <button 
                  type="submit" 
                  disabled={isPending}
                  className="w-full bg-[var(--accent)] text-white h-12 rounded-xl font-bold shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                  {isPending ? 'Saving...' : 'Submit All Votes'}
              </button>
          </div>
        </div>
      )}

      {/* Presentation Content Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedItem(null)}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 border-b border-[var(--border)] bg-slate-50">
                    <div>
                        <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-1">{selectedItem.session_name}</div>
                        <h2 className="font-bold text-sm text-[var(--foreground)] leading-tight">Presentation Details</h2>
                    </div>
                    <button 
                        onClick={() => setSelectedItem(null)}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors"
                        type="button"
                    >
                        ×
                    </button>
                </div>
                
                <div className="p-6 overflow-y-auto custom-scrollbar">
                    <h3 className="font-extrabold text-[18px] text-[var(--foreground)] leading-snug mb-4">
                        {selectedItem.title}
                    </h3>

                    {getAuthors(selectedItem).length > 0 && (
                        <div className="mb-6 pb-6 border-b border-slate-100">
                            <div className="text-[13px] text-slate-700 leading-relaxed">
                                {getAuthors(selectedItem).map((a, i) => (
                                    <span key={i} className={a.presenting ? 'font-bold underline underline-offset-2' : ''}>
                                        {a.firstName} {a.lastName}{i < getAuthors(selectedItem).length - 1 ? ', ' : ''}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {selectedItem.toc && selectedItem.toc !== 'null' && (
                        <div className="mb-6">
                            <label className="block text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest mb-2">Graphical Abstract</label>
                            <div 
                                className="relative rounded-xl border border-[var(--border)] bg-slate-50 overflow-hidden cursor-zoom-in group"
                                onClick={() => setIsTocExpanded(true)}
                            >
                                <img 
                                    src={`${selectedItem.base_url || 'https://www.nanoge.org/static/abstracts/'}${selectedItem.toc}`}
                                    alt="Graphical Abstract"
                                    className="w-full object-contain max-h-[300px]"
                                    onError={(e) => {
                                        e.target.style.display = 'none';
                                        e.target.parentElement.innerHTML = '<div class="flex items-center justify-center py-12 text-[10px] text-slate-400">Preview Unavailable</div>';
                                    }}
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-center">
                                    <span className="bg-white/90 backdrop-blur text-slate-700 text-[10px] font-bold px-3 py-1.5 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0">
                                        Click to expand
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {selectedItem.content ? (
                        <div 
                            className="prose prose-sm prose-slate max-w-none prose-p:leading-relaxed prose-headings:font-bold prose-a:text-indigo-600"
                            dangerouslySetInnerHTML={{ __html: selectedItem.content }} 
                        />
                    ) : (
                        <div className="py-12 text-center text-slate-400 text-sm">
                            No abstract content available.
                        </div>
                    )}
                </div>
                
                <div className="p-4 border-t border-[var(--border)] bg-slate-50 flex justify-end">
                    <button 
                        type="button"
                        onClick={() => setSelectedItem(null)}
                        className="px-6 py-2 bg-slate-200 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-300 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Full Screen TOC Overlay */}
      {isTocExpanded && selectedItem && selectedItem.toc && (
        <div 
            className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8"
            onClick={() => setIsTocExpanded(false)}
        >
            <button 
                className="absolute top-6 right-6 w-10 h-10 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-colors border border-white/20"
                onClick={(e) => { e.stopPropagation(); setIsTocExpanded(false); }}
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
            <div className="relative w-full max-w-5xl max-h-full flex items-center justify-center" onClick={e => e.stopPropagation()}>
                <img 
                    src={`${selectedItem.base_url || 'https://www.nanoge.org/static/abstracts/'}${selectedItem.toc}`} 
                    alt="Graphical Abstract Full" 
                    className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
                    onError={(e) => {
                      e.target.parentElement.innerHTML = '<div class="text-white text-sm">Image could not be loaded directly.</div>';
                    }}
                />
            </div>
        </div>
      )}
    </form>
  );
}
