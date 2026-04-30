'use client';

import { useState, useTransition } from 'react';
import { updateUserClusters } from '../actions/users';

export default function UserClustersSelect({ user, clusters }) {
  const [isPending, startTransition] = useTransition();
  const userClusters = user.cluster_for_review || [];

  const handleToggleCluster = (clusterId) => {
    let newClusters = [...userClusters];
    if (newClusters.includes(clusterId)) {
      newClusters = newClusters.filter(id => id !== clusterId);
    } else {
      newClusters.push(clusterId);
    }

    startTransition(async () => {
      await updateUserClusters(user.id, newClusters);
    });
  };

  if (user.role !== 'user') return null; // Only users review posters

  if (clusters.length === 0) {
    return <span className="text-xs text-slate-400">No clusters available</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {clusters.map(cluster => {
        const isSelected = userClusters.includes(cluster.id);
        return (
          <button
            key={cluster.id}
            disabled={isPending}
            onClick={() => handleToggleCluster(cluster.id)}
            className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
              isSelected 
                ? 'bg-indigo-100 text-indigo-700 border-indigo-200 hover:bg-indigo-200' 
                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
            } ${isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={`Toggle assignment to ${cluster.conference_acronym} - ${cluster.name}`}
          >
            {cluster.conference_acronym} / {cluster.name}
          </button>
        );
      })}
    </div>
  );
}
