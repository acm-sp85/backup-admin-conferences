'use client';

import { useState, useTransition, useEffect } from 'react';
import { submitCustomVotes } from '../actions/customVoting';

export default function CustomVotingForm({ activeGroups, items, initialVotes, userId, conferenceId, conferenceEmail, hasVoted = false, votingValidationEnabled = true }) {
  const [votes, setVotes] = useState(initialVotes || {});
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex-1">
                            <div className="text-[10px] font-bold text-indigo-600 mb-1 uppercase tracking-wide">
                                {item.session_name}
                            </div>
                            <h4 className="font-bold text-[14px] text-[var(--foreground)] leading-tight mb-2">
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
    </form>
  );
}
