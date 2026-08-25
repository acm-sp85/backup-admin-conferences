'use client';

import { useState, useEffect } from 'react';
import { updateConferenceNotes } from '../actions/conferences';

export default function NotesModal({ isOpen, conference, onClose }) {
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (conference) {
      setNotes(conference.notes || '');
      setError(null);
    }
  }, [conference, isOpen]);

  if (!isOpen || !conference) return null;

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const res = await updateConferenceNotes(conference.id, notes);
      if (res.error) {
        setError(res.error);
      } else {
        onClose(true); // pass true to indicate it was saved
      }
    } catch (err) {
      setError('An unexpected error occurred.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white border border-[var(--border)] p-6 rounded-2xl shadow-2xl w-full max-w-lg animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Notes for {conference.acronym}</h2>
          <button 
            onClick={() => onClose()}
            className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors p-1"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/50 text-red-500 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="mb-4">
          <textarea
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl min-h-[200px] resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
            placeholder="Add some notes here..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button 
            type="button" 
            className="btn-secondary" 
            onClick={() => onClose()}
            disabled={isSaving}
          >
            Cancel
          </button>
          <button 
            type="button" 
            className="btn-primary" 
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Notes'}
          </button>
        </div>
      </div>
    </div>
  );
}
