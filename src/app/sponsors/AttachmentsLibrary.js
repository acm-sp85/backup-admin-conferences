'use client';
import { useState } from 'react';
import { uploadAttachment, deleteAttachment } from '@/app/actions/attachments';

export default function AttachmentsLibrary({ initialAttachments }) {
    const [attachments, setAttachments] = useState(initialAttachments || []);
    const [isOpen, setIsOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 3 * 1024 * 1024) {
            alert('File must be smaller than 3MB');
            e.target.value = '';
            return;
        }

        setIsUploading(true);
        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64Data = reader.result;
            try {
                const res = await uploadAttachment(file.name, base64Data);
                if (res.error) {
                    alert('Error uploading file');
                } else {
                    alert('Attachment uploaded successfully!');
                    window.location.reload();
                }
            } catch (err) {
                alert('Upload failed: ' + err.message);
            }
            setIsUploading(false);
            e.target.value = '';
        };
        reader.readAsDataURL(file);
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
                                <h3 className="text-lg font-bold">Attachments Library</h3>
                                <p className="text-xs text-slate-500 mt-1">Upload reusable PDFs for your campaigns (Max 3MB)</p>
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
                                                <div className="bg-red-50 text-red-600 p-2 rounded-lg shrink-0">
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                                                </div>
                                                <div className="truncate">
                                                    <p className="text-sm font-bold truncate">{att.file_name}</p>
                                                    <p className="text-[10px] text-slate-500">
                                                        Uploaded {new Date(att.created_at).toLocaleDateString()}
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

                        <div className="p-4 border-t bg-slate-50">
                            <label className={`block w-full text-center border-2 border-dashed rounded-xl p-4 cursor-pointer transition-colors ${isUploading ? 'bg-slate-100 border-slate-300' : 'bg-white border-blue-200 hover:border-blue-400'}`}>
                                <input 
                                    type="file" 
                                    accept=".pdf" 
                                    onChange={handleFileChange} 
                                    disabled={isUploading}
                                    className="hidden" 
                                />
                                <span className="text-sm font-bold text-blue-600 flex items-center justify-center gap-2">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                                    {isUploading ? 'Uploading...' : 'Upload New PDF'}
                                </span>
                            </label>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
