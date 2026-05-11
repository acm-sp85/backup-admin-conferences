'use client';

import { useState } from 'react';
import { QrCode, X, Printer } from 'lucide-react';

export default function SocialDinnerTicketsBadge({ participantName, conferenceAcronym, tickets }) {
    const [isOpen, setIsOpen] = useState(false);

    if (!tickets || tickets.length === 0) {
        return (
            <span className="text-[9px] text-slate-300 italic flex items-center gap-1" title="Tickets not synced yet. Click 'Sync Tickets' at the top.">
                No tickets
                <QrCode className="w-2.5 h-2.5 opacity-30" />
            </span>
        );
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.smart-conference.org' || 'https://smart-conference.org';
    const sanitizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

    return (
        <>
            <button 
                onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(true);
                }}
                className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md text-[10px] font-bold border border-blue-100 hover:bg-blue-100 transition-colors flex items-center gap-1"
                title="View Tickets"
            >
                {tickets.length} Ticket{tickets.length > 1 ? 's' : ''}
                <QrCode className="w-2.5 h-2.5" />
            </button>

            {isOpen && (
                <div 
                    className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsOpen(false);
                    }}
                >
                    <div 
                        className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">{participantName}</h3>
                                <p className="text-[10px] text-blue-600 font-bold tracking-widest uppercase">{conferenceAcronym} • Social Dinner</p>
                            </div>
                            <button 
                                onClick={() => setIsOpen(false)}
                                className="text-slate-400 hover:text-slate-600 p-2 bg-white rounded-full shadow-sm"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 space-y-8 no-scrollbar">
                            {tickets.map((ticket, index) => (
                                <div key={ticket.id} className="text-center">
                                    <div className="inline-block p-5 bg-slate-50 rounded-3xl mb-4 border border-slate-100">
                                        <img 
                                            src={`${sanitizedBaseUrl}/api/qr/${ticket.token}`} 
                                            alt={`Ticket ${index + 1}`} 
                                            className="w-48 h-48 mix-blend-multiply"
                                        />
                                    </div>

                                    <p className="text-[10px] font-mono text-slate-300 break-all px-12">{ticket.token}</p>
                                    {ticket.scanned_at && (
                                        <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-600 rounded-full text-[10px] font-bold border border-green-100">
                                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                                            SCANNED AT {new Date(ticket.scanned_at).toLocaleString()}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
                            <button 
                                onClick={() => window.print()}
                                className="flex-1 bg-slate-900 text-white py-3 rounded-2xl font-bold text-sm hover:bg-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-slate-200"
                            >
                                <Printer className="w-4 h-4" />
                                Print Tickets
                            </button>
                            <button 
                                onClick={() => setIsOpen(false)}
                                className="flex-1 bg-white text-slate-600 py-3 rounded-2xl font-bold text-sm border border-slate-200 hover:bg-slate-50 transition-all"
                            >
                                Close Preview
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
