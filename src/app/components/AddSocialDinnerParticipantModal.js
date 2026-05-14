'use client';
import { useState, useTransition, useEffect } from 'react';
import { Search, Loader2, UserPlus, X } from 'lucide-react';
import { searchConferenceParticipants, addManualSocialDinnerTicket } from '../actions/social-dinner';

export default function AddSocialDinnerParticipantModal({ isOpen, onClose, conferenceAcronym }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, startSearching] = useTransition();
  const [isAdding, startAdding] = useTransition();

  useEffect(() => {
    if (searchTerm.length < 2) {
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
  }, [searchTerm, conferenceAcronym]);

  const handleAdd = async (registrationId) => {
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Add Attendee</h3>
            <p className="text-xs text-slate-500 font-medium mt-1">Search participants in {conferenceAcronym}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-6">
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
                No participants found matching "{searchTerm}"
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400 text-[11px] font-medium italic">
                Type at least 2 characters to search
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
