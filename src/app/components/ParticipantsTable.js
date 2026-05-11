'use client';

import { useState, useTransition } from 'react';
import ParticipantRow from './ParticipantRow';
import { sendParticipantCheckinQR } from '../actions/participants-qr';
import { Loader2, Mail } from 'lucide-react';

export default function ParticipantsTable({ participants, activeConfId, userRole, sortBy, order, searchParams }) {
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [isSendingBulk, startSendingBulk] = useTransition();

    const getSortUrl = (field) => {
        const newOrder = sortBy === field && order === 'asc' ? 'desc' : 'asc';
        const params = new URLSearchParams({ ...searchParams, sortBy: field, order: newOrder });
        return `?${params.toString()}`;
    };

    const SortIcon = ({ field }) => {
        if (sortBy !== field) return <span className="opacity-20 ml-1">↕</span>;
        return <span className="ml-1 text-indigo-600">{order === 'asc' ? '↑' : '↓'}</span>;
    };

    const toggleSelectAll = () => {
        if (selectedIds.size > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(participants.map(p => p.primary_registration_id).filter(id => id)));
        }
    };

    const toggleSelect = (registrationId) => {
        const next = new Set(selectedIds);
        if (next.has(registrationId)) next.delete(registrationId);
        else next.add(registrationId);
        setSelectedIds(next);
    };

    const handleBulkEmail = () => {
        if (selectedIds.size === 0) return;
        if (!confirm(`Send Check-in QR emails to ${selectedIds.size} participants?`)) return;

        startSendingBulk(async () => {
            let success = 0;
            let fail = 0;
            for (const id of selectedIds) {
                try {
                    await sendParticipantCheckinQR(id);
                    success++;
                } catch (e) {
                    fail++;
                }
            }
            alert(`Bulk send complete: ${success} successful, ${fail} failed.`);
            setSelectedIds(new Set());
        });
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200 shadow-sm min-h-[52px]">
                <div className="flex items-center gap-3">
                    {selectedIds.size > 0 ? (
                        <button 
                            onClick={handleBulkEmail}
                            disabled={isSendingBulk}
                            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-lg shadow-indigo-100 transition-all disabled:opacity-50 animate-in fade-in zoom-in duration-200"
                        >
                            {isSendingBulk ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
                            Send Check-in QRs ({selectedIds.size})
                        </button>
                    ) : (
                        <div className="text-[10px] text-slate-400 font-medium px-1 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                            Select participants to send bulk check-in emails
                        </div>
                    )}
                </div>
            </div>

            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            <th className="w-10">
                                <input 
                                    type="checkbox" 
                                    ref={(el) => {
                                        if (el) {
                                            el.indeterminate = selectedIds.size > 0 && selectedIds.size < participants.length;
                                        }
                                    }}
                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    checked={selectedIds.size === participants.length && participants.length > 0}
                                    onChange={toggleSelectAll}
                                />
                            </th>
                            <th><a href={getSortUrl('name')} className="hover:text-indigo-600 flex items-center">Name <SortIcon field="name" /></a></th>
                            <th><a href={getSortUrl('email')} className="hover:text-indigo-600 flex items-center">Email <SortIcon field="email" /></a></th>
                            <th>Conferences</th>
                            <th>
                                <div className="flex gap-4">
                                    <a href={getSortUrl('paid')} className="hover:text-indigo-600 flex items-center">Paid <SortIcon field="paid" /></a>
                                    <a href={getSortUrl('debt')} className="hover:text-indigo-600 flex items-center text-red-500">Debt <SortIcon field="debt" /></a>
                                </div>
                            </th>
                            <th className="text-right"><a href={getSortUrl('created_at')} className="hover:text-indigo-600 flex items-center justify-end">Date <SortIcon field="created_at" /></a></th>
                        </tr>
                    </thead>
                    <tbody>
                        {participants.map((person) => (
                            <ParticipantRow 
                                key={person.id} 
                                person={person} 
                                activeConfId={activeConfId} 
                                userRole={userRole}
                                selected={selectedIds.has(person.primary_registration_id)}
                                onSelect={() => toggleSelect(person.primary_registration_id)}
                            />
                        ))}
                    </tbody>
                </table>
                
                {participants.length === 0 && (
                    <div className="p-10 text-center text-[var(--muted)] text-xs">
                        No participants found.
                    </div>
                )}
            </div>
        </div>
    );
}
