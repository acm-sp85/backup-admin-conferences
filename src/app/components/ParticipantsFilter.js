'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTransition, useState, useEffect } from 'react';
import ConferenceGroupedOptions from '@/app/components/ConferenceGroupedOptions';

export default function ParticipantsFilter({ conferences, hideSearch = false, hideStatus = false }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [conference, setConference] = useState(searchParams.get('conference') || '');
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [showRemoved, setShowRemoved] = useState(searchParams.get('show_removed') === 'true');
  const [showManual, setShowManual] = useState(searchParams.get('show_manual') === 'true');

  useEffect(() => {
    setShowRemoved(searchParams.get('show_removed') === 'true');
    setShowManual(searchParams.get('show_manual') === 'true');
    setConference(searchParams.get('conference') || '');
    setStatus(searchParams.get('status') || '');
  }, [searchParams]);

  useEffect(() => {
    const timer = setTimeout(() => {
      updateFilters(search, conference, status, showRemoved, showManual);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const updateFilters = (s, c, st, sr, sm) => {
    const params = new URLSearchParams(searchParams);
    if (s) params.set('search', s); else params.delete('search');
    if (c) {
      params.set('conference', c);
      document.cookie = `last_conference=${c}; path=/; max-age=31536000`;
    } else {
      params.delete('conference');
      document.cookie = `last_conference=; path=/; max-age=0`;
    }
    if (st) params.set('status', st); else params.delete('status');
    if (sr) params.set('show_removed', 'true'); else params.delete('show_removed');
    if (sm) params.set('show_manual', 'true'); else params.delete('show_manual');

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  return (
    <div className="card p-3 mb-4 flex flex-col md:flex-row items-end gap-3">
      {!hideSearch && (
        <div className="flex-1 w-full">
          <label className="block text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1.5">Search</label>
          <div className="relative">
            <input
              type="text"
              placeholder="Name, email, user-type..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-base w-full"
            />
            {isPending && (
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                <div className="animate-spin rounded-full h-3 w-3 border-[1.5px] border-[var(--accent)] border-t-transparent"></div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className={`w-full ${!hideSearch ? 'md:w-40' : 'flex-1'}`}>
        <label className="block text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1.5">Conference</label>
        <select
          value={conference}
          onChange={(e) => { setConference(e.target.value); updateFilters(search, e.target.value, status, showRemoved, showManual); }}
          className="input-base w-full"
        >
          <option value="">All</option>
          <ConferenceGroupedOptions conferences={conferences} renderOption={conf => (<option key={conf.acronym} value={conf.acronym}>{conf.acronym}</option>)} />
        </select>
      </div>

      {!hideStatus && (
        <div className="w-full md:w-40">
          <label className="block text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1.5">Payment</label>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); updateFilters(search, conference, e.target.value, showRemoved, showManual); }}
            className="input-base w-full"
          >
            <option value="">Any</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="none">None</option>
          </select>
        </div>
      )}

      <div className="flex flex-col gap-1.5 pb-[5px]">
        <div className="flex items-center gap-2">
          <input 
            type="checkbox" 
            id="showManual" 
            checked={showManual} 
            onChange={(e) => { setShowManual(e.target.checked); updateFilters(search, conference, status, showRemoved, e.target.checked); }}
            className="rounded border-slate-300 text-[var(--accent)] focus:ring-[var(--accent)] cursor-pointer"
          />
          <label htmlFor="showManual" className="text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider cursor-pointer whitespace-nowrap">
            Added manually
          </label>
        </div>

        <div className="flex items-center gap-2">
          <input 
            type="checkbox" 
            id="showRemoved" 
            checked={showRemoved} 
            onChange={(e) => { setShowRemoved(e.target.checked); updateFilters(search, conference, status, e.target.checked, showManual); }}
            className="rounded border-slate-300 text-[var(--accent)] focus:ring-[var(--accent)] cursor-pointer"
          />
          <label htmlFor="showRemoved" className="text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider cursor-pointer whitespace-nowrap">
            Show removed
          </label>
        </div>
      </div>

      {(search || conference || status || showRemoved || showManual) && (
        <button
          onClick={() => { setSearch(''); setConference(''); setStatus(''); setShowRemoved(false); setShowManual(false); updateFilters('', '', '', false, false); }}
          className="text-[10px] font-semibold text-[#ff3b30] hover:underline pb-[7px]"
        >
          Clear
        </button>
      )}
    </div>
  );
}
