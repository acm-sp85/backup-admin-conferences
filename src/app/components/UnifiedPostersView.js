'use client';

import { useState } from 'react';
import PosterManager from './PosterManager';
import ParticipantVotingManager from './ParticipantVotingManager';
import VotingResults from './VotingResults';

export default function UnifiedPostersView({ conferences, allClusters, userRole }) {
    const [activeTab, setActiveTab] = useState('posters');

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
            </div>

            <div className="page-enter">
                {activeTab === 'posters' ? (
                    <PosterManager conferences={conferences} />
                ) : activeTab === 'voting' ? (
                    <ParticipantVotingManager conferences={conferences} allClusters={allClusters} />
                ) : (
                    <VotingResults conferences={conferences} userRole={userRole} />
                )}
            </div>
        </div>
    );
}
