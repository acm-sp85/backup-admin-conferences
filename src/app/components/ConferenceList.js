'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import VotingToggle from './VotingToggle';
import CommunicationToggle from './CommunicationToggle';
import ConferenceModal from './ConferenceModal';
import { deleteConference } from '../actions/conferences';

export default function ConferenceList({ initialConferences, userRole }) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConference, setEditingConference] = useState(null);
  const [conferences, setConferences] = useState(initialConferences);

  // Sync state if server revalidates and sends new props
  useEffect(() => {
    setConferences(initialConferences);
  }, [initialConferences]);

  const isSuperAdmin = userRole === 'superadmin';

  const handleCreateNew = () => {
    setEditingConference(null);
    setIsModalOpen(true);
  };

  const handleEdit = (conf) => {
    setEditingConference(conf);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingConference(null);
    router.refresh();
  };

  const handleDelete = async (id, acronym) => {
    if (!confirm(`Are you sure you want to delete ${acronym}? This will remove all associated data.`)) return;
    
    const res = await deleteConference(id);
    if (res.success) {
        router.refresh();
    } else {
        alert(res.error);
    }
  };

  return (
    <>
      <header className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Conferences</h2>
          <p className="text-[var(--muted)] text-xs mt-0.5">Manage your active and upcoming events</p>
        </div>
        {isSuperAdmin && (
          <button 
            onClick={handleCreateNew}
            className="btn-primary"
          >
            + New Conference
          </button>
        )}
      </header>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Acronym</th>
              <th>Conference Name</th>
              <th>Created</th>
              <th>Comms & Voting</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {conferences.map((conf) => (
              <tr key={conf.id}>
                <td>
                  <span className="badge" style={{background:'var(--accent-light)',color:'var(--accent)'}}>
                    {conf.acronym}
                  </span>
                </td>
                <td>
                  <span className="font-medium text-[var(--foreground)]">{conf.name}</span>
                </td>
                <td className="text-[var(--muted)] text-xs">
                  {new Date(conf.created_at + 'Z').toLocaleDateString('en-GB')}
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    <CommunicationToggle 
                      conferenceId={conf.id} 
                      initialStatus={conf.emails_enabled} 
                      isSuperAdmin={isSuperAdmin}
                    />
                    <VotingToggle 
                      conferenceId={conf.id} 
                      initialStatus={conf.voting_window_open} 
                    />
                  </div>
                </td>
                <td className="text-right">
                  <button 
                    onClick={() => handleEdit(conf)}
                    className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors p-1 inline-flex"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  {isSuperAdmin && (
                    <button 
                        onClick={() => handleDelete(conf.id, conf.acronym)}
                        className="text-[var(--muted)] hover:text-[#ff3b30] transition-colors p-1 inline-flex ml-0.5"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {conferences.length === 0 && (
          <div className="p-10 text-center text-[var(--muted)] text-xs">No conferences found.</div>
        )}
      </div>

      <ConferenceModal 
        isOpen={isModalOpen} 
        conference={editingConference}
        onClose={handleCloseModal} 
      />
    </>
  );
}
