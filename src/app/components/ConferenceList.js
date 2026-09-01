'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import VotingToggle from './VotingToggle';
import CommunicationToggle from './CommunicationToggle';
import ConferenceModal from './ConferenceModal';
import NotesModal from './NotesModal';
import { deleteConference } from '../actions/conferences';

export default function ConferenceList({ initialConferences, userRole }) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConference, setEditingConference] = useState(null);
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [notesConference, setNotesConference] = useState(null);
  const [conferences, setConferences] = useState(initialConferences);
  const searchParams = useSearchParams();
  const [initialTab, setInitialTab] = useState('general');

  // Sync state if server revalidates and sends new props
  useEffect(() => {
    setConferences(initialConferences);
  }, [initialConferences]);

  useEffect(() => {
    const editAcronym = searchParams.get('edit');
    const editTab = searchParams.get('tab');
    
    if (editAcronym) {
      const confToEdit = initialConferences.find(c => c.acronym === editAcronym);
      if (confToEdit) {
        setEditingConference(confToEdit);
        setInitialTab(editTab || 'general');
        setIsModalOpen(true);
      }
    }
  }, [searchParams, initialConferences]);

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
    if (searchParams.get('edit')) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('edit');
      params.delete('tab');
      router.replace(`/?${params.toString()}`);
    } else {
      router.refresh();
    }
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

  const handleOpenNotes = (conf) => {
    setNotesConference(conf);
    setIsNotesModalOpen(true);
  };

  const handleCloseNotesModal = (wasSaved) => {
    setIsNotesModalOpen(false);
    setNotesConference(null);
    if (wasSaved) {
      router.refresh();
    }
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const pastConferences = conferences.filter(conf => {
    if (!conf.end_date) return false;
    const endDate = new Date(conf.end_date);
    return endDate < today;
  }).sort((a, b) => new Date(b.end_date) - new Date(a.end_date));

  const ongoingFutureConferences = conferences.filter(conf => {
    if (!conf.end_date) return true;
    const endDate = new Date(conf.end_date);
    return endDate >= today;
  }).sort((a, b) => {
    if (!a.start_date) return 1;
    if (!b.start_date) return -1;
    return new Date(a.start_date) - new Date(b.start_date);
  });

  const formatDateRange = (start, end) => {
    if (!start && !end) return <span className="text-[var(--muted)]">TBA</span>;
    const formatOpts = { day: '2-digit', month: 'short', year: 'numeric' };
    const s = start ? new Date(start).toLocaleDateString('en-GB', formatOpts) : 'TBA';
    const e = end ? new Date(end).toLocaleDateString('en-GB', formatOpts) : 'TBA';
    if (s === e) return s;
    return `${s} - ${e}`;
  };

  const renderConferenceTable = (confList, emptyMessage) => (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            <th>Acronym</th>
            <th>Dates</th>
            <th>Comms & Voting</th>
            <th className="text-center">Notes</th>
            <th className="text-center">Report</th>
            <th className="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {confList.map((conf) => (
            <tr key={conf.id}>
              <td>
                <span className="badge" style={{background:'var(--accent-light)',color:'var(--accent)', textTransform: 'none'}}>
                  {conf.acronym}
                </span>
              </td>
              <td className="text-[var(--muted)] text-xs">
                {formatDateRange(conf.start_date, conf.end_date)}
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
              <td className="text-center">
                <button 
                  onClick={() => handleOpenNotes(conf)}
                  className={`transition-colors p-2 inline-flex rounded-md hover:bg-[var(--muted)]/10 ${conf.notes ? 'text-[#007aff]' : 'text-[var(--muted)]'}`}
                  title={conf.notes ? "View/Edit Notes" : "Add Notes"}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                </button>
              </td>
              <td className="text-center">
                <Link 
                  href={`/report/${conf.acronym}`}
                  className="transition-colors p-2 inline-flex rounded-md hover:bg-[var(--muted)]/10 text-[var(--muted)] hover:text-indigo-600"
                  title="View Report"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                </Link>
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
      {confList.length === 0 && (
        <div className="p-10 text-center text-[var(--muted)] text-xs">{emptyMessage}</div>
      )}
    </div>
  );

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

      <h3 className="text-lg font-medium mb-3">Active & Upcoming</h3>
      <div className="mb-8">
        {renderConferenceTable(ongoingFutureConferences, "No active or upcoming conferences found.")}
      </div>

      <h3 className="text-lg font-medium mb-3">Past Conferences</h3>
      <div className="mb-8">
        {renderConferenceTable(pastConferences, "No past conferences found.")}
      </div>

      <ConferenceModal 
        isOpen={isModalOpen} 
        conference={editingConference}
        initialTab={initialTab}
        onClose={handleCloseModal} 
      />

      <NotesModal
        isOpen={isNotesModalOpen}
        conference={notesConference}
        onClose={handleCloseNotesModal}
      />
    </>
  );
}
