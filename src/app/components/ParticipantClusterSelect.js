'use client';

import { useState, useEffect } from 'react';
import { updateParticipantClusters } from '../actions/participantVoting';

export default function ParticipantClusterSelect({ participantId, conferenceId, currentClusters, allClusters, onUpdate }) {
    const parseClusters = (val) => {
        if (!val) return [];
        if (Array.isArray(val)) return val.map(Number);
        if (typeof val === 'string') {
            try {
                const parsed = JSON.parse(val);
                return Array.isArray(parsed) ? parsed.map(Number) : [];
            } catch (e) {
                return [];
            }
        }
        return [];
    };

    const [selected, setSelected] = useState(() => parseClusters(currentClusters));
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setSelected(parseClusters(currentClusters));
    }, [currentClusters]);

    const toggleCluster = async (clusterId) => {
        const id = Number(clusterId);
        const isAlreadySelected = selected.some(s => Number(s) === id);
        const newSelection = isAlreadySelected
            ? selected.filter(s => Number(s) !== id)
            : [...selected, id];
        
        // Ensure everything is a number
        const cleanSelection = newSelection.map(Number);
        
        setSelected(cleanSelection);
        setLoading(true);
        
        try {
            const result = await updateParticipantClusters(participantId, cleanSelection, conferenceId);
            if (result.success && onUpdate) {
                onUpdate();
            } else if (result.error) {
                alert(result.error);
                setSelected(parseClusters(currentClusters));
            }
        } catch (err) {
            alert('Failed to update clusters');
            setSelected(parseClusters(currentClusters));
        }
        setLoading(false);
    };

    return (
        <div className="flex flex-wrap gap-1.5">
            {allClusters.map(cluster => {
                const isSelected = selected.some(id => Number(id) === Number(cluster.id));
                return (
                    <button
                        key={cluster.id}
                        type="button"
                        onClick={() => toggleCluster(cluster.id)}
                        disabled={loading}
                        className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all border ${
                            isSelected
                                ? 'bg-[var(--accent)] border-[var(--accent)] text-white shadow-sm'
                                : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                        } ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-105 active:scale-95'}`}
                    >
                        {cluster.name}
                    </button>
                );
            })}
            {allClusters.length === 0 && (
                <span className="text-slate-300 text-[10px] italic font-medium">No clusters found</span>
            )}
        </div>
    );
}
