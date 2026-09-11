import { query } from '@/lib/db';
import CalendarView from './CalendarView';

export const metadata = {
  title: 'Calendar | Admin Conferencias'
};

export const dynamic = 'force-dynamic';

export default async function CalendarPage() {
  let conferences = [];
  try {
    const rows = await query('SELECT * FROM global_calendar ORDER BY start_date ASC');
    // Parse the deadlines JSON string if it exists
    conferences = rows.map(r => ({
      ...r,
      deadlines: r.deadlines ? JSON.parse(r.deadlines) : null
    }));
  } catch (error) {
    console.error('Failed to fetch calendar data:', error.message);
    // Table might not exist yet if script hasn't been run
  }

  return (
    <div className="flex flex-col h-full bg-[#fbfbfd]">
      <div className="px-8 py-6 border-b border-slate-100 bg-white shadow-sm z-10 relative">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Conferences Calendar</h1>
        <p className="text-sm text-slate-500 mt-1">Global view of all past and upcoming conferences</p>
      </div>
      <div className="flex-1 p-8 overflow-y-auto">
        {conferences.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto">
            <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-800 mb-2">No Calendar Data Found</h3>
            <p className="text-slate-500 text-sm mb-6">
              It looks like the global calendar hasn't been synced yet. Run the sync script to pull data from MongoDB.
            </p>
            <div className="bg-slate-900 text-white font-mono text-xs p-3 rounded-lg w-full">
              npm run sync-calendar
            </div>
          </div>
        ) : (
          <CalendarView initialConferences={conferences} />
        )}
      </div>
    </div>
  );
}
