'use client';

import { useState } from 'react';
import { QrCode, X, Printer } from 'lucide-react';

export default function ParticipantQRBadge({ participantName, conferenceAcronym, token, registrationId, conferenceId }) {
    const [isOpen, setIsOpen] = useState(false);

    if (!token) return null;

    return (
        <>
            <button 
                onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(true);
                }}
                className="bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-md text-[10px] font-bold border border-indigo-100 hover:bg-indigo-100 transition-colors flex items-center justify-center"
                title="View Check-in QR"
            >
                <QrCode className="w-3 h-3" />
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
                        className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">{participantName}</h3>
                                <p className="text-[10px] text-indigo-600 font-bold tracking-widest uppercase">{conferenceAcronym} • Check-in QR</p>
                            </div>
                            <button 
                                onClick={() => setIsOpen(false)}
                                className="text-slate-400 hover:text-slate-600 p-2 bg-white rounded-full shadow-sm"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-10 text-center">
                            <div className="inline-block p-6 bg-slate-50 rounded-3xl mb-4 border border-slate-100">
                                <img 
                                    src={`/api/qr/participants/${token}`} 
                                    alt="Check-in QR" 
                                    className="w-48 h-48 mix-blend-multiply"
                                />
                            </div>
                            <p className="text-[10px] font-mono text-slate-300 break-all px-4">{token}</p>
                        </div>

                        <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
                            <button 
                                onClick={() => window.open(`/participants/print?registrationIds=${registrationId}&conferenceId=${conferenceId}`, '_blank')}
                                className="flex-1 bg-slate-900 text-white py-3 rounded-2xl font-bold text-sm hover:bg-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-slate-200"
                            >
                                <Printer className="w-4 h-4" />
                                Print Badge
                            </button>
                            <button 
                                onClick={() => setIsOpen(false)}
                                className="flex-1 bg-white text-slate-600 py-3 rounded-2xl font-bold text-sm border border-slate-200 hover:bg-slate-50 transition-all"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
