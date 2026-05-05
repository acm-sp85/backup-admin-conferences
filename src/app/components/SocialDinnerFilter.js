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
      updateFilters(search, conference);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const updateFilters = (s, c) => {
    const params = new URLSearchParams(searchParams);
    if (s) params.set('search', s); else params.delete('search');
    if (c) params.set('conference', c); else params.delete('conference');

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  return (
    <div className="card p-3 mb-4 flex flex-col md:flex-row items-end gap-3">
      <div className="flex-1 w-full">
        <label className="block text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1.5">Search Name/Email</label>
        <div className="relative">
          <input
            type="text"
            placeholder="Search attendees..."
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

      <div className="w-full md:w-48">
        <label className="block text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1.5">Conference</label>
        <select
          value={conference}
          onChange={(e) => { setConference(e.target.value); updateFilters(search, e.target.value); }}
          className="input-base w-full"
        >
          <option value="">All Conferences</option>
          {conferences.map(conf => (
            <option key={conf.acronym} value={conf.acronym}>{conf.acronym}</option>
          ))}
        </select>
      </div>

      {(search || conference) && (
        <button
          onClick={() => { setSearch(''); setConference(''); updateFilters('', ''); }}
          className="text-[10px] font-semibold text-[#ff3b30] hover:underline pb-[7px]"
        >
          Clear
        </button>
      )}
    </div>
  );
}
