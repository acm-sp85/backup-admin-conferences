'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { updateCampaign, updateCampaignRecipients, updateCampaignStatus, deleteCampaign, syncCampaignBounces, enqueueCampaign, getCampaignProgress } from '@/app/actions/sponsors';

export default function CampaignDetails({ campaign, initialBounces = [], initialAttachments = [] }) {
    const [name, setName] = useState(campaign.name || '');
    const [subject, setSubject] = useState(campaign.subject || '');
    const [body, setBody] = useState(campaign.body || '');
    const [isSaving, setIsSaving] = useState(false);
    const [copiedId, setCopiedId] = useState(null);
    const [buttonUrl, setButtonUrl] = useState('');
    const [buttonText, setButtonText] = useState('');
    const [buttonTexts, setButtonTexts] = useState({});
    
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
    const [progress, setProgress] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showBounces, setShowBounces] = useState(false);
    const fileInputRef = useRef(null);
    
    const [lastPending, setLastPending] = useState(null);
    const [targetEndTime, setTargetEndTime] = useState(null);
    const [timeLeftStr, setTimeLeftStr] = useState('');
    
    const isSent = campaign.status === 'completed';
    const isQueued = campaign.status === 'queued';
    const isSendingStatus = campaign.status === 'sending' || isSending || isQueued;
    const isReadonly = isSent || isSendingStatus;

    useEffect(() => {
        let interval;
        if (isQueued) {
            const fetchProgress = async () => {
                const res = await getCampaignProgress(campaign.id);
                setProgress(res);
                if (res.pending === 0 && res.total > 0) {
                    window.location.reload();
                }
            };
            fetchProgress();
            interval = setInterval(fetchProgress, 5000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isQueued, campaign.id]);

    useEffect(() => {
        if (progress && progress.pending > 0) {
            if (progress.pending !== lastPending) {
                const blocks = Math.ceil(progress.pending / 50);
                const etaSeconds = blocks * 120; // 2 mins per block
                setTargetEndTime(Date.now() + (etaSeconds * 1000));
                setLastPending(progress.pending);
            }
        }
    }, [progress, lastPending]);

    useEffect(() => {
        if (!targetEndTime) return;
        
        // Update immediately
        const updateStr = () => {
            const now = Date.now();
            const diff = targetEndTime - now;
            if (diff <= 0) {
                setTimeLeftStr('Finishing up...');
            } else {
                const m = Math.floor(diff / 60000);
                const s = Math.floor((diff % 60000) / 1000);
                setTimeLeftStr(`ETA: ~${m}m ${s}s`);
            }
        };
        updateStr();
        
        const interval = setInterval(updateStr, 1000);
        return () => clearInterval(interval);
    }, [targetEndTime]);

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
        if (!confirm(`Are you sure you want to queue this email to ${recipients.length} recipients?`)) return;
        
        // ensure saved first
        await updateCampaign(campaign.id, { name, subject, body });
        
        setIsSending(true);
        
        const res = await enqueueCampaign(campaign.id, recipients);
        if (res.error) {
            alert(res.error);
            setIsSending(false);
            return;
        }
        
        // The page will revalidate and status will become 'queued', triggering the useEffect
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

    async function copyAttachmentLink(att) {
        const url = att.url ? att.url : (window.location.origin + '/api/attachments/' + att.id);
        const customText = buttonTexts[att.id]?.trim() || `Download ${att.file_name}`;
        const buttonHtml = `
  <div style="text-align: center; margin: 32px 0;">
    <a href="${url}"
       style="display: inline-block; padding: 14px 28px; background-color: #10b981; color: #ffffff; text-decoration: none; font-weight: 600; border-radius: 8px; font-family: sans-serif; font-size: 15px; box-shadow: 0 2px 4px rgba(16,185,129,0.25);">
${customText}
    </a>
  </div>`;
        try {
            await navigator.clipboard.writeText(buttonHtml);
            setCopiedId(att.id);
            setTimeout(() => setCopiedId(null), 2000);
        } catch (err) {
            alert("Failed to copy to clipboard");
        }
    }

    async function copyCustomButton() {
        if (!buttonUrl) {
            alert('Please enter a URL for the button.');
            return;
        }
        const customText = buttonText.trim() || `Download PDF`;
        const buttonHtml = `
  <div style="text-align: center; margin: 32px 0;">
    <a href="${buttonUrl}"
       style="display: inline-block; padding: 14px 28px; background-color: #10b981; color: #ffffff; text-decoration: none; font-weight: 600; border-radius: 8px; font-family: sans-serif; font-size: 15px; box-shadow: 0 2px 4px rgba(16,185,129,0.25);">
${customText}
    </a>
  </div>`;
        try {
            await navigator.clipboard.writeText(buttonHtml);
            setCopiedId('custom');
            setTimeout(() => setCopiedId(null), 2000);
        } catch (err) {
            alert("Failed to copy to clipboard");
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
                            isQueued ? 'bg-[#f0f9ff] text-[#0ea5e9]' :
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
                    {(isSending || isQueued) && (
                        <div className="flex flex-col items-end">
                            <button disabled className="px-4 py-2 bg-[#0ea5e9] text-white text-sm font-semibold rounded-lg opacity-80 cursor-not-allowed">
                                {progress ? `Sent ${progress.sent + progress.failed} / ${progress.total}` : 'Queued for sending...'}
                            </button>
                            {timeLeftStr && <span className="text-[10px] text-[#0ea5e9] font-bold mt-1.5">{timeLeftStr}</span>}
                        </div>
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
                            
                            {/* Attachments Linker */}
                            {!isReadonly && initialAttachments.length > 0 && (
                                <div className="bg-[#f9f9f9] border border-[#e5e5ea] rounded-xl p-4">
                                    <h4 className="text-xs font-semibold text-[#1d1d1f] mb-3">Saved Library Links</h4>
                                    <div className="space-y-2">
                                        {initialAttachments.map(att => (
                                            <div key={att.id} className="flex items-center justify-between bg-white border border-[#e5e5ea] p-2 rounded-lg gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-medium text-[#1d1d1f] truncate">{att.file_name}</p>
                                                    {att.url && <p className="text-[9px] text-[#10b981] truncate">{att.url}</p>}
                                                </div>
                                                <input 
                                                    type="text" 
                                                    placeholder="Button Text" 
                                                    value={buttonTexts[att.id] || ''}
                                                    onChange={e => setButtonTexts(prev => ({...prev, [att.id]: e.target.value}))}
                                                    className="input-base py-1 px-2 text-[10px] w-32 shrink-0 border border-[#e5e5ea] rounded"
                                                />
                                                <button
                                                    onClick={() => copyAttachmentLink(att)}
                                                    className={`shrink-0 px-2.5 py-1 text-[10px] font-bold rounded transition-colors ${
                                                        copiedId === att.id 
                                                        ? 'bg-[#10b981] text-white' 
                                                        : 'bg-[#ecfdf5] text-[#10b981] hover:bg-[#d1fae5]'
                                                    }`}
                                                >
                                                    {copiedId === att.id ? 'Copied HTML!' : 'Copy HTML'}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-[10px] text-[#8e8e93] mt-3">Clicking "Copy HTML" generates a styled button pointing to the saved PDF or URL.</p>
                                </div>
                            )}

                            {/* Button Generator */}
                            {!isReadonly && (
                                <div className="bg-[#f9f9f9] border border-[#e5e5ea] rounded-xl p-4">
                                    <h4 className="text-xs font-semibold text-[#1d1d1f] mb-3">Custom Button Generator</h4>
                                    <div className="flex items-center gap-2 bg-white border border-[#e5e5ea] p-2 rounded-lg">
                                        <input 
                                            type="text" 
                                            placeholder="PDF URL (e.g. https://mydomain.com/file.pdf)" 
                                            value={buttonUrl}
                                            onChange={e => setButtonUrl(e.target.value)}
                                            className="input-base py-1 px-2 text-[10px] flex-1 border border-[#e5e5ea] rounded"
                                        />
                                        <input 
                                            type="text" 
                                            placeholder="Button Text" 
                                            value={buttonText}
                                            onChange={e => setButtonText(e.target.value)}
                                            className="input-base py-1 px-2 text-[10px] w-32 shrink-0 border border-[#e5e5ea] rounded"
                                        />
                                        <button
                                            onClick={copyCustomButton}
                                            className={`shrink-0 px-2.5 py-1 text-[10px] font-bold rounded transition-colors ${
                                                copiedId === 'custom' 
                                                ? 'bg-[#10b981] text-white' 
                                                : 'bg-[#ecfdf5] text-[#10b981] hover:bg-[#d1fae5]'
                                            }`}
                                        >
                                            {copiedId === 'custom' ? 'Copied HTML!' : 'Copy HTML'}
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-[#8e8e93] mt-3">Clicking "Copy HTML" generates a styled button pointing to your external PDF URL.</p>
                                </div>
                            )}
                            
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
