'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTransition, useState, useEffect } from 'react';

export default function SocialDinnerFilter({ conferences }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [conference, setConference] = useState(searchParams.get('conference') || '');

  useEffect(() => {
    const timer = setTimeout(() => {
      updateFilters(search, conference, searchParams.get('showAll') === 'true');
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const updateFilters = (s, c, showAll) => {
    const params = new URLSearchParams(searchParams);
    if (s) params.set('search', s); else params.delete('search');
    if (c) params.set('conference', c); else params.delete('conference');
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
