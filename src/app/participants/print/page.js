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

    // Extract base values and unit (supporting mm, cm, px, etc.)
    const parseDim = (val, defaultVal) => {
        const str = String(val || defaultVal || '').trim();
        const num = parseFloat(str) || 0;
        const unit = str.replace(/[0-9.]/g, '').trim() || 'mm';
        return { num, unit };
    };

    const widthDim = parseDim(config.width, '80mm');
    const heightDim = parseDim(config.height, '98mm');
    const bleedDim = parseDim(config.bleed, '3mm');

    const totalWidth = `${widthDim.num + bleedDim.num * 2}${widthDim.unit}`;
    const totalHeight = `${heightDim.num + bleedDim.num * 2}${heightDim.unit}`;
    const bleedStr = `${bleedDim.num}${bleedDim.unit}`;

    return (
        <div className="print-container">
            <style dangerouslySetInnerHTML={{ __html: `
                @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@300..900&family=Inter:wght@300..900&family=Lora:ital,wght@0,300..900;1,300..900&family=Montserrat:wght@300..900&family=Open+Sans:wght@300..800&family=Outfit:wght@100..900&family=Playfair+Display:wght@400..900&family=Roboto:wght@100..900&display=swap');
                
                @page {
                    size: ${totalWidth} ${totalHeight}; 
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
                    width: ${totalWidth};
                    height: ${totalHeight};
                    background-color: white;
                    background-size: cover;
                    background-position: center;
                    background-repeat: no-repeat;
                    position: relative;
                    overflow: hidden;
                    box-sizing: border-box;
                    padding: calc(${bleedStr} + ${config.padding || '10mm'});
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    text-align: center;
                    page-break-after: always;
                    font-family: 'Inter', sans-serif;
                }

                /* Trim line indicator */
                .badge::after {
                    content: '';
                    position: absolute;
                    top: ${bleedStr};
                    left: ${bleedStr};
                    right: ${bleedStr};
                    bottom: ${bleedStr};
                    border: 0.2mm dashed rgba(0,0,0,0.15);
                    pointer-events: none;
                    z-index: 10;
                }

                .name {
                    font-family: '${config.nameFont || 'Inter'}', sans-serif;
                    font-size: ${config.nameSize || '32px'};
                    color: ${config.nameColor || '#000000'};
                    font-weight: ${config.nameWeight || '700'};
                    line-height: 1.1;
                    word-wrap: break-word;
                    max-width: 100%;
                    text-transform: ${config.capitalizeName !== false ? 'uppercase' : 'none'};
                    
                    ${config.nameY ? `
                        position: absolute;
                        top: ${config.nameY};
                        left: ${config.sideMargin || '10mm'};
                        right: ${config.sideMargin || '10mm'};
                        margin: 0 auto;
                        transform: translateY(-50%);
                    ` : `
                        z-index: 2;
                    `}
                }

                .institution {
                    font-family: '${config.instFont || 'Inter'}', sans-serif;
                    font-size: ${config.instSize || '16px'};
                    color: ${config.instColor || '#666666'};
                    font-weight: ${config.instWeight || '400'};
                    word-wrap: break-word;
                    max-width: 100%;
                    text-transform: ${config.capitalizeInst ? 'uppercase' : 'none'};
                    
                    ${config.instY ? `
                        position: absolute;
                        top: ${config.instY};
                        left: ${config.sideMargin || '10mm'};
                        right: ${config.sideMargin || '10mm'};
                        margin: 0 auto;
                        transform: translateY(-50%);
                    ` : `
                        margin-top: 8px;
                        z-index: 2;
                    `}
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
            
            {(() => {
                const formatBadgeName = (fullName) => {
                    if (!fullName) return '';
                    let name = fullName;
                    if (config?.capitalizeName === false) {
                        name = name.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
                    }
                    const parts = name.trim().split(/\s+/);
                    if (parts.length <= 1) return name;
                    return `${parts[0]}<br/>${parts.slice(1).join(' ')}`;
                };

                return participants.map(p => {
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
                            <div className="name" dangerouslySetInnerHTML={{ __html: formatBadgeName(p.name) }} />
                            {p.entity && <div className="institution">{p.entity}</div>}
                        </div>
                    );
                });
            })()}
            
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
