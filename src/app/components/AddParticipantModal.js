'use client';
import { useState, useTransition, useEffect } from 'react';
import { Search, Loader2, UserPlus, X, Users, UserCheck, Upload, Download, FileText } from 'lucide-react';
import { searchGlobalParticipants, registerExistingParticipant, addManualParticipant, bulkAddManualParticipants } from '../actions/participants';

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

  // CSV tab state
  const [csvData, setCsvData] = useState([]);
  const [csvError, setCsvError] = useState(null);
  const [isUploading, startUploading] = useTransition();
  const [importResult, setImportResult] = useState(null);

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
      setCsvData([]);
      setCsvError(null);
      setImportResult(null);
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

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      try {
        const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
        if (lines.length < 2) {
          setCsvError('File must contain a header row and at least one data row.');
          return;
        }
        
        // Simple CSV parser supporting basic quotes
        const parseLine = (line) => {
           const result = [];
           let current = '';
           let inQuotes = false;
           for (let i=0; i<line.length; i++) {
             if (line[i] === '"') inQuotes = !inQuotes;
             else if (line[i] === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
             else current += line[i];
           }
           result.push(current.trim());
           return result;
        };

        const headers = parseLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z]/g, ''));
        
        // Map columns based on keywords
        let map = { fname: 0, lname: 1, email: 2, type: 3, entity: 4, country: 5 };
        headers.forEach((h, i) => {
            if (h.includes('first')) map.fname = i;
            else if (h.includes('last')) map.lname = i;
            else if (h.includes('email')) map.email = i;
            else if (h.includes('type') || h.includes('reg')) map.type = i;
            else if (h.includes('entity') || h.includes('inst') || h.includes('univ')) map.entity = i;
            else if (h.includes('country')) map.country = i;
        });

        const data = [];
        for (let i = 1; i < lines.length; i++) {
            const cols = parseLine(lines[i]);
            if (cols.length < 3) continue;
            
            data.push({
               firstName: cols[map.fname] || '',
               lastName: cols[map.lname] || '',
               email: (cols[map.email] || '').toLowerCase(),
               registration_type: cols[map.type] || 'Standard',
               entity: cols[map.entity] || '',
               country: cols[map.country] || ''
            });
        }
        
        // Filter out empty emails
        const validData = data.filter(d => d.email && d.email.includes('@'));
        if (validData.length === 0) {
            setCsvError('No valid email addresses found in the CSV.');
            return;
        }

        setCsvData(validData);
        setCsvError(null);
        setImportResult(null);
      } catch (err) {
        setCsvError('Error parsing CSV: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleBulkImport = () => {
     if (csvData.length === 0) return;
     startUploading(async () => {
        try {
           const res = await bulkAddManualParticipants(csvData, conferenceId);
           setImportResult(res);
        } catch (e) {
           setCsvError('Error importing: ' + e.message);
        }
     });
  };

  if (!isOpen) return null;


  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className={`bg-white rounded-3xl shadow-2xl w-full ${tab === 'csv' ? 'max-w-3xl' : 'max-w-md'} overflow-hidden animate-in fade-in zoom-in duration-200 transition-all`}>
        
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
          <button
            onClick={() => setTab('csv')}
            className={`flex-1 py-3 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors border-b-2 ${
              tab === 'csv' ? 'text-green-600 border-green-600' : 'text-slate-400 border-transparent hover:text-slate-600'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            Upload CSV
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
          ) : tab === 'create' ? (
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
          ) : (
            /* ── Tab 3: Upload CSV ── */
            <div className="space-y-4">
               {importResult ? (
                  <div className="bg-green-50 border border-green-100 rounded-2xl p-6 text-center">
                      <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-3">
                          <UserCheck className="w-6 h-6" />
                      </div>
                      <h4 className="text-sm font-bold text-green-800 mb-1">Import Complete!</h4>
                      <p className="text-xs text-green-700 font-medium">
                          Successfully processed <b>{importResult.processed}</b> participants.
                      </p>
                      {importResult.duplicates > 0 && (
                          <p className="text-xs text-amber-600 font-medium mt-2 bg-amber-50 px-2 py-1 rounded inline-block">
                              Skipped {importResult.duplicates} duplicates
                          </p>
                      )}
                      {importResult.errors?.length > 0 && (
                          <div className="mt-4 text-left max-h-32 overflow-y-auto bg-white/60 p-3 rounded-xl border border-red-100 text-[10px] text-red-600 font-medium">
                              <p className="font-bold mb-1">Errors encountered:</p>
                              {importResult.errors.map((e, i) => (
                                  <div key={i}>• Row: {e.row?.email || 'Unknown'} - {e.error}</div>
                              ))}
                          </div>
                      )}
                      <button 
                         onClick={onClose}
                         className="mt-6 px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-green-100"
                      >
                         Done
                      </button>
                  </div>
               ) : (
                  <>
                     <div className="bg-slate-50 border border-slate-200 border-dashed rounded-2xl p-6 text-center">
                         <input 
                             type="file" 
                             accept=".csv" 
                             onChange={handleFileUpload}
                             className="hidden" 
                             id="csv-upload"
                         />
                         <label htmlFor="csv-upload" className="cursor-pointer flex flex-col items-center">
                             <div className="w-10 h-10 bg-white border border-slate-200 rounded-full flex items-center justify-center mb-3 shadow-sm">
                                 <FileText className="w-5 h-5 text-slate-500" />
                             </div>
                             <span className="text-sm font-bold text-slate-700">Click to upload CSV</span>
                             <span className="text-[10px] text-slate-400 font-medium mt-1">First Name, Last Name, Email, Reg Type, Entity, Country</span>
                             <span className="text-[10px] text-slate-400 font-medium mt-1">Staff / Comité Organizador y presidencias ejecutivas / Participantes / Ponente Plenario / Simposio Plenario / Coordinadores/as Área de trabajo / Estudiantes / Jubilados / Desempleados / Simposio/Taller Plenario / Industrial / Streaming / Coordinador de simposio Waved /Ponente Simposio Waved</span>
                         </label>
                     </div>

                     {csvError && (
                         <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 font-medium">
                             {csvError}
                         </div>
                     )}

                     {csvData.length > 0 && (
                         <div className="border border-slate-200 rounded-xl overflow-hidden mt-4">
                             <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
                                 <span className="text-xs font-bold text-slate-700">Preview: {csvData.length} valid rows found</span>
                                 <button onClick={() => setCsvData([])} className="text-[10px] font-bold text-slate-400 hover:text-slate-600">Clear</button>
                             </div>
                             <div className="max-h-60 overflow-y-auto no-scrollbar">
                                 <table className="w-full text-left text-[10px]">
                                     <thead className="bg-slate-50/50 sticky top-0 text-slate-500 uppercase tracking-wider font-bold">
                                         <tr>
                                             <th className="px-4 py-2">Name</th>
                                             <th className="px-4 py-2">Email</th>
                                             <th className="px-4 py-2">Type</th>
                                             <th className="px-4 py-2">Entity</th>
                                         </tr>
                                     </thead>
                                     <tbody className="divide-y divide-slate-100">
                                         {csvData.slice(0, 100).map((row, i) => (
                                             <tr key={i} className="hover:bg-slate-50 transition-colors">
                                                 <td className="px-4 py-2 font-medium text-slate-900">{row.firstName} {row.lastName}</td>
                                                 <td className="px-4 py-2 text-slate-500">{row.email}</td>
                                                 <td className="px-4 py-2"><span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold">{row.registration_type}</span></td>
                                                 <td className="px-4 py-2 text-slate-500 truncate max-w-[120px]" title={row.entity}>{row.entity || '-'}</td>
                                             </tr>
                                         ))}
                                     </tbody>
                                 </table>
                                 {csvData.length > 100 && (
                                     <div className="text-center py-2 text-[10px] text-slate-400 italic bg-slate-50 border-t border-slate-100">
                                         Showing first 100 rows...
                                     </div>
                                 )}
                             </div>
                         </div>
                     )}

                     {csvData.length > 0 && (
                         <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
                             <button
                               onClick={onClose}
                               className="px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-50 rounded-xl transition-all"
                             >
                               Cancel
                             </button>
                             <button
                               onClick={handleBulkImport}
                               disabled={isUploading}
                               className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 shadow-md shadow-green-100"
                             >
                               {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                               Import {csvData.length} Participants
                             </button>
                         </div>
                     )}
                  </>
               )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
