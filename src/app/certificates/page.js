'use client';

import { useState } from 'react';
import { checkEmailForCertificates, sendPublicCertificateEmail } from '../actions/publicCertificates';
import { Mail, ArrowRight, Award, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

export default function PublicCertificatesPage() {
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'conferences' | 'sending' | 'success' | 'error'
    const [errorMsg, setErrorMsg] = useState('');
    const [conferences, setConferences] = useState([]);
    const [selectedEmail, setSelectedEmail] = useState('');

    const handleCheckEmail = async (e) => {
        e.preventDefault();
        if (!email.trim()) return;
        
        setStatus('loading');
        setErrorMsg('');
        
        try {
            const result = await checkEmailForCertificates(email);
            
            if (result.error) {
                setStatus('error');
                setErrorMsg(result.error);
                return;
            }
            
            setSelectedEmail(email.trim().toLowerCase());
            
            if (result.conferences.length === 1) {
                // Only one conference, send email immediately
                await sendCertificate(result.conferences[0].id, result.conferences[0].registration_id);
            } else {
                // Multiple conferences, ask user to select
                setConferences(result.conferences);
                setStatus('conferences');
            }
        } catch (err) {
            setStatus('error');
            setErrorMsg('An unexpected error occurred. Please try again.');
        }
    };

    const sendCertificate = async (conferenceId, registrationId) => {
        setStatus('sending');
        try {
            const result = await sendPublicCertificateEmail(selectedEmail, conferenceId, registrationId);
            if (result.error) {
                setStatus('error');
                setErrorMsg(result.error);
            } else {
                setStatus('success');
            }
        } catch (err) {
            setStatus('error');
            setErrorMsg('Failed to send the certificate email. Please try again.');
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-500">
                
                {/* Header */}
                <div className="bg-slate-900 p-8 text-center text-white relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-500/20 to-slate-600/20" />
                    <div className="relative z-10 flex flex-col items-center">
                        <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-sm mb-4 border border-white/20">
                            <Award className="w-8 h-8 text-white" />
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight text-white">Get Your Certificate</h1>
                        <p className="text-sm text-slate-300 mt-2 text-white">Enter your email to receive your Certificate of Participation</p>
                    </div>
                </div>

                <div className="p-8">
                    {status === 'idle' || status === 'loading' || status === 'error' ? (
                        <form onSubmit={handleCheckEmail} className="space-y-6">
                            {status === 'error' && (
                                <div className="p-4 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100 flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" />
                                    <p>{errorMsg}</p>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">
                                    Email Address
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Mail className="h-5 w-5 text-slate-400" />
                                    </div>
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="Enter the email you registered with"
                                        className="w-full h-12 pl-11 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all focus:bg-white"
                                        disabled={status === 'loading'}
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={status === 'loading' || !email.trim()}
                                className="w-full h-12 bg-slate-900 hover:bg-black text-white rounded-xl font-bold text-sm shadow-lg shadow-slate-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
                            >
                                {status === 'loading' ? (
                                    <>
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        Checking...
                                    </>
                                ) : (
                                    <>
                                        Get Certificate
                                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </button>
                        </form>
                    ) : status === 'conferences' ? (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                            <p className="text-sm text-slate-600 text-center">
                                We found multiple certificates for <strong>{selectedEmail}</strong>. Which one would you like to receive?
                            </p>
                            
                            <div className="space-y-3">
                                {conferences.map((conf) => (
                                    <button
                                        key={conf.id}
                                        onClick={() => sendCertificate(conf.id, conf.registration_id)}
                                        className="w-full p-4 bg-white border border-slate-200 rounded-xl hover:border-indigo-500 hover:ring-1 hover:ring-indigo-500 transition-all flex items-center justify-between group text-left"
                                    >
                                        <div className="flex-1 min-w-0 pr-4">
                                            <h3 className="font-bold text-slate-900 truncate">{conf.name}</h3>
                                            <p className="text-xs text-slate-500 truncate mt-1">
                                                {conf.conference_full_name || 'Conference'}
                                            </p>
                                        </div>
                                        <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-indigo-50 transition-colors">
                                            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
                                        </div>
                                    </button>
                                ))}
                            </div>
                            
                            <button 
                                onClick={() => { setStatus('idle'); setEmail(''); setConferences([]); }}
                                className="w-full h-10 text-xs font-bold text-slate-500 hover:text-slate-700 uppercase tracking-wider"
                            >
                                Use a different email
                            </button>
                        </div>
                    ) : status === 'sending' ? (
                        <div className="py-8 flex flex-col items-center justify-center text-center space-y-4 animate-in fade-in duration-300">
                            <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
                            <h3 className="text-lg font-bold text-slate-900">Preparing Email...</h3>
                            <p className="text-sm text-slate-500">Generating your secure link</p>
                        </div>
                    ) : status === 'success' ? (
                        <div className="py-8 flex flex-col items-center justify-center text-center space-y-4 animate-in zoom-in-95 duration-500">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                                <CheckCircle2 className="w-8 h-8 text-green-600" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900">Email Sent!</h3>
                            <p className="text-sm text-slate-600">
                                We've sent a secure link to <strong>{selectedEmail}</strong>. 
                                Please check your inbox (and spam folder) to view and download your certificate.
                            </p>
                            <button 
                                onClick={() => { setStatus('idle'); setEmail(''); }}
                                className="mt-4 h-11 px-6 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-colors"
                            >
                                Get another certificate
                            </button>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
