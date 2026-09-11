'use client';
import { useEffect, useState } from 'react';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

const parseJSONStr = (str) => {
    if (!str) return '';
    try {
        const parsed = JSON.parse(str);
        if (Array.isArray(parsed)) {
            if (parsed.length > 0 && typeof parsed[0] === 'object') {
                return parsed.map(a => {
                    const name = `${a.firstName || a.name || ''} ${a.lastName || ''}`.trim();
                    const aff = a.affiliation_name || a.affiliation || a.institution || '';
                    return aff ? `${name} (${aff})` : name;
                }).filter(Boolean).join('; ');
            }
            return parsed.join(', ');
        }
        return str;
    } catch {
        return str;
    }
};

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

export default function PrintableBookOfAbstracts() {
    const [data, setData] = useState(null);
    const [imagesLoaded, setImagesLoaded] = useState(false);

    useEffect(() => {
        const raw = sessionStorage.getItem('book_of_abstracts_print_data');
        if (raw) {
            try {
                setData(JSON.parse(raw));
            } catch (e) {}
        }
    }, []);

    useEffect(() => {
        if (data) {
            // Wait a moment for images to load, then trigger print
            // A more robust way would be to track onload of all images, but a short timeout usually suffices
            const timer = setTimeout(() => {
                setImagesLoaded(true);
                window.print();
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [data]);

    if (!data) return <div className="p-8">Loading print view...</div>;

    const { conference, items, fieldsConfig, accentColor = '#003087' } = data;

    const groupedItems = {};
    items.forEach(item => {
        const group = item.groupInfo || 'General';
        if (!groupedItems[group]) {
            groupedItems[group] = [];
        }
        groupedItems[group].push(item);
    });

    const groups = Object.keys(groupedItems);

    return (
        <div className={`bg-white text-black min-h-screen ${inter.className}`}>
            {/* Cover Page */}
            <div className="flex flex-col items-center justify-center min-h-[90vh] break-after-page text-center">
                <h1 className="text-5xl font-extrabold mb-8 tracking-tight" style={{ color: accentColor }}>BOOK OF ABSTRACTS</h1>
                <h2 className="text-3xl font-semibold max-w-3xl leading-snug" style={{ color: accentColor }}>{conference?.name}</h2>
            </div>

            {/* Content */}
            <div className="px-12 py-8 max-w-5xl mx-auto text-[14px]">
                {groups.map((groupName, groupIdx) => {
                    const groupItems = groupedItems[groupName];
                    return (
                        <div key={groupName} className={groupIdx < groups.length - 1 ? 'break-after-page' : ''}>
                            <h2 className="text-2xl font-bold border-b-2 pb-2 mb-6 mt-8 break-after-avoid" style={{ color: accentColor, borderColor: accentColor }}>
                                {groupName}
                            </h2>

                            {groupItems.map((item, idx) => (
                                <div key={item.id} className="mb-10 break-inside-avoid">
                                    <h3 className="text-lg font-bold mb-3 leading-snug break-after-avoid" style={{ color: accentColor }}>
                                        <span className="mr-2">{item.code ? item.code + '.' : (idx + 1) + '.'}</span>
                                        {item.title || 'Untitled'}
                                    </h3>

                                    {fieldsConfig.showAuthors && item.authors && (
                                        <div className="mb-3 text-[#444444]">
                                            <span className="font-bold underline text-black mr-2">Authors:</span>
                                            {parseJSONStr(item.authors)}
                                            {item.institution && (
                                                <span className="italic ml-1">({item.institution})</span>
                                            )}
                                        </div>
                                    )}

                                    {fieldsConfig.showContent && item.content && (
                                        <div className="mb-3 text-justify leading-relaxed">
                                            <span className="font-bold mr-2 inline-block mb-1">Abstract:</span>
                                            <div 
                                                className="html-content print:text-black"
                                                dangerouslySetInnerHTML={{ __html: item.content }}
                                            />
                                        </div>
                                    )}

                                    {fieldsConfig.showKeywords && item.toc && item.type === 'oral' && (
                                        <div className="mb-3">
                                            <span className="font-bold mr-2">Keywords:</span>
                                            {parseJSONStr(item.toc)}
                                        </div>
                                    )}

                                    {fieldsConfig.showTime && item.type === 'oral' && item.session_start_time && item.slot_start_time && (
                                        <div className="mb-3 text-[#444444]">
                                            <span className="font-bold text-black mr-2">Program Time:</span>
                                            {formatProgramTime(item.session_start_time, item.slot_start_time)}
                                        </div>
                                    )}

                                    {item.type === 'poster' && item.toc && item.toc !== 'null' && (
                                        <div className="mt-6 mb-4 text-center break-inside-avoid">
                                            <p className="font-bold mb-3">Graphical Abstract / Poster:</p>
                                            <img 
                                                src={`${item.base_url || 'https://www.nanoge.org/static/abstracts/'}${item.toc}`}
                                                alt="Graphical Abstract"
                                                className="max-w-full max-h-[700px] mx-auto object-contain"
                                                crossOrigin="anonymous"
                                            />
                                        </div>
                                    )}
                                    
                                    {/* Page break between entries */}
                                    {idx < groupItems.length - 1 && <div className="break-after-page"></div>}
                                </div>
                            ))}
                        </div>
                    );
                })}
            </div>
            
            <style jsx global>{`
                @media print {
                    @page { margin: 20mm; }
                    body { background: white; }
                    .html-content { color: black !important; }
                    .html-content p { color: black !important; }
                }
            `}</style>
        </div>
    );
}
