'use client';

import { useState } from 'react';

export default function ParticipantBadge({ participantName, conferenceAcronym, token }) {
    const [isOpen, setIsOpen] = useState(false);

    if (!token) return null;

    const qrUrl = `/api/qr/participants/${token}`;

    return (
        <>
            <button 
                onClick={() => setIsOpen(true)}
                className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md text-[10px] font-bold border border-indigo-100 hover:bg-indigo-100 transition-colors flex items-center gap-1"
                title="View Badge"
            >
                {conferenceAcronym}
                <span className="opacity-60">🎫</span>
            </button>

            {isOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 relative animate-in fade-in zoom-in duration-200">
                        <button 
                            onClick={() => setIsOpen(false)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-2"
                        >
                            ✕
                        </button>

                        <div className="text-center">
                            <div className="inline-block p-4 bg-slate-50 rounded-2xl mb-6">
                                <img src={qrUrl} alt="QR Code" className="w-48 h-48" />
                            </div>
                            
                            <h3 className="text-xl font-bold text-slate-900 mb-1">{participantName}</h3>
                            <p className="text-indigo-600 font-bold text-sm tracking-widest uppercase mb-6">{conferenceAcronym}</p>
                            
                            <div className="pt-6 border-t border-slate-100 flex flex-col gap-2">
                                <button 
                                    onClick={() => window.print()}
                                    className="w-full bg-slate-900 text-white py-3 rounded-xl font-semibold hover:bg-black transition-all"
                                >
                                    Print Badge
                                </button>
                                <button 
                                    onClick={() => setIsOpen(false)}
                                    className="w-full bg-slate-100 text-slate-600 py-3 rounded-xl font-semibold hover:bg-slate-200 transition-all"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
