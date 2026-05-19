'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Calendar, Trash2, Edit2, Plus, Users, Clock } from 'lucide-react';
import { createActivity, deleteActivity, updateActivity } from '@/app/actions/activities';

export default function ActivitiesManager({ activities, conferenceId }) {
    const [isCreating, setIsCreating] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Form state
    const [name, setName] = useState('');
    const [date, setDate] = useState('');
    const [description, setDescription] = useState('');

    const openCreate = () => {
        setIsCreating(true);
        setEditingId(null);
        setName('');
        setDate('');
        setDescription('');
    };

    const openEdit = (activity) => {
        setEditingId(activity.id);
        setIsCreating(false);
        setName(activity.name);
        
        // Format date for datetime-local input if exists
        let formattedDate = '';
        if (activity.date) {
            const d = new Date(activity.date);
            // Adjust for local timezone to display correctly in input
            d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
            formattedDate = d.toISOString().slice(0, 16);
        }
        
        setDate(formattedDate);
        setDescription(activity.description || '');
    };

    const cancelForm = () => {
        setIsCreating(false);
        setEditingId(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) return;

        try {
            setIsSubmitting(true);
            if (editingId) {
                await updateActivity(editingId, name, date || null, description);
            } else {
                await createActivity(conferenceId, name, date || null, description);
            }
            cancelForm();
        } catch (error) {
            alert(`Error ${editingId ? 'updating' : 'creating'} activity: ` + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id, name) => {
        if (!confirm(`Are you sure you want to delete "${name}"? This will also remove all its attendees and check-in data.`)) return;
        
        try {
            await deleteActivity(id);
            if (editingId === id) cancelForm();
        } catch (error) {
            alert('Error deleting activity: ' + error.message);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Extra Activities</h3>
                <button 
                    onClick={openCreate}
                    className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                >
                    <Plus className="w-4 h-4" />
                    Create Activity
                </button>
            </div>

            {(isCreating || editingId) && (
                <div className="card p-5 animate-in fade-in slide-in-from-top-4 border-l-4 border-l-[var(--accent)]">
                    <h4 className="font-medium mb-4">{editingId ? 'Edit Activity' : 'Create New Activity'}</h4>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium mb-1.5 text-[var(--muted)]">Activity Name *</label>
                                <input 
                                    type="text" 
                                    value={name} 
                                    onChange={e => setName(e.target.value)} 
                                    className="input-base w-full" 
                                    placeholder="e.g. Gala Dinner, Workshop A"
                                    required 
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1.5 text-[var(--muted)]">Date & Time</label>
                                <input 
                                    type="datetime-local" 
                                    value={date} 
                                    onChange={e => setDate(e.target.value)} 
                                    className="input-base w-full" 
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1.5 text-[var(--muted)]">Description (Optional)</label>
                            <textarea 
                                value={description} 
                                onChange={e => setDescription(e.target.value)} 
                                className="input-base w-full min-h-[80px]" 
                                placeholder="Short description of the activity..."
                            />
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                            <button 
                                type="button" 
                                onClick={cancelForm}
                                className="px-4 py-2 text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
                            >
                                Cancel
                            </button>
                            <button 
                                type="submit" 
                                disabled={isSubmitting || !name.trim()}
                                className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
                            >
                                {isSubmitting ? 'Saving...' : (editingId ? 'Save Changes' : 'Create')}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activities.map(activity => (
                    <div key={activity.id} className="card p-5 flex flex-col hover:border-[var(--accent)] transition-colors group">
                        <div className="flex justify-between items-start mb-3">
                            <h4 className="font-semibold text-base leading-tight group-hover:text-[var(--accent)] transition-colors">
                                <Link href={`/activities/${activity.id}`}>
                                    {activity.name}
                                </Link>
                            </h4>
                            <div className="flex items-center">
                                <button 
                                    onClick={() => openEdit(activity)}
                                    className="text-[var(--muted)] hover:text-[var(--accent)] transition-colors p-1"
                                    title="Edit Activity"
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button 
                                    onClick={() => handleDelete(activity.id, activity.name)}
                                    className="text-[var(--muted)] hover:text-red-500 transition-colors p-1"
                                    title="Delete Activity"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        
                        {activity.date && (
                            <div className="flex items-center gap-2 text-xs text-[var(--muted)] mb-3">
                                <Clock className="w-3.5 h-3.5" />
                                {new Date(activity.date).toLocaleString()}
                            </div>
                        )}
                        
                        {activity.description && (
                            <p className="text-sm text-[var(--muted)] mb-4 line-clamp-2 flex-1">
                                {activity.description}
                            </p>
                        )}
                        
                        {!activity.description && <div className="flex-1" />}

                        <div className="mt-4 pt-4 border-t border-[var(--border)] flex justify-between items-center">
                            <div className="flex items-center gap-1.5 text-xs font-medium">
                                <Users className="w-4 h-4 text-[var(--muted)]" />
                                <span>{activity.attendee_count} Attendees</span>
                            </div>
                            <Link 
                                href={`/activities/${activity.id}`}
                                className="text-xs font-semibold text-[var(--accent)] hover:underline"
                            >
                                Manage &rarr;
                            </Link>
                        </div>
                    </div>
                ))}

                {activities.length === 0 && !isCreating && !editingId && (
                    <div className="col-span-full p-8 text-center border-2 border-dashed border-[var(--border)] rounded-xl text-[var(--muted)] text-sm">
                        No activities created for this conference yet.
                    </div>
                )}
            </div>
        </div>
    );
}
