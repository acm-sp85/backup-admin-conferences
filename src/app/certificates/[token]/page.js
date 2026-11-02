import { query } from '@/lib/db';
import { decrypt } from '@/lib/auth';
import { emailTemplates } from '@/lib/email-templates';
import { Award, AlertCircle } from 'lucide-react';
import PrintButton from './PrintButton';
import PrintableCertificate from '@/components/PrintableCertificate';
import { getPresentationsForParticipant } from '@/lib/presentation-matcher';

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

    const presentations = getPresentationsForParticipant(participant, slots, posters);

    const isSpanish = conference.name && conference.name.toUpperCase().includes('CIPIE');
    const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });



    return (
        <div className="min-h-screen bg-slate-50 pb-20 print:pb-0 print:bg-white flex flex-col">
            {/* Top Toolbar - Hidden on print */}
            <div className="bg-slate-900 text-white p-4 sticky top-0 z-10 shadow-md no-print">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Award className="w-5 h-5 text-indigo-400" />
                        <h2 className="font-bold text-sm">Certificate of Participation</h2>
                    </div>
                    
                    {/* Client Component Button Wrapper */}
                    <PrintButton filename={`Certificate-${participant.name.replace(/\s+/g, '-')}.pdf`} />
                </div>
            </div>

            <div id="printable-certificate-container" className="flex-1 mt-8 print:mt-0 print:p-0">
                <PrintableCertificate 
                    participant={participant}
                    conference={conference}
                    conferenceDates={conferenceDates}
                    presentations={presentations}
                    isSpanish={isSpanish}
                    today={today}
                />
            </div>
        </div>
    );
}
