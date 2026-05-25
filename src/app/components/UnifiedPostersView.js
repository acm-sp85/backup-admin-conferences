'use client';

import { useState } from 'react';
import PosterManager from './PosterManager';
import ParticipantVotingManager from './ParticipantVotingManager';
import VotingResults from './VotingResults';
import CustomVotingManager from './CustomVotingManager';

export default function UnifiedPostersView({ conferences, allClusters, userRole }) {
    const [activeTab, setActiveTab] = useState('posters');
    
    // Initialize from cookie if available
    const [selectedConference, setSelectedConference] = useState(() => {
        if (typeof document !== 'undefined') {
            const match = document.cookie.match(/(?:^|; )last_conference=([^;]*)/);
            const acronym = match ? decodeURIComponent(match[1]) : null;
            if (acronym) {
                const found = conferences.find(c => c.acronym === acronym);
                if (found) return found.id;
            }
        }
        return conferences[0]?.id || '';
    });

    const handleConferenceChange = (id) => {
        setSelectedConference(id);
        const acronym = conferences.find(c => c.id == id)?.acronym;
        if (acronym) {
            document.cookie = `last_conference=${acronym}; path=/; max-age=31536000`;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex border-b border-[var(--border)] mb-4">
                <button
                    onClick={() => setActiveTab('posters')}
                    className={`px-6 py-3 text-[12px] font-semibold transition-all relative ${
                        activeTab === 'posters' 
                        ? 'text-[var(--accent)]' 
                        : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                    }`}
                >
                    Posters & Clusters
                    {activeTab === 'posters' && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent)]" />
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('voting')}
                    className={`px-6 py-3 text-[12px] font-semibold transition-all relative ${
                        activeTab === 'voting' 
                        ? 'text-[var(--accent)]' 
                        : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                    }`}
                >
                    Voting Management
                    {activeTab === 'voting' && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent)]" />
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('results')}
                    className={`px-6 py-3 text-[12px] font-semibold transition-all relative ${
                        activeTab === 'results' 
                        ? 'text-[var(--accent)]' 
                        : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                    }`}
                >
                    Results
                    {activeTab === 'results' && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent)]" />
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('custom')}
                    className={`px-6 py-3 text-[12px] font-semibold transition-all relative ${
                        activeTab === 'custom' 
                        ? 'text-[var(--accent)]' 
                        : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                    }`}
                >
                    Custom Voting
                    {activeTab === 'custom' && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent)]" />
                    )}
                </button>
            </div>

            <div className="page-enter">
                {activeTab === 'posters' ? (
                    <PosterManager 
                        conferences={conferences} 
                        selectedConference={selectedConference}
                        onConferenceChange={handleConferenceChange}
                    />
                ) : activeTab === 'voting' ? (
                    <ParticipantVotingManager 
                        conferences={conferences} 
                        allClusters={allClusters}
                        selectedConference={selectedConference}
                        onConferenceChange={handleConferenceChange}
                    />
                ) : activeTab === 'results' ? (
                    <VotingResults 
                        conferences={conferences} 
                        userRole={userRole}
                        selectedConference={selectedConference}
                        onConferenceChange={handleConferenceChange}
                    />
                ) : (
                    <CustomVotingManager 
                        conferences={conferences} 
                        userRole={userRole}
                        selectedConference={selectedConference}
                        onConferenceChange={handleConferenceChange}
                    />
                )}
            </div>
        </div>
    );
}
