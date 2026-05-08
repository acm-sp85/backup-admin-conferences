'use client';

import { useTransition } from 'react';
import { toggleVotingWindow } from '../actions/conferences';

export default function VotingToggle({ conferenceId, initialStatus }) {
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    startTransition(async () => {
      await toggleVotingWindow(conferenceId, initialStatus);
    });
  };

  return (
    <button 
      onClick={handleToggle}
      disabled={isPending}
      className={`badge transition-all cursor-pointer ${isPending ? 'opacity-50' : 'hover:opacity-80'}`}
      style={{
        background: initialStatus ? '#e8faf0' : '#f5f5f7',
        color: initialStatus ? '#34c759' : '#86868b',
      }}
    >
      <span className="w-[5px] h-[5px] rounded-full" style={{ background: initialStatus ? '#34c759' : '#aeaeb2' }}/>
      {isPending ? '...' : initialStatus ? 'Voting Open' : 'Voting Closed'}
    </button>
  );
}
