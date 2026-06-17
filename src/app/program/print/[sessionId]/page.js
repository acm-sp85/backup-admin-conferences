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

export default async function ProgramPrintPage({ params }) {
    const { sessionId } = await params;

    // Fetch session data
    const [session] = await query(`
        SELECT s.*, c.name as conference_name, c.id as conference_id
        FROM program_sessions s
        JOIN conferences c ON s.conference_id = c.id
        WHERE s.id = ?
    `, [sessionId]);

    if (!session) return <div>Session not found</div>;

    // Fetch slots
    const slots = await query(`
        SELECT * FROM program_slots 
        WHERE session_id = ? 
        ORDER BY start_time ASC
    `, [sessionId]);

    // Fetch conference config
    const { config, bgUrl } = await getConferenceConfig(session.conference_id);
    console.log(session)

    return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center py-10 no-print-bg">
            <div 
                id="print-container"
                className={`bg-white text-black shadow-2xl overflow-hidden print:shadow-none print:m-0 ${leagueSpartan.className}`}
                style={{ 
                    width: '210mm',
                    height: '297mm',
                    backgroundImage: bgUrl ? `url(${bgUrl})` : 'none',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    padding: config.padding || '30px 15px 120px 15px', 
                    position: 'relative',
                    boxSizing: 'border-box'
                }}
            >
                <div id="print-content" className="flex flex-col h-full mt-6">
                    {/* Header Section */}
                    <div className="mb-12">
                        <div 
                            className="font-medium uppercase tracking-widest mb-1 mt-6 opacity-70 text-center"
                            style={{ fontSize: '16px', color: config.titleColor }}
                        >
                           {new Date(session.start_time).toLocaleDateString(Number(session.conference_id) === 11 ? 'es-ES' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
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
                            <div className=" text-white px-4 py-2 font-medium text-xl"
                            style={{ backgroundColor: config.titleColor }}>
                                {new Date(session.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })} - {new Date(session.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                            </div>
                            {/* <div className="text-2xl font-bold opacity-80 italic">
                                {session.session_name}
                            </div> */}
                        </div>
                    </div>

                    {/* Slots Section */}
                    <div className="flex-1">
                        <table className="w-full border-collapse">
                            <tbody>
                                {slots.map((slot, idx) => (
                                    <tr key={idx} className={Number(session.conference_id) === 11 ? (slot.title?.includes('\u2022') && idx > 0 ? "border-t border-black/20" : "") : "border-b border-black/10 last:border-0"}>
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
                                                            {(slot.presenter_entity || slot.presenter_country) && (
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

            {/* Print Utility: Forces a print dialog and handles scaling */}
            <script dangerouslySetInnerHTML={{ __html: `
                window.onload = () => {
                    const container = document.getElementById('print-container');
                    const content = document.getElementById('print-content');
                    
                    const tryScale = () => {
                        const style = window.getComputedStyle(container);
                        const paddingY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
                        const paddingX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
                        const availableHeight = container.offsetHeight - paddingY;
                        const availableWidth = container.offsetWidth - paddingX;
                        
                        // Reset scale to measure real content size
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
                            
                            // To maintain centering and correct width visually:
                            // We keep logical width at 100%, and the 'top center' origin 
                            // will handle the horizontal centering automatically.
                        }
                    };

                    tryScale();
                    setTimeout(() => {
                        tryScale(); 
                        window.print();
                    }, 800);
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
                    #print-container {
                        box-shadow: none !important;
                        margin: 0 !important;
                        width: 210mm !important;
                        height: 297mm !important;
                    }
                }
                .no-print-bg {
                    transition: background 0.3s;
                }
            `}} />
        </div>
    );
}
