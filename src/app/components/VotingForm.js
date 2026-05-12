'use client';

import { useState, useTransition, useEffect } from 'react';
import { submitVotes } from '../actions/voting';

export default function VotingForm({ activeClusters, posters, initialVotes, userId, conferenceId, conferenceEmail, isParticipant = false, hasVoted = false, votingValidationEnabled = true }) {
  const [votes, setVotes] = useState(initialVotes || {});
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Group posters by cluster
  const postersByCluster = posters.reduce((acc, poster) => {
    if (!acc[poster.cluster_id]) acc[poster.cluster_id] = [];
    acc[poster.cluster_id].push(poster);
    return acc;
  }, {});

  const [missingPosterIds, setMissingPosterIds] = useState([]);
  const [selectedPoster, setSelectedPoster] = useState(null);
  const [isTocExpanded, setIsTocExpanded] = useState(false);

  useEffect(() => {
    setIsTocExpanded(false);
  }, [selectedPoster]);

  const handleVoteChange = (posterId, value) => {
    if (hasVoted) return; // Prevent changes if already voted
    setVotes(prev => ({
      ...prev,
      [posterId]: parseInt(value)
    }));
    // Remove from missing if it was there
    if (missingPosterIds.includes(posterId)) {
      setMissingPosterIds(prev => prev.filter(id => id !== posterId));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (hasVoted) return;
    setError('');
    setSuccess('');
    setMissingPosterIds([]);

    // Only validate that all posters are rated if the conference requires it
    if (votingValidationEnabled) {
        const missing = posters.filter(p => !votes[p.id]).map(p => p.id);
        if (missing.length > 0) {
            setMissingPosterIds(missing);
            setError(`Please submit a vote for all posters. You have ${missing.length} poster(s) left to rate.`);
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }
    }
    
    startTransition(async () => {
      const res = await submitVotes(userId, votes, isParticipant, conferenceId);
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

      {activeClusters.map(cluster => {
        const clusterPosters = postersByCluster[cluster.id] || [];
        
        return (
          <div key={cluster.id} className="space-y-4">
            <div className="flex items-center gap-2 px-1">
                <div className="w-1 h-4 bg-[var(--accent)] rounded-full"></div>
                <h3 className="font-bold text-[13px] text-[var(--foreground)] uppercase tracking-tight">
                    {cluster.conference_acronym} • {cluster.name}
                </h3>
            </div>
            
            <div className="space-y-3">
              {clusterPosters.map(poster => {
                const authorArray = (() => {
                  try {
                    return typeof poster.authors === 'string' ? JSON.parse(poster.authors) : poster.authors;
                  } catch(e) { return []; }
                })();
                
                const currentVote = votes[poster.id] || 0;
                const isMissing = missingPosterIds.includes(poster.id);

                return (
                  <div key={poster.id} className={`card overflow-hidden flex flex-col transition-all ${isMissing ? 'ring-2 ring-[#ff3b30] shadow-[0_0_15px_rgba(255,59,48,0.2)]' : ''}`}>
                    <div 
                        className="p-4 cursor-pointer hover:bg-slate-50/50 transition-colors active:bg-slate-100"
                        onClick={() => setSelectedPoster(poster)}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className="font-bold text-[14px] text-[var(--foreground)] leading-tight flex-1">
                          {poster.title}
                        </h4>
                        {poster.code && (
                          <span className="text-[11px] font-black bg-slate-900 text-white px-2 py-0.5 rounded-md shadow-sm font-mono tracking-tighter">
                            {poster.code}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[var(--muted)] line-clamp-1 mb-2">
                        {Array.isArray(authorArray) 
                          ? authorArray.map(a => [a.firstName, a.lastName].filter(Boolean).join(' ') || a.name || a.author_name).filter(Boolean).join(', ') 
                          : poster.authors}
                      </p>
                      <div className="text-[10px] font-bold text-[var(--accent)] uppercase tracking-widest opacity-60 text-center">
                        — tap for details —
                      </div>
                    </div>

                    <div className="p-2 sm:p-4 pt-0 space-y-2 border-t border-[var(--border)] mt-2">
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
                                    onClick={() => handleVoteChange(poster.id, n)}
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
              
              {clusterPosters.length === 0 && (
                <div className="p-8 text-center text-[var(--muted)] text-xs bg-white/50 rounded-2xl border border-dashed border-[var(--border)]">
                  No posters found for this conference.
                </div>
              )}
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

      {/* Details Modal */}
      {selectedPoster && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-[500px] max-h-[80vh] rounded-3xl overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="p-6 overflow-y-auto no-scrollbar">
                    <div className="flex justify-between items-start gap-4 mb-4">
                        <div className="flex-1">
                            {selectedPoster.code && (
                                <div className="inline-flex items-center px-2.5 py-1 rounded-lg bg-[var(--accent)] text-white text-[12px] font-black mb-2 shadow-lg shadow-[var(--accent)]/20 uppercase tracking-widest font-mono">
                                    {selectedPoster.code}
                                </div>
                            )}
                            <h3 className="text-lg font-bold leading-tight">{selectedPoster.title}</h3>
                        </div>
                        <button 
                            onClick={() => setSelectedPoster(null)}
                            className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                        </button>
                    </div>
                    
                    <div className="space-y-4">
                        <div className="flex flex-wrap gap-1.5">
                            {(() => {
                                try {
                                    const authors = typeof selectedPoster.authors === 'string' ? JSON.parse(selectedPoster.authors) : selectedPoster.authors;
                                    return Array.isArray(authors) ? authors.map((a, i) => (
                                        <span key={i} className="px-2 py-1 bg-slate-50 border border-slate-100 rounded text-[11px] font-medium text-slate-600">
                                            {typeof a === 'string' ? a : `${a.firstName || ''} ${a.lastName || ''}`.trim() || a.name || a.author_name || 'Unknown Author'}
                                        </span>
                                    )) : <span className="text-[11px] text-slate-400 italic">No authors listed</span>;
                                } catch (e) {
                                    return <span className="text-[11px] text-slate-400 italic">Error parsing authors</span>;
                                }
                            })()}
                        </div>

                        {selectedPoster.toc && selectedPoster.toc !== 'null' && (
                            <div className="pt-2">
                                <div className="relative group overflow-hidden rounded-xl border border-slate-200 bg-slate-50 transition-all duration-300">
                                    <div 
                                        onClick={() => setIsTocExpanded(true)}
                                        className="w-full h-32 md:h-40 cursor-pointer overflow-hidden"
                                    >
                                        <img 
                                            src={`https://www.nanoge.org/static/abstracts/${selectedPoster.toc}`} 
                                            alt="TOC" 
                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                        />
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 flex items-center justify-center transition-all">
                                            <div className="bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-[10px] font-bold text-slate-900 shadow-lg translate-y-4 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all">
                                                Tap to expand TOC
                                            </div>
                                        </div>
                                    </div>
                                    <div className="absolute top-2 right-2 flex gap-1">
                                        <a 
                                            href={`https://www.nanoge.org/static/abstracts/${selectedPoster.toc}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            className="bg-white/80 hover:bg-white backdrop-blur-md p-1.5 rounded-lg text-slate-600 hover:text-[var(--accent)] shadow-sm transition-all"
                                            title="Open in new tab"
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                                        </a>
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        <div className="text-[13px] text-slate-600 leading-relaxed pt-2 border-t border-slate-100 whitespace-pre-wrap">
                            {selectedPoster.content ? (
                                selectedPoster.content
                                    .replace(/<[^>]*>?/gm, '')
                                    .replace(/&nbsp;/g, ' ')
                                    .replace(/&amp;/g, '&')
                            ) : (
                                <span className="italic opacity-50">No abstract available.</span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="p-4 bg-slate-50 border-t border-slate-100">
                    <button 
                        onClick={() => setSelectedPoster(null)}
                        className="w-full h-11 bg-slate-900 text-white rounded-xl font-bold text-[13px]"
                    >
                        Close Details
                    </button>
                </div>
            </div>
        </div>
      )}
 
      {/* Full Screen TOC Overlay */}
      {isTocExpanded && selectedPoster && selectedPoster.toc && (
          <div 
              onClick={() => setIsTocExpanded(false)}
              className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4 cursor-pointer animate-in fade-in duration-300"
          >
              <div className="relative w-full h-full flex items-center justify-center">
                  <img 
                      src={`https://www.nanoge.org/static/abstracts/${selectedPoster.toc}`} 
                      alt="TOC Full" 
                      className="max-w-[95vw] max-h-[95vh] object-contain shadow-2xl animate-in zoom-in-95 duration-300"
                  />
                  <div className="absolute top-4 right-4 text-white/50 text-[11px] font-medium tracking-widest uppercase">
                      Click anywhere to close
                  </div>
              </div>
          </div>
      )}
    </form>
  );
}
