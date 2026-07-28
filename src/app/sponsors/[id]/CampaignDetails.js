'use client';
import { useState, useRef } from 'react';
import Link from 'next/link';
import { updateCampaign, updateCampaignRecipients, sendCampaign, deleteCampaign } from '@/app/actions/sponsors';

export default function CampaignDetails({ campaign }) {
    const [name, setName] = useState(campaign.name || '');
    const [subject, setSubject] = useState(campaign.subject || '');
    const [body, setBody] = useState(campaign.body || '');
    const [isSaving, setIsSaving] = useState(false);
    
    // Parse recipients
    let initialRecipients = [];
    if (typeof campaign.recipients === 'string') {
        try { initialRecipients = JSON.parse(campaign.recipients || '[]'); } catch(e){}
    } else {
        initialRecipients = campaign.recipients || [];
    }
    const [recipients, setRecipients] = useState(initialRecipients);
    
    // State for manual recipient addition
    const [manualEmail, setManualEmail] = useState('');
    const [manualName, setManualName] = useState('');
    const [manualCompany, setManualCompany] = useState('');
    
    const [isSending, setIsSending] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const fileInputRef = useRef(null);
    
    const isSent = campaign.status === 'completed';
    const isSendingStatus = campaign.status === 'sending';
    const isReadonly = isSent || isSendingStatus;

    async function handleSaveDetails() {
        setIsSaving(true);
        const res = await updateCampaign(campaign.id, { name, subject, body });
        if (res.error) alert(res.error);
        setIsSaving(false);
    }

    async function handleDelete() {
        if (!confirm('Are you sure you want to delete this campaign?')) return;
        setIsDeleting(true);
        const res = await deleteCampaign(campaign.id);
        if (res.error) {
            alert(res.error);
            setIsDeleting(false);
        } else {
            window.location.href = '/sponsors';
        }
    }

    async function handleSend() {
        if (recipients.length === 0) {
            alert('Cannot send without recipients.');
            return;
        }
        if (!confirm(`Are you sure you want to send this email to ${recipients.length} recipients? This action cannot be undone.`)) return;
        
        // ensure saved first
        await updateCampaign(campaign.id, { name, subject, body });
        
        setIsSending(true);
        const res = await sendCampaign(campaign.id);
        if (res.error) alert(res.error);
        else alert(res.message || 'Campaign sent successfully');
        setIsSending(false);
    }

    function handleFileUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = async (event) => {
            const text = event.target.result;
            const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
            if (lines.length < 2) {
                alert('CSV must contain a header row and at least one data row.');
                return;
            }
            
            const delimiter = lines[0].includes(';') && !lines[0].includes(',') ? ';' : lines[0].includes(';') && lines[0].split(';').length > lines[0].split(',').length ? ';' : ',';
            
            const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase());
            const emailIdx = headers.indexOf('email');
            const nameIdx = headers.indexOf('name');
            const companyIdx = headers.indexOf('company');
            
            if (emailIdx === -1) {
                alert('CSV must contain an "email" column.');
                return;
            }
            
            const parsedRecipients = [];
            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(delimiter).map(c => c.trim());
                if (cols[emailIdx]) {
                    parsedRecipients.push({
                        email: cols[emailIdx],
                        name: nameIdx !== -1 ? cols[nameIdx] : '',
                        company: companyIdx !== -1 ? cols[companyIdx] : ''
                    });
                }
            }
            
            setRecipients(parsedRecipients);
            const res = await updateCampaignRecipients(campaign.id, parsedRecipients);
            if (res.error) alert(res.error);
            
            // reset file input
            if (fileInputRef.current) fileInputRef.current.value = '';
        };
        reader.readAsText(file);
    }

    async function handleAddManualRecipient(e) {
        e.preventDefault();
        if (!manualEmail) return;
        
        const newRecipient = {
            email: manualEmail.trim(),
            name: manualName.trim(),
            company: manualCompany.trim()
        };
        
        const updatedRecipients = [newRecipient, ...recipients];
        setRecipients(updatedRecipients);
        
        const res = await updateCampaignRecipients(campaign.id, updatedRecipients);
        if (res.error) {
            alert(res.error);
            // revert state on error
            setRecipients(recipients);
        } else {
            setManualEmail('');
            setManualName('');
            setManualCompany('');
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4 mb-2">
                <Link href="/sponsors" className="p-2 bg-white border border-[#e5e5ea] rounded-lg text-[#8e8e93] hover:text-[#1d1d1f] transition-colors">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                </Link>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f]">{campaign.name}</h1>
                    <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            isSent ? 'bg-[#ecfdf5] text-[#10b981]' : 
                            isSendingStatus ? 'bg-[#fff5e6] text-[#ff9500]' : 
                            'bg-[#f2f2f7] text-[#8e8e93]'
                        }`}>
                            {campaign.status}
                        </span>
                        {isSent && campaign.sent_at && (
                            <span className="text-xs text-[#8e8e93]">
                                Sent on {new Date(campaign.sent_at).toLocaleString()}
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {!isReadonly && (
                        <button 
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="px-4 py-2 bg-white text-[#ff3b30] text-sm font-semibold border border-[#ff3b30]/30 rounded-lg hover:bg-[#fff5f5] transition-colors"
                        >
                            Delete
                        </button>
                    )}
                    {!isReadonly && (
                        <button 
                            onClick={handleSend}
                            disabled={isSending || recipients.length === 0}
                            className="px-4 py-2 bg-[#10b981] text-white text-sm font-semibold rounded-lg hover:bg-[#059669] transition-colors disabled:opacity-50"
                        >
                            {isSending ? 'Sending...' : 'Dispatch Campaign'}
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    {/* Content Editor */}
                    <div className="bg-white rounded-xl border border-[#e5e5ea] shadow-sm p-6">
                        <h3 className="font-semibold text-[#1d1d1f] mb-4">Email Content</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-[#8e8e93] mb-1">Campaign Name (Internal)</label>
                                <input 
                                    type="text" 
                                    value={name} 
                                    onChange={e => setName(e.target.value)}
                                    disabled={isReadonly}
                                    className="input-base w-full" 
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-[#8e8e93] mb-1">Subject</label>
                                <input 
                                    type="text" 
                                    value={subject} 
                                    onChange={e => setSubject(e.target.value)}
                                    disabled={isReadonly}
                                    className="input-base w-full" 
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-[#8e8e93] mb-1 flex justify-between">
                                    <span>HTML Body</span>
                                    <span className="font-normal text-[10px]">Supports nested fallbacks: {`{name|{company|there}}`}</span>
                                </label>
                                <textarea 
                                    value={body} 
                                    onChange={e => setBody(e.target.value)}
                                    disabled={isReadonly}
                                    rows={12}
                                    className="input-base w-full font-mono text-xs leading-relaxed" 
                                    placeholder="<p>Hello {name|{company|there}},</p>..."
                                />
                            </div>
                            {!isReadonly && (
                                <div className="flex justify-end">
                                    <button 
                                        onClick={handleSaveDetails}
                                        disabled={isSaving}
                                        className="btn-primary bg-[#1d1d1f] border-transparent"
                                    >
                                        {isSaving ? 'Saving...' : 'Save Content'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    {/* Recipients Management */}
                    <div className="bg-white rounded-xl border border-[#e5e5ea] shadow-sm p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-semibold text-[#1d1d1f]">Recipients ({recipients.length})</h3>
                            {!isReadonly && (
                                <div>
                                    <input 
                                        type="file" 
                                        accept=".csv" 
                                        className="hidden" 
                                        ref={fileInputRef}
                                        onChange={handleFileUpload}
                                    />
                                    <button 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="text-[11px] font-bold text-[#10b981] bg-[#ecfdf5] px-2 py-1 rounded hover:bg-[#d1fae5] transition-colors"
                                    >
                                        Upload CSV
                                    </button>
                                </div>
                            )}
                        </div>
                        
                        {!isReadonly && (
                            <form onSubmit={handleAddManualRecipient} className="bg-[#f9f9f9] p-3 rounded-xl border border-[#e5e5ea] mb-4 space-y-3">
                                <h4 className="text-[11px] font-semibold text-[#8e8e93] uppercase tracking-wider">Add Manually</h4>
                                <div>
                                    <input 
                                        type="email" 
                                        placeholder="Email (required)" 
                                        value={manualEmail}
                                        onChange={e => setManualEmail(e.target.value)}
                                        required
                                        className="input-base w-full text-xs py-1.5"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <input 
                                        type="text" 
                                        placeholder="Name" 
                                        value={manualName}
                                        onChange={e => setManualName(e.target.value)}
                                        className="input-base w-full text-xs py-1.5"
                                    />
                                    <input 
                                        type="text" 
                                        placeholder="Company" 
                                        value={manualCompany}
                                        onChange={e => setManualCompany(e.target.value)}
                                        className="input-base w-full text-xs py-1.5"
                                    />
                                </div>
                                <button 
                                    type="submit" 
                                    disabled={!manualEmail}
                                    className="w-full py-1.5 bg-[#1d1d1f] text-white text-xs font-semibold rounded hover:bg-black transition-colors disabled:opacity-50"
                                >
                                    Add Recipient
                                </button>
                            </form>
                        )}
                        
                        <div className="max-h-[400px] overflow-y-auto pr-2 space-y-2">
                            {recipients.length === 0 ? (
                                <p className="text-xs text-[#8e8e93] text-center py-8">No recipients uploaded yet.</p>
                            ) : (
                                recipients.map((r, i) => (
                                    <div key={i} className="flex flex-col bg-[#f9f9f9] p-2.5 rounded-lg border border-[#e5e5ea]/50">
                                        <span className="text-xs font-semibold text-[#1d1d1f] truncate">{r.email}</span>
                                        {(r.name || r.company) && (
                                            <span className="text-[10px] text-[#8e8e93] truncate">
                                                {r.name}{r.name && r.company ? ' • ' : ''}{r.company}
                                            </span>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
