import { validateTicket } from '@/app/actions/social-dinner';
import { CheckCircle2, XCircle, Clock } from 'lucide-react';

export default async function CheckInPage({ params }) {
    const { token } = await params;
    const result = await validateTicket(token);

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-3xl shadow-xl overflow-hidden">
                <div className={`p-8 text-center ${
                    result.success ? 'bg-green-50' : 
                    result.error === 'Ticket already scanned' ? 'bg-orange-50' : 'bg-red-50'
                }`}>
                    {result.success ? (
                        <CheckCircle2 className="w-20 h-20 text-green-500 mx-auto mb-4" />
                    ) : result.error === 'Ticket already scanned' ? (
                        <Clock className="w-20 h-20 text-orange-500 mx-auto mb-4" />
                    ) : (
                        <XCircle className="w-20 h-20 text-red-500 mx-auto mb-4" />
                    )}
                    
                    <h1 className={`text-2xl font-black ${
                        result.success ? 'text-green-700' : 
                        result.error === 'Ticket already scanned' ? 'text-orange-700' : 'text-red-700'
                    }`}>
                        {result.success ? 'CHECK-IN SUCCESSFUL' : result.error.toUpperCase()}
                    </h1>
                </div>

                <div className="p-8 space-y-6">
                    {(result.attendee || result.attendee_name) && (
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Attendee</label>
                            <div className="text-xl font-bold text-slate-800">{result.attendee || result.attendee_name}</div>
                            {result.email && <div className="text-sm text-slate-500">{result.email}</div>}
                        </div>
                    )}

                    {result.conference && (
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Conference</label>
                            <div className="text-sm font-bold text-slate-700">{result.conference}</div>
                        </div>
                    )}

                    {result.scannedAt && (
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Previously Scanned At</label>
                            <div className="text-sm font-medium text-orange-600">
                                {new Date(result.scannedAt).toLocaleString()}
                            </div>
                        </div>
                    )}

                    <div className="pt-6 border-t border-slate-100">
                        <p className="text-[10px] text-center text-slate-400 italic">
                            Smart Conference Social Dinner Validation System
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
