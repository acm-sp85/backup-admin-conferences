    import { query } from '@/lib/db';
import { verifySession } from '@/lib/auth';

export default async function CertificatePrintPage({ searchParams }) {
    const params = await searchParams;
    const registrationIds = params.registrationIds;
    const conferenceId = params.conferenceId;
    
    if (!registrationIds || !conferenceId) return <div className="p-10 text-center">Missing parameters (registrationIds, conferenceId)</div>;
    
    const ids = registrationIds.split(',');
    
    const session = await verifySession();
    if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
        return <div className="p-10 text-center">Unauthorized</div>;
    }

    // Fetch conference data
    const [conference] = await query(`SELECT * FROM conferences WHERE id = ?`, [conferenceId]);
    if (!conference) return <div className="p-10 text-center">Conference not found</div>;

    // Fetch participants
    const placeholders = ids.map(() => '?').join(',');
    const participants = await query(`
        SELECT 
            p.*, 
            CONCAT(p.firstName, ' ', p.lastName) as name,
            r.id as registrationId,
            pay.group_name as payment_group
        FROM participants p
        JOIN registrations r ON p.id = r.participant_id
        LEFT JOIN (
            SELECT registration_id, group_name 
            FROM payments 
            WHERE group_name IS NOT NULL AND group_name != ''
            ORDER BY created_at DESC 
            LIMIT 1
        ) pay ON r.id = pay.registration_id
        WHERE r.id IN (${placeholders})
    `, ids);

    // Fetch dates
    const [datesRow] = await query(`
        SELECT MIN(start_time) as start_date, MAX(end_time) as end_date 
        FROM program_sessions 
        WHERE conference_id = ?
    `, [conferenceId]);

    let conferenceDates = '';
    if (datesRow && datesRow.start_date && datesRow.end_date) {
        const start = new Date(datesRow.start_date);
        const end = new Date(datesRow.end_date);
        
        const startDay = start.getDate();
        const startMonth = start.toLocaleDateString('en-GB', { month: 'long' });
        const startYear = start.getFullYear();
        
        const endDay = end.getDate();
        const endMonth = end.toLocaleDateString('en-GB', { month: 'long' });
        const endYear = end.getFullYear();
        
        if (startYear !== endYear) {
            conferenceDates = `${startDay} ${startMonth} ${startYear} to ${endDay} ${endMonth} ${endYear}`;
        } else if (startMonth !== endMonth) {
            conferenceDates = `${startDay} ${startMonth} to ${endDay} ${endMonth} ${startYear}`;
        } else if (startDay !== endDay) {
            conferenceDates = `${startDay} to ${endDay} ${startMonth} ${startYear}`;
        } else {
            conferenceDates = `${startDay} ${startMonth} ${startYear}`;
        }
    }

    const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    // Fetch Posters
    const posters = await query('SELECT id, title, authors FROM posters WHERE conference_id = ?', [conferenceId]);
    
    // Fetch Program Slots
    const slots = await query('SELECT id, type, title, presenter_name FROM program_slots WHERE session_id IN (SELECT id FROM program_sessions WHERE conference_id = ?)', [conferenceId]);

    // Parse sponsors
    let sponsorsHtml = '';
    if (conference.sponsor_list) {
        try {
            const sponsors = typeof conference.sponsor_list === 'string' ? JSON.parse(conference.sponsor_list) : conference.sponsor_list;
            if (Array.isArray(sponsors) && sponsors.length > 0) {
                const logosList = sponsors
                    .map(s => {
                        if (s.logoUrl) {
                            return `<img src="${s.logoUrl}" alt="${s.name}" width="70" height="25" style="max-height: 25px; max-width: 70px; object-fit: contain; margin: 6px 10px; display: inline-block; vertical-align: middle;" />`;
                        }
                        return `<span style="font-size: 8px; font-weight: bold; color: #64748b; margin: 6px 10px; display: inline-block; vertical-align: middle;">${s.name}</span>`;
                    })
                    .join('');
                
                sponsorsHtml = `
                    <div style="margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 14px; text-align: center;">
                        <p style="font-size: 7px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 6px 0;">Supported By</p>
                        <div style="text-align: center; line-height: 25px;">
                            ${logosList}
                        </div>
                    </div>
                `;
            }
        } catch (e) {
            console.error("Error parsing sponsor list for template:", e);
        }
    }

    const compareNames = (presenter, firstName, lastName) => {
        if (!presenter || !firstName || !lastName) return false;
        
        const presenterClean = presenter.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const firstClean = firstName.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const lastClean = lastName.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
        // Case 1: Presenter contains a comma (usually "LastName, FirstName")
        if (presenterClean.includes(',')) {
            const parts = presenterClean.split(',');
            const presLast = parts[0].trim();
            const presFirst = parts[1] ? parts[1].trim() : '';
            
            // Check if last names are equal, and first name matches or is a prefix/suffix
            if (presLast === lastClean && (presFirst.includes(firstClean) || firstClean.includes(presFirst))) {
                return true;
            }
            // Sometimes lastName in the DB contains multiple surnames but only one matches:
            if (lastClean.includes(presLast) && presLast.length > 2 && (presFirst.includes(firstClean) || firstClean.includes(presFirst))) {
                return true;
            }
        }
        
        // Case 2: No comma, check direct combinations
        const option1 = `${firstClean} ${lastClean}`;
        const option2 = `${lastClean} ${firstClean}`;
        if (presenterClean === option1 || presenterClean === option2) {
            return true;
        }
        
        // Case 3: Fuzzy check - both first and last name appear somewhere in the presenter string
        if (presenterClean.includes(firstClean) && presenterClean.includes(lastClean)) {
            return true;
        }
        
        return false;
    };

    const getPresentationsForParticipant = (participant) => {
        const presentations = [];
        const fName = participant.firstName || '';
        const lName = participant.lastName || '';
        
        // Check slots
        for (const slot of slots) {
            if (slot.presenter_name && compareNames(slot.presenter_name, fName, lName)) {
                presentations.push({
                    title: slot.title,
                    type: slot.type ? (slot.type.charAt(0).toUpperCase() + slot.type.slice(1)) : 'Oral'
                });
            }
        }
        
        // Check posters (only primary author)
        for (const poster of posters) {
            let authors = [];
            try {
                authors = typeof poster.authors === 'string' ? JSON.parse(poster.authors) : poster.authors;
            } catch (e) {}
            
            if (Array.isArray(authors) && authors.length > 0) {
                const primaryAuthor = authors[0];
                let aName = '';
                if (typeof primaryAuthor === 'string') {
                    aName = primaryAuthor;
                } else if (primaryAuthor.name) {
                    aName = primaryAuthor.name;
                }
                
                if (aName && compareNames(aName, fName, lName)) {
                    presentations.push({
                        title: poster.title,
                        type: 'Poster'
                    });
                }
            }
        }
        
        return presentations;
    };

    return (
        <div className="print-container">
            <style dangerouslySetInnerHTML={{ __html: `
                @import url('https://fonts.googleapis.com/css2?family=Georgia&display=swap');
                
                @page {
                    size: A4;
                    margin: 0;
                }
                
                html, body {
                    margin: 0;
                    padding: 0;
                    background: #e2e8f0;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }

                .certificate-page {
                    width: 210mm;
                    height: 297mm;
                    background-color: white;
                    position: relative;
                    box-sizing: border-box;
                    padding: 12mm;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    page-break-after: always;
                    font-family: 'Georgia', 'Times New Roman', serif;
                    margin: 0 auto;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                    margin-bottom: 20px;
                }

                @media print {
                    body { background: white; }
                    .certificate-page {
                        box-shadow: none;
                        margin-bottom: 0;
                    }
                }

                .certificate-border {
                    border: 2px solid ${conference.accent_color || '#007aff'};
                    padding: 24px;
                    height: 100%;
                    box-sizing: border-box;
                    border-radius: 4px;
                    display: flex;
                    flex-direction: column;
                }
            `}} />
            
            {participants.map(p => {
                const presentations = getPresentationsForParticipant(p);
                const institution = p.entity || p.payment_group || '';
                const regType = p.payment_group || p.registration_type || '';
                const locParts = [[p.entity_zip, p.entity_city].filter(Boolean).join(' '), p.entity_country].filter(Boolean).join(', ');

                return (
                <div key={p.registrationId} className="certificate-page">
                    <div className="certificate-border">
                        {conference.banner_url && (
                            <div style={{ margin: '-24px -24px 20px -24px' }}>
                                <img src={conference.banner_url} alt="Banner" style={{ width: '100%', height: 'auto', display: 'block', borderRadius: '2px 2px 0 0' }} />
                            </div>
                        )}
                        
                        <div style={{ flex: 1 }}>
                            <h1 style={{ textAlign: 'center', color: conference.accent_color || '#007aff', fontSize: '26px', fontWeight: '700', margin: '0 0 8px 0', letterSpacing: '1px' }}>CERTIFICATE OF PARTICIPATION</h1>
                            <div style={{ textAlign: 'center', borderBottom: `2px solid ${conference.accent_color || '#007aff'}`, paddingBottom: '16px', marginBottom: '24px' }}>
                                <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>{today}</p>
                            </div>

                            <table style={{ width: '100%', marginBottom: '24px' }} cellPadding="0" cellSpacing="0">
                                <tbody>
                                    <tr>
                                        <td style={{ width: '50%', verticalAlign: 'top', paddingRight: '20px' }}>
                                            <p style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b', margin: '0 0 4px 0' }}>{p.name}</p>
                                            {institution && <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 2px 0' }}>{institution}</p>}
                                            {p.entity_address && <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 2px 0' }}>{p.entity_address}</p>}
                                            {locParts && <p style={{ fontSize: '12px', color: '#64748b', margin: '0' }}>{locParts}</p>}
                                        </td>
                                        <td style={{ width: '50%', verticalAlign: 'top', paddingLeft: '20px', borderLeft: '1px solid #e2e8f0' }}>
                                            <p style={{ fontSize: '11px', fontWeight: '700', color: conference.accent_color || '#007aff', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 6px 0' }}>This certifies participation at:</p>
                                            <p style={{ fontSize: '12px', fontWeight: '700', color: '#1e293b', margin: '0 0 4px 0' }}>{conference.name}{conference.conference_full_name ? ` - ${conference.conference_full_name}` : ''}</p>
                                            {conference.conference_address && <p style={{ fontSize: '12px', color: '#64748b', margin: '0', lineHeight: '1.4' }} dangerouslySetInnerHTML={{__html: conference.conference_address.replace(/\n/g, '<br>')}}></p>}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>

                            <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '20px', marginBottom: '24px', border: '1px solid #e2e8f0' }}>
                                <p style={{ fontSize: '14px', color: '#334155', lineHeight: '1.7', margin: '0' }}>
                                    This letter certifies that <strong>{p.name}</strong>
                                    {regType ? <span> participated as <strong>{regType}</strong></span> : ' participated'}
                                    at the <strong>{conference.conference_full_name ? `${conference.conference_full_name} - ${conference.name}` : conference.name}</strong>
                                    {conference.conference_address ? <span>, celebrated at <strong>{conference.conference_address.replace(/\n/g, ', ')}</strong></span> : ''}
                                    {conferenceDates ? <span> from <strong>{conferenceDates}</strong></span> : ''}.
                                </p>
                                
                                {presentations.length > 0 && (
                                    <div style={{ marginTop: '12px', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
                                        <p style={{ margin: '0 0 6px 0', fontSize: '14px', color: '#334155', lineHeight: '1.7' }}>
                                            <strong>{p.name}</strong> has presented:
                                        </p>
                                        <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#334155', lineHeight: '1.6' }}>
                                            {presentations.map((pres, idx) => (
                                                <li key={idx}>
                                                    {pres.type} contribution entitled <strong>"{pres.title}"</strong>.
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>

                        </div>

                        <div style={{ marginTop: 'auto', marginBottom: '12px' }}>
                            <p style={{ fontSize: '13px', color: '#475569', margin: 0 }}>Sincerely,</p>
                            {conference.signature_image && <img src={conference.signature_image} style={{ maxHeight: '65px', display: 'block', margin: '8px 0' }} alt="Signature" />}
                            {conference.text_under_signature 
                                ? <p style={{ fontSize: '13px', color: '#1e293b', fontWeight: '600', margin: '5px 0 0 0', lineHeight: '1.4' }} dangerouslySetInnerHTML={{__html: conference.text_under_signature.replace(/\n/g, '<br>')}}></p>
                                : <p style={{ fontSize: '13px', color: '#1e293b', fontWeight: '600', margin: '8px 0 0 0' }}>{conference.name} Organizing Committee</p>
                            }
                        </div>
                        
                        {sponsorsHtml && <div dangerouslySetInnerHTML={{__html: sponsorsHtml}}></div>}
                    </div>
                </div>
            )})}
            
            <script dangerouslySetInnerHTML={{ __html: `
                window.onload = () => {
                    setTimeout(() => {
                        window.print();
                    }, 1000);
                }
            `}} />
        </div>
    );
}
