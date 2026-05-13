'use client';

import { useState } from 'react';
import ParticipantBadge from './ParticipantBadge';
import ParticipantQRBadge from './ParticipantQRBadge';
import ParticipantVoterToggle from './ParticipantVoterToggle';
import { Mail, QrCode, CheckCircle2, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { sendParticipantCheckinQR, resetParticipantCheckin, manualCheckinParticipant } from '../actions/participants-qr';

export default function ParticipantRow({ person, activeConfId, userRole, selected, onSelect }) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isSendingQR, setIsSendingQR] = useState(false);
    const [isResetting, setIsResetting] = useState(false);
    const [isCheckingIn, setIsCheckingIn] = useState(false);

    const handleSendQR = async (e) => {
        e.stopPropagation();
        if (!person.primary_registration_id) {
            alert('No registration found for this participant in this conference context.');
            return;
        }
        if (!confirm(`Send Check-in QR to ${person.email}?`)) return;

        setIsSendingQR(true);
        try {
            const res = await sendParticipantCheckinQR(person.primary_registration_id);
            if (res.success) {
                alert('QR Email sent successfully!');
            }
        } catch (error) {
            alert(error.message);
        } finally {
            setIsSendingQR(false);
        }
    };
    
    const handleResetCheckin = async (e) => {
        e.stopPropagation();
        if (!confirm('Are you sure you want to RESET the check-in status for this participant? This will allow them to be scanned again.')) return;
        
        setIsResetting(true);
        try {
            const res = await resetParticipantCheckin(person.primary_registration_id);
            if (res.success) {
                alert('Check-in status reset successfully!');
            }
        } catch (error) {
            alert(error.message);
        } finally {
            setIsResetting(false);
        }
    };
    
    const handleManualCheckin = async (e) => {
        e.stopPropagation();
        if (!confirm(`Manually check-in ${person.name}?`)) return;
        
        setIsCheckingIn(true);
        try {
            const res = await manualCheckinParticipant(person.primary_registration_id);
            if (res.success) {
                alert('Checked in successfully!');
            }
        } catch (error) {
            alert(error.message);
        } finally {
            setIsCheckingIn(false);
        }
    };

    const statuses = person.payment_statuses ? person.payment_statuses.toLowerCase().split(', ') : [];
    // Parse all payments from the JSON array
    const payments = person.all_payments_json ? (typeof person.all_payments_json === 'string' ? JSON.parse(person.all_payments_json) : person.all_payments_json) : [];
    
    // Calculate total debt: use balance if it exists, otherwise use amount if not paid
    const totalDebt = payments.reduce((sum, pay) => {
        const balance = pay?.balance !== null ? Number(pay?.balance) : (pay?.status?.toLowerCase() !== 'paid' ? Number(pay?.amount || 0) : 0);
        return sum + balance;
    }, 0);

    // Filter out nulls and sort by date latest first
    const validPayments = Array.isArray(payments) ? payments.filter(p => p !== null) : [];
    const sortedPayments = validPayments.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Get latest info for the summary display
    const latestPayment = sortedPayments[0] || null;

    const isPaid = statuses.length > 0 && statuses.every(s => s === 'paid') && totalDebt <= 0;
    const isPending = statuses.includes('pending') || totalDebt > 0;
    const hasNoPayments = statuses.length === 0;

    const confTokens = person.conference_tokens ? person.conference_tokens.split('|').map(item => {
        const [acronym, token, registrationId, conferenceId] = item.split(':');
        return { acronym, token, registrationId, conferenceId };
    }) : [];

    return (
        <>
            <tr 
                onClick={() => setIsExpanded(!isExpanded)} 
                className={`cursor-pointer transition-colors border-b border-slate-100 ${isExpanded ? 'bg-slate-50/80' : 'hover:bg-slate-50/50'} ${selected ? 'bg-indigo-50/50' : ''}`}
            >
                <td className="py-4" onClick={(e) => e.stopPropagation()}>
                    <input 
                        type="checkbox" 
                        checked={selected}
                        onChange={onSelect}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 ml-1"
                    />
                </td>
                <td className="py-4">
                    <div className="flex items-center gap-2">
                        <div className="font-medium text-[var(--foreground)]">{person.name}</div>
                        <span className={`text-[var(--muted)] transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                             <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                        </span>
                    </div>
                    <div className="flex flex-col mt-0.5">
                        <div className="text-[10px] text-[var(--muted)] flex items-center gap-2">
                            {person.registration_type || 'Standard'}
                            {person.qr_email_sent_at && <Mail className="w-2.5 h-2.5 text-blue-500" title="QR Sent" />}
                        </div>
                        {latestPayment?.group && (
                            <div className="text-[9px] text-indigo-500 font-bold uppercase tracking-wider mt-0.5">{latestPayment.group}</div>
                        )}
                    </div>
                </td>
                <td className="text-[var(--muted)] py-4">{person.email}</td>
                <td className="py-4">
                    <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        person.qr_scanned_at ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-slate-50 text-slate-400 border border-slate-100'
                    }`}>
                        {person.qr_scanned_at ? (
                            <>
                                <CheckCircle2 className="w-2.5 h-2.5" />
                                {new Date(person.qr_scanned_at).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })}
                                {person.qr_is_manual ? <span className="ml-1 text-[8px] opacity-70 bg-green-200/50 px-1 rounded">MANUAL</span> : null}
                            </>
                        ) : 'Not Yet'}
                    </div>
                </td>
                <td className="py-4">
                    <div className="flex flex-wrap gap-1">
                        {confTokens.length > 0 ? confTokens.map(({ acronym, token, registrationId, conferenceId }) => (
                            <div key={acronym} className="flex items-center gap-1">
                                <ParticipantBadge 
                                    participantName={person.name} 
                                    conferenceAcronym={acronym} 
                                    token={token} 
                                    registrationId={registrationId}
                                    conferenceId={conferenceId}
                                    institution={person.regInstitution || person.institution}
                                />
                                <ParticipantQRBadge 
                                    participantName={person.name}
                                    conferenceAcronym={acronym}
                                    token={token}
                                    registrationId={registrationId}
                                    conferenceId={conferenceId}
                                />
                            </div>
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
                        <div className="flex flex-col gap-1 mt-1">
                            {totalDebt > 0 ? (
                                <div className="text-[10px] text-red-600 font-bold flex items-center gap-1 bg-red-50 px-1.5 py-0.5 rounded border border-red-100 w-fit">
                                    <span className="w-1 h-1 rounded-full bg-red-500 animate-pulse" />
                                    Debt: {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(totalDebt)}
                                </div>
                            ) : (
                                <div className="text-[11px] font-bold text-[var(--foreground)]">
                                    {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(person.total_paid)}
                                </div>
                            )}
                            
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
                    <td colSpan="6" className="pb-6 pt-0">
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

                                        <div className="pt-4 space-y-3">
                                            <div className="text-[9px] uppercase tracking-[0.1em] text-[var(--muted)] font-bold mb-2">Check-in Actions</div>
                                            <div className="flex flex-wrap gap-2">
                                                <button 
                                                    onClick={handleSendQR}
                                                    disabled={isSendingQR || !person.qr_token}
                                                    className="flex items-center gap-2 px-3 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-bold hover:bg-black transition-colors disabled:opacity-50"
                                                >
                                                    {isSendingQR ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
                                                    {person.qr_email_sent_at ? 'Resend Check-in QR' : 'Send Check-in QR'}
                                                </button>
                                                {!person.qr_scanned_at && (
                                                    <button 
                                                        onClick={handleManualCheckin}
                                                        disabled={isCheckingIn}
                                                        className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-xl text-[10px] font-bold hover:bg-green-700 transition-colors disabled:opacity-50"
                                                    >
                                                        {isCheckingIn ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                                                        Manual Check-in
                                                    </button>
                                                )}
                                                {!person.qr_token && (
                                                    <p className="text-[9px] text-amber-600 font-medium italic">Please run "Sync QR" to generate tokens first.</p>
                                                )}
                                                {person.qr_scanned_at && (
                                                    <div className="flex items-center gap-1.5 px-3 py-2 bg-green-50 text-green-700 rounded-xl text-[10px] font-bold border border-green-100">
                                                        <CheckCircle2 className="w-3 h-3" />
                                                        Checked In: {new Date(person.qr_scanned_at).toLocaleString()}
                                                    </div>
                                                )}
                                                {userRole === 'superadmin' && person.qr_scanned_at && (
                                                    <button 
                                                        onClick={handleResetCheckin}
                                                        disabled={isResetting}
                                                        className="flex items-center gap-2 px-3 py-2 bg-red-50 text-red-600 rounded-xl text-[10px] font-bold hover:bg-red-100 transition-colors border border-red-100 disabled:opacity-50"
                                                        title="Superadmin: Reset Check-in Status"
                                                    >
                                                        {isResetting ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                                                        Reset Check-in
                                                    </button>
                                                )}
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
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className="text-[8px] text-[var(--muted)] italic">{new Date(pay.date).toLocaleDateString()} via {pay.method || 'ndef'}</span>
                                                            {(() => {
                                                                const effectiveBalance = pay.balance !== null ? Number(pay.balance) : (pay.status?.toLowerCase() !== 'paid' ? Number(pay.amount) : 0);
                                                                return effectiveBalance > 0 && (
                                                                    <span className="text-[9px] text-red-500 font-bold">Unpaid: {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(effectiveBalance)}</span>
                                                                );
                                                            })()}
                                                        </div>
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
