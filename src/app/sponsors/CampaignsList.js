'use client';
import { useState } from 'react';
import { createCampaign, syncCampaignBounces } from '@/app/actions/sponsors';
import Link from 'next/link';
import AttachmentsLibrary from './AttachmentsLibrary';

export default function CampaignsList({ initialCampaigns, initialAttachments }) {
    const [isCreating, setIsCreating] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [syncingId, setSyncingId] = useState(null);
    
    async function handleCreate(e) {
        e.preventDefault();
        setIsSubmitting(true);
        const formData = new FormData(e.target);
        
        const defaultBody = `<div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937; line-height: 1.6;">

  <p style="font-size: 16px;">Dear {name|Sponsor},</p>

  <p style="font-size: 16px;">
    We are reaching out to <strong>{company|your organization}</strong> regarding...
  </p>
  
  <br>

  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">

  <p style="font-size: 15px; color: #374151;">
    Best regards,<br>
    <strong>Sponsors Nanoge</strong>
  </p>

</div>`;

        const res = await createCampaign({
            name: formData.get('name'),
            subject: formData.get('subject'),
            body: defaultBody
        });
        
        if (res.error) {
            alert(res.error);
            setIsSubmitting(false);
        } else {
            // Redirect to the new campaign detail page
            window.location.href = `/sponsors/${res.id}`;
        }
    }

    async function handleSync(e, campaignId) {
        e.preventDefault();
        e.stopPropagation();
        setSyncingId(campaignId);
        const res = await syncCampaignBounces(campaignId);
        setSyncingId(null);
        if (res.error) {
            alert(res.error);
        } else {
            alert(res.addedCount > 0 
                ? `Found ${res.addedCount} new failed emails.` 
                : `All failures are up to date.`
            );
            window.location.reload();
        }
    }
    
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-[#1d1d1f]">All Campaigns</h2>
                <div className="flex gap-2">
                    <AttachmentsLibrary initialAttachments={initialAttachments} />
                    <button 
                        onClick={() => setIsCreating(true)}
                        className="btn-primary flex items-center gap-2 bg-[#10b981] hover:bg-[#059669] border-transparent"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        New Campaign
                    </button>
                </div>
            </div>
            
            {isCreating && (
                <div className="bg-white p-6 rounded-xl border border-[#e5e5ea] shadow-sm mb-6">
                    <h3 className="font-semibold text-sm mb-4">Create New Campaign</h3>
                    <form onSubmit={handleCreate} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-[#8e8e93] mb-1">Campaign Name (Internal)</label>
                                <input type="text" name="name" required className="input-base w-full" placeholder="e.g. Q3 Platinum Sponsors" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-[#8e8e93] mb-1">Email Subject</label>
                                <input type="text" name="subject" required className="input-base w-full" placeholder="e.g. Special Offer for Smart Conference" />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <button type="button" onClick={() => setIsCreating(false)} className="px-3 py-1.5 text-xs font-semibold text-[#8e8e93] hover:text-[#1d1d1f] transition-colors">Cancel</button>
                            <button type="submit" disabled={isSubmitting} className="btn-primary bg-[#10b981] hover:bg-[#059669] border-transparent disabled:opacity-50">
                                {isSubmitting ? 'Creating...' : 'Create Campaign'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
            
            {initialCampaigns.length === 0 && !isCreating ? (
                <div className="text-center p-12 bg-white rounded-xl border border-[#e5e5ea] shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
                    <div className="w-12 h-12 bg-[#ecfdf5] text-[#10b981] rounded-full flex items-center justify-center mb-4 mx-auto">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                    </div>
                    <h3 className="text-sm font-semibold text-[#1d1d1f] mb-1">No Campaigns Found</h3>
                    <p className="text-xs text-[#8e8e93] mb-4">You haven't created any sponsor campaigns yet.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {initialCampaigns.map(camp => {
                        const recs = camp.recipients ? (typeof camp.recipients === 'string' ? JSON.parse(camp.recipients) : camp.recipients) : [];
                        return (
                            <Link href={`/sponsors/${camp.id}`} key={camp.id} className="block group">
                                <div className="bg-white border border-[#e5e5ea] rounded-xl p-5 shadow-sm transition-all hover:shadow-md hover:border-[#10b981]/30">
                                    <div className="flex justify-between items-start mb-3">
                                        <h3 className="font-semibold text-sm text-[#1d1d1f] group-hover:text-[#10b981] transition-colors line-clamp-1">{camp.name}</h3>
                                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                            camp.status === 'draft' ? 'bg-[#f2f2f7] text-[#8e8e93]' :
                                            camp.status === 'sending' ? 'bg-[#fff5e6] text-[#ff9500]' :
                                            'bg-[#ecfdf5] text-[#10b981]'
                                        }`}>
                                            {camp.status}
                                        </span>
                                    </div>
                                    <p className="text-xs text-[#8e8e93] line-clamp-1 mb-4">Subject: {camp.subject}</p>
                                    <div className="flex items-center justify-between border-t border-[#f2f2f7] pt-3">
                                        <div className="flex items-center gap-4 text-[10px] text-[#aeaeb2] font-semibold">
                                            <div className="flex items-center gap-1.5">
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                                                {recs.length} Recipients
                                            </div>
                                            {camp.bounce_count > 0 && (
                                                <div className="flex items-center gap-1.5 text-[#ff3b30]">
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                                                    {camp.bounce_count} Bounced
                                                </div>
                                            )}
                                        </div>
                                        
                                        {camp.status === 'completed' && (
                                            <button
                                                onClick={(e) => handleSync(e, camp.id)}
                                                disabled={syncingId === camp.id}
                                                className="px-2 py-1 bg-[#f2f2f7] hover:bg-[#e5e5ea] text-[#1d1d1f] text-[10px] font-bold rounded transition-colors disabled:opacity-50"
                                            >
                                                {syncingId === camp.id ? 'Syncing...' : 'Sync Bounces'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
