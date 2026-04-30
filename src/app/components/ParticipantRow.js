'use client';

import { useState } from 'react';
import ParticipantBadge from './ParticipantBadge';
import ParticipantVoterToggle from './ParticipantVoterToggle';

export default function ParticipantRow({ person, activeConfId }) {
    const [isExpanded, setIsExpanded] = useState(false);

    const statuses = person.payment_statuses ? person.payment_statuses.toLowerCase().split(', ') : [];
    const isPaid = statuses.length > 0 && statuses.every(s => s === 'paid');
    const isPending = statuses.includes('pending');
    const hasNoPayments = statuses.length === 0;

    const confTokens = person.conference_tokens ? person.conference_tokens.split('|').map(item => {
        const [acronym, token] = item.split(':');
        return { acronym, token };
    }) : [];

    // Parse all payments from the JSON array
    const payments = person.all_payments_json ? (typeof person.all_payments_json === 'string' ? JSON.parse(person.all_payments_json) : person.all_payments_json) : [];
    
    // Filter out nulls and sort by date latest first
    const validPayments = Array.isArray(payments) ? payments.filter(p => p !== null) : [];
    const sortedPayments = validPayments.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Get latest info for the summary display
    const latestPayment = sortedPayments[0] || null;

    return (
        <>
            <tr 
                onClick={() => setIsExpanded(!isExpanded)} 
                className={`cursor-pointer transition-colors border-b border-slate-100 ${isExpanded ? 'bg-slate-50/80' : 'hover:bg-slate-50/50'}`}
            >
                <td className="py-4">
                    <div className="flex items-center gap-2">
                        <div className="font-medium text-[var(--foreground)]">{person.name}</div>
                        <span className={`text-[var(--muted)] transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                             <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                        </span>
                    </div>
                    <div className="flex flex-col mt-0.5">
                        <div className="text-[10px] text-[var(--muted)]">{person.registration_type || 'Standard'}</div>
                        {latestPayment?.group && (
                            <div className="text-[9px] text-indigo-500 font-bold uppercase tracking-wider mt-0.5">{latestPayment.group}</div>
                        )}
                    </div>
                </td>
                <td className="text-[var(--muted)] py-4">{person.email}</td>
                <td className="py-4">
                    <div className="flex flex-wrap gap-1">
                        {confTokens.length > 0 ? confTokens.map(({ acronym, token }) => (
                            <ParticipantBadge 
                                key={acronym} 
                                participantName={person.name} 
                                conferenceAcronym={acronym} 
                                token={token} 
                            />
                        )) : (
                            <span className="text-[var(--muted)] text-[10px]">—</span>
                        )}
                    </div>
                </td>
                <td className="py-4">
                    {hasNoPayments ? (
                        <span className="text-[var(--muted)] text-xs">—</span>
                    ) : (
                        <div className="flex flex-col gap-0.5">
                            <span className="badge" style={{
                                background: isPaid ? '#e8faf0' : isPending ? '#fff8e8' : '#f5f5f7',
                                color: isPaid ? '#34c759' : isPending ? '#ff9f0a' : '#86868b',
                                fontSize: '9px',
                                padding: '2px 6px'
                            }}>
                                <span className="w-[4px] h-[4px] rounded-full" style={{ background: isPaid ? '#34c759' : isPending ? '#ff9f0a' : '#aeaeb2' }} />
                                {isPaid ? 'Paid' : isPending ? 'Pending' : 'Mixed'}
                            </span>
                            <div className="flex items-baseline gap-1.5 mt-0.5">
                                <span className="text-xs font-medium text-[var(--foreground)]">
                                    {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(person.total_paid)}
                                </span>
                                {latestPayment?.invoice && (
                                    <span className="text-[9px] text-[var(--muted)] font-mono">{latestPayment.invoice}</span>
                                )}
                            </div>
                        </div>
                    )}
                </td>
                <td className="text-right py-4" onClick={(e) => e.stopPropagation()}>
                    <ParticipantVoterToggle 
                        participantId={person.id} 
                        conferenceId={activeConfId}
                        isVoter={person.cluster_for_review !== null} 
                    />
                </td>
            </tr>
            {isExpanded && (
                <tr className="bg-slate-50/80 border-0">
                    <td colSpan="5" className="pb-6 pt-0">
                        <div className="mx-4 p-5 bg-white rounded-2xl border border-slate-200/60 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="grid grid-cols-2 gap-8">
                                <div>
                                    <h4 className="text-[9px] uppercase tracking-[0.1em] text-[var(--muted)] font-bold mb-4 flex items-center gap-1.5">
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                        Billing Information
                                    </h4>
                                    <div className="text-xs text-[var(--foreground)] space-y-4">
                                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                            <div className="text-[10px] text-[var(--muted)] uppercase font-bold tracking-wider mb-1">Client</div>
                                            <div className="font-semibold text-sm">{latestPayment?.client || 'No client info provided'}</div>
                                            {latestPayment?.group && (
                                                <div className="mt-2">
                                                    <span className="text-[10px] text-[var(--muted)] uppercase font-bold tracking-wider block mb-1">Group</span>
                                                    <span className="text-indigo-600 font-medium">{latestPayment.group}</span>
                                                </div>
                                            )}
                                        </div>
                                        
                                        <div className="flex flex-col gap-2">
                                            <div className="flex justify-between items-center py-2 border-b border-slate-100">
                                                <span className="text-[var(--muted)]">Latest Invoice</span>
                                                <span className="font-mono bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 text-[10px]">{latestPayment?.invoice || 'N/A'}</span>
                                            </div>
                                            <div className="flex justify-between items-center py-2 border-b border-slate-100">
                                                <span className="text-[var(--muted)]">Payment Method</span>
                                                <span className="font-medium capitalize">{latestPayment?.method || 'Standard'}</span>
                                            </div>
                                            <div className="flex justify-between items-center py-2 border-b border-slate-100">
                                                <span className="text-[var(--muted)]">Registration Date</span>
                                                <span className="font-medium">{new Date(person.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <h4 className="text-[9px] uppercase tracking-[0.1em] text-[var(--muted)] font-bold mb-4 flex items-center gap-1.5">
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
                                        Payment History & Tickets
                                    </h4>
                                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 no-scrollbar">
                                        {sortedPayments.length > 0 ? sortedPayments.map((pay, pIdx) => {
                                            const tickets = pay.tickets ? (typeof pay.tickets === 'string' ? JSON.parse(pay.tickets) : pay.tickets) : [];
                                            const pStatus = pay.status?.toLowerCase();
                                            const pIsPaid = pStatus === 'paid';
                                            const pIsPending = pStatus === 'pending';
                                            
                                            return (
                                                <div key={pIdx} className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <span className="text-[9px] font-mono text-[var(--muted)] uppercase tracking-tighter">#{pay.invoice || 'INV-' + pIdx}</span>
                                                        <span className="badge" style={{
                                                            background: pIsPaid ? '#e8faf0' : pIsPending ? '#fff8e8' : '#fef2f2',
                                                            color: pIsPaid ? '#34c759' : pIsPending ? '#ff9f0a' : '#ef4444',
                                                            fontSize: '8px',
                                                            padding: '1px 5px',
                                                            borderRadius: '100px'
                                                        }}>
                                                            {pay.status || 'NDEF'}
                                                        </span>
                                                    </div>
                                                    <ul className="space-y-1.5">
                                                        {tickets.map((t, tIdx) => (
                                                            <li key={tIdx} className="flex justify-between text-xs items-start">
                                                                <div className="flex flex-col">
                                                                    <span className="text-[var(--foreground)] font-medium leading-tight">{t.name || t.ticket_data?.name}</span>
                                                                    {t.discount > 0 && (
                                                                        <span className="text-[8px] text-red-500 font-bold mt-0.5">-{t.discount}% OFF</span>
                                                                    )}
                                                                </div>
                                                                <span className="font-mono text-[var(--muted)] text-[10px]">
                                                                    {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(t.price)}
                                                                </span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                    <div className="mt-2 pt-2 border-t border-slate-200/60 flex justify-between items-baseline">
                                                        <span className="text-[8px] text-[var(--muted)] italic">{new Date(pay.date).toLocaleDateString()} via {pay.method || 'ndef'}</span>
                                                        <span className="text-xs font-bold text-[var(--foreground)]">{new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(pay.amount)}</span>
                                                    </div>
                                                </div>
                                            );
                                        }) : (
                                            <div className="text-[var(--muted)] text-xs italic p-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                                No detailed payment records found
                                            </div>
                                        )}
                                    </div>
                                    <div className="mt-4 pt-3 border-t-2 border-slate-100 flex justify-between items-center">
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--foreground)]">Total Combined</span>
                                        <span className="text-sm font-black text-indigo-600">{new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(person.total_paid)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
}
