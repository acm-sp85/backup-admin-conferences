'use client';

import { useState, useEffect } from 'react';
import {
    getCustomVotingGroups,
    createCustomVotingGroup,
    updateCustomVotingGroup,
    deleteCustomVotingGroup,
    getCustomVotingItemsByConference,
    addCustomVotingItem,
    removeCustomVotingItem,
    getProgramSlotsForConference,
    getCustomVotersForConference,
    searchConferenceParticipantsForCustomVoting,
    updateCustomVoterGroups,
    removeCustomVoter,
    getCustomVotingResults,
    resetCustomVotingResults,
    sendCustomVoterInvite,
    resetCustomVoterVotes,
    addAllCheckedInAttendeesToCustomVoting
} from '../actions/customVoting';

export default function CustomVotingManager({ conferences, userRole, selectedConference, onConferenceChange }) {
    const [activeTab, setActiveTab] = useState('groups'); // groups, voters, results
    
    // State for Groups & Items
    const [groups, setGroups] = useState([]);
    const [items, setItems] = useState([]);
    const [programSlots, setProgramSlots] = useState([]);
    const [isCreatingGroup, setIsCreatingGroup] = useState(false);
    const [editingGroup, setEditingGroup] = useState(null);
    const [selectedSlotId, setSelectedSlotId] = useState('');
    const [selectedGroupIdForAdd, setSelectedGroupIdForAdd] = useState('');
    const [slotSearchQuery, setSlotSearchQuery] = useState('');
    const [isSlotDropdownOpen, setIsSlotDropdownOpen] = useState(false);
    
    // State for Voters
    const [voters, setVoters] = useState([]);
    const [voterSearch, setVoterSearch] = useState('');
    const [voterSearchResults, setVoterSearchResults] = useState([]);
    const [selectedVoterIds, setSelectedVoterIds] = useState(new Set());
    const [isSendingBulk, setIsSendingBulk] = useState(false);
    const [actionLoadingId, setActionLoadingId] = useState(null);

    // State for Results
    const [results, setResults] = useState([]);
    const [isResetting, setIsResetting] = useState(false);

    // Loading State
    const [loading, setLoading] = useState(false);

    // Fetch data based on active tab
    useEffect(() => {
        if (!selectedConference) return;
        
        const fetchData = async () => {
            setLoading(true);
            try {
                if (activeTab === 'groups') {
                    const [fetchedGroups, fetchedItems, fetchedSlots] = await Promise.all([
                        getCustomVotingGroups(selectedConference),
                        getCustomVotingItemsByConference(selectedConference),
                        getProgramSlotsForConference(selectedConference)
                    ]);
                    setGroups(fetchedGroups);
                    setItems(fetchedItems);
                    setProgramSlots(fetchedSlots);
                } else if (activeTab === 'voters') {
                    const [fetchedVoters, fetchedGroups] = await Promise.all([
                        getCustomVotersForConference(selectedConference),
                        getCustomVotingGroups(selectedConference)
                    ]);
                    setVoters(fetchedVoters);
                    setGroups(fetchedGroups);
                    setSelectedVoterIds(new Set());
                } else if (activeTab === 'results') {
                    const fetchedResults = await getCustomVotingResults(selectedConference);
                    setResults(fetchedResults);
                }
            } catch (err) {
                console.error("Error fetching data:", err);
            }
            setLoading(false);
        };

        fetchData();
    }, [selectedConference, activeTab]);

    // Search voters effect
    useEffect(() => {
        if (activeTab !== 'voters') return;
        
        const performSearch = async () => {
            if (voterSearch.length < 2) { 
                setVoterSearchResults([]); 
                return; 
            }
            const data = await searchConferenceParticipantsForCustomVoting(selectedConference, voterSearch);
            setVoterSearchResults(data);
        };
        const timer = setTimeout(performSearch, 300);
        return () => clearTimeout(timer);
    }, [voterSearch, selectedConference, activeTab]);

    // ==========================================
    // HANDLERS: Groups & Items
    // ==========================================
    const handleCreateGroup = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const name = formData.get('name');
        const color = formData.get('color') || '#7c3aed';
        
        await createCustomVotingGroup(selectedConference, name, color);
        setIsCreatingGroup(false);
        const updatedGroups = await getCustomVotingGroups(selectedConference);
        setGroups(updatedGroups);
    };

    const handleUpdateGroup = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const name = formData.get('name');
        const color = formData.get('color');
        
        await updateCustomVotingGroup(editingGroup.id, name, color);
        setEditingGroup(null);
        const updatedGroups = await getCustomVotingGroups(selectedConference);
        setGroups(updatedGroups);
    };

    const handleDeleteGroup = async (id) => {
        if (!confirm('Delete this group? This will remove all items assigned to it.')) return;
        await deleteCustomVotingGroup(id);
        const [updatedGroups, updatedItems] = await Promise.all([
            getCustomVotingGroups(selectedConference),
            getCustomVotingItemsByConference(selectedConference)
        ]);
        setGroups(updatedGroups);
        setItems(updatedItems);
    };

    const handleAddItem = async () => {
        if (!selectedGroupIdForAdd || !selectedSlotId) {
            alert('Please select both a group and a presentation.');
            return;
        }
        
        const res = await addCustomVotingItem(selectedGroupIdForAdd, selectedSlotId);
        if (res.error) {
            alert(res.error);
            return;
        }
        
        const updatedItems = await getCustomVotingItemsByConference(selectedConference);
        setItems(updatedItems);
        setSelectedSlotId('');
        setSlotSearchQuery('');
    };

    const handleRemoveItem = async (itemId) => {
        if (!confirm('Remove this presentation from the group?')) return;
        await removeCustomVotingItem(itemId);
        const updatedItems = await getCustomVotingItemsByConference(selectedConference);
        setItems(updatedItems);
    };

    // ==========================================
    // HANDLERS: Voters
    // ==========================================
    const handleAddVoter = async (participantId) => {
        setActionLoadingId(`add-${participantId}`);
        // Add them with empty groups initially
        await updateCustomVoterGroups(participantId, [], selectedConference);
        setVoterSearch('');
        setVoterSearchResults([]);
        const updatedVoters = await getCustomVotersForConference(selectedConference);
        setVoters(updatedVoters);
        setActionLoadingId(null);
    };

    const handleRemoveVoter = async (participantId) => {
        if (!confirm('Remove this voter from custom voting?')) return;
        setActionLoadingId(`remove-${participantId}`);
        await removeCustomVoter(participantId, selectedConference);
        const updatedVoters = await getCustomVotersForConference(selectedConference);
        setVoters(updatedVoters);
        setActionLoadingId(null);
    };

    const handleSendInvite = async (participantId) => {
        setActionLoadingId(`invite-${participantId}`);
        const res = await sendCustomVoterInvite(participantId, selectedConference);
        if (res.error) alert(res.error);
        else alert('Invitation sent successfully!');
        setActionLoadingId(null);
    };

    const handleResetVoter = async (participantId) => {
        if (!confirm('Reset votes for this user? They will be able to vote again.')) return;
        setActionLoadingId(`reset-${participantId}`);
        const res = await resetCustomVoterVotes(participantId, selectedConference);
        if (res.error) alert(res.error);
        else {
            alert('Votes reset successfully!');
            const updatedVoters = await getCustomVotersForConference(selectedConference);
            setVoters(updatedVoters);
        }
        setActionLoadingId(null);
    };

    const handleVoterGroupChange = async (participantId, currentGroups, groupId) => {
        let newGroups = [...currentGroups];
        if (newGroups.includes(groupId)) {
            newGroups = newGroups.filter(id => id !== groupId);
        } else {
            newGroups.push(groupId);
        }
        await updateCustomVoterGroups(participantId, newGroups, selectedConference);
        const updatedVoters = await getCustomVotersForConference(selectedConference);
        setVoters(updatedVoters);
    };

    const toggleSelectAllVoters = () => {
        if (selectedVoterIds.size > 0) setSelectedVoterIds(new Set());
        else setSelectedVoterIds(new Set(voters.map(v => v.id)));
    };

    const toggleSelectVoter = (id) => {
        const next = new Set(selectedVoterIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedVoterIds(next);
    };

    const handleBulkInvite = async () => {
        if (selectedVoterIds.size === 0) return;
        if (!confirm(`Send custom voting invitations to ${selectedVoterIds.size} participants?`)) return;

        setIsSendingBulk(true);
        let success = 0; let fail = 0;

        for (const id of selectedVoterIds) {
            try {
                const res = await sendCustomVoterInvite(id, selectedConference);
                if (res.success) success++; else fail++;
                await new Promise(r => setTimeout(r, 500)); // Pace
            } catch (e) { fail++; }
        }

        alert(`Bulk invitations complete: ${success} successful, ${fail} failed.`);
        setIsSendingBulk(false);
        setSelectedVoterIds(new Set());
    };

    const handleAddAllCheckedIn = async () => {
        if (!confirm('This will add all participants who have checked in to the Custom Voters list. Proceed?')) return;
        setActionLoadingId('add-all-checked-in');
        const res = await addAllCheckedInAttendeesToCustomVoting(selectedConference);
        if (res.error) {
            alert(res.error);
        } else {
            const updatedVoters = await getCustomVotersForConference(selectedConference);
            setVoters(updatedVoters);
        }
        setActionLoadingId(null);
    };

    // ==========================================
    // HANDLERS: Results
    // ==========================================
    const handleResetResults = async () => {
        if (!confirm('CAUTION: This will permanently DELETE all custom voting results for this conference. Are you sure?')) return;
        
        setIsResetting(true);
        try {
            await resetCustomVotingResults(selectedConference);
            alert('Voting results reset successfully.');
            const updatedResults = await getCustomVotingResults(selectedConference);
            setResults(updatedResults);
        } catch (err) {
            alert('Failed to reset voting results: ' + err.message);
        }
        setIsResetting(false);
    };

    // Helpers
    const groupsById = groups.reduce((acc, g) => ({...acc, [g.id]: g}), {});
    const itemsByGroup = items.reduce((acc, item) => {
        if (!acc[item.group_id]) acc[item.group_id] = [];
        acc[item.group_id].push(item);
        return acc;
    }, {});


    return (
        <div className="space-y-6">
            {/* Header / Sub-Navigation */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[var(--border)] pb-4">
                <div className="flex bg-[var(--bg)] p-1 rounded-xl">
                    <button
                        onClick={() => setActiveTab('groups')}
                        className={`px-4 py-2 text-[12px] font-semibold rounded-lg transition-all ${
                            activeTab === 'groups' ? 'bg-white text-[var(--accent)] shadow-sm' : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                        }`}
                    >
                        Groups & Items
                    </button>
                    <button
                        onClick={() => setActiveTab('voters')}
                        className={`px-4 py-2 text-[12px] font-semibold rounded-lg transition-all ${
                            activeTab === 'voters' ? 'bg-white text-[var(--accent)] shadow-sm' : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                        }`}
                    >
                        Voter Assignment
                    </button>
                    <button
                        onClick={() => setActiveTab('results')}
                        className={`px-4 py-2 text-[12px] font-semibold rounded-lg transition-all ${
                            activeTab === 'results' ? 'bg-white text-[var(--accent)] shadow-sm' : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                        }`}
                    >
                        Results
                    </button>
                </div>
                
                <div className="flex gap-2 w-full sm:w-auto">
                    <select 
                        value={selectedConference}
                        onChange={(e) => onConferenceChange(e.target.value)}
                        className="input-base font-semibold w-full sm:w-auto"
                    >
                        {conferences.map(c => (
                            <option key={c.id} value={c.id}>{c.acronym}</option>
                        ))}
                    </select>
                </div>
            </div>

            {loading && <div className="p-10 text-center text-sm text-[var(--muted)] animate-pulse">Loading data...</div>}

            {!loading && activeTab === 'groups' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="card p-4 flex flex-col md:flex-row gap-4">
                        <div className="w-full md:w-1/3 border-r border-[var(--border)] pr-4">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-sm">Voting Groups</h3>
                                <button 
                                    onClick={() => setIsCreatingGroup(true)}
                                    className="px-2 py-1 bg-[var(--accent)]/10 text-[var(--accent)] rounded-lg text-xs font-bold hover:bg-[var(--accent)]/20"
                                >
                                    + New Group
                                </button>
                            </div>

                            {isCreatingGroup && (
                                <form onSubmit={handleCreateGroup} className="bg-slate-50 p-3 rounded-xl mb-4 border border-[var(--border)]">
                                    <input name="name" type="text" placeholder="Group Name" required className="input-base w-full mb-2 h-8 text-xs" />
                                    <div className="flex gap-2">
                                        <input name="color" type="color" defaultValue="#7c3aed" className="w-8 h-8 rounded cursor-pointer p-0 border-0" />
                                        <div className="flex-1 flex gap-2">
                                            <button type="button" onClick={() => setIsCreatingGroup(false)} className="flex-1 h-8 rounded bg-white text-xs font-medium border border-[var(--border)] hover:bg-slate-100">Cancel</button>
                                            <button type="submit" className="flex-1 h-8 rounded bg-[var(--accent)] text-white text-xs font-bold">Create</button>
                                        </div>
                                    </div>
                                </form>
                            )}

                            {editingGroup && (
                                <form onSubmit={handleUpdateGroup} className="bg-slate-50 p-3 rounded-xl mb-4 border border-[var(--border)]">
                                    <input name="name" type="text" defaultValue={editingGroup.name} required className="input-base w-full mb-2 h-8 text-xs" />
                                    <div className="flex gap-2">
                                        <input name="color" type="color" defaultValue={editingGroup.color} className="w-8 h-8 rounded cursor-pointer p-0 border-0" />
                                        <div className="flex-1 flex gap-2">
                                            <button type="button" onClick={() => setEditingGroup(null)} className="flex-1 h-8 rounded bg-white text-xs font-medium border border-[var(--border)] hover:bg-slate-100">Cancel</button>
                                            <button type="submit" className="flex-1 h-8 rounded bg-indigo-600 text-white text-xs font-bold">Save</button>
                                        </div>
                                    </div>
                                </form>
                            )}

                            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                                {groups.map(g => (
                                    <div key={g.id} className="flex justify-between items-center p-2 rounded-lg border border-[var(--border)] bg-white hover:border-[var(--accent)]/50 transition-colors">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full" style={{backgroundColor: g.color}}></div>
                                            <span className="text-xs font-bold">{g.name}</span>
                                        </div>
                                        <div className="flex gap-1 opacity-50 hover:opacity-100 transition-opacity">
                                            <button onClick={() => setEditingGroup(g)} className="p-1 hover:bg-slate-100 rounded text-slate-500">✎</button>
                                            <button onClick={() => handleDeleteGroup(g.id)} className="p-1 hover:bg-red-50 rounded text-red-500">×</button>
                                        </div>
                                    </div>
                                ))}
                                {groups.length === 0 && <div className="text-xs text-center text-slate-400 py-4">No groups created yet</div>}
                            </div>
                        </div>

                        <div className="w-full md:w-2/3">
                            <div className="mb-4 bg-slate-50 p-4 rounded-xl border border-[var(--border)]">
                                <h3 className="font-bold text-sm mb-3">Add Presentation to Group</h3>
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <select 
                                        value={selectedGroupIdForAdd}
                                        onChange={e => setSelectedGroupIdForAdd(e.target.value)}
                                        className="input-base text-xs sm:w-1/3"
                                    >
                                        <option value="">Select Group...</option>
                                        {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                    </select>
                                    
                                    <div className="flex-1 relative">
                                        <input 
                                            type="text"
                                            className="input-base text-xs w-full"
                                            placeholder="Search presentation by title or presenter..."
                                            value={slotSearchQuery}
                                            onChange={e => {
                                                setSlotSearchQuery(e.target.value);
                                                setIsSlotDropdownOpen(true);
                                                if (!e.target.value) setSelectedSlotId('');
                                            }}
                                            onFocus={() => setIsSlotDropdownOpen(true)}
                                            onBlur={() => setTimeout(() => setIsSlotDropdownOpen(false), 200)}
                                        />
                                        {isSlotDropdownOpen && (
                                            <div className="absolute top-full left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white border border-[var(--border)] rounded-lg shadow-lg z-50">
                                                {programSlots
                                                    .filter(s => 
                                                        s.title?.toLowerCase().includes(slotSearchQuery.toLowerCase()) || 
                                                        s.presenter_name?.toLowerCase().includes(slotSearchQuery.toLowerCase()) ||
                                                        s.session_name?.toLowerCase().includes(slotSearchQuery.toLowerCase())
                                                    )
                                                    .map(s => (
                                                    <div 
                                                        key={s.id} 
                                                        className="px-3 py-2 text-xs hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0"
                                                        onClick={() => {
                                                            setSelectedSlotId(s.id);
                                                            setSlotSearchQuery(`${s.session_name} - ${s.title} (${s.presenter_name || 'TBA'})`);
                                                            setIsSlotDropdownOpen(false);
                                                        }}
                                                    >
                                                        <div className="font-bold text-slate-800">{s.title}</div>
                                                        <div className="text-[10px] text-slate-500">{s.session_name} • {s.presenter_name || 'TBA'}</div>
                                                    </div>
                                                ))}
                                                {programSlots.filter(s => 
                                                    s.title?.toLowerCase().includes(slotSearchQuery.toLowerCase()) || 
                                                    s.presenter_name?.toLowerCase().includes(slotSearchQuery.toLowerCase()) ||
                                                    s.session_name?.toLowerCase().includes(slotSearchQuery.toLowerCase())
                                                ).length === 0 && (
                                                    <div className="px-3 py-2 text-xs text-slate-500">No presentations found.</div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <button 
                                        onClick={handleAddItem}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors"
                                    >
                                        Add
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {groups.map(group => {
                                    const groupItems = itemsByGroup[group.id] || [];
                                    if (groupItems.length === 0) return null;
                                    
                                    return (
                                        <div key={group.id} className="border border-[var(--border)] rounded-xl overflow-hidden">
                                            <div className="bg-slate-50 px-3 py-2 border-b border-[var(--border)] flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full" style={{backgroundColor: group.color}}></div>
                                                <h4 className="text-xs font-bold text-slate-700">{group.name} ({groupItems.length})</h4>
                                            </div>
                                            <div className="divide-y divide-[var(--border)]">
                                                {groupItems.map(item => (
                                                    <div key={item.id} className="p-3 flex justify-between items-start gap-3 hover:bg-slate-50/50">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-[10px] font-bold text-indigo-600 mb-0.5 uppercase tracking-wide">{item.session_name}</div>
                                                            <div className="text-[13px] font-semibold leading-tight mb-1 truncate">{item.title}</div>
                                                            <div className="text-[11px] text-slate-500">{item.presenter_name || 'No presenter'}</div>
                                                        </div>
                                                        <button 
                                                            onClick={() => handleRemoveItem(item.id)}
                                                            className="text-slate-400 hover:text-red-500 p-1"
                                                            title="Remove from group"
                                                        >
                                                            ×
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {!loading && activeTab === 'voters' && (
                <div className="space-y-4 animate-in fade-in duration-300">
                    <div className="card p-4">
                        <div className="flex flex-col md:flex-row gap-3 items-end">
                            <div className="flex-1 w-full relative">
                                <label className="block text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1.5">Search to Add Voter</label>
                                <input 
                                    type="text" 
                                    placeholder="Search participant by name or email..."
                                    value={voterSearch}
                                    onChange={(e) => setVoterSearch(e.target.value)}
                                    className="input-base w-full"
                                />
                                
                                {voterSearchResults.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[var(--border)] rounded-lg shadow-lg z-50 overflow-hidden">
                                        {voterSearchResults.map(p => (
                                            <div key={p.id} className="px-3 py-2 hover:bg-[var(--bg)] flex justify-between items-center border-b border-[var(--bg)] last:border-0 transition-colors">
                                                <div>
                                                    <div className="text-xs font-medium text-[var(--foreground)]">{p.name}</div>
                                                    <div className="text-[10px] text-[var(--muted)]">{p.email}</div>
                                                </div>
                                                <button 
                                                    onClick={() => handleAddVoter(p.id)}
                                                    disabled={actionLoadingId === `add-${p.id}`}
                                                    className="btn-primary py-1 px-3 text-xs"
                                                    style={{background:'var(--accent)'}}
                                                >
                                                    {actionLoadingId === `add-${p.id}` ? '...' : '+ Add'}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="flex-none">
                                <button 
                                    onClick={handleAddAllCheckedIn}
                                    disabled={actionLoadingId === 'add-all-checked-in'}
                                    className="h-9 px-3 bg-white border border-[var(--border)] rounded-lg text-[10px] font-bold text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-colors uppercase tracking-wider disabled:opacity-50 flex items-center gap-2"
                                    title="Add all participants who have checked in to the conference"
                                >
                                    {actionLoadingId === 'add-all-checked-in' ? (
                                        <span className="w-3 h-3 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin inline-block"></span>
                                    ) : '👥'} 
                                    Add All Checked-In Attendees
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="table-container">
                        <div className="bg-[#fafafa] border-b border-[var(--border)] px-3 py-2 flex justify-between items-center h-12">
                            <div className="flex items-center gap-3">
                                <span className="text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wider">Custom Voters</span>
                                {selectedVoterIds.size > 0 && (
                                    <button 
                                        onClick={handleBulkInvite}
                                        disabled={isSendingBulk}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider shadow-lg transition-all disabled:opacity-50"
                                    >
                                        {isSendingBulk ? 'Sending...' : `Send Invites (${selectedVoterIds.size})`}
                                    </button>
                                )}
                            </div>
                            <div className="text-xs bg-[var(--accent)]/10 px-3 py-1.5 rounded-full text-[var(--muted)]">
                                Total: <strong className="text-[var(--foreground)] ml-1">{voters.length}</strong>
                            </div>
                        </div>
                        <table>
                            <thead>
                                <tr>
                                    <th className="w-10">
                                        <input 
                                            type="checkbox"
                                            className="rounded border-slate-300 text-indigo-600"
                                            checked={selectedVoterIds.size === voters.length && voters.length > 0}
                                            onChange={toggleSelectAllVoters}
                                        />
                                    </th>
                                    <th>Participant</th>
                                    <th>Status</th>
                                    <th>Assigned Groups</th>
                                    <th className="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {voters.length === 0 ? (
                                    <tr><td colSpan="5" className="text-center text-[var(--muted)] py-10 text-xs">No custom voters assigned yet.</td></tr>
                                ) : (
                                    voters.map(v => (
                                        <tr key={v.id}>
                                            <td>
                                                <input 
                                                    type="checkbox"
                                                    className="rounded border-slate-300 text-indigo-600"
                                                    checked={selectedVoterIds.has(v.id)}
                                                    onChange={() => toggleSelectVoter(v.id)}
                                                />
                                            </td>
                                            <td>
                                                <div className="font-medium text-[var(--foreground)]">{v.name}</div>
                                                <div className="text-[10px] text-[var(--muted)]">{v.email}</div>
                                            </td>
                                            <td>
                                                <span className="badge" style={{
                                                    background: v.has_custom_voted ? '#e8faf0' : '#f5f5f7',
                                                    color: v.has_custom_voted ? '#34c759' : '#86868b',
                                                }}>
                                                    {v.has_custom_voted ? 'Voted' : 'Authorized'}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="flex flex-wrap gap-1">
                                                    {groups.map(g => {
                                                        const isAssigned = (v.custom_voting_group || []).includes(g.id);
                                                        return (
                                                            <button
                                                                key={g.id}
                                                                onClick={() => handleVoterGroupChange(v.id, v.custom_voting_group || [], g.id)}
                                                                className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                                                                    isAssigned 
                                                                    ? 'bg-slate-900 border-slate-900 text-white' 
                                                                    : 'bg-white border-slate-200 text-slate-400 hover:border-slate-400'
                                                                }`}
                                                            >
                                                                {g.name}
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                            </td>
                                            <td className="text-right">
                                                <div className="flex justify-end gap-1">
                                                    <button 
                                                        onClick={() => handleSendInvite(v.id)}
                                                        disabled={actionLoadingId === `invite-${v.id}`}
                                                        className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded"
                                                        title="Send Invitation"
                                                    >
                                                        ✉️
                                                    </button>
                                                    {userRole === 'superadmin' && (
                                                        <button 
                                                            onClick={() => handleResetVoter(v.id)}
                                                            disabled={actionLoadingId === `reset-${v.id}`}
                                                            className="p-1.5 text-amber-600 hover:bg-amber-50 rounded"
                                                            title="Reset Votes"
                                                        >
                                                            ↺
                                                        </button>
                                                    )}
                                                    <button 
                                                        onClick={() => handleRemoveVoter(v.id)}
                                                        disabled={actionLoadingId === `remove-${v.id}`}
                                                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded"
                                                        title="Remove Voter"
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {!loading && activeTab === 'results' && (
                <div className="space-y-4 animate-in fade-in duration-300">
                    <div className="card p-3 flex justify-between items-center bg-[#fafafa]">
                        <h3 className="text-xs font-bold text-slate-700">Voting Results</h3>
                        {userRole === 'superadmin' && (
                            <button
                                onClick={handleResetResults}
                                disabled={isResetting}
                                className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-[11px] font-bold border border-red-200 hover:bg-red-100"
                            >
                                {isResetting ? 'Resetting...' : 'Reset All Results'}
                            </button>
                        )}
                    </div>

                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th style={{width: 50}}>Rank</th>
                                    <th>Presentation</th>
                                    <th>Group</th>
                                    <th className="text-center" style={{width: 80}}>Votes</th>
                                    <th className="text-center" style={{width: 100}}>Score</th>
                                </tr>
                            </thead>
                            <tbody>
                                {results.length === 0 ? (
                                    <tr><td colSpan="5" className="text-center text-[var(--muted)] py-10 text-xs">No results available yet.</td></tr>
                                ) : (
                                    results.map((r, index) => {
                                        const rank = index + 1;
                                        return (
                                            <tr key={r.item_id}>
                                                <td>
                                                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs ${
                                                        rank === 1 ? 'bg-yellow-100 text-yellow-700' :
                                                        rank === 2 ? 'bg-slate-100 text-slate-500' :
                                                        rank === 3 ? 'bg-orange-100 text-orange-700' :
                                                        'text-[var(--muted)]'
                                                    }`}>
                                                        {rank}
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="font-medium text-[var(--foreground)]">{r.title}</div>
                                                    <div className="text-[10px] text-[var(--muted)]">{r.presenter_name || 'TBA'}</div>
                                                </td>
                                                <td>
                                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{backgroundColor: `${r.group_color}15`, color: r.group_color}}>
                                                        {r.group_name}
                                                    </span>
                                                </td>
                                                <td className="text-center font-bold">{r.votesCount}</td>
                                                <td className="text-center">
                                                    <span className="font-black text-indigo-600 text-base">{r.calculatedScore.toFixed(2)}</span>
                                                    <div className="text-[9px] text-[var(--muted)] mt-0.5">({r.points} pts)</div>
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
