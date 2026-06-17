import { query } from '@/lib/db';
import { getConferenceConfig } from '@/app/actions/program';
import { League_Spartan } from 'next/font/google';

const leagueSpartan = League_Spartan({ 
    subsets: ['latin'],
    display: 'swap',
});

const formatName = (name) => {
    if (!name) return '';
    return name
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join('-');
};

export default async function ProgramPrintAllPage({ searchParams }) {
    const { conferenceId } = await searchParams;

    if (!conferenceId) return <div>Conference ID required</div>;

    // Fetch conference data
    const [conference] = await query('SELECT name, acronym FROM conferences WHERE id = ?', [conferenceId]);
    if (!conference) return <div>Conference not found</div>;

    // Fetch all sessions for this conference
    const sessions = await query(`
        SELECT * FROM program_sessions 
        WHERE conference_id = ? AND (is_hidden = 0 OR is_hidden IS NULL)
        ORDER BY start_time ASC, session_name ASC
    `, [conferenceId]);

    // Fetch all slots for all sessions at once
    const allSlots = await query(`
        SELECT * FROM program_slots 
        WHERE session_id IN (SELECT id FROM program_sessions WHERE conference_id = ?)
        ORDER BY start_time ASC
    `, [conferenceId]);

    // Fetch conference config
    const { config, bgUrl } = await getConferenceConfig(conferenceId);

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col items-center py-10 no-print-bg">
            {sessions.map((session, sIdx) => {
                const sessionSlots = allSlots.filter(slot => slot.session_id === session.id);
                
                return (
                    <div 
                        key={session.id}
                        className={`bg-white text-black shadow-2xl overflow-hidden print:shadow-none print:m-0 mb-10 print:mb-0 session-page ${leagueSpartan.className}`}
                        style={{ 
                            width: '210mm',
                            height: '297mm',
                            backgroundImage: bgUrl ? `url(${bgUrl})` : 'none',
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            padding: config.padding || '30px 15px 120px 15px', 
                            position: 'relative',
                            boxSizing: 'border-box',
                            breakAfter: 'page'
                        }}
                    >
                        <div className="print-content flex flex-col h-full mt-6">
                            {/* Header Section */}
                            <div className="mb-12">
                 <div 
                            className="font-medium uppercase tracking-widest mb-1 mt-6 text-center"
                            style={{ fontSize: '16px', color: config.titleColor }}
                        >
                           {new Date(session.start_time).toLocaleDateString(Number(conferenceId) === 11 ? 'es-ES' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </div>
                                
                                <h1 
                                    className="font-bold leading-tight mb-2"
                                    style={{ fontSize: config.titleSize || '48px' }}
                                >
                                    {session.full_session_name.replace(/\(Chair:.*?\)/, '').trim()}
                                </h1>

                                {session.full_session_name.includes('(Chair:') && (
                                    <div 
                                        className="font-medium opacity-80 mb-2 italic"
                                        style={{ fontSize: config.chairSize || '20px', color: config.titleColor }}
                                    >
                                        Chair: {formatName(session.full_session_name.match(/\(Chair:\s*(.*?)\)/)?.[1])}
                                    </div>
                                )}

                                <div className="flex gap-4 items-center">
                                    <div className=" text-white px-4 py-1 font-medium text-xl"
                                    style={{ backgroundColor: config.titleColor }}>
                                        {new Date(session.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })} - {new Date(session.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                                    </div>
                                </div>
                            </div>

                            {/* Slots Section */}
                            <div className="flex-1">
                                <table className="w-full border-collapse">
                                    <tbody>
                                        {sessionSlots.map((slot, idx) => (
                                            <tr key={idx} className={Number(conferenceId) === 11 ? (slot.title?.includes('\u2022') && idx > 0 ? "border-t border-black/20" : "") : "border-b border-black/10 last:border-0"}>
                                                <td 
                                                    className="py-1 pr-8 font-medium align-top whitespace-nowrap"
                                                    style={{ fontSize: config.contentSize, color: config.contentColor }}
                                                >
                                                    {slot.title?.includes('\u00A0\u00A0') ? '' : new Date(slot.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                                                </td>
                                                <td className="py-1 align-top">
                                                    <div className={slot.title?.includes('\u21B3') ? 'flex gap-2' : ''}>
                                                        {slot.title?.includes('\u21B3') && (
                                                            <div className="shrink-0 flex-none whitespace-pre opacity-80 pt-[1px]">
                                                                {'\u00A0\u00A0\u00A0\u00A0\u21B3'}
                                                            </div>
                                                        )}
                                                        <div className={slot.title?.includes('\u21B3') ? 'flex-1' : ''}>
                                                            <div 
                                                                className="font-semibold mb-1"
                                                                style={{ fontSize: config.contentSize, color: config.contentColor }}
                                                            >
                                                                {slot.title?.includes('\u21B3') 
                                                                    ? slot.title.replace('\u00A0\u00A0\u00A0\u00A0\u21B3 ', '') 
                                                                    : slot.title || '(No Title)'}
                                                            </div>
                                                            {slot.presenter_name && (
                                                                <div 
                                                                    className="font-normal opacity-85"
                                                                    style={{ fontSize: `calc(${config.contentSize} * 0.8)`, color: config.contentColor }}
                                                                >
                                                                    <span style={{ color: config.titleColor, fontWeight: 'bold' }}>
                                                                        {(() => {
                                                                            let displayName = slot.presenter_name;
                                                                            if (displayName.includes(',')) {
                                                                                const parts = displayName.split(',');
                                                                                displayName = `${parts[1].trim()} ${parts[0].trim()}`;
                                                                            }
                                                                            return formatName(displayName);
                                                                        })()}
                                                                    </span>
                                                                    {((slot.presenter_entity || slot.presenter_country)) && (
                                                                        <span style={{ opacity: 0.8 }}>
                                                                            {` - ${[slot.presenter_entity, slot.presenter_country].filter(Boolean).join(', ')}`}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )}
                                                            <div className="text-[10px] font-bold uppercase tracking-widest mt-2"
                                                            style={{ color: config.contentColor, opacity: 0.6 }}>
                                                                {slot.type}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                );
            })}

            {/* Print Utility: Forces a print dialog and handles scaling for all pages */}
            <script dangerouslySetInnerHTML={{ __html: `
                window.onload = () => {
                    const pages = document.querySelectorAll('.session-page');
                    
                    const tryScaleAll = () => {
                        pages.forEach(container => {
                            const content = container.querySelector('.print-content');
                            const style = window.getComputedStyle(container);
                            const paddingY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
                            const paddingX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
                            const availableHeight = container.offsetHeight - paddingY;
                            const availableWidth = container.offsetWidth - paddingX;
                            
                            content.style.transform = 'none';
                            content.style.width = '100%';
                            
                            const contentHeight = content.scrollHeight;
                            const contentWidth = content.scrollWidth;
                            
                            if (contentHeight > availableHeight || contentWidth > availableWidth) {
                                const scaleH = availableHeight / contentHeight;
                                const scaleW = availableWidth / contentWidth;
                                const scale = Math.min(scaleH, scaleW) - 0.01;
                                
                                content.style.transform = 'scale(' + scale + ')';
                                content.style.transformOrigin = 'top center';
                            }
                        });
                    };

                    tryScaleAll();
                    setTimeout(() => {
                        tryScaleAll(); 
                        window.print();
                    }, 1200);
                }
            ` }} />

            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 0;
                    }
                    body {
                        margin: 0;
                        padding: 0;
                        background: white !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .no-print-bg {
                        background: transparent !important;
                        padding: 0 !important;
                        min-height: 0 !important;
                        display: block !important;
                    }
                    .session-page {
                        box-shadow: none !important;
                        margin: 0 !important;
                        width: 210mm !important;
                        height: 297mm !important;
                        page-break-after: always !important;
                        break-after: page !important;
                    }
                }
                .no-print-bg {
                    transition: background 0.3s;
                }
            `}} />
        </div>
    );
}
