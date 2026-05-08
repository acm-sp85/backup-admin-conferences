'use client';

import { useTransition } from 'react';
import { toggleEmailsEnabled } from '../actions/conferences';

export default function CommunicationToggle({ conferenceId, initialStatus, isSuperAdmin }) {
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    if (!isSuperAdmin) return;
    startTransition(async () => {
      await toggleEmailsEnabled(conferenceId, initialStatus);
    });
  };

  const statusColor = initialStatus ? '#007aff' : '#ff9500';
  const statusBg = initialStatus ? '#e1f0ff' : '#fff4e5';

  return (
    <button 
      onClick={handleToggle}
      disabled={isPending || !isSuperAdmin}
      className={`badge transition-all ${!isSuperAdmin ? 'cursor-default' : isPending ? 'opacity-50' : 'hover:opacity-80 cursor-pointer'}`}
      style={{
        background: statusBg,
        color: statusColor,
      }}
      title={isSuperAdmin ? 'Toggle Communication Safety Lock' : 'Communication status (Superadmin only)'}
    >
      <span className="w-[5px] h-[5px] rounded-full" style={{ background: statusColor }}/>
      {isPending ? '...' : initialStatus ? 'Comms Active' : 'Comms Inactive'}
      {!isSuperAdmin && !initialStatus && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="ml-0.5"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      )}
    </button>
  );
}
