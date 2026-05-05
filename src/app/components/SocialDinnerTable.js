'use client';

import { useState } from 'react';
import SocialDinnerRow from './SocialDinnerRow';

export default function SocialDinnerTable({ attendees }) {
  const [sortConfig, setSortConfig] = useState({ key: 'purchase_date', direction: 'desc' });

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const sortedAttendees = [...attendees].sort((a, b) => {
    let aVal = a[sortConfig.key] || '';
    let bVal = b[sortConfig.key] || '';

    // Handle string comparisons case-insensitively if applicable
    if (typeof aVal === 'string') aVal = aVal.toLowerCase();
    if (typeof bVal === 'string') bVal = bVal.toLowerCase();

    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const SortIcon = ({ column }) => {
    if (sortConfig.key !== column) return <span className="opacity-30 ml-1 text-[10px]">↕</span>;
    return <span className="ml-1 text-[var(--accent)] text-[10px]">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            <th 
              className="cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => handleSort('name')}
            >
              Name <SortIcon column="name" />
            </th>
            <th 
              className="cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => handleSort('email')}
            >
              Email <SortIcon column="email" />
            </th>
            <th 
              className="cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => handleSort('conference')}
            >
              Conference <SortIcon column="conference" />
            </th>
            <th 
              className="cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => handleSort('payment_status')}
            >
              Payment <SortIcon column="payment_status" />
            </th>
            <th 
              className="cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => handleSort('dietary_preference')}
            >
              Dietary Preference <SortIcon column="dietary_preference" />
            </th>
            <th className="text-right">Details</th>
          </tr>
        </thead>
        <tbody>
          {sortedAttendees.map((person) => (
            <SocialDinnerRow 
              key={person.id} 
              person={person} 
            />
          ))}
        </tbody>
      </table>
      
      {attendees.length === 0 && (
        <div className="p-10 text-center text-[var(--muted)] text-xs">
          No attendees found for the selected filters.
        </div>
      )}
    </div>
  );
}
