import {
    Document, Packer, Paragraph, TextRun, HeadingLevel,
    PageBreak, AlignmentType, convertInchesToTwip, BorderStyle, ImageRun
} from 'docx';
import { fetchPosterImage } from '../actions/abstracts';

/**
 * Parses JSON keywords or authors if necessary
 */
const parseJSONStr = (str) => {
    if (!str) return '';
    try {
        const parsed = JSON.parse(str);
        if (Array.isArray(parsed)) {
            // Authors format
            if (parsed.length > 0 && typeof parsed[0] === 'object') {
                return parsed.map(a => {
                    const name = `${a.firstName || a.name || ''} ${a.lastName || ''}`.trim();
                    const aff = a.affiliation_name || a.affiliation || a.institution || '';
                    return aff ? `${name} (${aff})` : name;
                }).filter(Boolean).join('; ');
            }
            return parsed.join(', '); // Simple array
        }
        return str;
    } catch {
        return str;
    }
};

/**
 * Formats session date and slot time
 */
const formatProgramTime = (sessionStart, slotStart) => {
    if (!sessionStart || !slotStart) return '';
    try {
        const sessionDate = new Date(sessionStart);
        const slotDate = new Date(slotStart);
        if (isNaN(sessionDate.getTime()) || isNaN(slotDate.getTime())) return '';

        const weekday = sessionDate.toLocaleDateString('en-US', { weekday: 'long' });
        const monthName = sessionDate.toLocaleDateString('en-US', { month: 'long' });
        const day = sessionDate.getDate();

        let suffix = 'th';
        if (day === 1 || day === 21 || day === 31) suffix = 'st';
        else if (day === 2 || day === 22) suffix = 'nd';
        else if (day === 3 || day === 23) suffix = 'rd';

        let formatted = `${weekday}, ${monthName} ${day}${suffix}`;
        
        let hours = slotDate.getHours();
        let minutes = slotDate.getMinutes();
        
        let period = 'AM';
        if (hours >= 12) {
            period = 'PM';
            if (hours > 12) hours -= 12;
        }
        if (hours === 0) hours = 12;
        
        const minsStr = minutes < 10 ? '0' + minutes : minutes;
        formatted += ` at ${hours}:${minsStr} ${period}`;
        
        return formatted;
    } catch (e) {
        return '';
    }
};

/**
 * Converts HTML to plain text
 */
const stripHtml = (html) => {
    if (!html) return '';
    // Replace br and p tags with newlines to preserve some structure
    let text = html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n');
    if (typeof document !== 'undefined') {
        const div = document.createElement('div');
        div.innerHTML = text;
        return (div.textContent || div.innerText || '').trim();
    }
    // Fallback if document is undefined (shouldn't happen since this runs on client)
    return text.replace(/<[^>]*>?/gm, '').trim();
};

/**
 * Helper to get image dimensions
 */
const getImageDimensions = (base64Url) => {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => resolve(null);
        img.src = base64Url;
    });
};

export async function generateBookOfAbstractsDOCX({ conferenceName, items, fieldsConfig }) {
    
    // Group items by `groupInfo`
    const groupedItems = {};
    items.forEach(item => {
        const group = item.groupInfo || 'General';
        if (!groupedItems[group]) {
            groupedItems[group] = [];
        }
        groupedItems[group].push(item);
    });

    const children = [];

    // --- Cover Page ---
    children.push(
        new Paragraph({
            children: [new TextRun('')],
            spacing: { after: convertInchesToTwip(4) },
        }),
        new Paragraph({
            children: [new TextRun({
                text: 'BOOK OF ABSTRACTS',
                size: 72,
                bold: true,
                color: '003087',
            })],
            alignment: AlignmentType.CENTER
        }),
        new Paragraph({
            children: [new TextRun({
                text: (conferenceName || '').toUpperCase(),
                size: 40,
                color: '003087',
            })],
            alignment: AlignmentType.CENTER
        }),
        new Paragraph({
            children: [new PageBreak()],
        })
    );

    // --- Content ---
    for (const [groupIdx, groupName] of Object.keys(groupedItems).entries()) {
        // Group Header
        children.push(
            new Paragraph({
                children: [new TextRun({ text: groupName, bold: true, size: 28, color: '003087' })],
                heading: HeadingLevel.HEADING_2,
                border: {
                    bottom: { style: BorderStyle.SINGLE, size: 6, color: '003087', space: 1 },
                },
                spacing: { before: convertInchesToTwip(0.2), after: convertInchesToTwip(0.2) },
            })
        );

        const groupItems = groupedItems[groupName];

        for (const [index, item] of groupItems.entries()) {
            // Page jump before entry (if not the first item in the first group, or maybe just always except very first?)
            // Actually, adding a PageBreak before every entry except the very first one of the group, or after every entry?
            // "Add a page jump between entries." means after each entry.

            // Title
            children.push(
                new Paragraph({
                    children: [
                        new TextRun({ text: item.code ? `${item.code}. ` : `${index + 1}. `, bold: true, size: 20, color: '003087' }),
                        new TextRun({ text: item.title || 'Untitled', bold: true, size: 20 })
                    ],
                    spacing: { after: convertInchesToTwip(0.04) }
                })
            );

            children.push(new Paragraph({ children: [new TextRun('')], spacing: { after: convertInchesToTwip(0.05) } }));

            // Authors
            if (fieldsConfig.showAuthors && item.authors) {
                const authorsStr = parseJSONStr(item.authors);
                if (authorsStr) {
                    children.push(
                        new Paragraph({
                            children: [
                                new TextRun({ text: 'Authors: ', bold: true, size: 18, underline: true }),
                                new TextRun({ text: authorsStr, size: 18, color: '444444' }),
                            ],
                            spacing: { after: convertInchesToTwip(0.04) }
                        })
                    );
                    children.push(new Paragraph({ children: [new TextRun('')], spacing: { after: convertInchesToTwip(0.05) } }));
                }
            }

            // Content (Plain Text)
            if (fieldsConfig.showContent && item.content) {
                const plainText = stripHtml(item.content);
                if (plainText) {
                    children.push(
                        new Paragraph({
                            children: [
                                new TextRun({ text: 'Abstract:', bold: true, size: 18 }),
                                new TextRun({ text: plainText, size: 18, break: 1 }),
                            ],
                            alignment: AlignmentType.JUSTIFIED,
                            spacing: { after: convertInchesToTwip(0.04) }
                        })
                    );
                    children.push(new Paragraph({ children: [new TextRun('')], spacing: { after: convertInchesToTwip(0.05) } }));
                }
            }

            // Keywords (for Orals)
            if (fieldsConfig.showKeywords && item.toc && item.type === 'oral') {
                const keywordsStr = parseJSONStr(item.toc);
                if (keywordsStr) {
                    children.push(
                        new Paragraph({
                            children: [
                                new TextRun({ text: 'Keywords: ', bold: true, size: 18 }),
                                new TextRun({ text: keywordsStr, size: 18 }),
                            ],
                            spacing: { after: convertInchesToTwip(0.04) }
                        })
                    );
                    children.push(new Paragraph({ children: [new TextRun('')], spacing: { after: convertInchesToTwip(0.05) } }));
                }
            }

            // Program Time
            if (fieldsConfig.showTime && item.type === 'oral' && item.session_start_time && item.slot_start_time) {
                const timeStr = formatProgramTime(item.session_start_time, item.slot_start_time);
                if (timeStr) {
                    children.push(
                        new Paragraph({
                            children: [
                                new TextRun({ text: 'Program Time: ', bold: true, size: 18 }),
                                new TextRun({ text: timeStr, size: 18 }),
                            ],
                            spacing: { after: convertInchesToTwip(0.04) }
                        })
                    );
                    children.push(new Paragraph({ children: [new TextRun('')], spacing: { after: convertInchesToTwip(0.05) } }));
                }
            }

            // Poster Image
            if (item.type === 'poster' && item.toc && item.toc !== 'null') {
                const imageUrl = `${item.base_url || 'https://www.nanoge.org/static/abstracts/'}${item.toc}`;
                const imgData = await fetchPosterImage(imageUrl);
                
                if (imgData && imgData.base64) {
                    const base64Url = `data:${imgData.mimeType};base64,${imgData.base64}`;
                    const dims = await getImageDimensions(base64Url);
                    
                    if (dims) {
                        // Max width for A4 with 1 inch margins is approx 6.27 inches = 600 pixels roughly
                        const MAX_WIDTH = 550;
                        let { width, height } = dims;
                        if (width > MAX_WIDTH) {
                            height = Math.round((MAX_WIDTH / width) * height);
                            width = MAX_WIDTH;
                        }

                        // Convert base64 string to Uint8Array for docx
                        const binaryString = atob(imgData.base64);
                        const bytes = new Uint8Array(binaryString.length);
                        for (let i = 0; i < binaryString.length; i++) {
                            bytes[i] = binaryString.charCodeAt(i);
                        }

                        children.push(
                            new Paragraph({
                                children: [
                                    new TextRun({ text: 'Graphical Abstract / Poster:', bold: true, size: 18, break: 1 }),
                                    new ImageRun({
                                        data: bytes,
                                        transformation: {
                                            width,
                                            height
                                        }
                                    })
                                ],
                                alignment: AlignmentType.CENTER,
                                spacing: { after: convertInchesToTwip(0.04), before: convertInchesToTwip(0.04) }
                            })
                        );
                    }
                }
            }

            // Extra space or page break between items
            if (index < groupItems.length - 1) {
                children.push(new Paragraph({ children: [new PageBreak()] }));
            }
        }

        // Page break between groups (except the last one)
        if (groupIdx < Object.keys(groupedItems).length - 1) {
            children.push(new Paragraph({ children: [new PageBreak()] }));
        }
    }

    const doc = new Document({
        sections: [
            {
                properties: {
                    page: {
                        margin: {
                            top: convertInchesToTwip(1),
                            bottom: convertInchesToTwip(1),
                            left: convertInchesToTwip(1.1),
                            right: convertInchesToTwip(1.1),
                        },
                    },
                },
                children,
            },
        ],
        styles: {
            default: {
                document: {
                    run: { font: 'Calibri', size: 20 },
                    paragraph: {
                        spacing: { line: 360 }, // 1.5 line spacing
                    },
                },
            },
        },
    });

    const blob = await Packer.toBlob(doc);
    return blob;
}
