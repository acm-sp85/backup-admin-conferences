import { query } from '@/lib/db';
import { decrypt } from '@/lib/auth';
import { emailTemplates } from '@/lib/email-templates';
import { Award, AlertCircle, Printer, Download } from 'lucide-react';

export default async function AdminCertificatesViewPage({ params }) {
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
                        This admin certificate link is invalid or has expired. Please request a new one from the /certificates page.
                    </p>
                    <a href="/certificates" className="mt-6 inline-block bg-slate-900 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-black transition-colors">
                        Go to Certificates
                    </a>
                </div>
            </div>
        );
    }

    const { conferenceId, isAdmin } = payload;

    if (!isAdmin || !conferenceId) {
        return <div className="p-10 text-center">Unauthorized</div>;
    }

    // Fetch conference data
    const [conference] = await query(`SELECT * FROM conferences WHERE id = ?`, [conferenceId]);
    if (!conference) {
        return <div className="p-10 text-center">Conference not found</div>;
    }

    // Fetch ALL scanned participants for this conference
    const participants = await query(`
        SELECT 
            p.*, 
            CONCAT(p.firstName, ' ', p.lastName) as name,
            r.id as registrationId,
            pay.group_name as payment_group
        FROM participants p
        JOIN registrations r ON p.id = r.participant_id
        JOIN participant_qr_tokens t ON r.id = t.registration_id
        LEFT JOIN (
            SELECT registration_id, group_name 
            FROM payments 
            WHERE group_name IS NOT NULL AND group_name != ''
            ORDER BY created_at DESC 
            LIMIT 1
        ) pay ON r.id = pay.registration_id
        WHERE r.conference_id = ? AND t.scanned_at IS NOT NULL
        ORDER BY p.lastName ASC, p.firstName ASC
    `, [conferenceId]);

    if (participants.length === 0) {
        return <div className="p-10 text-center text-slate-500">No checked-in participants found for this conference.</div>;
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

    const isLandscape = conference.certificate_orientation === 'landscape';
    const bgImage = conference.certificate_background_image;

    const printWidth = isLandscape ? '297mm' : '210mm';
    const printHeight = isLandscape ? '210mm' : '297mm';
    const pageOrientation = isLandscape ? 'landscape' : 'portrait';

    const styleHtml = `
        @media print {
            @page { margin: 0; size: A4 ${pageOrientation}; }
            html, body { background: white !important; margin: 0; padding: 0; overflow: visible !important; height: auto !important; }
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
                page-break-after: always !important;
                break-after: always !important;
                ${bgImage ? `background-image: url('${bgImage}') !important; background-size: cover !important; background-position: center !important; background-repeat: no-repeat !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;` : ''}
            }
            .print-container > div {
                height: 100%;
                overflow: hidden !important;
            }
        }
    `;

    // Process all participants
    const processedParticipants = participants.map(participant => {
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
        return { ...participant, html: emailObj.html };
    });

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            <style dangerouslySetInnerHTML={{ __html: styleHtml }} />

            {/* Top Toolbar - Hidden on print */}
            <div className="bg-slate-900 text-white p-4 sticky top-0 z-10 shadow-md no-print">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <Award className="w-5 h-5 text-indigo-400" />
                            <h2 className="font-bold text-sm">Admin: All Certificates for {conference.name}</h2>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">{processedParticipants.length} total certificates</p>
                    </div>
                    
                    {/* Top Toolbar - Hidden on print */}
                    <button 
                        style={{ display: 'none' }} 
                        id="print-btn-hidden"
                    />
                    
                    <button 
                        id="print-btn"
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-colors shadow-lg"
                    >
                        <Download className="w-4 h-4" />
                        Download / Print All PDF
                    </button>
                    
                    <script dangerouslySetInnerHTML={{ __html: `
                        document.getElementById('print-btn').onclick = () => window.print();
                    `}} />
                </div>
            </div>

            {/* Visual preview list (only first 5 shown in UI if there are many, but all printed) */}
            <div className="no-print mt-8 max-w-4xl mx-auto px-4">
                <div className="bg-white rounded-xl shadow-sm border border-indigo-100 p-4 mb-8 text-sm text-indigo-800 flex items-start gap-3">
                    <Printer className="w-5 h-5 flex-shrink-0 text-indigo-600 mt-0.5" />
                    <div>
                        <p className="font-bold mb-1">Printing Instructions</p>
                        <p>Click the "Download / Print All PDF" button. Make sure to set the layout to <strong>{isLandscape ? 'Landscape' : 'Portrait'}</strong>, paper size to <strong>A4</strong>, scale to <strong>Default</strong>, and enable <strong>Background graphics</strong> in your print dialogue.</p>
                        <p className="mt-2 text-slate-500">Note: Only the first {Math.min(5, processedParticipants.length)} certificates are shown below as a preview, but ALL {processedParticipants.length} will be printed.</p>
                    </div>
                </div>
            </div>

            {/* Certificate Container Preview (max 5) */}
            {processedParticipants.slice(0, 5).map((p, index) => (
                <div key={`preview-${p.registrationId}`} className={`mx-auto p-4 no-print ${isLandscape ? 'max-w-6xl' : 'max-w-4xl'}`}>
                    <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2 text-center">Preview {index + 1} of {processedParticipants.length}: {p.name}</div>
                    <div 
                        className="bg-white rounded-xl shadow-xl overflow-hidden mx-auto relative" 
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
                        <div dangerouslySetInnerHTML={{ __html: p.html }} />
                    </div>
                </div>
            ))}
            
            {/* Hidden container with ALL certificates for printing only */}
            <div className="hidden print:block">
                {processedParticipants.map(p => (
                    <div key={`print-${p.registrationId}`} className="print-container">
                        <div dangerouslySetInnerHTML={{ __html: p.html }} />
                    </div>
                ))}
            </div>
            
        </div>
    );
}
