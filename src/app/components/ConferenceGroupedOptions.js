import React from 'react';

export default function ConferenceGroupedOptions({ conferences, renderOption }) {
    const now = new Date();
    // Normalize now to start of day for fairer comparison
    now.setHours(0, 0, 0, 0);

    const upcoming = [];
    const past = [];
    
    conferences.forEach(c => {
        let isPast = false;
        if (c.end_date) {
            const endDate = new Date(c.end_date);
            endDate.setHours(23, 59, 59, 999);
            isPast = endDate < now;
        } else if (c.start_date) {
            const startDate = new Date(c.start_date);
            startDate.setHours(23, 59, 59, 999);
            isPast = startDate < now;
        }
        
        if (isPast) {
            past.push(c);
        } else {
            upcoming.push(c);
        }
    });

    return (
        <>
            {upcoming.length > 0 && (
                <optgroup label="Upcoming Conferences">
                    {upcoming.map(renderOption)}
                </optgroup>
            )}
            {past.length > 0 && (
                <optgroup label="Past Conferences">
                    {past.map(renderOption)}
                </optgroup>
            )}
        </>
    );
}
