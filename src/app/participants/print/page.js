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
        <div className="print-container" style={{ paddingTop: '60px' }}>
            <style dangerouslySetInnerHTML={{ __html: `
                @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@300..900&family=Inter:wght@300..900&family=Lora:ital,wght@0,300..900;1,300..900&family=Montserrat:wght@300..900&family=Open+Sans:wght@300..800&family=Outfit:wght@100..900&family=Playfair+Display:wght@400..900&family=Roboto:wght@100..900&display=swap');
                
                @page {
                    size: ${totalWidth} ${totalHeight}; 
                    margin: 0;
                }
                
                html, body {
                    margin: 0;
                    padding: 0;
                    background: #f8fafc;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }

                .print-controls {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 55px;
                    background: #0f172a;
                    color: white;
                    padding: 0 24px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    z-index: 1000;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.15);
                    font-family: system-ui, -apple-system, sans-serif;
                    font-size: 13px;
                }

                .print-btn {
                    background: #4f46e5;
                    color: white;
                    border: none;
                    padding: 8px 18px;
                    border-radius: 10px;
                    font-weight: bold;
                    cursor: pointer;
                    transition: all 0.2s;
                    box-shadow: 0 2px 4px rgba(79, 70, 229, 0.2);
                }

                .print-btn:hover {
                    background: #4338ca;
                    transform: translateY(-1px);
                    box-shadow: 0 4px 6px rgba(79, 70, 229, 0.3);
                }

                .badge-wrapper {
                    position: relative;
                    margin: 20px auto;
                    width: ${totalWidth};
                    height: ${totalHeight};
                    box-shadow: 0 10px 25px rgba(0,0,0,0.08);
                    border-radius: 4px;
                }

                .badge {
                    width: 100%;
                    height: 100%;
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
                    font-family: 'Inter', sans-serif;
                }

                /* Trim line indicator */
                .trim-line {
                    position: absolute;
                    top: ${bleedStr};
                    left: ${bleedStr};
                    right: ${bleedStr};
                    bottom: ${bleedStr};
                    border: 0.2mm dashed rgba(0,0,0,0.18);
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
                    outline: none;
                    border: 1px transparent dashed;
                    border-radius: 4px;
                    transition: border 0.15s;
                    cursor: text;
                    
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

                .name:hover, .name:focus {
                    border-color: rgba(79, 70, 229, 0.4);
                    background-color: rgba(79, 70, 229, 0.02);
                }

                .institution {
                    font-family: '${config.instFont || 'Inter'}', sans-serif;
                    font-size: ${config.instSize || '16px'};
                    color: ${config.instColor || '#666666'};
                    font-weight: ${config.instWeight || '400'};
                    word-wrap: break-word;
                    max-width: 100%;
                    text-transform: ${config.capitalizeInst ? 'uppercase' : 'none'};
                    outline: none;
                    border: 1px transparent dashed;
                    border-radius: 4px;
                    transition: border 0.15s;
                    cursor: text;
                    
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

                .institution:hover, .institution:focus {
                    border-color: rgba(79, 70, 229, 0.4);
                    background-color: rgba(79, 70, 229, 0.02);
                }

                .badge-editor-controls {
                    position: absolute;
                    top: 10px;
                    right: -105px;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    background: #0f172a;
                    color: white;
                    padding: 10px;
                    border-radius: 12px;
                    font-family: system-ui, -apple-system, sans-serif;
                    font-size: 8px;
                    z-index: 100;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    width: 80px;
                    text-align: left;
                }

                .badge-editor-controls label {
                    display: block;
                    font-weight: bold;
                    margin-bottom: 3px;
                    text-transform: uppercase;
                    color: #94a3b8;
                }

                .badge-editor-controls input[type="range"] {
                    width: 100%;
                    height: 2px;
                    background: #334155;
                    border-radius: 2px;
                    appearance: none;
                    cursor: pointer;
                    accent-color: #6366f1;
                }

                @media print {
                    html, body {
                        background: white;
                    }
                    .print-container {
                        padding-top: 0 !important;
                    }
                    .print-controls, .badge-editor-controls {
                        display: none !important;
                    }
                    .badge-wrapper {
                        margin: 0 !important;
                        box-shadow: none !important;
                        border-radius: 0 !important;
                        page-break-after: always;
                    }
                    body.hide-trim-lines-print .trim-line {
                        display: none !important;
                    }
                    .name, .institution {
                        border: none !important;
                        background: transparent !important;
                    }
                }
            `}} />

            {/* Print Settings Control Bar */}
            <div className="print-controls">
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '16px' }}>✏️</span>
                        <div>
                            <strong style={{ color: '#818cf8' }}>Edit Mode Active:</strong> Click directly on any participant name or institution to customize before printing. Changes are temporary.
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#1e293b', padding: '6px 12px', borderRadius: '8px', border: '1px solid #334155' }}>
                        <input 
                            type="checkbox" 
                            id="toggle-print-trim-lines" 
                            defaultChecked={true}
                            style={{ margin: 0, cursor: 'pointer', width: 'auto' }}
                        />
                        <label htmlFor="toggle-print-trim-lines" style={{ margin: 0, cursor: 'pointer', fontWeight: 'bold', color: '#e2e8f0', whiteSpace: 'nowrap' }}>Print Trim Lines</label>
                    </div>
                </div>
                <button className="print-btn" id="print-button-trigger">
                    Print Badges
                </button>
            </div>
            
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
                        <div key={p.registrationId} className="badge-wrapper">
                            {/* Card-specific alignment controls (hidden on print) */}
                            <div className="badge-editor-controls">
                                <div>
                                    <label>Name Y</label>
                                    <input 
                                        type="range" 
                                        min="0" 
                                        max="100" 
                                        defaultValue={parseInt(config.nameY) || 50}
                                        className="slider-name-y"
                                    />
                                </div>
                                <div>
                                    <label>Inst Y</label>
                                    <input 
                                        type="range" 
                                        min="0" 
                                        max="100" 
                                        defaultValue={parseInt(config.instY) || 60}
                                        className="slider-inst-y"
                                    />
                                </div>
                                <div>
                                    <label>Margin</label>
                                    <input 
                                        type="range" 
                                        min="0" 
                                        max="40" 
                                        defaultValue={parseInt(config.sideMargin) || 10}
                                        className="slider-margin"
                                    />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                                    <input 
                                        type="checkbox" 
                                        className="toggle-inst-white" 
                                        id={`inst-white-${p.registrationId}`}
                                        style={{ margin: 0, width: 'auto', cursor: 'pointer' }}
                                    />
                                    <label htmlFor={`inst-white-${p.registrationId}`} style={{ margin: 0, cursor: 'pointer', whiteSpace: 'nowrap' }}>White Inst</label>
                                </div>
                            </div>

                            <div 
                                className="badge"
                                style={{
                                    backgroundImage: activeBgUrl ? `url("${activeBgUrl.replace(/"/g, '%22')}")` : 'none'
                                }}
                            >
                                <div className="trim-line" />
                                <div 
                                    className="name" 
                                    contentEditable="true" 
                                    suppressContentEditableWarning={true}
                                    dangerouslySetInnerHTML={{ __html: formatBadgeName(p.name) }} 
                                />
                                {p.entity ? (
                                    <div 
                                        className="institution" 
                                        contentEditable="true" 
                                        suppressContentEditableWarning={true}
                                    >
                                        {p.entity}
                                    </div>
                                ) : (
                                    <div 
                                        className="institution" 
                                        contentEditable="true" 
                                        suppressContentEditableWarning={true}
                                        style={{ minHeight: '1.2em', minWidth: '50px' }}
                                    />
                                )}
                            </div>
                        </div>
                    );
                });
            })()}

            <script dangerouslySetInnerHTML={{ __html: `
                document.getElementById('print-button-trigger').addEventListener('click', function() {
                    window.print();
                });

                const toggleTrimCheckbox = document.getElementById('toggle-print-trim-lines');
                toggleTrimCheckbox.addEventListener('change', function() {
                    if (this.checked) {
                        document.body.classList.remove('hide-trim-lines-print');
                    } else {
                        document.body.classList.add('hide-trim-lines-print');
                    }
                });

                document.querySelectorAll('.badge-wrapper').forEach(function(wrapper) {
                    const badge = wrapper.querySelector('.badge');
                    const nameEl = badge.querySelector('.name');
                    const instEl = badge.querySelector('.institution');
                    
                    const nameYSlider = wrapper.querySelector('.slider-name-y');
                    nameYSlider.addEventListener('input', function() {
                        nameEl.style.position = 'absolute';
                        nameEl.style.transform = 'translateY(-50%)';
                        nameEl.style.top = this.value + '%';
                    });
                    
                    const instYSlider = wrapper.querySelector('.slider-inst-y');
                    instYSlider.addEventListener('input', function() {
                        if (instEl) {
                            instEl.style.position = 'absolute';
                            instEl.style.transform = 'translateY(-50%)';
                            instEl.style.top = this.value + '%';
                        }
                    });
                    
                    const marginSlider = wrapper.querySelector('.slider-margin');
                    marginSlider.addEventListener('input', function() {
                        nameEl.style.left = this.value + 'mm';
                        nameEl.style.right = this.value + 'mm';
                        if (instEl) {
                            instEl.style.left = this.value + 'mm';
                            instEl.style.right = this.value + 'mm';
                        }
                    });

                    const whiteInstCheckbox = wrapper.querySelector('.toggle-inst-white');
                    whiteInstCheckbox.addEventListener('change', function() {
                        if (instEl) {
                            if (this.checked) {
                                instEl.dataset.originalColor = instEl.style.color || window.getComputedStyle(instEl).color;
                                instEl.style.color = '#FFFFFF';
                            } else {
                                instEl.style.color = instEl.dataset.originalColor || '';
                            }
                        }
                    });
                });
            `}} />
        </div>
    );
}
