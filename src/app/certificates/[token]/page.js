import { query } from '@/lib/db';
import { decrypt } from '@/lib/auth';
import { emailTemplates } from '@/lib/email-templates';
import { Award, AlertCircle } from 'lucide-react';
import PrintButton from './PrintButton';

export default async function PublicCertificateViewPage({ params }) {
    const { token } = await params;

    let payload;
    try {
        payload = await decrypt(token);
    } catch (e) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="w-8 h-8 text-red-600" />
                    </div>
                    <h1 className="text-xl font-bold text-slate-900 mb-2">Invalid or Expired Link</h1>
                    <p className="text-slate-500 text-sm">
                        This certificate link is invalid or has expired. Please request a new one.
                    </p>
                    <a href="/certificates" className="mt-6 inline-block bg-slate-900 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-black transition-colors">
                        Request New Link
                    </a>
                </div>
            </div>
        );
    }

    const { conferenceId, registrationId } = payload;

    // Fetch conference data
    const [conference] = await query(`SELECT * FROM conferences WHERE id = ?`, [conferenceId]);
    if (!conference) {
        return <div className="p-10 text-center">Conference not found</div>;
    }

    // Fetch participant
    const [participant] = await query(`
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
        WHERE r.id = ?
    `, [registrationId]);

    if (!participant) {
        return <div className="p-10 text-center">Participant not found</div>;
    }

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

    // Fetch Posters
    const posters = await query('SELECT id, title, authors FROM posters WHERE conference_id = ?', [conferenceId]);
    
    // Fetch Program Slots
    const slots = await query('SELECT id, type, title, presenter_name FROM program_slots WHERE session_id IN (SELECT id FROM program_sessions WHERE conference_id = ?)', [conferenceId]);

    const compareNames = (presenter, firstName, lastName) => {
        if (!presenter || !firstName || !lastName) return false;
        
        const presenterClean = presenter.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const firstClean = firstName.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const lastClean = lastName.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
        if (presenterClean.includes(',')) {
            const parts = presenterClean.split(',');
            const presLast = parts[0].trim();
            const presFirst = parts[1] ? parts[1].trim() : '';
            
            if (presLast === lastClean && (presFirst.includes(firstClean) || firstClean.includes(presFirst))) {
                return true;
            }
            if (lastClean.includes(presLast) && presLast.length > 2 && (presFirst.includes(firstClean) || firstClean.includes(presFirst))) {
                return true;
            }
        }
        
        const option1 = `${firstClean} ${lastClean}`;
        const option2 = `${lastClean} ${firstClean}`;
        if (presenterClean === option1 || presenterClean === option2) {
            return true;
        }
        
        if (presenterClean.includes(firstClean) && presenterClean.includes(lastClean)) {
            return true;
        }
        
        return false;
    };

    const getPresentationsForParticipant = (p) => {
        const presentations = [];
        const fName = p.firstName || '';
        const lName = p.lastName || '';
        
        for (const slot of slots) {
            if (slot.presenter_name && compareNames(slot.presenter_name, fName, lName)) {
                presentations.push({
                    title: slot.title,
                    type: slot.type ? (slot.type.charAt(0).toUpperCase() + slot.type.slice(1)) : 'Oral'
                });
            }
        }
        
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

    const presentations = getPresentationsForParticipant(participant);

    const templateData = {
        name: participant.name,
        conference: conference,
        registrationType: participant.payment_group || participant.registration_type || '',
        institution: participant.entity || participant.payment_group || '',
        entityAddress: participant.entity_address || '',
        entityZip: participant.entity_zip || '',
        entityCity: participant.entity_city || '',
        entityCountry: participant.entity_country || '',
        checkinDate: participant.scanned_at || '',
        sponsorList: conference.sponsor_list,
        conferenceAddress: conference.conference_address,
        signatureImage: conference.signature_image,
        textUnderSignature: conference.text_under_signature,
        conferenceFullName: conference.conference_full_name,
        conferenceDates: conferenceDates,
        presentations: presentations
    };

    const emailObj = emailTemplates.certificate(templateData);

    const isLandscape = conference.certificate_orientation === 'landscape';
    const bgImage = conference.certificate_background_image;

    const printWidth = isLandscape ? '297mm' : '210mm';
    const printHeight = isLandscape ? '210mm' : '297mm';
    const pageOrientation = isLandscape ? 'landscape' : 'portrait';

    const styleHtml = `
        @media print {
            @page { margin: 0; size: A4 ${pageOrientation}; }
            html, body { background: white !important; margin: 0; padding: 0; overflow: hidden !important; height: ${printHeight} !important; }
            .no-print { display: none !important; }
            .print-container { 
                width: ${printWidth} !important; 
                height: ${printHeight} !important; 
                max-height: ${printHeight} !important;
                box-shadow: none !important; 
                margin: 0 !important; 
                padding: 12mm !important; 
                box-sizing: border-box !important; 
                display: flex !important;
                flex-direction: column !important;
                justify-content: center !important;
                overflow: hidden !important;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                ${bgImage ? `background-image: url('${bgImage}') !important; background-size: cover !important; background-position: center !important; background-repeat: no-repeat !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;` : ''}
            }
            .print-container > div {
                height: 100%;
                overflow: hidden !important;
            }
        }
    `;

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            <style dangerouslySetInnerHTML={{ __html: styleHtml }} />

            {/* Top Toolbar - Hidden on print */}
            <div className="bg-slate-900 text-white p-4 sticky top-0 z-10 shadow-md no-print">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Award className="w-5 h-5 text-indigo-400" />
                        <h2 className="font-bold text-sm">Certificate of Participation</h2>
                    </div>
                    
                    {/* Client Component Button Wrapper */}
                    <PrintButton />
                </div>
            </div>

            {/* Certificate Container */}
            <div className={`mx-auto mt-8 p-4 no-print ${isLandscape ? 'max-w-6xl' : 'max-w-4xl'}`}>
                <div 
                    className="bg-white rounded-xl shadow-xl overflow-hidden mx-auto print-container print:shadow-none print:rounded-none relative" 
                    style={{ 
                        maxWidth: isLandscape ? '1123px' : '794px',
                        minHeight: isLandscape ? '794px' : '1123px',
                        ...(bgImage ? {
                            backgroundImage: `url(${bgImage})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            backgroundRepeat: 'no-repeat'
                        } : {})
                    }}
                >
                    <div dangerouslySetInnerHTML={{ __html: emailObj.html }} />
                </div>
            </div>
            
            <div className="hidden print:block print-container">
                <div dangerouslySetInnerHTML={{ __html: emailObj.html }} />
            </div>
        </div>
    );
}
