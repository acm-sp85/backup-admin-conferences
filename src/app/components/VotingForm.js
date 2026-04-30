'use client';

import { useState, useTransition } from 'react';
import { submitVotes } from '../actions/voting';

export default function VotingForm({ activeClusters, posters, initialVotes, userId, conferenceId, conferenceEmail, isParticipant = false, hasVoted = false }) {
  const [votes, setVotes] = useState(initialVotes || {});
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Group posters by conference
  const postersByConference = posters.reduce((acc, poster) => {
    if (!acc[poster.conference_id]) acc[poster.conference_id] = [];
    acc[poster.conference_id].push(poster);
    return acc;
  }, {});

  const handleVoteChange = (posterId, value) => {
    if (hasVoted) return; // Prevent changes if already voted
    setVotes(prev => ({
      ...prev,
      [posterId]: parseInt(value)
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (hasVoted) return;
    setError('');
    setSuccess('');
    
    startTransition(async () => {
      const res = await submitVotes(userId, votes, isParticipant, conferenceId);
      if (res.error) {
        setError(res.error);
      } else {
        setSuccess('Votes submitted successfully!');
      }
    });
  };

  const [selectedPoster, setSelectedPoster] = useState(null);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <div className="p-3 bg-[#fff5f5] text-[#ff3b30] text-xs font-semibold rounded-xl border border-[#ff3b30]/10">{error}</div>}
      {success && <div className="p-3 bg-[#e8faf0] text-[#34c759] text-xs font-semibold rounded-xl border border-[#34c759]/10">{success}</div>}

      {hasVoted && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col items-center text-center gap-2 mx-4 mt-4">
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
        const clusterPosters = postersByConference[cluster.conference_id] || [];
        
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

                return (
                  <div key={poster.id} className="card overflow-hidden flex flex-col">
                    <div 
                        className="p-4 cursor-pointer hover:bg-slate-50/50 transition-colors active:bg-slate-100"
                        onClick={() => setSelectedPoster(poster)}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className="font-bold text-[14px] text-[var(--foreground)] leading-tight flex-1">
                          {poster.title}
                        </h4>
                        {poster.code && (
                          <span className="text-[10px] font-bold text-[var(--accent)] bg-[var(--accent-light)] px-1.5 py-0.5 rounded">
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

                    <div className="p-4 pt-0 space-y-2 border-t border-[var(--border)] mt-2">
                        <div className="flex justify-between items-center pt-3">
                            <span className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">Your Score</span>
                            <span className={`text-[12px] font-bold ${currentVote > 0 ? 'text-[var(--accent)]' : 'text-[var(--muted)]'}`}>
                                {currentVote > 0 ? currentVote : 'Not Rated'}
                            </span>
                        </div>
                        <div className="flex justify-between gap-1 overflow-x-auto pb-1 no-scrollbar">
                            {[1,2,3,4,5,6,7,8,9,10].map(n => (
                                <button
                                    key={n}
                                    type="button"
                                    onClick={() => handleVoteChange(poster.id, n)}
                                    className={`flex-1 min-w-[32px] h-9 rounded-lg text-[13px] font-bold transition-all border ${
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
                                <div className="text-[10px] font-bold text-[var(--accent)] mb-1 uppercase tracking-widest">{selectedPoster.code}</div>
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
                        
                        <div 
                            className="text-[13px] text-slate-600 leading-relaxed html-content pt-2 border-t border-slate-100"
                            dangerouslySetInnerHTML={{ __html: selectedPoster.content || '<span class="italic opacity-50">No abstract available.</span>' }}
                        />
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
    </form>
  );
}
