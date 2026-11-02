import { hasAdminAccess } from '@/lib/roles';
    import { query } from '@/lib/db';
import { verifySession } from '@/lib/auth';
import PrintableCertificate from '@/components/PrintableCertificate';
import { emailTemplates } from '@/lib/email-templates';
import { getPresentationsForParticipant } from '@/lib/presentation-matcher';
export default async function CertificatePrintPage({ searchParams }) {
    const params = await searchParams;
    const registrationIds = params.registrationIds;
    const conferenceId = params.conferenceId;
    
    if (!registrationIds || !conferenceId) return <div className="p-10 text-center">Missing parameters (registrationIds, conferenceId)</div>;
    
    const ids = registrationIds.split(',');
    
    const session = await verifySession();
    if (!session || (!hasAdminAccess(session.role))) {
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

    let conferenceDates = '';
    if (conference.start_date && conference.end_date) {
        const start = new Date(conference.start_date);
        const end = new Date(conference.end_date);
        
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

    const isSpanish = conference.name && conference.name.toUpperCase().includes('CIPIE');

    // Generate custom HTML if defined for this conference
    const hasCustomBody = !!conference.email_certificate_body;

    return (
        <div className="print-container">
            {participants.map(p => {
                const presentations = getPresentationsForParticipant(p, slots, posters);
                
                let customHtml = null;
                if (hasCustomBody) {
                    const templateData = {
                        name: p.name,
                        conference: conference,
                        registrationType: p.payment_group || p.registration_type || '',
                        institution: p.entity || p.payment_group || '',
                        entityAddress: p.entity_address || '',
                        entityZip: p.entity_zip || '',
                        entityCity: p.entity_city || '',
                        entityCountry: p.entity_country || '',
                        checkinDate: p.scanned_at || '',
                        sponsorList: conference.sponsor_list,
                        conferenceAddress: conference.conference_address,
                        signatureImage: conference.signature_image,
                        textUnderSignature: conference.text_under_signature,
                        conferenceFullName: conference.conference_full_name,
                        conferenceDates: conferenceDates,
                        presentations: presentations
                    };
                    const emailObj = emailTemplates.certificate(templateData);
                    customHtml = emailObj.html;
                }

                return (
                    <PrintableCertificate 
                        key={p.registrationId}
                        participant={p}
                        conference={conference}
                        conferenceDates={conferenceDates}
                        presentations={presentations}
                        customHtml={customHtml}
                        isSpanish={isSpanish}
                        today={today}
                    />
                );
            })}
            
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
