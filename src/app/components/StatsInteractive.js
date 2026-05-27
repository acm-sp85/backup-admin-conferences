'use client';
import { useState } from 'react';

export default function StatsInteractive({ total_registrations, total_checked_in, total_revenue, total_inferred, countriesData, countriesDataCheckedIn }) {
  const [filter, setFilter] = useState('all'); // 'all' or 'checked-in'

  const activeCountries = filter === 'all' ? countriesData : countriesDataCheckedIn;
  const activeTotal = filter === 'all' ? total_registrations : total_checked_in;

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        <div 
          onClick={() => setFilter('all')}
          className={`cursor-pointer bg-white p-6 rounded-2xl border shadow-sm transition-all ${filter === 'all' ? 'border-indigo-500 ring-2 ring-indigo-100' : 'border-slate-200/60 opacity-70 hover:opacity-100'}`}
        >
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Total Participants</h3>
          <p className="text-3xl font-black text-slate-800">{total_registrations}</p>
          {total_inferred > 0 && (
            <div className="text-[10px] text-indigo-500 font-medium mt-1 flex items-center gap-1">
              <span>🪄</span> {total_inferred} inferred from institution
            </div>
          )}
        </div>
        
        <div 
          onClick={() => setFilter('checked-in')}
          className={`cursor-pointer bg-white p-6 rounded-2xl border shadow-sm transition-all ${filter === 'checked-in' ? 'border-indigo-500 ring-2 ring-indigo-100' : 'border-slate-200/60 opacity-70 hover:opacity-100'}`}
        >
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Checked-in</h3>
          <p className="text-3xl font-black text-indigo-600">{total_checked_in}</p>
          <div className="text-[10px] text-slate-400 font-medium mt-1">
            {total_registrations > 0 ? Math.round((total_checked_in / total_registrations) * 100) : 0}% of total
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm opacity-70 cursor-default">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Total Revenue</h3>
          <p className="text-3xl font-black text-emerald-600">
            {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(total_revenue || 0)}
          </p>
        </div>
      </div>

      {activeCountries.length > 0 && (
        <div className="mt-8 bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm max-w-2xl">
          <h3 className="text-sm font-bold text-slate-800 mb-4">
            Participants by Country 
            <span className="text-xs font-normal text-slate-400 ml-2">({filter === 'all' ? 'All Registered' : 'Checked-in'})</span>
          </h3>
          <div className="space-y-3 pr-4">
            {activeCountries.map((c, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-32 text-xs font-medium text-slate-600 truncate" title={c.country}>{c.country}</div>
                <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
                  <div 
                    className="bg-indigo-500 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${(c.count / activeTotal) * 100}%` }}
                  />
                </div>
                <div className="w-8 text-right text-xs font-bold text-slate-700">{c.count}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
