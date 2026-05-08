import { query } from '@/lib/db';
import { getConferenceConfig } from '@/app/actions/program';

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
                        className="bg-white text-black shadow-2xl overflow-hidden print:shadow-none print:m-0 mb-10 print:mb-0 session-page"
                        style={{ 
                            width: '210mm',
                            height: '297mm',
                            backgroundImage: bgUrl ? `url(${bgUrl})` : 'none',
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            padding: config.padding || '60px',
                            position: 'relative',
                            boxSizing: 'border-box',
                            breakAfter: 'page'
                        }}
                    >
                        <div className="print-content flex flex-col h-full">
                            {/* Header Section */}
                            <div className="mb-12">
                                <div 
                                    className="font-bold uppercase tracking-widest mb-4 opacity-70"
                                    style={{ fontSize: '16px', color: config.titleColor }}
                                >
                                    {conference.name} • {new Date(session.start_time).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                                </div>
                                
                                <h1 
                                    className="font-black leading-tight mb-2"
                                    style={{ fontSize: config.titleSize || '48px' }}
                                >
                                    {session.full_session_name.replace(/\(Chair:.*?\)/, '').trim()}
                                </h1>

                                {session.full_session_name.includes('(Chair:') && (
                                    <div 
                                        className="font-bold opacity-80 mb-6 italic"
                                        style={{ fontSize: config.chairSize || '24px', color: config.titleColor }}
                                    >
                                        Chair: {session.full_session_name.match(/\(Chair:\s*(.*?)\)/)?.[1]}
                                    </div>
                                )}

                                <div className="flex gap-4 items-center">
                                    <div className=" text-white px-4 py-2 font-bold text-xl"
                                    style={{ backgroundColor: config.titleColor }}>
                                        {new Date(session.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(session.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                            </div>

                            {/* Slots Section */}
                            <div className="flex-1">
                                <table className="w-full border-collapse">
                                    <tbody>
                                        {sessionSlots.map((slot, idx) => (
                                            <tr key={idx} className="border-b border-black/10 last:border-0">
                                                <td 
                                                    className="py-6 pr-8 font-bold align-top whitespace-nowrap"
                                                    style={{ fontSize: config.contentSize, color: config.contentColor }}
                                                >
                                                    {new Date(slot.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </td>
                                                <td className="py-6 align-top">
                                                    <div 
                                                        className="font-bold mb-1"
                                                        style={{ fontSize: config.contentSize, color: config.contentColor }}
                                                    >
                                                        {slot.title || '(No Title)'}
                                                    </div>
                                                    {slot.presenter_name && (
                                                        <div 
                                                            className="font-medium opacity-80"
                                                            style={{ fontSize: `calc(${config.contentSize} * 0.8)` }}
                                                        >
                                                            {slot.presenter_name}
                                                        </div>
                                                    )}
                                                    <div className="text-[10px] font-black uppercase tracking-widest mt-2"
                                                    style={{ color: config.titleColor }}>
                                                        {slot.type}
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
                            const paddingX = (parseFloat(container.style.paddingLeft) || 60);
                            const paddingY = (parseFloat(container.style.paddingTop) || 60);
                            const availableHeight = container.offsetHeight - (paddingY * 2);
                            const availableWidth = container.offsetWidth - (paddingX * 2);
                            
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
