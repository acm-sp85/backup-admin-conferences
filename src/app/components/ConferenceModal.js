import { useState, useTransition, useEffect } from 'react';
import { createConference, updateConference, getRegistrationTypes } from '../actions/conferences';
import { getDefaultEmailBody } from '@/lib/email-templates';
import { Info, Settings, Mail, Award, Globe, Plus, Trash2 } from 'lucide-react';
import { formatSocialDinnerDate, formatRegistrationDate } from '@/lib/date-formatter';

const formatDatetimeLocal = (val) => {
    if (!val) return '';
    try {
        const d = new Date(val);
        if (isNaN(d.getTime())) return '';
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    } catch (e) {
        return '';
    }
};

export default function ConferenceModal({ isOpen, onClose, conference = null }) {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState('');
    const [accentColor, setAccentColor] = useState(conference?.accent_color || '#007aff');
    const [socialDinnerDate, setSocialDinnerDate] = useState(
        conference?.social_dinner_date ? formatDatetimeLocal(conference.social_dinner_date) : ''
    );
    const [socialDinnerTimezone, setSocialDinnerTimezone] = useState(
        conference?.social_dinner_timezone || 
        (typeof window !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC')
    );
    const [socialDinnerLocation, setSocialDinnerLocation] = useState(conference?.social_dinner_location || '');
    const [socialDinnerMapsUrl, setSocialDinnerMapsUrl] = useState(conference?.social_dinner_maps_url || '');

    const [registrationVenue, setRegistrationVenue] = useState(conference?.registration_venue || '');
    const [registrationStartsAt, setRegistrationStartsAt] = useState(
        conference?.registration_starts_at ? formatDatetimeLocal(conference.registration_starts_at) : ''
    );
    const [registrationNotes, setRegistrationNotes] = useState(conference?.registration_notes || '');
    const [registrationMapsUrl, setRegistrationMapsUrl] = useState(conference?.registration_maps_url || '');

    const [activeTab, setActiveTab] = useState('general'); // 'general' | 'badge_voting' | 'emails' | 'sponsors'
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
        padding: '10mm',
        width: '80mm',
        height: '98mm',
        bleed: '3mm'
    });
    const [availableUserTypes, setAvailableUserTypes] = useState([]);

    // Sponsor List State
    const [sponsorsList, setSponsorsList] = useState([]);
    const [newSponsorName, setNewSponsorName] = useState('');
    const [newSponsorLogo, setNewSponsorLogo] = useState('');

    const handleAddCustomBg = () => {
        const customBackgrounds = badgeConfig.customBackgrounds || [];
        setBadgeConfig({
            ...badgeConfig,
            customBackgrounds: [...customBackgrounds, { url: '', userTypes: [] }]
        });
    };

    const handleUpdateCustomBg = (index, field, value) => {
        const customBackgrounds = [...(badgeConfig.customBackgrounds || [])];
        customBackgrounds[index] = {
            ...customBackgrounds[index],
            [field]: value
        };
        setBadgeConfig({
            ...badgeConfig,
            customBackgrounds
        });
    };

    const handleToggleUserTypeForCustomBg = (bgIndex, type) => {
        const customBackgrounds = [...(badgeConfig.customBackgrounds || [])];
        const userTypes = [...(customBackgrounds[bgIndex].userTypes || [])];
        const typeIndex = userTypes.indexOf(type);
        if (typeIndex > -1) {
            userTypes.splice(typeIndex, 1);
        } else {
            userTypes.push(type);
        }
        customBackgrounds[bgIndex] = {
            ...customBackgrounds[bgIndex],
            userTypes
        };
        setBadgeConfig({
            ...badgeConfig,
            customBackgrounds
        });
    };

    const handleRemoveCustomBg = (index) => {
        const customBackgrounds = [...(badgeConfig.customBackgrounds || [])];
        customBackgrounds.splice(index, 1);
        setBadgeConfig({
            ...badgeConfig,
            customBackgrounds
        });
    };

    useEffect(() => {
        if (isOpen) {
            setAccentColor(conference?.accent_color || '#007aff');
            setSocialDinnerDate(conference?.social_dinner_date ? formatDatetimeLocal(conference.social_dinner_date) : '');
            setSocialDinnerTimezone(
                conference?.social_dinner_timezone || 
                (typeof window !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC')
            );
            setSocialDinnerLocation(conference?.social_dinner_location || '');
            setSocialDinnerMapsUrl(conference?.social_dinner_maps_url || '');
            setRegistrationVenue(conference?.registration_venue || '');
            setRegistrationStartsAt(conference?.registration_starts_at ? formatDatetimeLocal(conference.registration_starts_at) : '');
            setRegistrationNotes(conference?.registration_notes || '');
            setRegistrationMapsUrl(conference?.registration_maps_url || '');
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

            // Parse sponsors list
            try {
                if (conference?.sponsor_list) {
                    setSponsorsList(typeof conference.sponsor_list === 'string' ? JSON.parse(conference.sponsor_list) : conference.sponsor_list);
                } else {
                    setSponsorsList([]);
                }
            } catch (e) {
                console.error("Failed to parse sponsor list:", e);
                setSponsorsList([]);
            }
            setNewSponsorName('');

            // Fetch available registration types
            getRegistrationTypes(conference?.id).then(types => {
                setAvailableUserTypes(types || []);
            }).catch(err => {
                console.error("Failed to load registration types:", err);
            });
        }
    }, [isOpen, conference]);

    const resetToDefault = (type) => {
        if (confirm(`Are you sure you want to reset the template to its default message? Any custom edits will be lost.`)) {
            setTemplates(t => ({
                ...t,
                [type]: getDefaultEmailBody(type, conference)
            }));
        }
    };

    const handleAddSponsor = () => {
        if (!newSponsorName.trim()) {
            alert('Please enter a sponsor name.');
            return;
        }
        const logoUrl = newSponsorLogo.trim() || '';
        const updated = [...sponsorsList, { name: newSponsorName.trim(), logoUrl }];
        setSponsorsList(updated);
        setNewSponsorName('');
        setNewSponsorLogo('');
    };

    const handleRemoveSponsor = (index) => {
        const updated = sponsorsList.filter((_, i) => i !== index);
        setSponsorsList(updated);
    };

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
                className="bg-white w-full max-w-4xl rounded-[16px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header Section */}
                <div className="px-8 pt-8 pb-4 border-b border-slate-100 flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-bold text-slate-900">
                            {isEdit ? 'Edit Conference' : 'New Conference'}
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">Configure details, voting rules, templates, and sponsors</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-50 rounded-full transition-all">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                    </button>
                </div>

                {/* Tab Navigation */}
                <div className="flex px-8 bg-slate-50/50 border-b border-slate-100 overflow-x-auto gap-2">
                    <button
                        type="button"
                        onClick={() => setActiveTab('general')}
                        className={`flex items-center gap-2 px-4 py-3.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all whitespace-nowrap outline-none ${
                            activeTab === 'general'
                                ? 'border-indigo-600 text-indigo-600'
                                : 'border-transparent text-slate-400 hover:text-slate-600'
                        }`}
                    >
                        <Info className="w-3.5 h-3.5" />
                        General Info
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('badge_voting')}
                        className={`flex items-center gap-2 px-4 py-3.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all whitespace-nowrap outline-none ${
                            activeTab === 'badge_voting'
                                ? 'border-indigo-600 text-indigo-600'
                                : 'border-transparent text-slate-400 hover:text-slate-600'
                        }`}
                    >
                        <Award className="w-3.5 h-3.5" />
                        Badge & Voting
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('emails')}
                        className={`flex items-center gap-2 px-4 py-3.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all whitespace-nowrap outline-none ${
                            activeTab === 'emails'
                                ? 'border-indigo-600 text-indigo-600'
                                : 'border-transparent text-slate-400 hover:text-slate-600'
                        }`}
                    >
                        <Mail className="w-3.5 h-3.5" />
                        Email Templates
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('sponsors')}
                        className={`flex items-center gap-2 px-4 py-3.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all whitespace-nowrap outline-none ${
                            activeTab === 'sponsors'
                                ? 'border-indigo-600 text-indigo-600'
                                : 'border-transparent text-slate-400 hover:text-slate-600'
                        }`}
                    >
                        <Globe className="w-3.5 h-3.5" />
                        Sponsors
                    </button>
                </div>

                {/* Form and Scrollable Container */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto flex flex-col">
                    <div className="p-8 flex-1">
                        {error && (
                            <div className="mb-6 p-3.5 bg-red-50 border border-red-100 text-red-600 text-xs font-bold rounded-xl flex items-center gap-2">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                {error}
                            </div>
                        )}

                        {/* Hidden input to preserve email safety lock state if not editable in modal */}
                        <input type="hidden" name="emails_enabled" value={conference?.emails_enabled ? 'on' : 'off'} />
                        
                        {/* TAB 1: General Info */}
                        <div className={activeTab === 'general' ? 'space-y-5' : 'hidden'}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Conference Name</label>
                                    <input 
                                        name="name"
                                        type="text" 
                                        required
                                        defaultValue={conference?.name || ''}
                                        placeholder="e.g. HOPV26"
                                        className="w-full h-11 px-4 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Conference Full Name</label>
                                    <input 
                                        name="conference_full_name"
                                        type="text" 
                                        defaultValue={conference?.conference_full_name || ''}
                                        placeholder="e.g. International Conference on Hybrid and Organic Photovoltaics"
                                        className="w-full h-11 px-4 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Acronym</label>
                                    <input 
                                        name="acronym"
                                        type="text" 
                                        required
                                        defaultValue={conference?.acronym || ''}
                                        placeholder="e.g. HOPV26"
                                        className="w-full h-11 px-4 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Contact Email</label>
                                    <input 
                                        name="email"
                                        type="email" 
                                        defaultValue={conference?.email || ''}
                                        placeholder="organizers@acronym.org"
                                        className="w-full h-11 px-4 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Start Date</label>
                                    <input 
                                        name="start_date"
                                        type="date" 
                                        required
                                        defaultValue={conference?.start_date ? conference.start_date.split('T')[0] : ''}
                                        className="w-full h-11 px-4 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">End Date</label>
                                    <input 
                                        name="end_date"
                                        type="date" 
                                        required
                                        defaultValue={conference?.end_date ? conference.end_date.split('T')[0] : ''}
                                        className="w-full h-11 px-4 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Logo URL (Optional)</label>
                                    <input 
                                        name="logo_url"
                                        type="url" 
                                        defaultValue={conference?.logo_url || ''}
                                        placeholder="https://..."
                                        className="w-full h-11 px-4 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Banner URL (Optional)</label>
                                    <input 
                                        name="banner_url"
                                        type="url" 
                                        defaultValue={conference?.banner_url || ''}
                                        placeholder="https://..."
                                        className="w-full h-11 px-4 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Accent Color (Optional)</label>
                                    <div className="flex gap-3 items-center">
                                        <input 
                                            name="accent_color"
                                            type="color" 
                                            value={accentColor}
                                            onChange={(e) => setAccentColor(e.target.value)}
                                            className="h-11 w-16 bg-slate-50 border border-slate-100 rounded-xl cursor-pointer"
                                        />
                                        <input 
                                            name="accent_color_text"
                                            type="text"
                                            value={accentColor}
                                            onChange={(e) => setAccentColor(e.target.value)}
                                            className="flex-1 h-11 px-4 bg-slate-50 border border-slate-100 rounded-xl text-xs font-mono text-slate-500 outline-none"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Conference Address (Venue)</label>
                                    <textarea 
                                        name="conference_address"
                                        defaultValue={conference?.conference_address || ''}
                                        placeholder="e.g. Venue Name, Address, City, Country"
                                        className="w-full h-16 p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
                                    />
                                </div>
                            </div>

                            {/* Social Dinner Settings Subsection */}
                            <div className="border-t border-slate-100/80 pt-5 mt-5 space-y-4">
                                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Social Dinner Details</h4>
                                <input type="hidden" name="social_dinner_time" value="" />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Social Dinner Starts at</label>
                                        <input 
                                            name="social_dinner_date"
                                            type="datetime-local" 
                                            value={socialDinnerDate}
                                            onChange={(e) => setSocialDinnerDate(e.target.value)}
                                            className="w-full h-11 px-4 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Timezone</label>
                                        <select 
                                            name="social_dinner_timezone"
                                            value={socialDinnerTimezone}
                                            onChange={(e) => setSocialDinnerTimezone(e.target.value)}
                                            className="w-full h-11 px-4 bg-slate-50 border border-slate-100 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                        >
                                            {Array.from(new Set([
                                                socialDinnerTimezone,
                                                typeof window !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC',
                                                'Europe/Madrid', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Rome',
                                                'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
                                                'Asia/Tokyo', 'Asia/Shanghai', 'UTC'
                                            ])).filter(Boolean).map(tz => (
                                                <option key={tz} value={tz}>{tz}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Social Dinner Location (Venue Name & Address)</label>
                                        <input 
                                            name="social_dinner_location"
                                            type="text" 
                                            value={socialDinnerLocation}
                                            onChange={(e) => setSocialDinnerLocation(e.target.value)}
                                            placeholder="e.g. Playachica, Benicàssim"
                                            className="w-full h-11 px-4 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Google Maps Link (Optional)</label>
                                        <input 
                                            name="social_dinner_maps_url"
                                            type="url" 
                                            value={socialDinnerMapsUrl}
                                            onChange={(e) => setSocialDinnerMapsUrl(e.target.value)}
                                            placeholder="e.g. https://maps.app.goo.gl/bZSYHuqKcTgMFhK96"
                                            className="w-full h-11 px-4 bg-slate-50 border border-slate-100 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Registration Process Subsection */}
                            <div className="border-t border-slate-100/80 pt-5 mt-5 space-y-4">
                                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Registration Process Details</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="md:col-span-2">
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Registration Venue (Name & Address)</label>
                                        <input 
                                            name="registration_venue"
                                            type="text" 
                                            value={registrationVenue}
                                            onChange={(e) => setRegistrationVenue(e.target.value)}
                                            placeholder="e.g. Foyer, Main Building, University of Valencia"
                                            className="w-full h-11 px-4 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Registration Starts at</label>
                                        <input 
                                            name="registration_starts_at"
                                            type="datetime-local" 
                                            value={registrationStartsAt}
                                            onChange={(e) => setRegistrationStartsAt(e.target.value)}
                                            className="w-full h-11 px-4 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Google Maps Link (Optional)</label>
                                        <input 
                                            name="registration_maps_url"
                                            type="url" 
                                            value={registrationMapsUrl}
                                            onChange={(e) => setRegistrationMapsUrl(e.target.value)}
                                            placeholder="e.g. https://maps.app.goo.gl/bZSYHuqKcTgMFhK96"
                                            className="w-full h-11 px-4 bg-slate-50 border border-slate-100 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Registration Notes (Optional)</label>
                                        <input 
                                            name="registration_notes"
                                            type="text" 
                                            value={registrationNotes}
                                            onChange={(e) => setRegistrationNotes(e.target.value)}
                                            placeholder="e.g. Please bring your identity card or student ID."
                                            className="w-full h-11 px-4 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* TAB 2: Badge & Voting */}
                        <div className={activeTab === 'badge_voting' ? 'space-y-6' : 'hidden'}>
                            {/* Voting Settings Group */}
                            <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100 space-y-4">
                                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Voting Settings</h4>
                                
                                <div className="flex items-center gap-3 p-3.5 bg-white border border-slate-100 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors shadow-sm">
                                    <input 
                                        id="voting_validation_enabled"
                                        name="voting_validation_enabled"
                                        type="checkbox" 
                                        defaultChecked={conference ? !!conference.voting_validation_enabled : true}
                                        className="w-5 h-5 rounded-lg text-blue-600 focus:ring-blue-500 border-slate-350"
                                    />
                                    <label htmlFor="voting_validation_enabled" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                                        All posters need to be voted on to submit votes
                                    </label>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Voting Instructions</label>
                                    <textarea 
                                        name="voting_instructions"
                                        defaultValue={conference?.voting_instructions || 'Rank your assigned posters from 1 to 10(1 being the lowest score and 10 the highest)'}
                                        placeholder="Rank your assigned posters from 1 to 10..."
                                        className="w-full h-20 p-3 bg-white border border-slate-100 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none shadow-sm"
                                    />
                                </div>
                            </div>

                            {/* Certificate Signatures Group */}
                            <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100 space-y-4">
                                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Certificate Configuration</h4>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Signature Image URL</label>
                                        <input 
                                            name="signature_image"
                                            type="url"
                                            defaultValue={conference?.signature_image || ''}
                                            placeholder="https://..."
                                            className="w-full h-11 px-4 bg-white border border-slate-100 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Text Under Signature</label>
                                        <input 
                                            name="text_under_signature"
                                            type="text"
                                            defaultValue={conference?.text_under_signature || ''}
                                            placeholder="e.g. Prof. David Sanz, Chairperson"
                                            className="w-full h-11 px-4 bg-white border border-slate-100 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Badge Settings Group */}
                            <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100 space-y-4">
                                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Badge Settings (80x98mm)</h4>
                                
                                <input type="hidden" name="badge_config" value={JSON.stringify(badgeConfig)} />
                                
                                <div>
                                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1 ml-1">Badge Background URL</label>
                                    <input 
                                        name="badge_bg"
                                        type="url" 
                                        defaultValue={conference?.badge_bg || ''}
                                        placeholder="https://..."
                                        className="w-full h-10 px-3 bg-white border border-slate-100 rounded-xl text-[11px] focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
                                    />
                                </div>

                                <div className="border-t border-slate-200/60 pt-4 mt-4 space-y-4">
                                    <div className="flex justify-between items-center">
                                        <h5 className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">Custom Backgrounds by User Type</h5>
                                        <button 
                                            type="button"
                                            onClick={handleAddCustomBg}
                                            className="text-[9px] font-bold uppercase tracking-wider text-indigo-600 hover:text-indigo-700 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 shadow-sm"
                                        >
                                            <Plus className="w-3 h-3" />
                                            Add Custom Background
                                        </button>
                                    </div>

                                    <div className="space-y-4">
                                        {(badgeConfig.customBackgrounds || []).map((bg, index) => (
                                            <div key={index} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm relative space-y-3">
                                                <button 
                                                    type="button"
                                                    onClick={() => handleRemoveCustomBg(index)}
                                                    className="absolute top-3 right-3 text-slate-400 hover:text-red-500 p-1 hover:bg-slate-50 rounded-lg transition-colors"
                                                    title="Remove mapping"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>

                                                <div className="pr-8">
                                                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 ml-0.5">Background Image URL</label>
                                                    <input 
                                                        type="url"
                                                        value={bg.url || ''}
                                                        onChange={(e) => handleUpdateCustomBg(index, 'url', e.target.value)}
                                                        placeholder="https://example.com/custom-bg.png"
                                                        className="w-full h-9 px-3 bg-slate-55 border border-slate-100 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500 transition-all font-mono"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-0.5">Applies to User Types</label>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {availableUserTypes.map(type => {
                                                            const isSelected = (bg.userTypes || []).includes(type);
                                                            return (
                                                                <button
                                                                    key={type}
                                                                    type="button"
                                                                    onClick={() => handleToggleUserTypeForCustomBg(index, type)}
                                                                    className={`px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider border transition-all ${
                                                                        isSelected 
                                                                            ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-extrabold shadow-sm' 
                                                                            : 'bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100'
                                                                    }`}
                                                                >
                                                                    {type}
                                                                </button>
                                                            );
                                                        })}
                                                        {availableUserTypes.length === 0 && (
                                                            <span className="text-[10px] text-slate-400 italic">No user types found in database.</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {(badgeConfig.customBackgrounds || []).length === 0 && (
                                            <p className="text-[10px] text-slate-400 italic text-center py-2">No custom backgrounds defined yet. Click the button above to add one.</p>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                    <div>
                                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1 ml-1">Name Font Size</label>
                                        <input 
                                            type="text" 
                                            value={badgeConfig.nameSize}
                                            onChange={(e) => setBadgeConfig({ ...badgeConfig, nameSize: e.target.value })}
                                            className="w-full h-10 px-3 bg-white border border-slate-100 rounded-xl text-[11px] shadow-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1 ml-1">Name Color</label>
                                        <div className="flex gap-2">
                                            <input 
                                                type="color" 
                                                value={badgeConfig.nameColor}
                                                onChange={(e) => setBadgeConfig({ ...badgeConfig, nameColor: e.target.value })}
                                                className="h-10 w-10 border border-slate-150 rounded-lg cursor-pointer bg-white"
                                            />
                                            <input 
                                                type="text" 
                                                value={badgeConfig.nameColor}
                                                onChange={(e) => setBadgeConfig({ ...badgeConfig, nameColor: e.target.value })}
                                                className="flex-1 w-full h-10 px-2 bg-white border border-slate-100 rounded-xl text-[10px] font-mono shadow-sm"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1 ml-1">Inst. Font Size</label>
                                        <input 
                                            type="text" 
                                            value={badgeConfig.instSize}
                                            onChange={(e) => setBadgeConfig({ ...badgeConfig, instSize: e.target.value })}
                                            className="w-full h-10 px-3 bg-white border border-slate-100 rounded-xl text-[11px] shadow-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1 ml-1">Inst. Color</label>
                                        <div className="flex gap-2">
                                            <input 
                                                type="color" 
                                                value={badgeConfig.instColor}
                                                onChange={(e) => setBadgeConfig({ ...badgeConfig, instColor: e.target.value })}
                                                className="h-10 w-10 border border-slate-150 rounded-lg cursor-pointer bg-white"
                                            />
                                            <input 
                                                type="text" 
                                                value={badgeConfig.instColor}
                                                onChange={(e) => setBadgeConfig({ ...badgeConfig, instColor: e.target.value })}
                                                className="flex-1 w-full h-10 px-2 bg-white border border-slate-100 rounded-xl text-[10px] font-mono shadow-sm"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-3">
                                    <div>
                                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1 ml-1">Name Font Family</label>
                                        <select 
                                            value={badgeConfig.nameFont || 'Inter'}
                                            onChange={(e) => setBadgeConfig({ ...badgeConfig, nameFont: e.target.value })}
                                            className="w-full h-10 px-2 bg-white border border-slate-100 rounded-xl text-[11px] shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        >
                                            {['Inter', 'Roboto', 'Outfit', 'Montserrat', 'Playfair Display', 'Open Sans', 'Lora', 'Cinzel'].map(f => (
                                                <option key={f} value={f}>{f}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1 ml-1">Name Font Weight</label>
                                        <select 
                                            value={badgeConfig.nameWeight || '700'}
                                            onChange={(e) => setBadgeConfig({ ...badgeConfig, nameWeight: e.target.value })}
                                            className="w-full h-10 px-2 bg-white border border-slate-100 rounded-xl text-[11px] shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        >
                                            <option value="300">Light (300)</option>
                                            <option value="400">Regular (400)</option>
                                            <option value="500">Medium (500)</option>
                                            <option value="700">Bold (700)</option>
                                            <option value="900">Black (900)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1 ml-1">Inst. Font Family</label>
                                        <select 
                                            value={badgeConfig.instFont || 'Inter'}
                                            onChange={(e) => setBadgeConfig({ ...badgeConfig, instFont: e.target.value })}
                                            className="w-full h-10 px-2 bg-white border border-slate-100 rounded-xl text-[11px] shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        >
                                            {['Inter', 'Roboto', 'Outfit', 'Montserrat', 'Playfair Display', 'Open Sans', 'Lora', 'Cinzel'].map(f => (
                                                <option key={f} value={f}>{f}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1 ml-1">Inst. Font Weight</label>
                                        <select 
                                            value={badgeConfig.instWeight || '400'}
                                            onChange={(e) => setBadgeConfig({ ...badgeConfig, instWeight: e.target.value })}
                                            className="w-full h-10 px-2 bg-white border border-slate-100 rounded-xl text-[11px] shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        >
                                            <option value="300">Light (300)</option>
                                            <option value="400">Regular (400)</option>
                                            <option value="500">Medium (500)</option>
                                            <option value="700">Bold (700)</option>
                                            <option value="900">Black (900)</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="flex gap-6 mt-3 px-1">
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="checkbox" 
                                            id="capitalizeName"
                                            checked={badgeConfig.capitalizeName !== false} 
                                            onChange={(e) => setBadgeConfig({ ...badgeConfig, capitalizeName: e.target.checked })}
                                            className="w-4 h-4 text-blue-600 border-slate-200 rounded focus:ring-blue-500"
                                        />
                                        <label htmlFor="capitalizeName" className="text-[10px] font-bold text-slate-500 uppercase cursor-pointer select-none">Capitalize Name</label>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="checkbox" 
                                            id="capitalizeInst"
                                            checked={!!badgeConfig.capitalizeInst} 
                                            onChange={(e) => setBadgeConfig({ ...badgeConfig, capitalizeInst: e.target.checked })}
                                            className="w-4 h-4 text-blue-600 border-slate-200 rounded focus:ring-blue-500"
                                        />
                                        <label htmlFor="capitalizeInst" className="text-[10px] font-bold text-slate-500 uppercase cursor-pointer select-none">Capitalize Institution</label>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-6 mt-3 bg-slate-50/50 p-4 rounded-xl border border-slate-100/80">
                                    <div>
                                        <div className="flex justify-between items-center mb-1.5">
                                            <label className="block text-[9px] font-bold text-slate-500 uppercase ml-1">Name Y Position</label>
                                            <span className="text-[9px] font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                                                {badgeConfig.nameY || '50%'}
                                            </span>
                                        </div>
                                        <input 
                                            type="range" 
                                            min="0" 
                                            max="100"
                                            value={parseInt(badgeConfig.nameY) || 50}
                                            onChange={(e) => setBadgeConfig({ ...badgeConfig, nameY: `${e.target.value}%` })}
                                            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                        />
                                        <div className="flex justify-between text-[8px] text-slate-400 mt-1 px-0.5">
                                            <span>0% (Top)</span>
                                            <span>100% (Bottom)</span>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex justify-between items-center mb-1.5">
                                            <label className="block text-[9px] font-bold text-slate-500 uppercase ml-1">Inst. Y Position</label>
                                            <span className="text-[9px] font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                                                {badgeConfig.instY || '60%'}
                                            </span>
                                        </div>
                                        <input 
                                            type="range" 
                                            min="0" 
                                            max="100"
                                            value={parseInt(badgeConfig.instY) || 60}
                                            onChange={(e) => setBadgeConfig({ ...badgeConfig, instY: `${e.target.value}%` })}
                                            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                        />
                                        <div className="flex justify-between text-[8px] text-slate-400 mt-1 px-0.5">
                                            <span>0% (Top)</span>
                                            <span>100% (Bottom)</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1 ml-1">QR Size</label>
                                        <input 
                                            type="text" 
                                            value={badgeConfig.qrSize}
                                            onChange={(e) => setBadgeConfig({ ...badgeConfig, qrSize: e.target.value })}
                                            className="w-full h-10 px-3 bg-white border border-slate-100 rounded-xl text-[11px] shadow-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1 ml-1">Padding</label>
                                        <input 
                                            type="text" 
                                            value={badgeConfig.padding}
                                            onChange={(e) => setBadgeConfig({ ...badgeConfig, padding: e.target.value })}
                                            className="w-full h-10 px-3 bg-white border border-slate-100 rounded-xl text-[11px] shadow-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1 ml-1">Side Margin</label>
                                        <input 
                                            type="text" 
                                            value={badgeConfig.sideMargin || '10mm'}
                                            placeholder="e.g. 10mm"
                                            onChange={(e) => setBadgeConfig({ ...badgeConfig, sideMargin: e.target.value })}
                                            className="w-full h-10 px-3 bg-white border border-slate-100 rounded-xl text-[11px] shadow-sm"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-4 mt-3">
                                    <div>
                                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1 ml-1">Width (e.g. 80mm)</label>
                                        <input 
                                            type="text" 
                                            value={badgeConfig.width || '80mm'}
                                            onChange={(e) => setBadgeConfig({ ...badgeConfig, width: e.target.value })}
                                            className="w-full h-10 px-3 bg-white border border-slate-100 rounded-xl text-[11px] shadow-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1 ml-1">Height (e.g. 98mm)</label>
                                        <input 
                                            type="text" 
                                            value={badgeConfig.height || '98mm'}
                                            onChange={(e) => setBadgeConfig({ ...badgeConfig, height: e.target.value })}
                                            className="w-full h-10 px-3 bg-white border border-slate-100 rounded-xl text-[11px] shadow-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1 ml-1">Bleed (e.g. 3mm)</label>
                                        <input 
                                            type="text" 
                                            value={badgeConfig.bleed || '3mm'}
                                            onChange={(e) => setBadgeConfig({ ...badgeConfig, bleed: e.target.value })}
                                            className="w-full h-10 px-3 bg-white border border-slate-100 rounded-xl text-[11px] shadow-sm"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* TAB 3: Email Templates */}
                        <div className={activeTab === 'emails' ? 'grid grid-cols-1 md:grid-cols-2 gap-6' : 'hidden'}>
                            {/* Template Block: Magic Link */}
                            <div className="space-y-2 bg-slate-50/50 p-4 rounded-xl border border-slate-100 flex flex-col">
                                <div className="flex justify-between items-center px-1 mb-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Magic Link Body</label>
                                    <div className="flex items-center gap-1.5">
                                        <button 
                                            type="button"
                                            onClick={() => resetToDefault('magicLink')}
                                            className="text-[9px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md transition-colors"
                                        >
                                            Use Default Message
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={() => setViewMode(v => ({ ...v, magicLink: v.magicLink === 'preview' ? 'html' : 'preview' }))}
                                            className="text-[9px] font-bold uppercase tracking-wider text-blue-600 hover:text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md transition-colors"
                                        >
                                            {viewMode.magicLink === 'preview' ? 'Edit HTML' : 'View Preview'}
                                        </button>
                                    </div>
                                </div>
                                
                                <input type="hidden" name="email_magic_link_body" value={templates.magicLink} />
                                {viewMode.magicLink === 'preview' ? (
                                    <div 
                                        className="w-full h-44 p-4 bg-white border border-slate-100 rounded-xl overflow-y-auto text-[13px] leading-normal email-preview-container flex-1 shadow-sm"
                                        dangerouslySetInnerHTML={{ __html: templates.magicLink.replace(/\${magicLink}/g, '#').replace(/\${name}/g, 'Voter') }}
                                    />
                                ) : (
                                    <textarea 
                                        value={templates.magicLink}
                                        onChange={(e) => setTemplates(t => ({ ...t, magicLink: e.target.value }))}
                                        placeholder="Use ${magicLink} for the login URL."
                                        className="w-full h-44 p-3 bg-white border border-slate-100 rounded-xl text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none flex-1 shadow-sm"
                                    />
                                )}
                                <p className="text-[9px] text-slate-400 px-1 italic mt-1">Use {"${magicLink}"} placeholder.</p>
                            </div>

                            {/* Template Block: Voting Invite */}
                            <div className="space-y-2 bg-slate-50/50 p-4 rounded-xl border border-slate-100 flex flex-col">
                                <div className="flex justify-between items-center px-1 mb-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Poster Voting Invite</label>
                                    <div className="flex items-center gap-1.5">
                                        <button 
                                            type="button"
                                            onClick={() => resetToDefault('posterVotingInvite')}
                                            className="text-[9px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md transition-colors"
                                        >
                                            Use Default Message
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={() => setViewMode(v => ({ ...v, posterVotingInvite: v.posterVotingInvite === 'preview' ? 'html' : 'preview' }))}
                                            className="text-[9px] font-bold uppercase tracking-wider text-blue-600 hover:text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md transition-colors"
                                        >
                                            {viewMode.posterVotingInvite === 'preview' ? 'Edit HTML' : 'View Preview'}
                                        </button>
                                    </div>
                                </div>
                                
                                <input type="hidden" name="email_poster_voting_invite_body" value={templates.posterVotingInvite} />
                                {viewMode.posterVotingInvite === 'preview' ? (
                                    <div 
                                        className="w-full h-44 p-4 bg-white border border-slate-100 rounded-xl overflow-y-auto text-[13px] leading-normal email-preview-container flex-1 shadow-sm"
                                        dangerouslySetInnerHTML={{ __html: templates.posterVotingInvite.replace(/\${magicLink}/g, '#').replace(/\${name}/g, 'John Doe') }}
                                    />
                                ) : (
                                    <textarea 
                                        value={templates.posterVotingInvite}
                                        onChange={(e) => setTemplates(t => ({ ...t, posterVotingInvite: e.target.value }))}
                                        placeholder="Use ${name} and ${magicLink} placeholders."
                                        className="w-full h-44 p-3 bg-white border border-slate-100 rounded-xl text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none flex-1 shadow-sm"
                                    />
                                )}
                                <p className="text-[9px] text-slate-400 px-1 italic mt-1">Use {"${name}"} and {"${magicLink}"} placeholders.</p>
                            </div>

                            {/* Template Block: Social Dinner */}
                            <div className="space-y-2 bg-slate-50/50 p-4 rounded-xl border border-slate-100 flex flex-col">
                                <div className="flex justify-between items-center px-1 mb-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Social Dinner Tickets</label>
                                    <div className="flex items-center gap-1.5">
                                        <button 
                                            type="button"
                                            onClick={() => resetToDefault('socialDinnerTickets')}
                                            className="text-[9px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md transition-colors"
                                        >
                                            Use Default Message
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={() => setViewMode(v => ({ ...v, socialDinnerTickets: v.socialDinnerTickets === 'preview' ? 'html' : 'preview' }))}
                                            className="text-[9px] font-bold uppercase tracking-wider text-blue-600 hover:text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md transition-colors"
                                        >
                                            {viewMode.socialDinnerTickets === 'preview' ? 'Edit HTML' : 'View Preview'}
                                        </button>
                                    </div>
                                </div>
                                
                                <input type="hidden" name="email_social_dinner_tickets_body" value={templates.socialDinnerTickets} />
                                {viewMode.socialDinnerTickets === 'preview' ? (
                                    <div 
                                        className="w-full h-44 p-4 bg-white border border-slate-100 rounded-xl overflow-y-auto text-[13px] leading-normal email-preview-container flex-1 shadow-sm"
                                        dangerouslySetInnerHTML={{ 
                                            __html: (() => {
                                                const formattedDate = formatSocialDinnerDate(socialDinnerDate, '', socialDinnerTimezone);
                                                const formattedLocation = socialDinnerMapsUrl 
                                                    ? `<a href="${socialDinnerMapsUrl}" target="_blank" style="color: #0071e3; text-decoration: underline;">${socialDinnerLocation || 'TBD'}</a>`
                                                    : (socialDinnerLocation || 'TBD');
                                                return templates.socialDinnerTickets
                                                    .replace(/\${name}/g, 'John Doe')
                                                    .replace(/\${social_dinner_date}/g, formattedDate || 'TBD')
                                                    .replace(/\${social_dinner_location}/g, formattedLocation)
                                                    .replace(/\${conference\.social_dinner_date}/g, formattedDate || 'TBD')
                                                    .replace(/\${conference\.social_dinner_location}/g, formattedLocation);
                                            })()
                                        }}
                                    />
                                ) : (
                                    <textarea 
                                        value={templates.socialDinnerTickets}
                                        onChange={(e) => setTemplates(t => ({ ...t, socialDinnerTickets: e.target.value }))}
                                        placeholder="Use ${name} placeholder."
                                        className="w-full h-44 p-3 bg-white border border-slate-100 rounded-xl text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none flex-1 shadow-sm"
                                    />
                                )}
                                <p className="text-[9px] text-slate-400 px-1 italic mt-1">Use {"${name}"} placeholder. QRs are appended automatically.</p>
                            </div>

                            {/* Template Block: Participant Check-in */}
                            <div className="space-y-2 bg-slate-50/50 p-4 rounded-xl border border-slate-100 flex flex-col">
                                <div className="flex justify-between items-center px-1 mb-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Check-in Email Body</label>
                                    <div className="flex items-center gap-1.5">
                                        <button 
                                            type="button"
                                            onClick={() => resetToDefault('emailCheckin')}
                                            className="text-[9px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md transition-colors"
                                        >
                                            Use Default Message
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={() => setViewMode(v => ({ ...v, emailCheckin: v.emailCheckin === 'preview' ? 'html' : 'preview' }))}
                                            className="text-[9px] font-bold uppercase tracking-wider text-blue-600 hover:text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md transition-colors"
                                        >
                                            {viewMode.emailCheckin === 'preview' ? 'Edit HTML' : 'View Preview'}
                                        </button>
                                    </div>
                                </div>
                                
                                <input type="hidden" name="email_checkin_body" value={templates.emailCheckin} />
                                {viewMode.emailCheckin === 'preview' ? (
                                    <div 
                                        className="w-full h-44 p-4 bg-white border border-slate-100 rounded-xl overflow-y-auto text-[13px] leading-normal email-preview-container flex-1 shadow-sm"
                                        dangerouslySetInnerHTML={{ 
                                            __html: (() => {
                                                const venueVal = (registrationVenue || '').trim();
                                                const startsAtVal = (registrationStartsAt || '').trim();
                                                const notesVal = (registrationNotes || '').trim();
                                                const hasNotes = notesVal && notesVal.toLowerCase() !== 'none';
                                                
                                                const regVenueHtml = registrationMapsUrl 
                                                    ? `<a href="${registrationMapsUrl}" target="_blank" style="color: #0071e3; text-decoration: underline;">${venueVal || 'TBD'}</a>`
                                                    : venueVal;
                                                    
                                                let previewHtml = templates.emailCheckin;
                                                const hasRegistration = venueVal || startsAtVal || hasNotes;
                                                
                                                if (!hasRegistration) {
                                                    previewHtml = previewHtml.replace(/<!-- registration_details_start -->[\s\S]*?<!-- registration_details_end -->/gi, '');
                                                } else {
                                                    const stripPlaceholder = (content, placeholder) => {
                                                        const tagRegex = new RegExp('<(p|li|tr|td|span)[^>]*>(?:(?!<\\/\\1>)[\\s\\S])*?\\$\\{' + placeholder + '\\}(?:(?!<\\/\\1>)[\\s\\S])*?<\\/\\1>', 'gi');
                                                        let newContent = content.replace(tagRegex, '');
                                                        const lineRegex = new RegExp('^[^\\n]*\\$\\{' + placeholder + '\\}[^\\n]*\\n?', 'gim');
                                                        newContent = newContent.replace(lineRegex, '');
                                                        return newContent;
                                                    };

                                                    if (!venueVal) {
                                                        previewHtml = stripPlaceholder(previewHtml, 'registration_venue');
                                                    } else {
                                                        previewHtml = previewHtml.replace(/\${registration_venue}/g, regVenueHtml);
                                                    }
                                                    if (!startsAtVal) {
                                                        previewHtml = stripPlaceholder(previewHtml, 'registration_starts_at');
                                                    } else {
                                                        previewHtml = previewHtml.replace(/\${registration_starts_at}/g, formatRegistrationDate(registrationStartsAt) || '');
                                                    }
                                                    if (!hasNotes) {
                                                        previewHtml = stripPlaceholder(previewHtml, 'registration_notes');
                                                    } else {
                                                        previewHtml = previewHtml.replace(/\${registration_notes}/g, notesVal);
                                                    }
                                                }
                                                
                                                return previewHtml
                                                    .replace(/\${name}/g, 'John Doe')
                                                    .replace(/\${conference}/g, conference?.name || 'Conference');
                                            })()
                                        }}
                                    />
                                ) : (
                                    <textarea 
                                        value={templates.emailCheckin}
                                        onChange={(e) => setTemplates(t => ({ ...t, emailCheckin: e.target.value }))}
                                        placeholder="Use ${name}, ${conference}, ${registration_venue}, ${registration_starts_at}, and ${registration_notes} placeholders."
                                        className="w-full h-44 p-3 bg-white border border-slate-100 rounded-xl text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none flex-1 shadow-sm"
                                    />
                                )}
                                <p className="text-[9px] text-slate-400 px-1 italic mt-1">Use {"${name}"}, {"${conference}"}, {"${registration_venue}"}, {"${registration_starts_at}"}, and {"${registration_notes}"} placeholders. QR is appended automatically.</p>
                            </div>
                        </div>

                        {/* TAB 4: Sponsors */}
                        <div className={activeTab === 'sponsors' ? 'space-y-6' : 'hidden'}>
                            <input type="hidden" name="sponsor_list" value={JSON.stringify(sponsorsList)} />

                            {/* Add Sponsor Input Row */}
                            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-4">
                                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Add Conference Sponsor</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1.5 ml-1">Sponsor Name</label>
                                        <input 
                                            type="text" 
                                            value={newSponsorName}
                                            onChange={(e) => setNewSponsorName(e.target.value)}
                                            placeholder="e.g. SCITO"
                                            className="w-full h-11 px-4 bg-white border border-slate-150 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1.5 ml-1">Logo URL (Optional)</label>
                                        <input 
                                            type="url" 
                                            value={newSponsorLogo}
                                            onChange={(e) => setNewSponsorLogo(e.target.value)}
                                            placeholder="https://..."
                                            className="w-full h-11 px-4 bg-white border border-slate-150 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
                                        />
                                    </div>
                                </div>
                                <button 
                                    type="button"
                                    onClick={handleAddSponsor}
                                    className="h-11 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md shadow-indigo-100 active:scale-[0.98] border border-indigo-700"
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                    Add Sponsor
                                </button>
                            </div>

                            {/* Sponsors List Preview */}
                            <div className="space-y-3">
                                <div className="flex justify-between items-center px-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Current Sponsors</label>
                                    <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">{sponsorsList.length} total</span>
                                </div>

                                {sponsorsList.length > 0 ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                        {sponsorsList.map((sponsor, index) => (
                                            <div key={index} className="flex items-center gap-3.5 p-3.5 bg-white border border-slate-200 rounded-2xl relative shadow-sm hover:border-slate-300 transition-all group animate-in fade-in duration-200">
                                                {sponsor.logoUrl ? (
                                                    <div className="w-12 h-12 rounded-xl border border-slate-100 overflow-hidden flex-shrink-0 flex items-center justify-center bg-slate-50">
                                                        <img src={sponsor.logoUrl} alt={sponsor.name} className="max-w-full max-h-full object-contain" />
                                                    </div>
                                                ) : (
                                                    <div className="w-12 h-12 rounded-xl border border-slate-100 flex-shrink-0 flex items-center justify-center bg-slate-50 text-[10px] font-bold text-slate-400">
                                                        No Logo
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0 pr-6">
                                                    <p className="text-xs font-bold text-slate-700 truncate">{sponsor.name}</p>
                                                </div>
                                                <button 
                                                    type="button"
                                                    onClick={() => handleRemoveSponsor(index)}
                                                    className="absolute top-2 right-2 text-slate-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-full transition-all"
                                                >
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-8 text-center border border-dashed border-slate-200 rounded-2xl text-xs text-slate-400 font-medium">
                                        No sponsors added yet.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Footer / Submit Buttons */}
                    <div className="px-8 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3 rounded-b-[16px]">
                        <button 
                            type="button" 
                            onClick={onClose}
                            className="h-11 px-5 border border-slate-200 text-slate-600 rounded-xl font-bold text-xs hover:bg-slate-100 transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit"
                            disabled={isPending}
                            className="h-11 px-6 bg-slate-900 text-white hover:bg-black rounded-xl font-bold text-xs shadow-md shadow-slate-200 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center min-w-[120px]"
                        >
                            {isPending ? 'Saving...' : isEdit ? 'Update Conference' : 'Create Conference'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
