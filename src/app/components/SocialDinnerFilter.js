'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTransition, useState, useEffect } from 'react';

export default function SocialDinnerFilter({ conferences, attendees }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [conference, setConference] = useState(searchParams.get('conference') || '');

  const exportToCSV = () => {
    if (!attendees || attendees.length === 0) return;
    
    const headers = ['Name', 'Email', 'Conference', 'Payment Status', 'Dietary Preference', 'Amount', 'Currency', 'Invoice', 'Date'];
    
    const rows = attendees.map(a => [
      a.name,
      a.email,
      a.conference,
      a.payment_status,
      a.dietary_preference,
      a.amount_paid,
      a.currency,
      a.invoice_code,
      new Date(a.purchase_date).toLocaleDateString()
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `social_dinner_attendees_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      updateFilters(search, conference, searchParams.get('showAll') === 'true');
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const updateFilters = (s, c, showAll) => {
    const params = new URLSearchParams(searchParams);
    if (s) params.set('search', s); else params.delete('search');
    if (c) {
      params.set('conference', c);
      document.cookie = `last_conference=${c}; path=/; max-age=31536000`;
    } else {
      params.delete('conference');
      document.cookie = `last_conference=; path=/; max-age=0`;
    }
    if (showAll) params.set('showAll', 'true'); else params.delete('showAll');

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  return (
    <div className="card p-3 mb-4 flex flex-wrap md:flex-nowrap items-center gap-4">
      {/* Search */}
      <div className="flex-1 min-w-[200px]">
        <div className="relative">
          <input
            type="text"
            placeholder="Search name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-base w-full h-9 text-xs"
          />
          {isPending && (
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
              <div className="animate-spin rounded-full h-3 w-3 border-[1.5px] border-[var(--accent)] border-t-transparent"></div>
            </div>
          )}
        </div>
      </div>

      {/* Conference */}
      <div className="w-full md:w-48">
        <select
          value={conference}
          onChange={(e) => { setConference(e.target.value); updateFilters(search, e.target.value, searchParams.get('showAll') === 'true'); }}
          className="input-base w-full h-9 text-xs font-medium"
        >
          <option value="">All Conferences</option>
          {conferences.map(conf => (
            <option key={conf.acronym} value={conf.acronym}>{conf.acronym}</option>
          ))}
        </select>
      </div>

      {/* Checkbox */}
      <div className="flex items-center gap-2 whitespace-nowrap bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 h-9">
        <input 
          type="checkbox" 
          id="showAll"
          checked={searchParams.get('showAll') === 'true'}
          onChange={(e) => updateFilters(search, conference, e.target.checked)}
          className="w-3.5 h-3.5 rounded border-slate-300 text-[var(--accent)] focus:ring-[var(--accent)]"
        />
        <label htmlFor="showAll" className="text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider cursor-pointer select-none">
          Show Duplicate Records
        </label>
      </div>

      {/* Export Button */}
      <button
        onClick={exportToCSV}
        className="flex items-center gap-2 bg-[#0071e3] hover:bg-[#0077ed] text-white px-3 py-1.5 rounded-lg h-9 transition-colors group shadow-sm"
        title="Export current results to CSV"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:translate-y-0.5 transition-transform"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
        <span className="text-[10px] font-bold uppercase tracking-wider">Export CSV</span>
      </button>

      {/* Clear Button */}
      {(search || conference || searchParams.get('showAll')) && (
        <button
          onClick={() => { setSearch(''); setConference(''); updateFilters('', '', false); }}
          className="text-[10px] font-bold text-[#ff3b30] hover:text-red-600 transition-colors uppercase tracking-widest px-2"
        >
          Clear
        </button>
      )}
    </div>
  );
}
