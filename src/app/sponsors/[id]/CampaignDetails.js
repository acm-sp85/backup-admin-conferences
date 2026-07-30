'use client';
import { useState, useRef } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { updateCampaign, updateCampaignRecipients, sendSingleCampaignEmail, updateCampaignStatus, deleteCampaign, syncCampaignBounces } from '@/app/actions/sponsors';

export default function CampaignDetails({ campaign, initialBounces = [], initialAttachments = [] }) {
    const [name, setName] = useState(campaign.name || '');
    const [subject, setSubject] = useState(campaign.subject || '');
    const [body, setBody] = useState(campaign.body || '');
    const [attachmentId, setAttachmentId] = useState(campaign.attachment_id || '');
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
    const [isSyncing, setIsSyncing] = useState(false);
    const [sentCount, setSentCount] = useState(0);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showBounces, setShowBounces] = useState(false);
    const fileInputRef = useRef(null);
    
    const isSent = campaign.status === 'completed';
    const isSendingStatus = campaign.status === 'sending' || isSending;
    const isReadonly = isSent || isSendingStatus;

    async function handleSaveDetails() {
        setIsSaving(true);
        const res = await updateCampaign(campaign.id, { 
            name, 
            subject, 
            body, 
            attachment_id: attachmentId ? parseInt(attachmentId, 10) : null 
        });
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
        await updateCampaign(campaign.id, { 
            name, 
            subject, 
            body,
            attachment_id: attachmentId ? parseInt(attachmentId, 10) : null 
        });
        
        setIsSending(true);
        setSentCount(0);
        
        const statusRes = await updateCampaignStatus(campaign.id, 'sending');
        if (statusRes.error) {
            alert(statusRes.error);
            setIsSending(false);
            return;
        }
        
        let successCount = 0;
        let failCount = 0;
        
        for (let i = 0; i < recipients.length; i++) {
            const recipient = recipients[i];
            if (!recipient.email) continue;
            
            const res = await sendSingleCampaignEmail(campaign.id, recipient);
            if (res.error) {
                console.error(res.error);
                failCount++;
            } else {
                successCount++;
            }
            
            setSentCount(i + 1);
            // 500ms delay to avoid rate limiting
            await new Promise(r => setTimeout(r, 500));
        }
        
        await updateCampaignStatus(campaign.id, 'completed');
        setIsSending(false);
        alert(`Campaign sent! ${successCount} succeeded, ${failCount} failed.`);
    }

    async function handleSyncBounces() {
        setIsSyncing(true);
        const res = await syncCampaignBounces(campaign.id);
        setIsSyncing(false);
        
        if (res.error) {
            alert(res.error);
        } else {
            alert(res.addedCount > 0 
                ? `Synced successfully! Found ${res.addedCount} new failed emails.` 
                : `Synced successfully! All failures are up to date.`
            );
            // Refresh to get the new bounces
            window.location.reload();
        }
    }

    function handleFileUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = async (event) => {
            const data = event.target.result;
            try {
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                
                // Convert to array of arrays
                const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                
                if (json.length < 2) {
                    alert('File must contain a header row and at least one data row.');
                    return;
                }
                
                const headers = json[0].map(h => String(h || '').trim().toLowerCase());
                const emailIdx = headers.indexOf('email');
                const nameIdx = headers.indexOf('name');
                const companyIdx = headers.indexOf('company');
                
                if (emailIdx === -1) {
                    alert('File must contain an "email" column.');
                    return;
                }
                
                const parsedRecipients = [];
                for (let i = 1; i < json.length; i++) {
                    const row = json[i];
                    if (!row || row.length === 0) continue;
                    
                    const email = row[emailIdx];
                    if (email) {
                        parsedRecipients.push({
                            email: String(email).trim(),
                            name: nameIdx !== -1 && row[nameIdx] ? String(row[nameIdx]).trim() : '',
                            company: companyIdx !== -1 && row[companyIdx] ? String(row[companyIdx]).trim() : ''
                        });
                    }
                }
                
                setRecipients(parsedRecipients);
                const res = await updateCampaignRecipients(campaign.id, parsedRecipients);
                if (res.error) alert(res.error);
                
                // reset file input
                if (fileInputRef.current) fileInputRef.current.value = '';
            } catch (err) {
                alert('Failed to parse file. Make sure it is a valid CSV or Excel file.');
                console.error(err);
            }
        };
        reader.readAsArrayBuffer(file);
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
                    {isSent && (
                        <button 
                            onClick={handleSyncBounces}
                            disabled={isSyncing}
                            className="px-3 py-1.5 bg-[#f2f2f7] text-[#1d1d1f] text-xs font-semibold rounded-lg hover:bg-[#e5e5ea] transition-colors disabled:opacity-50"
                        >
                            {isSyncing ? 'Syncing...' : 'Sync Bounces'}
                        </button>
                    )}
                    {initialBounces.length > 0 && (
                        <button 
                            onClick={() => setShowBounces(!showBounces)}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors border ${showBounces ? 'bg-[#ff3b30] text-white border-[#ff3b30]' : 'bg-[#fff0f0] text-[#ff3b30] border-[#ff3b30]/30 hover:bg-[#ffe5e5]'}`}
                        >
                            {initialBounces.length} Bounced
                        </button>
                    )}
                    {!isReadonly && (
                        <button 
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="px-4 py-2 bg-white text-[#ff3b30] text-sm font-semibold border border-[#ff3b30]/30 rounded-lg hover:bg-[#fff5f5] transition-colors"
                        >
                            Delete
                        </button>
                    )}
                    {!isReadonly && !isSending && (
                        <button 
                            onClick={handleSend}
                            disabled={recipients.length === 0}
                            className="px-4 py-2 bg-[#10b981] text-white text-sm font-semibold rounded-lg hover:bg-[#059669] transition-colors disabled:opacity-50"
                        >
                            Dispatch Campaign
                        </button>
                    )}
                    {isSending && (
                        <button disabled className="px-4 py-2 bg-[#ff9500] text-white text-sm font-semibold rounded-lg opacity-80 cursor-not-allowed">
                            Sending {sentCount} / {recipients.length}...
                        </button>
                    )}
                </div>
            </div>

            {showBounces && initialBounces.length > 0 && (
                <div className="bg-[#fff0f0] border border-[#ff3b30]/30 rounded-xl p-4 mb-6 shadow-sm">
                    <h3 className="text-[#ff3b30] font-bold text-sm mb-3">Bounce Details</h3>
                    <div className="max-h-[200px] overflow-y-auto space-y-2">
                        {initialBounces.map((b, i) => (
                            <div key={i} className="bg-white p-3 rounded-lg border border-[#ff3b30]/20 text-xs">
                                <span className="font-semibold text-[#1d1d1f]">{b.email}</span>
                                <span className="ml-2 px-2 py-0.5 bg-[#f2f2f7] text-[#8e8e93] rounded text-[9px] uppercase tracking-wider">{b.type}</span>
                                <p className="text-[#8e8e93] mt-1">{b.reason || 'No reason provided'}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

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
                            
                            {/* Attachment Selector */}
                            <div>
                                <label className="block text-xs font-semibold text-[#8e8e93] mb-1">Library Attachment</label>
                                <select
                                    value={attachmentId}
                                    onChange={e => setAttachmentId(e.target.value)}
                                    disabled={isReadonly}
                                    className="input-base w-full text-xs py-2"
                                >
                                    <option value="">-- No Attachment --</option>
                                    {initialAttachments.map(att => (
                                        <option key={att.id} value={att.id}>
                                            {att.file_name}
                                        </option>
                                    ))}
                                </select>
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
                                        accept=".csv,.xlsx,.xls" 
                                        className="hidden" 
                                        ref={fileInputRef}
                                        onChange={handleFileUpload}
                                    />
                                    <button 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="text-[11px] font-bold text-[#10b981] bg-[#ecfdf5] px-2 py-1 rounded hover:bg-[#d1fae5] transition-colors"
                                    >
                                        Upload File
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
                                recipients.map((r, i) => {
                                    const bounced = initialBounces.find(b => b.email === r.email);
                                    const showBouncedStyle = bounced && showBounces;
                                    
                                    return (
                                        <div key={i} className={`flex flex-col p-2.5 rounded-lg border ${showBouncedStyle ? 'bg-[#fff0f0] border-[#ff3b30]/30' : 'bg-[#f9f9f9] border-[#e5e5ea]/50'}`}>
                                            <div className="flex justify-between items-start">
                                                <span className={`text-xs font-semibold truncate ${showBouncedStyle ? 'text-[#ff3b30]' : 'text-[#1d1d1f]'}`}>{r.email}</span>
                                                {showBouncedStyle && <span className="text-[9px] font-bold text-[#ff3b30] uppercase tracking-wider bg-[#ff3b30]/10 px-1.5 py-0.5 rounded">Bounced</span>}
                                            </div>
                                            {(r.name || r.company) && (
                                                <span className="text-[10px] text-[#8e8e93] truncate mt-0.5">
                                                    {r.name}{r.name && r.company ? ' • ' : ''}{r.company}
                                                </span>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
