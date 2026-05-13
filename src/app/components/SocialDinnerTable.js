'use client';
import { useState, useTransition } from 'react';
import SocialDinnerRow from './SocialDinnerRow';
import { syncSocialDinnerTickets, sendSocialDinnerQR } from '../actions/social-dinner';
import { Loader2, Mail, RefreshCw, CheckCircle2 } from 'lucide-react';

export default function SocialDinnerTable({ attendees, userRole }) {
  const [sortConfig, setSortConfig] = useState({ key: 'purchase_date', direction: 'desc' });
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isSyncing, startSync] = useTransition();
  const [isSendingBulk, startSendingBulk] = useTransition();

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const toggleSelectAll = () => {
    if (selectedIds.size > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedAttendees.map(a => a.registration_id)));
    }
  };

  const toggleSelect = (registrationId) => {
    const next = new Set(selectedIds);
    if (next.has(registrationId)) next.delete(registrationId);
    else next.add(registrationId);
    setSelectedIds(next);
  };

  const handleSync = () => {
    startSync(async () => {
      const res = await syncSocialDinnerTickets();
      alert(`Sync complete! ${res.newTickets} new tickets found.`);
    });
  };

  const handleBulkEmail = () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Send QR code emails to ${selectedIds.size} participants?`)) return;

    startSendingBulk(async () => {
      let success = 0;
      let fail = 0;
      for (const id of selectedIds) {
        try {
          await sendSocialDinnerQR(id);
          success++;
          // Pace emails: wait 500ms between each
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (e) {
          fail++;
        }
      }
      alert(`Bulk send complete: ${success} successful, ${fail} failed.`);
      setSelectedIds(new Set());
    });
  };

  const sortedAttendees = [...attendees].sort((a, b) => {
    let aVal, bVal;
    
    if (sortConfig.key === 'scanned') {
      aVal = a.tickets_status?.filter(t => t.scanned_at).length || 0;
      bVal = b.tickets_status?.filter(t => t.scanned_at).length || 0;
    } else {
      aVal = a[sortConfig.key] || '';
      bVal = b[sortConfig.key] || '';
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
    }

    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const SortIcon = ({ column }) => {
    if (sortConfig.key !== column) return <span className="opacity-30 ml-1 text-[10px]">↕</span>;
    return <span className="ml-1 text-[var(--accent)] text-[10px]">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 h-9">
          {selectedIds.size > 0 ? (
            <button 
              onClick={handleBulkEmail}
              disabled={isSendingBulk}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-lg shadow-blue-100 transition-all disabled:opacity-50 animate-in fade-in zoom-in duration-200"
            >
              {isSendingBulk ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
              Send QR Codes ({selectedIds.size})
            </button>
          ) : (
            <div className="text-[10px] text-slate-400 font-medium px-1 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Tickets are automatically synced with master database
            </div>
          )}
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th className="w-10">
                <input 
                  type="checkbox" 
                  ref={(el) => {
                    if (el) {
                      el.indeterminate = selectedIds.size > 0 && selectedIds.size < sortedAttendees.length;
                    }
                  }}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  checked={selectedIds.size === sortedAttendees.length && sortedAttendees.length > 0}
                  onChange={toggleSelectAll}
                />
              </th>
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
              className="cursor-pointer hover:bg-slate-50 transition-colors text-center"
              onClick={() => handleSort('scanned')}
            >
              Scanned <SortIcon column="scanned" />
            </th>
            <th 
              className="cursor-pointer hover:bg-slate-50 transition-colors text-center"
              onClick={() => handleSort('ticket_count')}
            >
              # Tickets <SortIcon column="ticket_count" />
            </th>
            <th 
              className="cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => handleSort('dinner_debt')}
            >
              Payment / Debt <SortIcon column="dinner_debt" />
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
              userRole={userRole}
              selected={selectedIds.has(person.registration_id)}
              onSelect={() => toggleSelect(person.registration_id)}
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
    </div>
  );
}
