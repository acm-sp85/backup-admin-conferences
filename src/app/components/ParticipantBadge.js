'use client';

import { useState, useEffect } from 'react';
import { getBadgeConfig } from '../actions/participants-qr';
import { Loader2, Printer, X } from 'lucide-react';

export default function ParticipantBadge({ participantName, conferenceAcronym, token, registrationId, conferenceId, institution }) {
    const [isOpen, setIsOpen] = useState(false);
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && conferenceId) {
            loadConfig();
        }
    }, [isOpen, conferenceId]);

    async function loadConfig() {
        setLoading(true);
        try {
            const data = await getBadgeConfig(conferenceId);
            setConfig(data);
        } catch (error) {
            console.error('Error loading badge config:', error);
        } finally {
            setLoading(false);
        }
    }

    if (!token) return null;

    const handlePrint = () => {
        window.open(`/participants/print?registrationIds=${registrationId}&conferenceId=${conferenceId}`, '_blank');
    };

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
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white rounded-[32px] shadow-2xl max-w-2xl w-full p-8 relative animate-in fade-in zoom-in duration-200">
                        <button 
                            onClick={() => setIsOpen(false)}
                            className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 p-2 bg-slate-50 rounded-full transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="flex flex-col md:flex-row gap-10 items-start">
                            {/* Preview Area */}
                            <div className="flex-shrink-0 mx-auto md:mx-0">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 text-center">Badge Preview (80x98mm + 3mm Bleed)</p>
                                <div className="relative shadow-2xl rounded-sm overflow-hidden border border-slate-200" style={{ width: '86mm', height: '104mm', transform: 'scale(0.6)', transformOrigin: 'top center' }}>
                                    {loading ? (
                                        <div className="absolute inset-0 flex items-center justify-center bg-slate-50">
                                            <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
                                        </div>
                                    ) : (
                                        <div 
                                            className="w-full h-full bg-white flex flex-col items-center justify-center text-center p-[13mm] box-border relative"
                                            style={{ 
                                                backgroundImage: config?.bgUrl ? `url("${config.bgUrl.replace(/"/g, '%22')}")` : 'none',
                                                backgroundSize: 'cover',
                                                backgroundPosition: 'center',
                                                backgroundRepeat: 'no-repeat'
                                            }}
                                        >
                                            {/* Trim line indicator */}
                                            <div className="absolute inset-[3mm] border border-dashed border-slate-300 pointer-events-none" />
                                            
                                            <div style={{ 
                                                fontSize: config?.config?.nameSize || '32px', 
                                                color: config?.config?.nameColor || '#000',
                                                fontWeight: '700',
                                                lineHeight: '1.1',
                                                textTransform: 'uppercase',
                                                zIndex: 2
                                            }}>
                                                {participantName}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Info & Actions */}
                            <div className="flex-1 space-y-6 pt-6">
                                <div>
                                    <h3 className="text-2xl font-black text-slate-900 leading-tight">{participantName}</h3>
                                    <p className="text-indigo-600 font-bold text-xs tracking-[0.2em] uppercase mt-1">{conferenceAcronym} Participant</p>
                                </div>

                                <div className="space-y-4">
                                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Badge Status</p>
                                        <p className="text-sm font-medium text-slate-700">Ready for printing</p>
                                    </div>
                                    
                                    <div className="flex flex-col gap-3">
                                        <button 
                                            onClick={handlePrint}
                                            className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-black transition-all shadow-xl shadow-slate-200"
                                        >
                                            <Printer className="w-5 h-5" />
                                            Print Badge
                                        </button>
                                        <button 
                                            onClick={() => setIsOpen(false)}
                                            className="w-full bg-slate-100 text-slate-600 py-4 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                                        >
                                            Close Preview
                                        </button>
                                    </div>
                                </div>

                                <p className="text-[10px] text-slate-400 italic">
                                    The preview shows a scaled-down version. The final print will respect the 80x98mm dimensions exactly.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
