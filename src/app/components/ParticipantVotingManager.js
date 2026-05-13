'use client';

import { useState, useEffect } from 'react';
import { searchConferenceParticipants, getVotersForConference, updateParticipantClusters, removeVoter, sendVoterInvite } from '../actions/participantVoting';
import { resetParticipantVotes } from '../actions/posters';
import ParticipantClusterSelect from './ParticipantClusterSelect';

export default function ParticipantVotingManager({ conferences, allClusters, userRole, selectedConference, onConferenceChange }) {
    const [search, setSearch] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [voters, setVoters] = useState([]);
    const [loading, setLoading] = useState(false);

    const [inviteSending, setInviteSending] = useState(null);
    const [isSendingBulk, setIsSendingBulk] = useState(false);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [resettingId, setResettingId] = useState(null);

    const fetchVoters = async () => {
        if (!selectedConference) return;
        const data = await getVotersForConference(selectedConference);
        setVoters(data);
        setSelectedIds(new Set());
    };

    useEffect(() => { fetchVoters(); }, [selectedConference]);

    useEffect(() => {
        const performSearch = async () => {
            if (search.length < 2) { setSearchResults([]); return; }
            const data = await searchConferenceParticipants(selectedConference, search);
            setSearchResults(data);
        };
        const timer = setTimeout(performSearch, 300);
        return () => clearTimeout(timer);
    }, [search, selectedConference]);

    const addAsVoter = async (participantId) => {
        setLoading(true);
        await updateParticipantClusters(participantId, [], selectedConference);
        setSearch(''); setSearchResults([]);
        await fetchVoters();
        setLoading(false);
    };

    const handleRemoveVoter = async (participantId) => {
        if (!confirm('Remove this voter?')) return;
        setLoading(true);
        await removeVoter(participantId, selectedConference);
        await fetchVoters();
        setLoading(false);
    };

    const handleSendInvite = async (participantId) => {
        setInviteSending(participantId);
        const res = await sendVoterInvite(participantId, selectedConference);
        if (res.success) {
            alert('Invitation sent successfully!');
        } else {
            alert(res.error);
        }
        setInviteSending(null);
    };

    const handleResetVotes = async (participantId) => {
        if (!confirm('RESET votes for this user? This will remove their points from all posters and allow them to vote again.')) return;
        setResettingId(participantId);
        const res = await resetParticipantVotes(participantId, selectedConference);
        if (res.success) {
            alert('Votes reset successfully!');
            await fetchVoters();
        } else {
            alert(res.error);
        }
        setResettingId(null);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(voters.map(v => v.id)));
        }
    };

    const toggleSelect = (id) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const handleBulkInvite = async () => {
        if (selectedIds.size === 0) return;
        if (!confirm(`Send voting invitations to ${selectedIds.size} participants?`)) return;

        setIsSendingBulk(true);
        let success = 0;
        let fail = 0;

        for (const id of selectedIds) {
            try {
                const res = await sendVoterInvite(id, selectedConference);
                if (res.success) success++; else fail++;
                // Pace emails: wait 500ms
                await new Promise(r => setTimeout(r, 500));
            } catch (e) {
                fail++;
            }
        }

        alert(`Bulk invitations complete: ${success} successful, ${fail} failed.`);
        setIsSendingBulk(false);
        setSelectedIds(new Set());
    };

    const filteredClusters = allClusters.filter(c => c.conference_id == selectedConference);

    return (
        <div className="space-y-4">
            {/* Search & Add */}
            <div className="card p-4">
                <div className="flex flex-col md:flex-row gap-3 items-end">
                    <div className="w-full md:w-48">
                        <label className="block text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1.5">Conference</label>
                        <select 
                            value={selectedConference}
                            onChange={(e) => onConferenceChange(e.target.value)}
                            className="input-base w-full font-semibold"
                        >
                            {conferences.map(c => (
                                <option key={c.id} value={c.id}>{c.acronym}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex-1 w-full relative">
                        <label className="block text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1.5">Add New Voter</label>
                        <input 
                            type="text" 
                            placeholder="Search by name or email..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="input-base w-full"
                        />
                        
                        {searchResults.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[var(--border)] rounded-lg shadow-lg z-50 overflow-hidden">
                                {searchResults.map(p => (
                                    <div key={p.id} className="px-3 py-2 hover:bg-[var(--bg)] flex justify-between items-center border-b border-[var(--bg)] last:border-0 transition-colors">
                                        <div>
                                            <div className="text-xs font-medium text-[var(--foreground)]">{p.name}</div>
                                            <div className="text-[10px] text-[var(--muted)]">{p.email}</div>
                                        </div>
                                        <button 
                                            onClick={() => addAsVoter(p.id)}
                                            className="btn-primary"
                                            style={{background:'var(--accent)'}}
                                        >
                                            + Add
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Voters List */}
            <div className="table-container">
                <div className="bg-[#fafafa] border-b border-[var(--border)] px-3 py-2 flex justify-between items-center h-12">
                    <div className="flex items-center gap-3">
                        <span className="text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wider">Authorized Voters</span>
                        {selectedIds.size > 0 && (
                            <button 
                                onClick={handleBulkInvite}
                                disabled={isSendingBulk}
                                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider shadow-lg shadow-indigo-100 transition-all disabled:opacity-50 animate-in fade-in zoom-in duration-200"
                            >
                                {isSendingBulk ? (
                                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                                )}
                                Send Invites ({selectedIds.size})
                            </button>
                        )}
                    </div>
                    <div className="text-xs bg-[var(--accent)]/10 px-3 py-1.5 rounded-full text-[var(--muted)]">
                        Total Results: <strong className="text-[var(--foreground)] ml-1">{voters.length}</strong>
                    </div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th className="w-10">
                                <input 
                                    type="checkbox"
                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    checked={selectedIds.size === voters.length && voters.length > 0}
                                    onChange={toggleSelectAll}
                                />
                            </th>
                            <th>Participant</th>
                            <th>Status</th>
                            <th>Clusters</th>
                            <th className="text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {voters.length === 0 ? (
                            <tr><td colSpan="4" className="text-center text-[var(--muted)] py-10 text-xs">No voters yet. Search and add above.</td></tr>
                        ) : (
                            voters.map(p => (
                                <tr key={p.id}>
                                    <td>
                                        <input 
                                            type="checkbox"
                                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                            checked={selectedIds.has(p.id)}
                                            onChange={() => toggleSelect(p.id)}
                                        />
                                    </td>
                                    <td>
                                        <div className="font-medium text-[var(--foreground)]">{p.name}</div>
                                        <div className="text-[10px] text-[var(--muted)]">{p.email}</div>
                                    </td>
                                    <td>
                                        <span className="badge" style={{
                                            background: p.has_voted ? '#e8faf0' : '#f5f5f7',
                                            color: p.has_voted ? '#34c759' : '#86868b',
                                        }}>
                                            {p.has_voted ? 'Voted' : 'Authorized'}
                                        </span>
                                    </td>
                                    <td>
                                        <ParticipantClusterSelect 
                                            participantId={p.id} 
                                            conferenceId={selectedConference}
                                            currentClusters={p.cluster_for_review} 
                                            allClusters={filteredClusters} 
                                            onUpdate={fetchVoters}
                                        />
                                    </td>
                                    <td className="text-right">
                                        <div className="flex justify-end items-center gap-1">
                                            <button 
                                                onClick={() => handleSendInvite(p.id)}
                                                disabled={inviteSending === p.id}
                                                className={`p-1.5 rounded-md transition-all ${inviteSending === p.id ? 'bg-slate-50 opacity-50' : 'text-[var(--accent)] hover:bg-[var(--accent-light)]'}`}
                                                title="Send Invitation Email"
                                            >
                                                {inviteSending === p.id ? (
                                                    <div className="w-3.5 h-3.5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                                                ) : (
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                                                )}
                                            </button>
                                            {userRole === 'superadmin' && (
                                                <button 
                                                    onClick={() => handleResetVotes(p.id)}
                                                    disabled={resettingId === p.id}
                                                    className={`p-1.5 rounded-md transition-all ${resettingId === p.id ? 'opacity-50' : 'text-amber-500 hover:bg-amber-50'}`}
                                                    title="Reset User Votes"
                                                >
                                                    {resettingId === p.id ? (
                                                        <div className="w-3.5 h-3.5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                                                    ) : (
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
                                                    )}
                                                </button>
                                            )}
                                            <button 
                                                onClick={() => handleRemoveVoter(p.id)}
                                                className="text-[var(--muted)] hover:text-[#ff3b30] hover:bg-[#fff5f5] transition-colors p-1.5 rounded-md"
                                                title="Remove Voter"
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
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
    );
}
