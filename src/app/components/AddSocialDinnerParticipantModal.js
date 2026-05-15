'use client';
import { useState, useTransition, useEffect } from 'react';
import { Search, Loader2, UserPlus, X, Users, UserCheck } from 'lucide-react';
import { searchConferenceParticipants, addManualSocialDinnerTicket, addGuestAndSocialDinnerTicket } from '../actions/social-dinner';

export default function AddSocialDinnerParticipantModal({ isOpen, onClose, conferenceAcronym }) {
  const [tab, setTab] = useState('participant');

  // — Participant tab state —
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, startSearching] = useTransition();
  const [isAdding, startAdding] = useTransition();

  // — Guest tab state —
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [isAddingGuest, startAddingGuest] = useTransition();

  // Reset fields when modal closes
  useEffect(() => {
    if (!isOpen) {
      setTab('participant');
      setSearchTerm('');
      setResults([]);
      setGuestName('');
      setGuestEmail('');
    }
  }, [isOpen]);

  // Debounced participant search
  useEffect(() => {
    if (tab !== 'participant' || searchTerm.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      startSearching(async () => {
        const data = await searchConferenceParticipants(conferenceAcronym, searchTerm);
        setResults(data);
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, conferenceAcronym, tab]);

  const handleAdd = (registrationId) => {
    startAdding(async () => {
      try {
        await addManualSocialDinnerTicket(registrationId);
        onClose();
        alert('Participant added to Social Dinner list!');
      } catch (e) {
        alert('Error adding participant: ' + e.message);
      }
    });
  };

  const handleAddGuest = () => {
    if (!guestName.trim() || !guestEmail.trim()) {
      alert('Please enter both a name and an email address.');
      return;
    }
    startAddingGuest(async () => {
      try {
        await addGuestAndSocialDinnerTicket(guestName, guestEmail, conferenceAcronym);
        onClose();
        alert('External guest added to Social Dinner list!');
      } catch (e) {
        alert('Error adding guest: ' + e.message);
      }
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">

        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Add Attendee</h3>
            <p className="text-xs text-slate-500 font-medium mt-1">{conferenceAcronym} · Social Dinner</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-slate-100">
          <button
            onClick={() => setTab('participant')}
            className={`flex-1 py-3 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors border-b-2 ${
              tab === 'participant' ? 'text-slate-900 border-slate-900' : 'text-slate-400 border-transparent hover:text-slate-600'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Conference Participant
          </button>
          <button
            onClick={() => setTab('guest')}
            className={`flex-1 py-3 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors border-b-2 ${
              tab === 'guest' ? 'text-violet-700 border-violet-700' : 'text-slate-400 border-transparent hover:text-slate-600'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            External Guest
          </button>
        </div>

        <div className="p-6">
          {tab === 'participant' ? (
            /* ── Conference Participant search ── */
            <>
              <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 no-scrollbar">
                {isSearching ? (
                  <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mb-2" />
                    <span className="text-[11px] font-medium">Searching participants...</span>
                  </div>
                ) : results.length > 0 ? (
                  results.map((p) => (
                    <div key={p.registration_id} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-2xl border border-transparent hover:border-slate-100 transition-all group">
                      <div>
                        <div className="text-[13px] font-bold text-slate-900">{p.name}</div>
                        <div className="text-[11px] text-slate-500 font-medium">{p.email}</div>
                      </div>
                      <button
                        onClick={() => handleAdd(p.registration_id)}
                        disabled={isAdding}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-black text-white rounded-lg text-[10px] font-bold transition-all disabled:opacity-50"
                      >
                        {isAdding ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />}
                        Add
                      </button>
                    </div>
                  ))
                ) : searchTerm.length >= 2 ? (
                  <div className="text-center py-8 text-slate-400 text-[11px] font-medium">
                    No participants found matching &quot;{searchTerm}&quot;
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-400 text-[11px] font-medium italic">
                    Type at least 2 characters to search
                  </div>
                )}
              </div>
            </>
          ) : (
            /* ── External Guest form ── */
            <>
              <div className="mb-4 p-3 bg-violet-50 border border-violet-100 rounded-2xl">
                <p className="text-[11px] text-violet-700 font-medium leading-relaxed">
                  External guests are <strong>not</strong> conference participants. They will appear in the Social Dinner list and receive a valid QR ticket, but will be hidden from all participant metrics.
                </p>
              </div>

              <div className="space-y-3 mb-6">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5 block">Full Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Jane Smith"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 outline-none transition-all"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    autoFocus={tab === 'guest'}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5 block">Email Address</label>
                  <input
                    type="email"
                    placeholder="e.g. jane@example.com"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500 outline-none transition-all"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddGuest()}
                  />
                </div>
              </div>

              <button
                onClick={handleAddGuest}
                disabled={isAddingGuest || !guestName.trim() || !guestEmail.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-2xl text-sm font-bold shadow-lg shadow-violet-100 transition-all disabled:opacity-50"
              >
                {isAddingGuest ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
                Add External Guest
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
