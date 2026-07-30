'use client';
import { useState } from 'react';
import { uploadAttachment, deleteAttachment, addLinkAttachment } from '@/app/actions/attachments';

export default function AttachmentsLibrary({ initialAttachments, isSuperadmin }) {
    const [attachments, setAttachments] = useState(initialAttachments || []);
    const [isOpen, setIsOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [linkName, setLinkName] = useState('');
    const [linkUrl, setLinkUrl] = useState('');

    const handleAddLink = async (e) => {
        e.preventDefault();
        if (!linkName || !linkUrl) return;
        setIsUploading(true);
        try {
            const res = await addLinkAttachment(linkName, linkUrl);
            if (res.error) {
                setErrorMsg(res.error);
            } else {
                window.location.reload();
            }
        } catch (err) {
            setErrorMsg('Failed to add link: ' + err.message);
        }
        setIsUploading(false);
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 3 * 1024 * 1024) {
            setErrorMsg(`The file "${file.name}" is ${(file.size / 1024 / 1024).toFixed(2)}MB, which exceeds our 3MB limit. Please compress the PDF and try again.`);
            e.target.value = '';
            return;
        }

        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        
        try {
            const res = await uploadAttachment(formData);
            if (res.error) {
                setErrorMsg(res.error);
            } else {
                alert('Attachment uploaded successfully!');
                window.location.reload();
            }
        } catch (err) {
            setErrorMsg('Upload failed: ' + err.message);
        }
        
        setIsUploading(false);
        e.target.value = '';
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure? Any campaigns using this attachment will lose it.')) return;
        try {
            await deleteAttachment(id);
            alert('Deleted');
            window.location.reload();
        } catch (err) {
            alert('Delete failed');
        }
    };

    return (
        <>
            <button 
                onClick={() => setIsOpen(true)}
                className="btn-primary flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border-transparent transition-colors"
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                Library
            </button>

            {isOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200 flex flex-col max-h-[80vh]">
                        <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                            <div>
                                <h3 className="text-lg font-bold">Media & Links Library</h3>
                                <p className="text-xs text-slate-500 mt-1">Saved URLs for quick access in campaigns.</p>
                            </div>
                            <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600 p-2">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto flex-1">
                            {attachments.length === 0 ? (
                                <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                    <p className="text-sm text-slate-500">No attachments in library.</p>
                                </div>
                            ) : (
                                <ul className="space-y-3">
                                    {attachments.map(att => (
                                        <li key={att.id} className="flex justify-between items-center p-3 border rounded-xl hover:bg-slate-50 transition-colors">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className={`p-2 rounded-lg shrink-0 ${att.url ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'}`}>
                                                    {att.url ? (
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                                                    ) : (
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                                                    )}
                                                </div>
                                                <div className="truncate">
                                                    <p className="text-sm font-bold truncate">{att.file_name}</p>
                                                    {att.url && (
                                                        <p className="text-[10px] text-blue-500 truncate">{att.url}</p>
                                                    )}
                                                    <p className="text-[10px] text-slate-500">
                                                        {att.url ? 'Link added' : 'Uploaded'} {new Date(att.created_at).toLocaleDateString()}
                                                    </p>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => handleDelete(att.id)}
                                                className="text-red-500 hover:bg-red-50 p-2 rounded-lg shrink-0 transition-colors"
                                                title="Delete attachment"
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        <div className="p-4 border-t bg-slate-50 space-y-4">
                            {/* Add Link Form */}
                            <form onSubmit={handleAddLink} className="space-y-2">
                                <p className="text-xs font-bold text-slate-700">Add New Link</p>
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        placeholder="Name (e.g. 2026 Brochure)" 
                                        value={linkName}
                                        onChange={(e) => setLinkName(e.target.value)}
                                        className="input-base text-xs py-2 w-1/3"
                                        required
                                        disabled={isUploading}
                                    />
                                    <input 
                                        type="url" 
                                        placeholder="URL (e.g. https://mydomain.com/file.pdf)" 
                                        value={linkUrl}
                                        onChange={(e) => setLinkUrl(e.target.value)}
                                        className="input-base text-xs py-2 flex-1"
                                        required
                                        disabled={isUploading}
                                    />
                                    <button 
                                        type="submit" 
                                        disabled={isUploading}
                                        className="bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                    >
                                        Add
                                    </button>
                                </div>
                            </form>

                            {/* Superadmin Upload PDF */}
                            {isSuperadmin && (
                                <div className="pt-4 border-t border-slate-200">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Superadmin Only: Upload Local PDF</p>
                                    <label className={`block w-full text-center border-2 border-dashed rounded-xl p-3 cursor-pointer transition-colors ${isUploading ? 'bg-slate-100 border-slate-300' : 'bg-white border-blue-200 hover:border-blue-400'}`}>
                                        <input 
                                            type="file" 
                                            accept=".pdf" 
                                            onChange={handleFileChange} 
                                            disabled={isUploading}
                                            className="hidden" 
                                        />
                                        <span className="text-xs font-bold text-blue-600 flex items-center justify-center gap-2">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                                            {isUploading ? 'Uploading...' : 'Upload PDF (Max 3MB)'}
                                        </span>
                                    </label>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            
            {/* Error Modal */}
            {errorMsg && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in duration-200">
                        <div className="p-6 text-center">
                            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4 text-red-500">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 mb-2">Upload Failed</h3>
                            <p className="text-sm text-slate-500 mb-6">{errorMsg}</p>
                            <button 
                                onClick={() => setErrorMsg('')}
                                className="w-full py-2.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors"
                            >
                                Got it
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
