'use client';
import { useState, useTransition } from 'react';
import { Mail, CheckCircle2, Loader2, QrCode as QrIcon } from 'lucide-react';
import { sendSocialDinnerQR, resetTicketScan, manualCheckinSocialDinner, addManualSocialDinnerTicket, removeSocialDinnerTicket } from '../actions/social-dinner';
import SocialDinnerTicketsBadge from './SocialDinnerTicketsBadge';
import { Plus, Trash2 } from 'lucide-react';

export default function SocialDinnerRow({ person, selected, onSelect, userRole }) {
  const [expanded, setExpanded] = useState(false);
  const [isSending, startSending] = useTransition();
  const [isResetting, startResetting] = useTransition();
  const [isCheckingIn, startCheckingIn] = useTransition();
  const [isModifying, startModifying] = useTransition();

  const handleAddTicket = (e) => {
    e.stopPropagation();
    if (!confirm(`Add one manual Social Dinner ticket for ${person.name}?`)) return;
    startModifying(async () => {
      try {
        await addManualSocialDinnerTicket(person.registration_id);
      } catch (e) {
        alert('Failed to add ticket: ' + e.message);
      }
    });
  };

  const handleRemoveTicket = (e, ticketId, isManual) => {
    e.stopPropagation();
    const msg = isManual 
      ? 'Are you sure you want to delete this manual ticket?' 
      : 'This is a sync-generated ticket. Removing it will hide it and prevent it from being re-synced. Continue?';
    if (!confirm(msg)) return;
    
    startModifying(async () => {
      try {
        await removeSocialDinnerTicket(ticketId);
      } catch (e) {
        alert('Failed to remove ticket: ' + e.message);
      }
    });
  };

  const handleResetScan = (e, ticketId) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to reset this scan? The user will need to scan again to enter.')) return;
    startResetting(async () => {
      try {
        await resetTicketScan(ticketId);
      } catch (e) {
        alert('Failed to reset scan: ' + e.message);
      }
    });
  };

  const handleSendEmail = (e) => {
    e.stopPropagation();
    if (!confirm(`Send QR code(s) to ${person.email}?`)) return;
    startSending(async () => {
      try {
        await sendSocialDinnerQR(person.registration_id);
        alert('Email sent successfully!');
      } catch (e) {
        alert('Failed to send email: ' + e.message);
      }
    });
  };

  const handleManualCheckin = (e, ticketId, index) => {
    e.stopPropagation();
    if (!confirm(`Manually check-in Ticket T${index+1} for ${person.name}?`)) return;
    startCheckingIn(async () => {
      try {
        await manualCheckinSocialDinner(ticketId);
        alert('Ticket checked in successfully!');
      } catch (e) {
        alert('Failed to check in: ' + e.message);
      }
    });
  };

  const tickets = person.tickets_status || [];
  const allSent = tickets.length > 0 && tickets.every(t => t.sent_at);
  const someSent = tickets.some(t => t.sent_at);
  const allScanned = tickets.length > 0 && tickets.every(t => t.scanned_at);
  const someScanned = tickets.some(t => t.scanned_at);

  return (
    <>
      <tr 
        className={`hover:bg-slate-50/50 transition-colors cursor-pointer ${expanded ? 'bg-slate-50/80' : ''}`}
        onClick={() => setExpanded(!expanded)}
      >
        <td onClick={(e) => e.stopPropagation()}>
          <input 
            type="checkbox" 
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            checked={selected}
            onChange={onSelect}
          />
        </td>
        <td>
          <div className="flex items-center gap-2">
            <div className="font-medium text-[13px]">{person.name}</div>
            <div className="flex gap-1">
              {allScanned ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" title="All tickets scanned" />
              ) : someScanned ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-green-400 opacity-60" title="Some tickets scanned" />
              ) : null}
              {allSent ? (
                <Mail className="w-3.5 h-3.5 text-blue-500" title="All QR codes sent" />
              ) : someSent ? (
                <Mail className="w-3.5 h-3.5 text-blue-400 opacity-60" title="Some QR codes sent" />
              ) : null}
            </div>
          </div>
        </td>
        <td>
          <div className="text-[13px] text-[var(--muted)]">{person.email}</div>
        </td>
        <td>
          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#0071e3]/10 text-[#0071e3]">
            {person.conference}
          </span>
        </td>
        <td className="text-center">
          <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
            person.tickets_status?.some(t => t.scanned_at) ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-slate-50 text-slate-400 border border-slate-100'
          }`}>
            {person.tickets_status?.filter(t => t.scanned_at).length || 0} / {person.tickets_status?.length || 0}
          </div>
        </td>
        <td className="text-center">
          <SocialDinnerTicketsBadge 
            participantName={person.name}
            conferenceAcronym={person.conference}
            tickets={person.tickets_status}
          />
        </td>
        <td>
          <div className="flex flex-col gap-1">
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider w-fit ${
              person.dinner_debt > 0 ? 'bg-[#ff3b30]/10 text-[#ff3b30]' :
              person.payment_status === 'paid' ? 'bg-[#34c759]/10 text-[#34c759]' :
              person.payment_status === 'pending' ? 'bg-[#ff9f0a]/10 text-[#ff9f0a]' :
              'bg-[#ff3b30]/10 text-[#ff3b30]'
            }`}>
              {person.dinner_debt > 0 ? 'Unpaid' : person.payment_status || 'Unknown'}
            </span>
            {person.dinner_debt > 0 ? (
              <div className="text-[10px] text-red-600 font-bold flex items-center gap-1 bg-red-50 px-1.5 py-0.5 rounded border border-red-100 w-fit">
                <span className="w-1 h-1 rounded-full bg-red-500 animate-pulse" />
                Debt: {new Intl.NumberFormat('de-DE', { style: 'currency', currency: person.currency || 'EUR' }).format(person.dinner_debt)}
              </div>
            ) : (
              <div className="text-[11px] font-bold text-[var(--foreground)]">
                {new Intl.NumberFormat('de-DE', { style: 'currency', currency: person.currency || 'EUR' }).format(person.amount_paid)}
              </div>
            )}
          </div>
        </td>
        <td>
          <div className="text-[13px] font-medium">{person.dietary_preference}</div>
        </td>
        <td className="text-right text-[var(--muted)]">
          <svg 
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className={`inline-block transition-transform ${expanded ? 'rotate-180' : ''}`}
          >
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </td>
      </tr>
      
      {expanded && (
        <tr className="bg-slate-50/30">
          <td colSpan="7" className="pb-6 pt-0 border-t-0">
            <div className="mx-4 p-5 bg-white rounded-2xl border border-slate-200/60 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left Column: Billing Info & QR Actions */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-[9px] uppercase tracking-[0.1em] text-[var(--muted)] font-bold flex items-center gap-1.5">
                      <QrIcon className="w-2.5 h-2.5" />
                      Ticket Management
                    </h4>
                    <button 
                      onClick={handleSendEmail}
                      disabled={isSending}
                      className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-md text-[10px] font-bold transition-all disabled:opacity-50"
                    >
                      {isSending ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Mail className="w-2.5 h-2.5" />}
                      Send QR Email
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-slate-100">
                      <span className="text-[11px] text-[var(--muted)] font-medium">Conference</span>
                      <span className="text-xs font-bold text-[var(--foreground)]">{person.conference}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-100">
                      <span className="text-[11px] text-[var(--muted)] font-medium">Dietary Preference</span>
                      <span className="text-xs font-bold text-[var(--accent)]">{person.dietary_preference}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-100">
                      <span className="text-[11px] text-[var(--muted)] font-medium">Tickets Issued</span>
                      <span className="text-xs font-bold text-[var(--foreground)]">
                        <div className="flex flex-col gap-2">
                          {tickets.length > 0 ? (
                            <div className="flex flex-wrap gap-3">
                              {tickets.map((t, i) => (
                                <div key={i} className="flex items-center gap-1.5 p-1.5 bg-slate-50 rounded-lg border border-slate-100" title={t.scanned_at ? `Scanned at ${new Date(t.scanned_at).toLocaleString()}` : 'Not scanned'}>
                                  <div className={`w-2 h-2 rounded-full ${t.scanned_at ? 'bg-green-500' : 'bg-slate-300'}`} />
                                  <span className="text-[10px] text-slate-500 font-bold">T{i+1}</span>
                                  {t.is_manual && !t.is_hidden && <span className="text-[8px] font-bold text-amber-600 bg-amber-50 px-1 rounded border border-amber-100">MANUAL</span>}
                                  
                                  <div className="flex items-center gap-2 ml-1">
                                    {!t.scanned_at && (
                                      <button
                                        onClick={(e) => handleManualCheckin(e, t.id, i)}
                                        disabled={isCheckingIn || isModifying}
                                        className="text-[9px] text-green-600 hover:text-green-700 font-bold underline disabled:opacity-50"
                                      >
                                        Check-in
                                      </button>
                                    )}
                                    {t.scanned_at && userRole === 'superadmin' && (
                                      <button
                                        onClick={(e) => handleResetScan(e, t.id)}
                                        disabled={isResetting || isModifying}
                                        className="text-[9px] text-red-500 hover:text-red-700 font-bold underline disabled:opacity-50"
                                      >
                                        Reset
                                      </button>
                                    )}
                                    <button
                                      onClick={(e) => handleRemoveTicket(e, t.id, t.is_manual && !t.payment_id)}
                                      disabled={isModifying}
                                      className="p-1 text-slate-300 hover:text-red-500 transition-colors disabled:opacity-50"
                                      title="Remove Ticket"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">No tickets found</span>
                          )}
                          
                          <button
                            onClick={handleAddTicket}
                            disabled={isModifying}
                            className="flex items-center gap-1.5 w-fit px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-md text-[10px] font-bold border border-amber-200 transition-all disabled:opacity-50 mt-1"
                          >
                            <Plus className="w-2.5 h-2.5" />
                            Add Manual Ticket
                          </button>
                        </div>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Column: Payment History & Tickets */}
                <div>
                  <h4 className="text-[9px] uppercase tracking-[0.1em] text-[var(--muted)] font-bold mb-4 flex items-center gap-1.5">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
                    Payment History & Tickets
                  </h4>
                  <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2 no-scrollbar">
                    {person.all_payments?.sort((a, b) => new Date(b.date) - new Date(a.date)).map((pay, pIdx) => {
                      const tickets = typeof pay.tickets === 'string' ? JSON.parse(pay.tickets) : (pay.tickets || []);
                      const isPaid = pay.status === 'paid';
                      const isPending = pay.status === 'pending';

                      return (
                        <div key={pIdx} className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-[9px] font-mono text-[var(--muted)] uppercase tracking-tighter">#{pay.invoice || 'INV-' + pIdx}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider ${
                              isPaid ? 'bg-[#34c759]/10 text-[#34c759]' :
                              isPending ? 'bg-[#ff9f0a]/10 text-[#ff9f0a]' :
                              'bg-[#ff3b30]/10 text-[#ff3b30]'
                            }`}>
                              {pay.status || 'Unknown'}
                            </span>
                          </div>
                          <ul className="space-y-1.5">
                            {tickets.map((t, tIdx) => (
                              <li key={tIdx} className="flex justify-between text-xs items-start">
                                <span className="text-[var(--foreground)] font-medium text-[11px] leading-tight">
                                  {t.name || t.ticket_data?.name}
                                </span>
                                <span className="font-mono text-[var(--muted)] text-[10px]">
                                  {new Intl.NumberFormat('de-DE', { style: 'currency', currency: pay.currency || 'EUR' }).format(t.price)}
                                </span>
                              </li>
                            ))}
                          </ul>
                          <div className="mt-2 pt-2 border-t border-slate-200/60 flex justify-between items-baseline">
                            <span className="text-[8px] text-[var(--muted)] italic">
                              {new Date(pay.date).toLocaleDateString('en-GB')} via {pay.method || 'Unknown'}
                            </span>
                            <span className="text-xs font-bold text-[var(--foreground)]">
                              {new Intl.NumberFormat('de-DE', { style: 'currency', currency: pay.currency || 'EUR' }).format(pay.amount)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-4 pt-3 border-t-2 border-slate-100 flex justify-between items-center">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--foreground)]">Total Combined</span>
                    <div className="text-right">
                      <div className="text-sm font-black text-[#0071e3]">
                        {new Intl.NumberFormat('de-DE', { 
                          style: 'currency', 
                          currency: person.currency || 'EUR' 
                        }).format(person.all_payments?.reduce((sum, p) => p.status === 'paid' ? sum + Number(p.amount) : sum, 0))}
                      </div>
                      {person.dinner_debt > 0 && (
                        <div className="text-[10px] text-red-600 font-bold flex items-center justify-end gap-1 mt-0.5">
                          <span className="w-1 h-1 rounded-full bg-red-500 animate-pulse" />
                          Debt: {new Intl.NumberFormat('de-DE', { style: 'currency', currency: person.currency || 'EUR' }).format(person.dinner_debt)}
                        </div>
                      )}
                    </div>
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
