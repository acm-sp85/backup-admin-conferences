'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTransition, useState, useEffect } from 'react';

export default function ParticipantsFilter({ conferences }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [conference, setConference] = useState(searchParams.get('conference') || '');
  const [status, setStatus] = useState(searchParams.get('status') || '');

  useEffect(() => {
    const timer = setTimeout(() => {
      updateFilters(search, conference, status);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const updateFilters = (s, c, st) => {
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

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  return (
    <div className="card p-3 mb-4 flex flex-col md:flex-row items-end gap-3">
      <div className="flex-1 w-full">
        <label className="block text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1.5">Search</label>
        <div className="relative">
          <input
            type="text"
            placeholder="Name, email..."
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

      <div className="w-full md:w-40">
        <label className="block text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1.5">Conference</label>
        <select
          value={conference}
          onChange={(e) => { setConference(e.target.value); updateFilters(search, e.target.value, status); }}
          className="input-base w-full"
        >
          <option value="">All</option>
          {conferences.map(conf => (
            <option key={conf.acronym} value={conf.acronym}>{conf.acronym}</option>
          ))}
        </select>
      </div>

      <div className="w-full md:w-40">
        <label className="block text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1.5">Payment</label>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); updateFilters(search, conference, e.target.value); }}
          className="input-base w-full"
        >
          <option value="">Any</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
          <option value="none">None</option>
        </select>
      </div>

      {(search || conference || status) && (
        <button
          onClick={() => { setSearch(''); setConference(''); setStatus(''); updateFilters('', '', ''); }}
          className="text-[10px] font-semibold text-[#ff3b30] hover:underline pb-[7px]"
        >
          Clear
        </button>
      )}
    </div>
  );
}
