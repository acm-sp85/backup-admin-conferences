/**
 * Formats a date string (YYYY-MM-DD), time string (HH:MM), and timezone
 * into a human-readable localized string.
 * E.g., "Wednesday, May 27th, at 20:00h (Europe/Madrid)"
 */
export function formatSocialDinnerDate(dateStr, timeStr, timezone) {
    if (!dateStr) return '';
    try {
        let actualDateStr = dateStr;
        let actualTimeStr = timeStr;
        const normalized = typeof dateStr === 'string' ? dateStr.replace(' ', 'T') : String(dateStr).replace(' ', 'T');
        if (normalized.includes('T')) {
            const parts = normalized.split('T');
            actualDateStr = parts[0];
            if (!actualTimeStr) {
                actualTimeStr = parts[1] ? parts[1].substring(0, 5) : '';
            }
        }
        
        const dateParts = actualDateStr.split('-');
        if (dateParts.length !== 3) return dateStr;
        
        const year = parseInt(dateParts[0], 10);
        const month = parseInt(dateParts[1], 10) - 1;
        const day = parseInt(dateParts[2], 10);
        
        // Parse timezone-independently by using local constructor
        const localDate = new Date(year, month, day);
        if (isNaN(localDate.getTime())) return dateStr;

        const weekday = localDate.toLocaleDateString('en-US', { weekday: 'long' });
        const monthName = localDate.toLocaleDateString('en-US', { month: 'long' });

        // Ordinal suffix (1st, 2nd, 3rd, 4th, etc.)
        let suffix = 'th';
        if (day === 1 || day === 21 || day === 31) suffix = 'st';
        else if (day === 2 || day === 22) suffix = 'nd';
        else if (day === 3 || day === 23) suffix = 'rd';

        let formatted = `${weekday}, ${monthName} ${day}${suffix}`;
        if (actualTimeStr) {
            formatted += `, at ${actualTimeStr}h`;
        }
        if (timezone) {
            formatted += ` (${timezone})`;
        }
        return formatted;
    } catch (e) {
        console.error('Error formatting social dinner date:', e);
        return dateStr;
    }
}

/**
 * Formats a registration datetime-local string (YYYY-MM-DDTHH:MM)
 * into a human-readable localized string.
 * E.g., "Wednesday, May 27th, at 10:00h"
 */
export function formatRegistrationDate(datetimeStr) {
    if (!datetimeStr) return '';
    try {
        // Normalize space separation to T if it comes from the MySQL datetime string
        const normalized = typeof datetimeStr === 'string' ? datetimeStr.replace(' ', 'T') : String(datetimeStr).replace(' ', 'T');
        const parts = normalized.split('T');
        if (parts.length < 1) return datetimeStr;
        const dateStr = parts[0];
        const timeStr = parts[1] ? parts[1].substring(0, 5) : '';
        
        const dateParts = dateStr.split('-');
        if (dateParts.length !== 3) return datetimeStr;
        
        const year = parseInt(dateParts[0], 10);
        const month = parseInt(dateParts[1], 10) - 1;
        const day = parseInt(dateParts[2], 10);
        
        const localDate = new Date(year, month, day);
        if (isNaN(localDate.getTime())) return datetimeStr;

        const weekday = localDate.toLocaleDateString('en-US', { weekday: 'long' });
        const monthName = localDate.toLocaleDateString('en-US', { month: 'long' });

        let suffix = 'th';
        if (day === 1 || day === 21 || day === 31) suffix = 'st';
        else if (day === 2 || day === 22) suffix = 'nd';
        else if (day === 3 || day === 23) suffix = 'rd';

        let formatted = `${weekday}, ${monthName} ${day}${suffix}`;
        if (timeStr) {
            formatted += `, at ${timeStr}h`;
        }
        return formatted;
    } catch (e) {
        console.error('Error formatting registration date:', e);
        return datetimeStr;
    }
}
