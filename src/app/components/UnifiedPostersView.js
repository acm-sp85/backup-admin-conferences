'use client';

import { useState, useEffect } from 'react';
import PosterManager from './PosterManager';
import ParticipantVotingManager from './ParticipantVotingManager';
import VotingResults from './VotingResults';
import CustomVotingManager from './CustomVotingManager';
import ActiveVotingDaySelector from './ActiveVotingDaySelector';

export default function UnifiedPostersView({ conferences, allClusters, userRole }) {
    const [conferencesList, setConferencesList] = useState(conferences);
    const [activeTab, setActiveTab] = useState('posters');
    
    // Initialize cleanly without SSR hydration mismatch
    const [selectedConference, setSelectedConference] = useState(conferences[0]?.id || '');

    useEffect(() => {
        if (typeof document !== 'undefined') {
            const match = document.cookie.match(/(?:^|; )last_conference=([^;]*)/);
            const acronym = match ? decodeURIComponent(match[1]) : null;
            if (acronym) {
                const found = conferences.find(c => c.acronym === acronym);
                if (found) setSelectedConference(found.id);
            }
        }
    }, [conferences]);

    const handleConferenceChange = (id) => {
        setSelectedConference(id);
        const acronym = conferencesList.find(c => c.id == id)?.acronym;
        if (acronym) {
            document.cookie = `last_conference=${acronym}; path=/; max-age=31536000`;
        }
    };

    const handleConferenceUpdate = (updatedConf) => {
        setConferencesList(prev => prev.map(c => c.id === updatedConf.id ? { ...c, ...updatedConf } : c));
    };

    const currentConference = conferencesList.find(c => String(c.id) === String(selectedConference));
    const currentClusters = allClusters.filter(c => String(c.conference_id) === String(selectedConference));

    return (
        <div className="space-y-6">
            {/* Flashy Active Voting Day Selector */}
            <ActiveVotingDaySelector 
                conference={currentConference} 
                clusters={currentClusters} 
                onUpdate={handleConferenceUpdate} 
            />

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
