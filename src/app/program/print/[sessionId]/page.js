import { query } from '@/lib/db';
import { getConferenceConfig } from '@/app/actions/program';

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

    return (
        <div 
            className="min-h-screen bg-white text-black print:m-0"
            style={{ 
                backgroundImage: bgUrl ? `url(${bgUrl})` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                padding: config.padding || '60px'
            }}
        >
            <div className="max-w-4xl mx-auto flex flex-col h-full">
                {/* Header Section */}
                <div className="mb-12">
                    <div 
                        className="font-bold uppercase tracking-widest mb-4 opacity-70"
                        style={{ fontSize: '16px', color: config.titleColor }}
                    >
                        {session.conference_name} • {new Date(session.start_time).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </div>
                    
                    <h1 
                        className="font-black leading-tight mb-4"
                        style={{ fontSize: config.titleSize || '48px', color: config.titleColor }}
                    >
                        {session.full_session_name}
                    </h1>

                    <div className="flex gap-4 items-center">
                        <div className="bg-black text-white px-4 py-2 font-bold text-xl">
                            {new Date(session.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(session.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="text-2xl font-bold opacity-80 italic">
                            {session.session_name}
                        </div>
                    </div>
                </div>

                {/* Slots Section */}
                <div className="flex-1">
                    <table className="w-full border-collapse">
                        <tbody>
                            {slots.map((slot, idx) => (
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
                                        <div className="text-[10px] font-black uppercase tracking-widest opacity-40 mt-2">
                                            {slot.type}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Print Utility: Forces a print dialog when the page loads */}
                <script dangerouslySetInnerHTML={{ __html: `window.onload = () => { setTimeout(() => window.print(), 500); }` }} />
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 0;
                    }
                    body {
                        -webkit-print-color-adjust: exact;
                    }
                    .no-print {
                        display: none;
                    }
                }
            `}} />
        </div>
    );
}
