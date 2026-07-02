const CIPIE_TIME_SLOTS = [
    { id: 'ts1', label: '10:00 – 11:00',  startH: 10, startM: 0,  endH: 11, endM: 0  },
    { id: 'ts2', label: '11:30 – 12:30',  startH: 11, startM: 30, endH: 12, endM: 30 },
    { id: 'ts3', label: '13:30 – 14:15',  startH: 13, startM: 30, endH: 14, endM: 15 },
    { id: 'ts4', label: '17:00 – 18:00',  startH: 17, startM: 0,  endH: 18, endM: 0  },
    { id: 'ts5', label: '18:30 – 20:00',  startH: 18, startM: 30, endH: 20, endM: 0  },
];

function matchToTimeSlot(startTimeStr) {
    const d = new Date(startTimeStr);
    const mins = d.getHours() * 60 + d.getMinutes();

    for (const ts of CIPIE_TIME_SLOTS) {
        const sMin = ts.startH * 60 + ts.startM;
        const eMin = ts.endH * 60 + ts.endM;
        if (mins >= sMin - 15 && mins < eMin + 5) return ts;
    }
    let best = CIPIE_TIME_SLOTS[0], bestDiff = Infinity;
    for (const ts of CIPIE_TIME_SLOTS) {
        const diff = Math.abs(mins - (ts.startH * 60 + ts.startM));
        if (diff < bestDiff) { bestDiff = diff; best = ts; }
    }
    return best;
}

import { query } from './src/lib/db.js';

(async () => {
  const sessions = await query('SELECT id, session_name, start_time, end_time FROM program_sessions WHERE conference_id = 11');
  for (const s of sessions) {
     const mapped = matchToTimeSlot(s.start_time);
     console.log(`${s.session_name}: ${s.start_time.toISOString().split('T')[1]} -> ${mapped.label}`);
  }
  process.exit(0);
})();
