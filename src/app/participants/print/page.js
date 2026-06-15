import { query } from '@/lib/db';
import { getBadgeConfig } from '@/app/actions/participants-qr';

export default async function PrintBadgesPage({ searchParams }) {
    const { registrationIds, conferenceId } = await searchParams;
    
    if (!registrationIds || !conferenceId) return <div className="p-10 text-center">Missing parameters (registrationIds, conferenceId)</div>;
    
    const ids = registrationIds.split(',');
    
    // Fetch participant data
    const participants = await query(`
        SELECT 
            p.*, 
            CONCAT(p.firstName, ' ', p.lastName) as name,
            r.id as registrationId, 
            t.token, 
            c.acronym
        FROM participants p
        JOIN registrations r ON p.id = r.participant_id
        JOIN conferences c ON r.conference_id = c.id
        LEFT JOIN participant_qr_tokens t ON r.id = t.registration_id
        WHERE r.id IN (${ids.map(() => '?').join(',')})
    `, ids);

    const { config, bgUrl } = await getBadgeConfig(conferenceId);

    return (
        <div className="print-container">
            <style dangerouslySetInnerHTML={{ __html: `
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap');
                
                @page {
                    size: 86mm 104mm; /* 80x98mm + 3mm bleed on each side */
                    margin: 0;
                }
                
                html, body {
                    margin: 0;
                    padding: 0;
                    background: #f0f0f0;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }

                .badge {
                    width: 86mm;
                    height: 104mm;
                    background-color: white;
                    background-size: cover;
                    background-position: center;
                    background-repeat: no-repeat;
                    position: relative;
                    overflow: hidden;
                    box-sizing: border-box;
                    padding: 13mm; /* 3mm bleed + 10mm internal safety margin */
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    text-align: center;
                    page-break-after: always;
                    font-family: 'Inter', sans-serif;
                }

                /* Trim line indicator (80x98mm) */
                .badge::after {
                    content: '';
                    position: absolute;
                    top: 3mm;
                    left: 3mm;
                    right: 3mm;
                    bottom: 3mm;
                    border: 0.2mm dashed rgba(0,0,0,0.15);
                    pointer-events: none;
                    z-index: 10;
                }

                .name {
                    font-size: ${config.nameSize || '32px'};
                    color: ${config.nameColor || '#000000'};
                    font-weight: 700;
                    line-height: 1.1;
                    z-index: 2;
                    word-wrap: break-word;
                    max-width: 100%;
                    text-transform: uppercase;
                }

                @media print {
                    body {
                        background: white;
                    }
                    .badge::after {
                        display: none !important; /* Never print the dashed trim line */
                    }
                }
            `}} />
            
            {participants.map(p => {
                let activeBgUrl = bgUrl;
                if (config?.customBackgrounds && p.registration_type) {
                    const match = config.customBackgrounds.find(cb => 
                        cb.userTypes && cb.userTypes.includes(p.registration_type)
                    );
                    if (match && match.url) {
                        activeBgUrl = match.url;
                    }
                }
                
                return (
                    <div 
                        key={p.registrationId} 
                        className="badge"
                        style={{
                            backgroundImage: activeBgUrl ? `url("${activeBgUrl.replace(/"/g, '%22')}")` : 'none'
                        }}
                    >
                        <div className="name">{p.name}</div>
                    </div>
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
