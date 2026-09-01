import { query } from '@/lib/db';
import { verifySession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import DashboardLayout from '@/app/components/DashboardLayout';
import { hasAdminAccess } from '@/lib/roles';
import { 
    Mail, Users, Award, FileText, Calendar, MapPin, 
    Globe, Ticket, Clock, AlignLeft, Info
} from 'lucide-react';
import Link from 'next/link';
import { formatSocialDinnerDate, formatRegistrationDate } from '@/lib/date-formatter';

function Section({ title, icon: Icon, children, className = "", href }) {
    const Content = (
        <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-6 ${className} ${href ? 'hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer group' : ''}`}>
            <div className={`flex items-center justify-between px-6 py-4 bg-slate-50/50 border-b border-slate-100 ${href ? 'group-hover:bg-indigo-50/50' : ''}`}>
                <div className="flex items-center gap-2">
                    <Icon className="w-5 h-5 text-indigo-500" />
                    <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">{title}</h2>
                </div>
                {href && (
                    <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Edit</span>
                )}
            </div>
            <div className="p-6">
                {children}
            </div>
        </div>
    );

    if (href) {
        return <Link href={href} className="block">{Content}</Link>;
    }
    return Content;
}

function Field({ label, value, isHtml = false, isCode = false }) {
    if (value === null || value === undefined || value === '') return null;
    
    return (
        <div className="mb-4 last:mb-0">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">{label}</label>
            {isHtml ? (
                <div 
                    className="prose prose-sm max-w-none text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-100 mt-2 overflow-x-auto"
                    dangerouslySetInnerHTML={{ __html: value }}
                />
            ) : isCode ? (
                <pre className="text-xs text-slate-700 bg-slate-50/50 p-4 rounded-xl border border-slate-100 overflow-x-auto whitespace-pre-wrap font-mono">
                    {value}
                </pre>
            ) : (
                <div className="text-sm text-slate-800 bg-slate-50/50 px-4 py-2.5 rounded-xl border border-slate-100 inline-block min-w-full md:min-w-[50%]">
                    {value}
                </div>
            )}
        </div>
    );
}

function KPIBox({ label, value, icon: Icon, colorClass }) {
    return (
        <div className="bg-white rounded-2xl border border-slate-100 p-6 flex items-center gap-5 shadow-sm hover:shadow-md transition-shadow">
            <div className={`p-4 rounded-2xl ${colorClass}`}>
                <Icon className="w-6 h-6" />
            </div>
            <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
                <p className="text-3xl font-black text-slate-800">{value}</p>
            </div>
        </div>
    );
}

export default async function PreConferenceReportPage({ params }) {
    const session = await verifySession();
    if (!session || !hasAdminAccess(session.role)) {
        redirect('/login');
    }
    
    const { acronym } = await params;

    const [conference] = await query('SELECT * FROM conferences WHERE acronym = ?', [acronym]);

    if (!conference) {
        return (
            <DashboardLayout>
                <div className="p-8 max-w-6xl mx-auto">
                    <div className="bg-red-50 text-red-600 p-6 rounded-2xl border border-red-100 flex flex-col items-center justify-center min-h-[300px]">
                        <Info className="w-12 h-12 mb-4 opacity-50" />
                        <h1 className="text-2xl font-bold mb-2">Conference Not Found</h1>
                        <p>The conference "{acronym}" does not exist.</p>
                        <Link href="/" className="mt-6 px-4 py-2 bg-white text-red-600 rounded-xl border border-red-200 hover:bg-red-100 font-bold text-sm transition-colors">
                            Return to Dashboard
                        </Link>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    // Fetch KPIs
    const [{ count: participantsCount }] = await query(
        'SELECT COUNT(*) as count FROM registrations WHERE conference_id = ? AND (is_removed = 0 OR is_removed IS NULL) AND (is_guest = 0 OR is_guest IS NULL)', 
        [conference.id]
    );

    const [{ count: postersCount }] = await query(
        'SELECT COUNT(*) as count FROM posters WHERE conference_id = ?', 
        [conference.id]
    );

    const [{ count: socialDinnerCount }] = await query(
        'SELECT COUNT(*) as count FROM social_dinner_tickets t JOIN registrations r ON t.registration_id = r.id WHERE r.conference_id = ? AND t.is_hidden = 0', 
        [conference.id]
    );

    const [{ count: abstractsCount }] = await query(
        'SELECT COUNT(*) as count FROM posters WHERE conference_id = ? AND content IS NOT NULL AND content != ""', 
        [conference.id]
    );

    const formatDatetimeLocal = (val) => {
        if (!val) return null;
        try {
            const d = new Date(val);
            if (isNaN(d.getTime())) return null;
            return new Intl.DateTimeFormat('en-US', { 
                dateStyle: 'full', 
                timeStyle: 'short' 
            }).format(d);
        } catch (e) {
            return null;
        }
    };
    
    const formatDate = (val) => {
        if (!val) return null;
        try {
            const d = new Date(val);
            if (isNaN(d.getTime())) return null;
            return new Intl.DateTimeFormat('en-US', { dateStyle: 'long' }).format(d);
        } catch (e) {
            return null;
        }
    };

    return (
        <DashboardLayout>
            <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
                
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-slate-100 pb-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-3 py-1 rounded-full tracking-wide">
                                {conference.acronym}
                            </span>
                            {conference.emails_enabled ? (
                                <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Emails Enabled</span>
                            ) : (
                                <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Emails Locked</span>
                            )}
                        </div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">{conference.name}</h1>
                        <p className="text-slate-500 text-sm mt-1">Pre-Conference Configuration Report</p>
                    </div>
                    <Link href="/" className="px-4 py-2 bg-white text-slate-600 rounded-xl border border-slate-200 hover:bg-slate-50 font-bold text-sm transition-colors shadow-sm">
                        Back to Dashboard
                    </Link>
                </div>

                {/* KPIs */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <KPIBox 
                        label="Total Participants" 
                        value={participantsCount} 
                        icon={Users} 
                        colorClass="bg-blue-50 text-blue-600" 
                    />
                    {/* <KPIBox 
                        label="Total Posters" 
                        value={postersCount} 
                        icon={FileText} 
                        colorClass="bg-emerald-50 text-emerald-600" 
                    />
                    <KPIBox 
                        label="Total Abstracts" 
                        value={abstractsCount} 
                        icon={AlignLeft} 
                        colorClass="bg-amber-50 text-amber-600" 
                    /> */}
                    <KPIBox 
                        label="Social Dinner Attendees" 
                        value={socialDinnerCount} 
                        icon={Ticket} 
                        colorClass="bg-fuchsia-50 text-fuchsia-600" 
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* General Section */}
                    <Section title="General Information" icon={Info} href={`/?edit=${acronym}&tab=general`}>
                        <Field label="Full Name" value={conference.conference_full_name} />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Field label="Start Date" value={formatDate(conference.start_date)} />
                            <Field label="End Date" value={formatDate(conference.end_date)} />
                        </div>
                        <Field label="Contact Email" value={conference.email} />
                        <Field label="Email From Domain" value={conference.email_from_domain} />
                        <Field label="Accent Color" value={
                            conference.accent_color ? (
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 rounded-full border border-black/10" style={{ backgroundColor: conference.accent_color }}></div>
                                    <span className="font-mono">{conference.accent_color}</span>
                                </div>
                            ) : null
                        } />
                        <Field label="Conference Address (Venue)" value={conference.conference_address} />
                        
                        {(conference.logo_url || conference.banner_url) && (
                            <div className="mt-6 pt-6 border-t border-slate-100">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Branding Assets</h3>
                                <div className="flex gap-4 flex-wrap">
                                    {conference.logo_url && (
                                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col items-center">
                                            <img src={conference.logo_url} alt="Logo" className="h-16 object-contain mb-2" />
                                            <span className="text-[10px] text-slate-500 font-mono break-all max-w-[200px]">{conference.logo_url}</span>
                                        </div>
                                    )}
                                    {conference.banner_url && (
                                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col items-center">
                                            <img src={conference.banner_url} alt="Banner" className="h-16 object-cover rounded-md mb-2" />
                                            <span className="text-[10px] text-slate-500 font-mono break-all max-w-[200px]">{conference.banner_url}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </Section>

                    {/* Registrations & Venue */}
                    <div className="space-y-6">
                        <Section title="Registration Details" icon={MapPin} href={`/?edit=${acronym}&tab=general`}>
                            <Field label="Registration Venue" value={conference.registration_venue} />
                            <Field label="Registration Starts At" value={formatDatetimeLocal(conference.registration_starts_at)} />
                            <Field label="Registration Notes" value={conference.registration_notes} />
                            <Field label="Maps Link" value={
                                conference.registration_maps_url ? (
                                    <a href={conference.registration_maps_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                                        <Globe className="w-3 h-3" /> View on Map
                                    </a>
                                ) : null
                            } />
                        </Section>

                        <Section title="Social Dinner Details" icon={Clock} href={`/?edit=${acronym}&tab=general`}>
                            <Field label="Date & Time" value={formatDatetimeLocal(conference.social_dinner_date)} />
                            <Field label="Timezone" value={conference.social_dinner_timezone} />
                            <Field label="Location" value={conference.social_dinner_location} />
                            <Field label="Maps Link" value={
                                conference.social_dinner_maps_url ? (
                                    <a href={conference.social_dinner_maps_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                                        <Globe className="w-3 h-3" /> View on Map
                                    </a>
                                ) : null
                            } />
                        </Section>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-6">
                    <Section title="Voting & Badge Config" icon={Award} href={`/?edit=${acronym}&tab=badge_voting`}>
                        <div className="mb-4">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Voting Validation</label>
                            <div className="flex items-center gap-2 text-sm text-slate-800 bg-slate-50/50 px-4 py-2.5 rounded-xl border border-slate-100 inline-flex">
                                <div className={`w-2 h-2 rounded-full ${conference.voting_validation_enabled ? 'bg-green-500' : 'bg-slate-300'}`}></div>
                                {conference.voting_validation_enabled ? 'Enabled (All assigned must be voted)' : 'Disabled'}
                            </div>
                        </div>
                        <Field label="Voting Instructions" value={conference.voting_instructions} />
                        
                        {(conference.badge_bg || conference.badge_config) && (() => {
                            let badgeConfig = {};
                            if (conference.badge_config) {
                                try {
                                    badgeConfig = typeof conference.badge_config === 'string' ? JSON.parse(conference.badge_config) : conference.badge_config;
                                } catch (e) {
                                    console.error(e);
                                }
                            }
                            const customBackgrounds = badgeConfig.customBackgrounds || [];

                            return (
                                <div className="mt-6 pt-6 border-t border-slate-100">
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Badge Setup</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                        {conference.badge_bg && (
                                            <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 flex flex-col items-center text-center">
                                                <p className="text-[10px] font-bold text-slate-500 uppercase mb-3">Default Background</p>
                                                <img src={conference.badge_bg} alt="Default Badge BG" className="w-32 object-contain rounded-lg border border-slate-200 shadow-sm mb-3 bg-white" />
                                                <p className="text-xs text-slate-600">All other user types</p>
                                            </div>
                                        )}
                                        {customBackgrounds.map((bg, index) => (
                                            <div key={index} className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 flex flex-col items-center text-center">
                                                <p className="text-[10px] font-bold text-slate-500 uppercase mb-3">Custom Background {index + 1}</p>
                                                {bg.url ? (
                                                    <img src={bg.url} alt={`Custom Badge BG ${index + 1}`} className="w-32 object-contain rounded-lg border border-slate-200 shadow-sm mb-3 bg-white" />
                                                ) : (
                                                    <div className="w-32 h-44 bg-slate-100 rounded-lg border border-slate-200 shadow-sm mb-3 flex items-center justify-center text-slate-400 text-xs">No Image</div>
                                                )}
                                                <div className="flex flex-wrap justify-center gap-1">
                                                    {bg.userTypes && bg.userTypes.length > 0 ? (
                                                        bg.userTypes.map((type, tIdx) => (
                                                            <span key={tIdx} className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                                                                {type}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span className="text-xs text-slate-400 italic">No user types assigned</span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })()}
                    </Section>
                </div>

                {/* Email Templates Preview */}
                <div className="mt-8">
                    <div className="flex items-center gap-3 mb-6">
                        <Mail className="w-6 h-6 text-slate-400" />
                        <h2 className="text-xl font-bold text-slate-800">Email Templates Preview</h2>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-6">
                        {(() => {
                            let parsedSocialDinnerBody = conference.email_social_dinner_tickets_body || '';
                            if (parsedSocialDinnerBody) {
                                const formattedDate = formatSocialDinnerDate(conference.social_dinner_date, '', conference.social_dinner_timezone);
                                const formattedLocation = conference.social_dinner_maps_url 
                                    ? `<a href="${conference.social_dinner_maps_url}" target="_blank" style="color: #0071e3; text-decoration: underline;">${conference.social_dinner_location || 'TBD'}</a>`
                                    : (conference.social_dinner_location || 'TBD');
                                parsedSocialDinnerBody = parsedSocialDinnerBody
                                    .replace(/\${name}/g, 'John Doe')
                                    .replace(/\${social_dinner_date}/g, formattedDate || 'TBD')
                                    .replace(/\${social_dinner_location}/g, formattedLocation)
                                    .replace(/\${conference\.social_dinner_date}/g, formattedDate || 'TBD')
                                    .replace(/\${conference\.social_dinner_location}/g, formattedLocation);
                            }

                            let parsedCheckinBody = conference.email_checkin_body || '';
                            if (parsedCheckinBody) {
                                const venueVal = (conference.registration_venue || '').trim();
                                const startsAtVal = (conference.registration_starts_at || '').trim();
                                const notesVal = (conference.registration_notes || '').trim();
                                const hasNotes = notesVal && notesVal.toLowerCase() !== 'none';
                                
                                const regVenueHtml = conference.registration_maps_url 
                                    ? `<a href="${conference.registration_maps_url}" target="_blank" style="color: #0071e3; text-decoration: underline;">${venueVal || 'TBD'}</a>`
                                    : venueVal;
                                
                                const hasRegistration = venueVal || startsAtVal || hasNotes;
                                
                                if (!hasRegistration) {
                                    parsedCheckinBody = parsedCheckinBody.replace(/<!-- registration_details_start -->[\s\S]*?<!-- registration_details_end -->/gi, '');
                                } else {
                                    const stripPlaceholder = (content, placeholder) => {
                                        const tagRegex = new RegExp('<(p|li|tr|td|span)[^>]*>(?:(?!<\\/\\1>)[\\s\\S])*?\\$\\{' + placeholder + '\\}(?:(?!<\\/\\1>)[\\s\\S])*?<\\/\\1>', 'gi');
                                        let newContent = content.replace(tagRegex, '');
                                        const lineRegex = new RegExp('^[^\\n]*\\$\\{' + placeholder + '\\}[^\\n]*\\n?', 'gim');
                                        newContent = newContent.replace(lineRegex, '');
                                        return newContent;
                                    };

                                    if (!venueVal) {
                                        parsedCheckinBody = stripPlaceholder(parsedCheckinBody, 'registration_venue');
                                    } else {
                                        parsedCheckinBody = parsedCheckinBody.replace(/\${registration_venue}/g, regVenueHtml);
                                    }
                                    if (!startsAtVal) {
                                        parsedCheckinBody = stripPlaceholder(parsedCheckinBody, 'registration_starts_at');
                                    } else {
                                        parsedCheckinBody = parsedCheckinBody.replace(/\${registration_starts_at}/g, formatRegistrationDate(conference.registration_starts_at) || '');
                                    }
                                    if (!hasNotes) {
                                        parsedCheckinBody = stripPlaceholder(parsedCheckinBody, 'registration_notes');
                                    } else {
                                        parsedCheckinBody = parsedCheckinBody.replace(/\${registration_notes}/g, notesVal);
                                    }
                                }
                                
                                parsedCheckinBody = parsedCheckinBody
                                    .replace(/\${name}/g, 'John Doe')
                                    .replace(/\${conference}/g, conference?.name || 'Conference');
                            }

                            return (
                                <>
                                    {conference.email_social_dinner_tickets_body && (
                                        <Section title="Social Dinner Tickets" icon={AlignLeft} className="mb-0" href={`/?edit=${acronym}&tab=emails`}>
                                            <Field label="Template Body" value={parsedSocialDinnerBody} isHtml={true} />
                                        </Section>
                                    )}
                                    {conference.email_checkin_body && (
                                        <Section title="Registration Check-in" icon={AlignLeft} className="mb-0" href={`/?edit=${acronym}&tab=emails`}>
                                            <Field label="Template Body" value={parsedCheckinBody} isHtml={true} />
                                        </Section>
                                    )}
                                </>
                            );
                        })()}
                    </div>
                </div>

                <div className="py-8 text-center text-slate-400 text-xs">
                    End of Report
                </div>

            </div>
        </DashboardLayout>
    );
}
