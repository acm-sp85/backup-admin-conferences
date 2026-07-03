import { validateParticipantTicket } from '../../../actions/participants-qr';
import { CheckCircle2, XCircle, Clock, User, ClipboardCheck } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function ParticipantCheckinPage({ params }) {
    const { token } = await params;
    const result = await validateParticipantTicket(token);

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-[32px] shadow-2xl shadow-slate-200/50 overflow-hidden border border-slate-100 animate-in fade-in zoom-in duration-500">
                <div className={`p-10 text-center ${
                    result.success ? 'bg-green-500' : 
                    result.hasDebt ? 'bg-amber-500' : 'bg-red-500'
                }`}>
                    {result.success ? (
                        <CheckCircle2 className="w-24 h-24 text-white mx-auto animate-bounce" />
                    ) : (
                        <XCircle className="w-24 h-24 text-white mx-auto animate-pulse" />
                    )}
                </div>
                
                <div className="p-10 text-center">
                    <h1 className="text-3xl font-black text-slate-900 mb-2 uppercase tracking-tight">
                        {result.success ? 'Success!' : result.hasDebt ? 'Action Required' : 'Check-in Error'}
                    </h1>
                    <p className="text-slate-500 text-sm font-medium mb-8 uppercase tracking-widest">
                        {result.success ? 'Participant verified' : result.error}
                    </p>

                    {result.attendee && (
                        <div className="bg-slate-50 rounded-2xl p-6 mb-8 border border-slate-100">
                            <div className="flex items-center justify-center gap-3 text-slate-900 font-bold text-xl mb-2">
                                <User className="w-6 h-6 text-slate-400" />
                                {result.attendee}
                            </div>
                            <div className="flex flex-col gap-2 items-center">
                                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white border border-slate-200 rounded-full text-slate-600 font-bold text-[10px] uppercase tracking-widest shadow-sm">
                                    <ClipboardCheck className="w-3.5 h-3.5 text-blue-500" />
                                    {result.acronym || result.conference}
                                </div>
                                
                                {result.hasDebt && (
                                    <div className="mt-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800">
                                        <div className="text-[10px] font-bold uppercase tracking-tight mb-1">Pending Balance</div>
                                        <div className="text-2xl font-black">{result.debtAmount}€</div>
                                    </div>
                                )}
                                
                                {!result.success && result.scannedAt && (
                                    <div className="flex items-center gap-2 text-red-500 font-bold text-xs mt-2 italic">
                                        <Clock className="w-4 h-4" />
                                        Already scanned: {new Date(result.scannedAt).toLocaleString()}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <Link 
                        href="/participants"
                        className="inline-block w-full py-4 bg-slate-900 text-white rounded-2xl font-bold text-sm shadow-lg shadow-slate-200 active:scale-[0.98] transition-all"
                    >
                        Return to Dashboard
                    </Link>
                </div>
            </div>
        </div>
    );
}
