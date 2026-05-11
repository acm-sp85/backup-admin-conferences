import { useState, useTransition, useEffect } from 'react';
import { createConference, updateConference } from '../actions/conferences';
import { getDefaultEmailBody } from '@/lib/email-templates';

export default function ConferenceModal({ isOpen, onClose, conference = null }) {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState('');
    const [accentColor, setAccentColor] = useState(conference?.accent_color || '#007aff');
    const isEdit = !!conference;

    // Track template contents and view modes
    const [templates, setTemplates] = useState({
        magicLink: conference?.email_magic_link_body || getDefaultEmailBody('magicLink', conference),
        posterVotingInvite: conference?.email_poster_voting_invite_body || getDefaultEmailBody('posterVotingInvite', conference),
        socialDinnerTickets: conference?.email_social_dinner_tickets_body || getDefaultEmailBody('socialDinnerTickets', conference),
        emailCheckin: conference?.email_checkin_body || getDefaultEmailBody('emailCheckin', conference)
    });

    const [viewMode, setViewMode] = useState({
        magicLink: 'preview',
        posterVotingInvite: 'preview',
        socialDinnerTickets: 'preview',
        emailCheckin: 'preview'
    });

    const [badgeConfig, setBadgeConfig] = useState(conference?.badge_config ? (typeof conference.badge_config === 'string' ? JSON.parse(conference.badge_config) : conference.badge_config) : {
        nameSize: '28px',
        nameColor: '#000000',
        instSize: '14px',
        instColor: '#666666',
        qrSize: '35mm',
        padding: '10mm'
    });

    useEffect(() => {
        if (isOpen) {
            setAccentColor(conference?.accent_color || '#007aff');
            setTemplates({
                magicLink: conference?.email_magic_link_body || getDefaultEmailBody('magicLink', conference),
                posterVotingInvite: conference?.email_poster_voting_invite_body || getDefaultEmailBody('posterVotingInvite', conference),
                socialDinnerTickets: conference?.email_social_dinner_tickets_body || getDefaultEmailBody('socialDinnerTickets', conference),
                emailCheckin: conference?.email_checkin_body || getDefaultEmailBody('emailCheckin', conference)
            });
            setBadgeConfig(conference?.badge_config ? (typeof conference.badge_config === 'string' ? JSON.parse(conference.badge_config) : conference.badge_config) : {
                nameSize: '28px',
                nameColor: '#000000',
                instSize: '14px',
                instColor: '#666666',
                qrSize: '35mm',
                padding: '10mm'
            });
        }
    }, [isOpen, conference]);

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
                className="bg-white w-full max-w-5xl rounded-[12px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-8 overflow-y-auto">
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

                    <form onSubmit={handleSubmit}>
                        {/* Hidden input to preserve email safety lock state if not editable in modal */}
                        <input type="hidden" name="emails_enabled" value={conference?.emails_enabled ? 'on' : 'off'} />
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                            {/* Left Column: Conference Details */}
                            <div className="space-y-5">
                                <div className="pb-2 border-b border-slate-50 mb-4">
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Conference Details</label>
                                </div>
                                
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

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Logo URL (Optional)</label>
                                        <input 
                                            name="logo_url"
                                            type="url" 
                                            defaultValue={conference?.logo_url || ''}
                                            placeholder="https://..."
                                            className="w-full h-12 px-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Banner URL (Optional)</label>
                                        <input 
                                            name="banner_url"
                                            type="url" 
                                            defaultValue={conference?.banner_url || ''}
                                            placeholder="https://..."
                                            className="w-full h-12 px-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Accent Color (Optional)</label>
                                    <div className="flex gap-3 items-center">
                                        <input 
                                            name="accent_color"
                                            type="color" 
                                            value={accentColor}
                                            onChange={(e) => setAccentColor(e.target.value)}
                                            className="h-12 w-16 bg-slate-50 border border-slate-100 rounded-xl cursor-pointer"
                                        />
                                        <input 
                                            name="accent_color_text"
                                            type="text"
                                            value={accentColor}
                                            onChange={(e) => setAccentColor(e.target.value)}
                                            className="flex-1 h-12 px-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-mono text-slate-500 outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-100 rounded-2xl cursor-pointer hover:bg-slate-100 transition-colors">
                                    <input 
                                        id="voting_validation_enabled"
                                        name="voting_validation_enabled"
                                        type="checkbox" 
                                        defaultChecked={conference ? !!conference.voting_validation_enabled : true}
                                        className="w-5 h-5 rounded-lg text-blue-600 focus:ring-blue-500 border-slate-300"
                                    />
                                    <label htmlFor="voting_validation_enabled" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                                        All posters need to be voted on to submit votes
                                    </label>
                                </div>

                                <div className="space-y-4">
                                    <div className="pb-2 border-b border-slate-50 mb-2">
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Voting Settings</label>
                                    </div>
                                    <textarea 
                                        name="voting_instructions"
                                        defaultValue={conference?.voting_instructions || 'Rank your assigned posters from 1 to 10(1 being the lowest score and 10 the highest)'}
                                        placeholder="Rank your assigned posters from 1 to 10..."
                                        className="w-full h-20 p-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
                                    />
                                </div>

                                <div className="space-y-4 pt-4">
                                    <div className="pb-2 border-b border-slate-50 mb-2 flex justify-between items-center">
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Badge Settings (80x98mm)</label>
                                    </div>
                                    
                                    <input type="hidden" name="badge_config" value={JSON.stringify(badgeConfig)} />
                                    
                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1 ml-1">Badge Background URL</label>
                                            <input 
                                                name="badge_bg"
                                                type="url" 
                                                defaultValue={conference?.badge_bg || ''}
                                                placeholder="https://..."
                                                className="w-full h-10 px-3 bg-slate-50 border border-slate-100 rounded-xl text-[11px] focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1 ml-1">Name Font Size</label>
                                                <input 
                                                    type="text" 
                                                    value={badgeConfig.nameSize}
                                                    onChange={(e) => setBadgeConfig({ ...badgeConfig, nameSize: e.target.value })}
                                                    className="w-full h-10 px-3 bg-slate-50 border border-slate-100 rounded-xl text-[11px]"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1 ml-1">Name Color</label>
                                                <div className="flex gap-2">
                                                    <input 
                                                        type="color" 
                                                        value={badgeConfig.nameColor}
                                                        onChange={(e) => setBadgeConfig({ ...badgeConfig, nameColor: e.target.value })}
                                                        className="h-10 w-10 bg-slate-50 border border-slate-100 rounded-lg cursor-pointer"
                                                    />
                                                    <input 
                                                        type="text" 
                                                        value={badgeConfig.nameColor}
                                                        onChange={(e) => setBadgeConfig({ ...badgeConfig, nameColor: e.target.value })}
                                                        className="flex-1 h-10 px-2 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-mono"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1 ml-1">Inst. Font Size</label>
                                                <input 
                                                    type="text" 
                                                    value={badgeConfig.instSize}
                                                    onChange={(e) => setBadgeConfig({ ...badgeConfig, instSize: e.target.value })}
                                                    className="w-full h-10 px-3 bg-slate-50 border border-slate-100 rounded-xl text-[11px]"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1 ml-1">Inst. Color</label>
                                                <div className="flex gap-2">
                                                    <input 
                                                        type="color" 
                                                        value={badgeConfig.instColor}
                                                        onChange={(e) => setBadgeConfig({ ...badgeConfig, instColor: e.target.value })}
                                                        className="h-10 w-10 bg-slate-50 border border-slate-100 rounded-lg cursor-pointer"
                                                    />
                                                    <input 
                                                        type="text" 
                                                        value={badgeConfig.instColor}
                                                        onChange={(e) => setBadgeConfig({ ...badgeConfig, instColor: e.target.value })}
                                                        className="flex-1 h-10 px-2 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-mono"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1 ml-1">QR Size</label>
                                                <input 
                                                    type="text" 
                                                    value={badgeConfig.qrSize}
                                                    onChange={(e) => setBadgeConfig({ ...badgeConfig, qrSize: e.target.value })}
                                                    className="w-full h-10 px-3 bg-slate-50 border border-slate-100 rounded-xl text-[11px]"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1 ml-1">Padding</label>
                                                <input 
                                                    type="text" 
                                                    value={badgeConfig.padding}
                                                    onChange={(e) => setBadgeConfig({ ...badgeConfig, padding: e.target.value })}
                                                    className="w-full h-10 px-3 bg-slate-50 border border-slate-100 rounded-xl text-[11px]"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                                {/* Right Column: Custom Email Templates */}
                                <div className="space-y-6">
                                    <div className="pb-2 border-b border-slate-50 mb-4">
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Custom Email Templates (Optional)</label>
                                    </div>
                                    
                                    {/* Template Block: Magic Link */}
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center px-1">
                                            <label className="text-[10px] font-bold text-slate-500">Magic Link Body</label>
                                            <button 
                                                type="button"
                                                onClick={() => setViewMode(v => ({ ...v, magicLink: v.magicLink === 'preview' ? 'html' : 'preview' }))}
                                                className="text-[9px] font-bold uppercase tracking-wider text-blue-600 hover:text-blue-700 bg-blue-50 px-2 py-1 rounded-md transition-colors"
                                            >
                                                {viewMode.magicLink === 'preview' ? 'Edit HTML' : 'View Preview'}
                                            </button>
                                        </div>
                                        
                                        <input type="hidden" name="email_magic_link_body" value={templates.magicLink} />
                                        {viewMode.magicLink === 'preview' ? (
                                            <div 
                                                className="w-full h-40 p-4 bg-white border border-slate-100 rounded-xl overflow-y-auto text-[13px] leading-normal email-preview-container"
                                                dangerouslySetInnerHTML={{ __html: templates.magicLink.replace(/\${magicLink}/g, '#').replace(/\${name}/g, 'Voter') }}
                                            />
                                        ) : (
                                            <textarea 
                                                value={templates.magicLink}
                                                onChange={(e) => setTemplates(t => ({ ...t, magicLink: e.target.value }))}
                                                placeholder="Use ${magicLink} for the login URL."
                                                className="w-full h-40 p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
                                            />
                                        )}
                                        <p className="text-[9px] text-slate-400 px-1 italic">Use {"${magicLink}"} placeholder.</p>
                                    </div>

                                    {/* Template Block: Voting Invite */}
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center px-1">
                                            <label className="text-[10px] font-bold text-slate-500">Poster Voting Invite</label>
                                            <button 
                                                type="button"
                                                onClick={() => setViewMode(v => ({ ...v, posterVotingInvite: v.posterVotingInvite === 'preview' ? 'html' : 'preview' }))}
                                                className="text-[9px] font-bold uppercase tracking-wider text-blue-600 hover:text-blue-700 bg-blue-50 px-2 py-1 rounded-md transition-colors"
                                            >
                                                {viewMode.posterVotingInvite === 'preview' ? 'Edit HTML' : 'View Preview'}
                                            </button>
                                        </div>
                                        
                                        <input type="hidden" name="email_poster_voting_invite_body" value={templates.posterVotingInvite} />
                                        {viewMode.posterVotingInvite === 'preview' ? (
                                            <div 
                                                className="w-full h-40 p-4 bg-white border border-slate-100 rounded-xl overflow-y-auto text-[13px] leading-normal email-preview-container"
                                                dangerouslySetInnerHTML={{ __html: templates.posterVotingInvite.replace(/\${magicLink}/g, '#').replace(/\${name}/g, 'John Doe') }}
                                            />
                                        ) : (
                                            <textarea 
                                                value={templates.posterVotingInvite}
                                                onChange={(e) => setTemplates(t => ({ ...t, posterVotingInvite: e.target.value }))}
                                                placeholder="Use ${name} and ${magicLink} placeholders."
                                                className="w-full h-40 p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
                                            />
                                        )}
                                        <p className="text-[9px] text-slate-400 px-1 italic">Use {"${name}"} and {"${magicLink}"} placeholders.</p>
                                    </div>

                                    {/* Template Block: Social Dinner */}
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center px-1">
                                            <label className="text-[10px] font-bold text-slate-500">Social Dinner Tickets</label>
                                            <button 
                                                type="button"
                                                onClick={() => setViewMode(v => ({ ...v, socialDinnerTickets: v.socialDinnerTickets === 'preview' ? 'html' : 'preview' }))}
                                                className="text-[9px] font-bold uppercase tracking-wider text-blue-600 hover:text-blue-700 bg-blue-50 px-2 py-1 rounded-md transition-colors"
                                            >
                                                {viewMode.socialDinnerTickets === 'preview' ? 'Edit HTML' : 'View Preview'}
                                            </button>
                                        </div>
                                        
                                        <input type="hidden" name="email_social_dinner_tickets_body" value={templates.socialDinnerTickets} />
                                        {viewMode.socialDinnerTickets === 'preview' ? (
                                            <div 
                                                className="w-full h-40 p-4 bg-white border border-slate-100 rounded-xl overflow-y-auto text-[13px] leading-normal email-preview-container"
                                                dangerouslySetInnerHTML={{ __html: templates.socialDinnerTickets.replace(/\${name}/g, 'John Doe') }}
                                            />
                                        ) : (
                                            <textarea 
                                                value={templates.socialDinnerTickets}
                                                onChange={(e) => setTemplates(t => ({ ...t, socialDinnerTickets: e.target.value }))}
                                                placeholder="Use ${name} placeholder."
                                                className="w-full h-40 p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
                                            />
                                        )}
                                        <p className="text-[9px] text-slate-400 px-1 italic">Use {"${name}"} placeholder. QRs are appended automatically.</p>
                                    </div>

                                    {/* Template Block: Participant Check-in */}
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center px-1">
                                            <label className="text-[10px] font-bold text-slate-500">Check-in Email Body</label>
                                            <button 
                                                type="button"
                                                onClick={() => setViewMode(v => ({ ...v, emailCheckin: v.emailCheckin === 'preview' ? 'html' : 'preview' }))}
                                                className="text-[9px] font-bold uppercase tracking-wider text-blue-600 hover:text-blue-700 bg-blue-50 px-2 py-1 rounded-md transition-colors"
                                            >
                                                {viewMode.emailCheckin === 'preview' ? 'Edit HTML' : 'View Preview'}
                                            </button>
                                        </div>
                                        
                                        <input type="hidden" name="email_checkin_body" value={templates.emailCheckin} />
                                        {viewMode.emailCheckin === 'preview' ? (
                                            <div 
                                                className="w-full h-40 p-4 bg-white border border-slate-100 rounded-xl overflow-y-auto text-[13px] leading-normal email-preview-container"
                                                dangerouslySetInnerHTML={{ __html: templates.emailCheckin.replace(/\${name}/g, 'John Doe').replace(/\${conference}/g, conference?.name || 'Conference') }}
                                            />
                                        ) : (
                                            <textarea 
                                                value={templates.emailCheckin}
                                                onChange={(e) => setTemplates(t => ({ ...t, emailCheckin: e.target.value }))}
                                                placeholder="Use ${name} and ${conference} placeholders."
                                                className="w-full h-40 p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
                                            />
                                        )}
                                        <p className="text-[9px] text-slate-400 px-1 italic">Use {"${name}"} and {"${conference}"} placeholders. QR is appended automatically.</p>
                                    </div>
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
