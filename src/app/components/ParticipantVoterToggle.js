'use client';

import { useTransition } from 'react';
import { toggleVoterStatus } from '../actions/participantVoting';

export default function ParticipantVoterToggle({ participantId, conferenceId, isVoter }) {
    const [isPending, startTransition] = useTransition();

    const handleToggle = () => {
        if (!conferenceId) {
            alert('Please select a conference filter first to manage voting power.');
            return;
        }
        startTransition(async () => {
            const res = await toggleVoterStatus(participantId, conferenceId);
            if (res?.error) {
                alert(res.error);
            }
        });
    };

    return (
        <button 
            onClick={handleToggle}
            disabled={isPending}
            className={`p-2 rounded-full transition-all duration-300 relative group ${
                isVoter 
                ? 'text-[var(--accent)] opacity-100' 
                : 'text-slate-400 opacity-20 hover:opacity-50'
            } ${isPending ? 'animate-pulse' : ''}`}
            title={isVoter ? "Revoke Voting Power" : "Grant Voting Power"}
        >
            {/* Subtle glow effect for enabled state */}
            {isVoter && (
                <span className="absolute inset-2 rounded-full bg-[var(--accent)] opacity-10 blur-sm group-hover:opacity-15 transition-all" />
            )}
            
            <svg 
                width="18" 
                height="18" 
                viewBox="0 0 24 24" 
                fill={isVoter ? "currentColor" : "none"} 
                stroke="currentColor" 
                strokeWidth="2.5" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                className="relative z-10"
            >
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <polyline points="16 11 18 13 22 9"/>
            </svg>
        </button>
    );
}
