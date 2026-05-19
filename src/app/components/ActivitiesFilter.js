'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTransition, useState } from 'react';

export default function ActivitiesFilter({ conferences }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [conference, setConference] = useState(searchParams.get('conference') || '');

  const updateFilters = (c) => {
    const params = new URLSearchParams(searchParams);
    if (c) {
      params.set('conference', c);
      document.cookie = `last_conference=${c}; path=/; max-age=31536000`;
    } else {
      params.delete('conference');
      document.cookie = `last_conference=; path=/; max-age=0`;
    }

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  return (
    <div className="card p-3 mb-4 flex items-end gap-3">
      <div className="w-full md:w-64">
        <label className="block text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1.5">Conference</label>
        <div className="relative">
            <select
            value={conference}
            onChange={(e) => { setConference(e.target.value); updateFilters(e.target.value); }}
            className="input-base w-full"
            disabled={isPending}
            >
            <option value="">Select a Conference...</option>
            {conferences.map(conf => (
                <option key={conf.acronym} value={conf.acronym}>{conf.acronym}</option>
            ))}
            </select>
            {isPending && (
                <div className="absolute right-8 top-1/2 -translate-y-1/2">
                    <div className="animate-spin rounded-full h-3 w-3 border-[1.5px] border-[var(--accent)] border-t-transparent"></div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
