'use client';

import { useState } from 'react';
import { checkEmailForCertificates, sendPublicCertificateEmail, sendAdminCertificatesEmail } from '../actions/publicCertificates';
import { Mail, ArrowRight, Award, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

export default function PublicCertificatesPage() {
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'conferences' | 'sending' | 'success' | 'error'
    const [errorMsg, setErrorMsg] = useState('');
    const [conferences, setConferences] = useState([]);
    const [selectedEmail, setSelectedEmail] = useState('');
    const [sentConfName, setSentConfName] = useState('');
    const [isAdmin, setIsAdmin] = useState(false);

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
            setIsAdmin(result.isAdmin || false);
            
            if (result.conferences.length === 1 && !result.isAdmin) {
                // Only one conference, send email immediately
                await sendCertificate(result.conferences[0].id, result.conferences[0].registration_id, result.conferences[0].name, email.trim().toLowerCase(), false);
            } else {
                // Multiple conferences or is Admin, ask user to select
                setConferences(result.conferences);
                setStatus('conferences');
            }
        } catch (err) {
            setStatus('error');
            setErrorMsg('An unexpected error occurred. Please try again.');
        }
    };

    const sendCertificate = async (conferenceId, registrationId, confName, targetEmail, isUserAdmin) => {
        setStatus('sending');
        try {
            const result = isUserAdmin
                ? await sendAdminCertificatesEmail(targetEmail, conferenceId)
                : await sendPublicCertificateEmail(targetEmail, conferenceId, registrationId);
            
            if (result.error) {
                setErrorMsg(result.error);
                setStatus('error');
            } else {
                setSentConfName(confName);
                setStatus('success');
            }
        } catch (error) {
            setErrorMsg('An unexpected error occurred. Please try again later.');
            setStatus('error');
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
                        <h1 className="text-2xl font-bold tracking-tight text-white">Obtén tu Certificado</h1>
                        <p className="text-sm text-slate-300 mt-2 text-white">Introduce tu email para recibir tu Certificado de Participación</p>
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
                                    Correo Electrónico
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
                                        placeholder="Introduce el email con el que te registraste"
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
                                        Comprobando...
                                    </>
                                ) : (
                                    <>
                                        Obtener Certificado
                                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </button>
                        </form>
                    ) : status === 'conferences' ? (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                            <p className="text-sm text-slate-600 text-center">
                                Hemos encontrado múltiples certificados para <strong>{selectedEmail}</strong>. ¿Cuál te gustaría recibir?
                            </p>
                            
                            <div className="space-y-3">
                                {conferences.map((conf) => (
                                    <button
                                        key={conf.id}
                                        onClick={() => sendCertificate(conf.id, conf.registration_id, conf.name, selectedEmail, isAdmin)}
                                        className="w-full p-4 bg-white border border-slate-200 rounded-xl hover:border-indigo-500 hover:ring-1 hover:ring-indigo-500 transition-all flex items-center justify-between group text-left"
                                    >
                                        <div className="flex-1 min-w-0 pr-4">
                                            <h3 className="font-bold text-slate-900 truncate">
                                                {isAdmin ? `Todos los Certificados: ${conf.name}` : conf.name}
                                            </h3>
                                            <p className="text-xs text-slate-500 truncate mt-1">
                                                {conf.conference_full_name || 'Conferencia'}
                                            </p>
                                        </div>
                                        <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-indigo-50 transition-colors">
                                            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
                                        </div>
                                    </button>
                                ))}
                            </div>
                            
                            <button 
                                onClick={() => { setStatus('idle'); setEmail(''); setConferences([]); setIsAdmin(false); }}
                                className="w-full h-10 text-xs font-bold text-slate-500 hover:text-slate-700 uppercase tracking-wider"
                            >
                                Usar un email distinto
                            </button>
                        </div>
                    ) : status === 'sending' ? (
                        <div className="py-8 flex flex-col items-center justify-center text-center space-y-4 animate-in fade-in duration-300">
                            <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
                            <h3 className="text-lg font-bold text-slate-900">Preparando Email...</h3>
                            <p className="text-sm text-slate-500">Generando tu enlace seguro</p>
                        </div>
                    ) : status === 'success' ? (
                        <div className="space-y-4 animate-in fade-in zoom-in duration-300">
                            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h2 className="text-2xl font-bold text-slate-900 text-center">¡Email Enviado!</h2>
                            <p className="text-slate-600 text-center">
                                Hemos enviado un email a <strong className="text-slate-900">{selectedEmail}</strong> con un enlace seguro para descargar tu certificado {sentConfName ? `para ${sentConfName}` : ''}.
                            </p>
                            <p className="text-sm text-slate-500 mt-4 text-center">
                                Por favor revisa tu bandeja de entrada (y la carpeta de spam) para ver el email.
                            </p>
                            <button
                                onClick={() => {
                                    setStatus('idle');
                                    setEmail('');
                                    setSentConfName('');
                                }}
                                className="w-full mt-8 text-sm text-indigo-600 font-medium hover:text-indigo-700"
                            >
                                Comprobar otro email
                            </button>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
