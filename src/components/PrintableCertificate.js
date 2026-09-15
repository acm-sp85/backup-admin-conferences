import React from 'react';

export default function PrintableCertificate({ 
    participant, 
    conference, 
    conferenceDates, 
    presentations,
    customHtml,
    isSpanish,
    today
}) {
    const isLandscape = conference.certificate_orientation === 'landscape';
    const bgImage = conference.certificate_background_image;

    const printWidth = isLandscape ? '297mm' : '210mm';
    const printHeight = isLandscape ? '210mm' : '297mm';
    const pageOrientation = isLandscape ? 'landscape' : 'portrait';

    const styleHtml = `
        @import url('https://fonts.googleapis.com/css2?family=Georgia&display=swap');
        
        @page { margin: 0; size: A4 ${pageOrientation}; }
        
        @media print {
            html, body { 
                background: white !important; 
                margin: 0; 
                padding: 0; 
                -webkit-print-color-adjust: exact !important; 
                print-color-adjust: exact !important; 
            }
            .no-print { display: none !important; }
            
            .certificate-page {
                box-shadow: none !important;
                margin-bottom: 0 !important;
                page-break-after: always !important;
            }
        }

        .certificate-page {
            width: ${printWidth};
            height: ${printHeight};
            background-color: white;
            position: relative;
            box-sizing: border-box;
            padding: 12mm;
            display: flex;
            flex-direction: column;
            justify-content: center;
            font-family: 'Georgia', 'Times New Roman', serif;
            margin: 0 auto;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            margin-bottom: 20px;
            page-break-after: always;
            ${bgImage ? `background-image: url('${bgImage}'); background-size: cover; background-position: center; background-repeat: no-repeat;` : ''}
        }

        .certificate-border {
            border: 2px solid ${conference.accent_color || '#007aff'};
            padding: 24px;
            height: 100%;
            box-sizing: border-box;
            border-radius: 4px;
            display: flex;
            flex-direction: column;
            background: rgba(255, 255, 255, 0.95);
        }
    `;

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

    if (customHtml) {
        return (
            <>
                <style dangerouslySetInnerHTML={{ __html: styleHtml }} />
                <div className="certificate-page print-container">
                    <div dangerouslySetInnerHTML={{ __html: customHtml }} />
                </div>
            </>
        );
    }

    const institution = participant.entity || participant.payment_group || '';
    const regType = participant.payment_group || participant.registration_type || '';
    
    let displayRegType = regType;
    if (isSpanish) {
        const typeMapping = {
            'Industrial': 'Sponsor',
        };
        displayRegType = typeMapping[regType] || regType;
    }
    const locParts = [[participant.entity_zip, participant.entity_city].filter(Boolean).join(' '), participant.entity_country].filter(Boolean).join(', ');

    return (
        <>
            <style dangerouslySetInnerHTML={{ __html: styleHtml }} />
            <div className="certificate-page print-container">
                <div className="certificate-border">
                    {conference.banner_url && (
                        <div style={{ margin: '-24px -24px 20px -24px' }}>
                            <img src={conference.banner_url} alt="Banner" style={{ width: '100%', height: 'auto', display: 'block', borderRadius: '2px 2px 0 0' }} />
                        </div>
                    )}
                    
                    <div style={{ flex: 1 }}>
                        <h1 style={{ textAlign: 'center', color: conference.accent_color || '#007aff', fontSize: '26px', fontWeight: '700', margin: '0 0 8px 0', letterSpacing: '1px' }}>{isSpanish ? 'CERTIFICADO DE PARTICIPACIÓN' : 'CERTIFICATE OF PARTICIPATION'}</h1>
                        <div style={{ textAlign: 'center', borderBottom: `2px solid ${conference.accent_color || '#007aff'}`, paddingBottom: '16px', marginBottom: '24px' }}>
                            <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>{today}</p>
                        </div>

                        <table style={{ width: '100%', marginBottom: '24px' }} cellPadding="0" cellSpacing="0">
                            <tbody>
                                <tr>
                                    <td style={{ width: '50%', verticalAlign: 'top', paddingRight: '20px' }}>
                                        <p style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b', margin: '0 0 4px 0' }}>{participant.name}</p>
                                        {institution && <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 2px 0' }}>{institution}</p>}
                                        {participant.entity_address && <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 2px 0' }}>{participant.entity_address}</p>}
                                        {locParts && <p style={{ fontSize: '12px', color: '#64748b', margin: '0' }}>{locParts}</p>}
                                    </td>
                                    <td style={{ width: '50%', verticalAlign: 'top', paddingLeft: '20px', borderLeft: '1px solid #e2e8f0' }}>
                                        <p style={{ fontSize: '11px', fontWeight: '700', color: conference.accent_color || '#007aff', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 6px 0' }}>{isSpanish ? 'Este certificado acredita la participación en:' : 'This certifies participation at:'}</p>
                                        <p style={{ fontSize: '12px', fontWeight: '700', color: '#1e293b', margin: '0 0 4px 0' }}>{conference.name}{conference.conference_full_name ? ` - ${conference.conference_full_name}` : ''}</p>
                                        {conference.conference_address && <p style={{ fontSize: '12px', color: '#64748b', margin: '0', lineHeight: '1.4' }} dangerouslySetInnerHTML={{__html: conference.conference_address.replace(/\n/g, '<br>')}}></p>}
                                    </td>
                                </tr>
                            </tbody>
                        </table>

                        <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '20px', marginBottom: '24px', border: '1px solid #e2e8f0' }}>
                            <p style={{ fontSize: '14px', color: '#334155', lineHeight: '1.7', margin: '0' }}>
                                {isSpanish ? 'El presente documento certifica que' : 'This letter certifies that'} <strong>{participant.name}</strong>
                                {displayRegType ? <span> {isSpanish ? 'participó como' : 'participated as'} <strong>{displayRegType}</strong></span> : (isSpanish ? ' participó' : ' participated')}
                                    &nbsp;{isSpanish ? 'en' : 'at the'} <strong>{conference.conference_full_name ? `${conference.conference_full_name} - ${conference.name}` : conference.name}</strong>
                                {conference.conference_address ? <span>{isSpanish ? ', celebrado en ' : ', celebrated at '}<strong>{conference.conference_address.replace(/\n/g, ', ')}</strong></span> : ''}
                                {conferenceDates ? <span> {isSpanish ? 'del' : 'from'} <strong>{conferenceDates}</strong></span> : ''}.
                            </p>
                            
                            {presentations && presentations.length > 0 && (
                                <div style={{ marginTop: '12px', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
                                    <p style={{ margin: '0 0 6px 0', fontSize: '14px', color: '#334155', lineHeight: '1.7' }}>
                                        <strong>{participant.name}</strong> {isSpanish ? 'ha presentado:' : 'has presented:'}
                                    </p>
                                    <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#334155', lineHeight: '1.6' }}>
                                        {presentations.map((pres, idx) => (
                                            <li key={idx}>
                                                {isSpanish ? ({'poster': 'Póster', 'demo': 'Demostración'}[pres.type.toLowerCase()] || pres.type) : pres.type} {isSpanish ? ' con título' : 'contribution entitled'} <strong>"{pres.title}"</strong>.
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>

                    </div>

                    <div style={{ marginTop: 'auto', marginBottom: '12px' }}>
                        <p style={{ fontSize: '13px', color: '#475569', margin: 0 }}>{isSpanish ? 'Atentamente,' : 'Sincerely,'}</p>
                        {conference.signature_image && <img src={conference.signature_image} style={{ maxHeight: '65px', display: 'block', margin: '8px 0' }} alt="Signature" />}
                        {conference.text_under_signature 
                            ? <p style={{ fontSize: '13px', color: '#1e293b', fontWeight: '600', margin: '5px 0 0 0', lineHeight: '1.4' }} dangerouslySetInnerHTML={{__html: conference.text_under_signature.replace(/\n/g, '<br>')}}></p>
                            : <p style={{ fontSize: '13px', color: '#1e293b', fontWeight: '600', margin: '8px 0 0 0' }}>{conference.name} {isSpanish ? 'Comité Organizador' : 'Organizing Committee'}</p>
                        }
                    </div>
                    
                    {sponsorsHtml && <div dangerouslySetInnerHTML={{__html: sponsorsHtml}}></div>}
                </div>
            </div>
        </>
    );
}
