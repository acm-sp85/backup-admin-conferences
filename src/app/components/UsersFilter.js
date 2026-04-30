'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function UsersFilter() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [search, setSearch] = useState(searchParams.get('search') || '');
    const [showAll, setShowAll] = useState(searchParams.get('showAll') === 'true');

    const handleSearch = (val) => {
        setSearch(val);
        const params = new URLSearchParams(searchParams);
        if (val) params.set('search', val);
        else params.delete('search');
        router.push(`${pathname}?${params.toString()}`);
    };

    const handleToggle = (checked) => {
        setShowAll(checked);
        const params = new URLSearchParams(searchParams);
        if (checked) params.set('showAll', 'true');
        else params.delete('showAll');
        router.push(`${pathname}?${params.toString()}`);
    };

    return (
        <div className="card p-4 mb-6">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex-1 w-full relative">
                    <input 
                        type="text" 
                        placeholder="Search by name or email..."
                        value={search}
                        onChange={(e) => handleSearch(e.target.value)}
                        className="input-base w-full pl-10"
                    />
                </div>
                
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-100 whitespace-nowrap">
                    <input 
                        type="checkbox" 
                        id="showAll"
                        checked={showAll}
                        onChange={(e) => handleToggle(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-[var(--accent)] focus:ring-[var(--accent)]"
                    />
                    <label htmlFor="showAll" className="text-xs font-semibold text-slate-600 cursor-pointer select-none">
                        Show Regular Users
                    </label>
                </div>
            </div>
        </div>
    );
}
