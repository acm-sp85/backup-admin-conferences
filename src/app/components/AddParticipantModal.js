'use client';
import { useState, useTransition, useEffect } from 'react';
import { Search, Loader2, UserPlus, X, Users, UserCheck } from 'lucide-react';
import { searchGlobalParticipants, registerExistingParticipant, addManualParticipant } from '../actions/participants';

export default function AddParticipantModal({ isOpen, onClose, conferenceAcronym, conferenceId, registrationTypes }) {
  const [tab, setTab] = useState('search');

  // Search tab state
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, startSearching] = useTransition();
  const [isRegisteringExisting, startRegisteringExisting] = useTransition();
  const [selectedUserType, setSelectedUserType] = useState('Standard');

  // Create tab state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [registrationType, setRegistrationType] = useState('Standard');
  const [entity, setEntity] = useState('');
  const [country, setCountry] = useState('');
  const [isAddingNew, startAddingNew] = useTransition();

  // Reset fields on close
  useEffect(() => {
    if (!isOpen) {
      setTab('search');
      setSearchTerm('');
      setSearchResults([]);
      setFirstName('');
      setLastName('');
      setEmail('');
      setRegistrationType('Standard');
      setEntity('');
      setCountry('');
    }
  }, [isOpen]);

  // Debounced search for global participants
  useEffect(() => {
    if (tab !== 'search' || searchTerm.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      startSearching(async () => {
        try {
          const data = await searchGlobalParticipants(searchTerm);
          setSearchResults(data);
        } catch (e) {
          console.error(e);
        }
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, tab]);

  const handleRegisterExisting = (participantId) => {
    startRegisteringExisting(async () => {
      try {
        await registerExistingParticipant(participantId, conferenceId, selectedUserType);
        onClose();
        alert('Participant successfully registered to this conference!');
      } catch (e) {
        alert('Error registering participant: ' + e.message);
      }
    });
  };

  const handleAddNew = (e) => {
    e.preventDefault();
    if (!email.trim()) {
      alert('Please enter an email address.');
      return;
    }
    startAddingNew(async () => {
      try {
        await addManualParticipant({
          firstName,
          lastName,
          email,
          registration_type: registrationType,
          entity,
          country,
          conferenceId
        });
        onClose();
        alert('Manual participant created and registered successfully!');
      } catch (e) {
        alert('Error creating participant: ' + e.message);
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
            <h3 className="text-lg font-bold text-slate-900">Add Participant</h3>
            <p className="text-xs text-slate-500 font-medium mt-1">{conferenceAcronym} · Manual Registration</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-slate-100">
          <button
            onClick={() => setTab('search')}
            className={`flex-1 py-3 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors border-b-2 ${
              tab === 'search' ? 'text-slate-900 border-slate-900' : 'text-slate-400 border-transparent hover:text-slate-600'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            Find Existing User
          </button>
          <button
            onClick={() => setTab('create')}
            className={`flex-1 py-3 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors border-b-2 ${
              tab === 'create' ? 'text-blue-600 border-blue-600' : 'text-slate-400 border-transparent hover:text-slate-600'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            Create Brand New
          </button>
        </div>

        <div className="p-6">
          {tab === 'search' ? (
            /* ── Tab 1: Find & Register Existing User ── */
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search globally by name or email..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  autoFocus
                />
              </div>

              {/* Set user type for existing user prior to registration */}
              {searchResults.length > 0 && (
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">User Type to Assign:</label>
                  <select
                    value={selectedUserType}
                    onChange={(e) => setSelectedUserType(e.target.value)}
                    className="bg-white border border-slate-200 rounded-lg text-xs font-semibold px-2 py-1 outline-none"
                  >
                    {registrationTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1 no-scrollbar">
                {isSearching ? (
                  <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mb-2" />
                    <span className="text-[11px] font-medium">Searching global database...</span>
                  </div>
                ) : searchResults.length > 0 ? (
                  searchResults.map((p) => (
                    <div key={p.id} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-2xl border border-transparent hover:border-slate-100 transition-all group">
                      <div>
                        <div className="text-[13px] font-bold text-slate-900">{p.firstName} {p.lastName}</div>
                        <div className="text-[11px] text-slate-500 font-medium mt-0.5">{p.email}</div>
                        {p.entity && (
                          <div className="text-[10px] text-slate-400 font-medium mt-0.5">{p.entity}</div>
                        )}
                      </div>
                      <button
                        onClick={() => handleRegisterExisting(p.id)}
                        disabled={isRegisteringExisting}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-black text-white rounded-lg text-[10px] font-bold transition-all disabled:opacity-50"
                      >
                        {isRegisteringExisting ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />}
                        Register
                      </button>
                    </div>
                  ))
                ) : searchTerm.length >= 2 ? (
                  <div className="text-center py-8 text-slate-400 text-[11px] font-medium">
                    No users found matching &quot;{searchTerm}&quot;
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-400 text-[11px] font-medium italic">
                    Type at least 2 characters to search globally
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ── Tab 2: Create Brand New Participant Form ── */
            <form onSubmit={handleAddNew} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">First Name</label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-blue-500 focus:bg-white transition-all"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Last Name</label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-blue-500 focus:bg-white transition-all"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Email Address</label>
                <input
                  type="email"
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-blue-500 focus:bg-white transition-all"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">User Type</label>
                  <select
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-blue-500 focus:bg-white transition-all"
                    value={registrationType}
                    onChange={(e) => setRegistrationType(e.target.value)}
                  >
                    {registrationTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Country</label>
                  <input
                    type="text"
                    placeholder="e.g. Spain"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-blue-500 focus:bg-white transition-all"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Institution / Entity</label>
                <input
                  type="text"
                  placeholder="e.g. University of Valencia"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-blue-500 focus:bg-white transition-all"
                  value={entity}
                  onChange={(e) => setEntity(e.target.value)}
                />
              </div>

              <div className="pt-2 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-50 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAddingNew}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 shadow-md shadow-blue-100"
                >
                  {isAddingNew ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                  Register Manual Participant
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
