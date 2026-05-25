import { query } from '@/lib/db';
import { getConferenceConfig } from '@/app/actions/program';

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

export default async function DownloadDocPage({ params }) {
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

    const { config } = await getConferenceConfig(session.conference_id);

    // Prepare HTML content for Word
    const htmlContent = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
        <meta charset="utf-8">
        <title>${session.full_session_name}</title>
        <style>
            body { font-family: 'Arial', sans-serif; }
            .header { margin-bottom: 30pt; }
            .conf-name { font-size: 12pt; color: #666; text-transform: uppercase; margin-bottom: 5pt; }
            .session-title { font-size: 28pt; font-weight: bold; margin-bottom: 10pt; color: ${config.titleColor || '#000000'}; }
            .time-box { background-color: ${config.titleColor || '#333'}; color: #ffffff; padding: 10pt; font-size: 14pt; font-weight: bold; display: inline-block; }
            table { width: 100%; border-collapse: collapse; margin-top: 20pt; }
            td { padding: 15pt 10pt; border-bottom: 1pt solid #eeeeee; vertical-align: top; }
            .slot-time { font-weight: bold; width: 80pt; font-size: 12pt; }
            .slot-title { font-weight: bold; font-size: 12pt; margin-bottom: 3pt; }
            .slot-presenter { font-style: italic; color: #555; font-size: 10pt; }
            .presenter-name { color: ${config.titleColor || '#000000'}; font-weight: bold; }
            .presenter-institution { color: #555; font-weight: normal; }
            .slot-type { font-size: 8pt; text-transform: uppercase; color: #666; margin-top: 5pt; font-weight: bold; }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="conf-name">${session.conference_name} - ${new Date(session.start_time).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
            <div class="session-title">${session.full_session_name.replace(/\(Chair:.*?\)/, '').trim()}</div>
            ${session.full_session_name.includes('(Chair:') ? `
                <div style="font-size: 16pt; font-style: italic; color: #555; margin-bottom: 15pt;">
                    Chair: ${formatName(session.full_session_name.match(/\(Chair:\s*(.*?)\)/)?.[1])}
                </div>
            ` : ''}
            <div class="time-box">
                ${new Date(session.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })} - ${new Date(session.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
            </div>
        </div>
 
        <table>
            ${slots.map(slot => `
                <tr>
                    <td class="slot-time">${new Date(slot.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</td>
                    <td>
                        <div class="slot-title">${slot.title || '(No Title)'}</div>
                        ${(() => {
                            if (!slot.presenter_name) return '';
                            let displayName = slot.presenter_name;
                            if (displayName.includes(',')) {
                                const parts = displayName.split(',');
                                displayName = `${parts[1].trim()} ${parts[0].trim()}`;
                            }
                            const formatted = formatName(displayName);
                            const nameSpan = `<span class="presenter-name">${formatted}</span>`;
                            const instSpan = slot.presenter_entity ? `<span class="presenter-institution"> - ${slot.presenter_entity}</span>` : '';
                            return `<div class="slot-presenter">${nameSpan}${instSpan}</div>`;
                        })()}
                        <div class="slot-type">${slot.type}</div>
                    </td>
                </tr>
            `).join('')}
        </table>
    </body>
    </html>
    `;

    return (
        <>
            <div className="p-20 text-center font-sans">
                <h2 className="text-xl font-bold mb-4">Generating Word Document...</h2>
                <p className="text-slate-500">Your download should start automatically.</p>
                <a 
                    id="download-link"
                    href={`data:application/msword;charset=utf-8,${encodeURIComponent(htmlContent)}`}
                    download={`${session.session_name}_DoorSign.doc`}
                    className="hidden"
                >Download</a>
            </div>
            <script dangerouslySetInnerHTML={{ __html: `
                setTimeout(() => {
                    document.getElementById('download-link').click();
                    setTimeout(() => window.close(), 1000);
                }, 500);
            `}} />
        </>
    );
}
