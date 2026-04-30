import { useState, useTransition, useEffect } from 'react';
import { createConference, updateConference } from '../actions/conferences';

export default function ConferenceModal({ isOpen, onClose, conference = null }) {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState('');
    const isEdit = !!conference;

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        
        const formData = new FormData(e.target);
        
        startTransition(async () => {
            const res = isEdit 
                ? await updateConference(conference.id, formData)
                : await createConference(formData);
                
            if (res.error) {
                setError(res.error);
            } else {
                onClose();
            }
        });
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div 
                className="bg-white w-full max-w-md rounded-[12px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-8">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-slate-900">
                            {isEdit ? 'Edit Conference' : 'New Conference'}
                        </h3>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                        </button>
                    </div>

                    {error && (
                        <div className="mb-6 p-3 bg-red-50 border border-red-100 text-red-600 text-xs font-bold rounded-xl flex items-center gap-2">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Conference Name</label>
                            <input 
                                name="name"
                                type="text" 
                                required
                                defaultValue={conference?.name || ''}
                                placeholder="e.g. Hybrid and Organic Photovoltaics"
                                className="w-full h-12 px-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Acronym</label>
                                <input 
                                    name="acronym"
                                    type="text" 
                                    required
                                    defaultValue={conference?.acronym || ''}
                                    placeholder="e.g. HOPV26"
                                    className="w-full h-12 px-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Contact Email</label>
                                <input 
                                    name="email"
                                    type="email" 
                                    defaultValue={conference?.email || ''}
                                    placeholder="organizers@..."
                                    className="w-full h-12 px-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                />
                            </div>
                        </div>

                        <div className="pt-4">
                            <button 
                                type="submit"
                                disabled={isPending}
                                className="w-full h-12 bg-slate-900 text-white rounded-xl font-bold text-sm shadow-lg shadow-slate-200 active:scale-[0.98] transition-all disabled:opacity-50"
                            >
                                {isPending ? 'Saving...' : isEdit ? 'Update Conference' : 'Create Conference'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
