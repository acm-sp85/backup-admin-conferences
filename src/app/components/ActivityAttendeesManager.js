'use client';

import { useState, useTransition } from 'react';
import { Mail, Search, Upload, Download, Plus, Trash2, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { 
    addAttendeeManual, 
    importCSVAttendees, 
    removeAttendee, 
    manualCheckinActivity, 
    resetCheckinActivity, 
    sendActivityQREmail,
    searchConferenceParticipantsLocal,
    updateActivityEmailTemplate,
    updateAttendeeTicketsCount
} from '@/app/actions/activities';
import ActivityQRBadge from './ActivityQRBadge';

export default function ActivityAttendeesManager({ activityId, conferenceId, initialAttendees, activityName, initialEmailTemplate }) {
    const [attendees, setAttendees] = useState(initialAttendees);
    const [isAdding, setIsAdding] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    
    // Email Template State
    const [emailSubject, setEmailSubject] = useState(initialEmailTemplate?.subject || '');
    const [emailBody, setEmailBody] = useState(initialEmailTemplate?.body || '');
    const [includeQr, setIncludeQr] = useState(initialEmailTemplate?.includeQr ?? true);
    const [isSavingEmail, setIsSavingEmail] = useState(false);
    const [previewMode, setPreviewMode] = useState(false);
    
    // Add Manual State
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [customName, setCustomName] = useState('');
    const [customEmail, setCustomEmail] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // CSV Import State
    const [csvText, setCsvText] = useState('');
    const [importingStatus, setImportingStatus] = useState('');

    // Bulk selection state
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [isSendingBulk, startSendingBulk] = useTransition();

    // Sorting & Ticket Management state
    const [sortBy, setSortBy] = useState('date');
    const [isUpdatingTickets, setIsUpdatingTickets] = useState(null);

    const handleSearch = async (e) => {
        const q = e.target.value;
        setSearchQuery(q);
        if (q.length < 3) {
            setSearchResults([]);
            return;
        }
        setIsSearching(true);
        try {
            const results = await searchConferenceParticipantsLocal(conferenceId, q);
            setSearchResults(results);
        } catch (error) {
            console.error(error);
        } finally {
            setIsSearching(false);
        }
    };

    const handleAddParticipant = async (participant) => {
        try {
            setIsSubmitting(true);
            await addAttendeeManual(activityId, participant.participant_id, participant.name, participant.email);
            window.location.reload(); 
        } catch (error) {
            alert(error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAddCustom = async (e) => {
        e.preventDefault();
        try {
            setIsSubmitting(true);
            await addAttendeeManual(activityId, null, customName, customEmail);
            window.location.reload();
        } catch (error) {
            alert(error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleImportCSV = async () => {
        if (!csvText.trim()) return;
        const emails = csvText.split('\n')
            .map(e => e.trim())
            .filter(e => e.length > 0 && e.includes('@'));
        
        if (emails.length === 0) {
            alert('No valid emails found.');
            return;
        }

        try {
            setImportingStatus(`Importing ${emails.length} attendees...`);
            const res = await importCSVAttendees(activityId, conferenceId, emails);
            alert(`Successfully imported ${res.count} new attendees.`);
            window.location.reload();
        } catch (error) {
            alert(error.message);
        } finally {
            setImportingStatus('');
            setIsImporting(false);
            setCsvText('');
        }
    };

    const handleDelete = async (id, name) => {
        if (!confirm(`Remove ${name} from this activity?`)) return;
        try {
            await removeAttendee(id, activityId);
            setAttendees(attendees.filter(a => a.id !== id));
            if (selectedIds.has(id)) {
                const next = new Set(selectedIds);
                next.delete(id);
                setSelectedIds(next);
            }
        } catch (e) {
            alert(e.message);
        }
    };

    const handleSendEmail = async (id) => {
        try {
            alert('Sending email... this might take a few seconds.');
            await sendActivityQREmail(id, activityId);
            alert('Email sent successfully!');
            window.location.reload();
        } catch (e) {
            alert('Error sending email: ' + e.message);
        }
    };

    const handleManualCheckin = async (id) => {
        try {
            await manualCheckinActivity(id, activityId);
            window.location.reload();
        } catch (e) {
            alert(e.message);
        }
    };

    const handleResetCheckin = async (id) => {
        try {
            await resetCheckinActivity(id, activityId);
            window.location.reload();
        } catch (e) {
            alert(e.message);
        }
    };

    const handleSaveEmailTemplate = async () => {
        setIsSavingEmail(true);
        try {
            await updateActivityEmailTemplate(activityId, emailSubject, emailBody, includeQr);
            alert('Email template saved successfully!');
        } catch (e) {
            alert('Error saving email template: ' + e.message);
        } finally {
            setIsSavingEmail(false);
        }
    };

    // Bulk Actions
    const toggleSelectAll = () => {
        if (selectedIds.size > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(attendees.map(a => a.id)));
        }
    };

    const toggleSelect = (id) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const handleBulkEmail = () => {
        if (selectedIds.size === 0) return;
        if (!confirm(`Send QR code emails to ${selectedIds.size} attendees?`)) return;

        startSendingBulk(async () => {
            let success = 0;
            let fail = 0;
            for (const id of selectedIds) {
                try {
                    await sendActivityQREmail(id, activityId);
                    success++;
                    // Pace emails to avoid rate limits
                    await new Promise(resolve => setTimeout(resolve, 500));
                } catch (e) {
                    fail++;
                }
            }
            alert(`Bulk send complete: ${success} successful, ${fail} failed.`);
            window.location.reload();
        });
    };

    const handleExportCSV = () => {
        const headers = ['First Name', 'Last Name', 'Email', 'Tickets Count', 'Checked In', 'Checked In At', 'Email Sent At', 'Registration Type'];
        const rows = attendees.map(a => {
            let firstName = a.firstName || '';
            let lastName = a.lastName || '';
            if (!a.firstName && !a.lastName && a.name) {
                const parts = a.name.split(' ');
                firstName = parts[0];
                lastName = parts.slice(1).join(' ');
            }
            return [
                firstName,
                lastName,
                a.email,
                a.tickets_count || 1,
                a.scanned_at ? 'Yes' : 'No',
                a.scanned_at ? new Date(a.scanned_at).toLocaleString('en-US', { hour12: false }) : '',
                a.email_sent_at ? new Date(a.email_sent_at).toLocaleString('en-US', { hour12: false }) : '',
                a.participant_id ? 'Conference Participant' : 'Custom'
            ];
        });

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `${activityName.toLowerCase().replace(/\s+/g, '_')}_attendees.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleUpdateTickets = async (attendeeId, newCount) => {
        if (newCount < 1) return;
        setIsUpdatingTickets(attendeeId);
        try {
            await updateAttendeeTicketsCount(attendeeId, newCount);
            setAttendees(prev => prev.map(a => a.id === attendeeId ? { ...a, tickets_count: newCount } : a));
        } catch (e) {
            alert(e.message || 'Failed to update tickets');
        } finally {
            setIsUpdatingTickets(null);
        }
    };

    const sortedAttendees = [...attendees].sort((a, b) => {
        if (sortBy === 'conf-first') {
            const aType = a.participant_id ? 0 : 1;
            const bType = b.participant_id ? 0 : 1;
            return aType - bType;
        }
        if (sortBy === 'custom-first') {
            const aType = a.participant_id ? 1 : 0;
            const bType = b.participant_id ? 1 : 0;
            return aType - bType;
        }
        if (sortBy === 'name-asc') {
            return a.name.localeCompare(b.name);
        }
        // Default: date (already DESC from DB, let's keep original order)
        return 0;
    });

    return (
        <div className="space-y-6">
            <div className="card p-5 border border-[var(--border)] bg-slate-50/30">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h4 className="font-semibold text-sm">Email Template Settings</h4>
                        <p className="text-xs text-[var(--muted)] mt-0.5">Customize the email sent to attendees when delivering their QR ticket.</p>
                    </div>
                    <div className="flex gap-2">
                        <div className="flex bg-slate-200/50 p-1 rounded-lg">
                            <button
                                onClick={() => setPreviewMode(false)}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${!previewMode ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Edit
                            </button>
                            <button
                                onClick={() => setPreviewMode(true)}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${previewMode ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Preview
                            </button>
                        </div>
                        <button 
                            onClick={handleSaveEmailTemplate}
                            disabled={isSavingEmail}
                            className="px-4 py-2 bg-black text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-all disabled:opacity-50 shrink-0"
                        >
                            {isSavingEmail ? 'Saving...' : 'Save Settings'}
                        </button>
                    </div>
                </div>

                {!previewMode ? (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1.5">Email Subject</label>
                            <input 
                                type="text"
                                value={emailSubject}
                                onChange={(e) => setEmailSubject(e.target.value)}
                                className="input-base w-full bg-white text-sm"
                                placeholder={`e.g. Your ticket for ${activityName}`}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1.5">Email Body (HTML supported)</label>
                            <div className="mb-2 text-xs text-slate-500 flex flex-wrap gap-2">
                                <span>Variables:</span>
                                <code className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-700">{'${name}'}</code>
                                <code className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-700">{'${activityName}'}</code>
                                <code className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-700">{'${tickets}'}</code>
                                <code className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-700">{'${qrCode}'}</code> (optional custom placement)
                            </div>
                            <textarea 
                                value={emailBody}
                                onChange={(e) => setEmailBody(e.target.value)}
                                className="input-base w-full min-h-[160px] font-mono text-xs bg-white leading-relaxed"
                                placeholder={`<p>Hello \${name},</p>\n<p>Here is your ticket for \${activityName}.</p>`}
                            />
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer mt-4 border-t pt-4">
                            <input 
                                type="checkbox"
                                checked={includeQr}
                                onChange={(e) => setIncludeQr(e.target.checked)}
                                className="w-4 h-4 rounded border-gray-300 text-[var(--accent)] focus:ring-[var(--accent)]"
                            />
                            <div className="flex flex-col">
                                <span className="text-sm font-medium text-slate-900">Include QR Code</span>
                                <span className="text-xs text-slate-500">If checked, a large QR code will be generated and embedded in the email automatically.</span>
                            </div>
                        </label>
                    </div>
                ) : (
                    <div className="bg-white border rounded-lg p-6 max-w-2xl mx-auto shadow-sm">
                        <div className="border-b pb-4 mb-4">
                            <div className="text-sm"><strong>Subject:</strong> {emailSubject ? emailSubject.replace(/\$\{name\}/g, 'John Doe').replace(/\$\{activityName\}/g, activityName).replace(/\$\{tickets\}/g, '2') : `Your QR Ticket for ${activityName}`}</div>
                        </div>
                        <div className="prose prose-sm max-w-none text-slate-700"
                            dangerouslySetInnerHTML={{ 
                                __html: (emailBody || `<p>Hello \${name},</p><p>You are registered for <strong>\${activityName}</strong>.</p>`)
                                    .replace(/\$\{name\}/g, 'John Doe')
                                    .replace(/\$\{activityName\}/g, activityName)
                                    .replace(/\$\{tickets\}/g, '2')
                                    .replace(/\$\{qrCode\}/g, includeQr ? '<div style="margin:20px 0;text-align:center;padding:20px;background:#f5f5f7;border-radius:12px;"><div style="width:150px;height:150px;background:#ddd;margin:0 auto;display:flex;align-items:center;justify-content:center;color:#666">[QR CODE HERE]</div></div>' : '') 
                            }} 
                        />
                        {includeQr && !emailBody.includes('${qrCode}') && (
                            <div style={{ margin: '20px 0', textAlign: 'center', padding: '20px', background: '#f5f5f7', borderRadius: '12px' }}>
                                <div style={{ width: '150px', height: '150px', background: '#ddd', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>[QR CODE HERE]</div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-[var(--border)] shadow-sm">
                <div className="flex items-center gap-3 h-9">
                    {selectedIds.size > 0 ? (
                        <button 
                            onClick={handleBulkEmail}
                            disabled={isSendingBulk}
                            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-lg shadow-blue-100 transition-all disabled:opacity-50 animate-in fade-in zoom-in duration-200"
                        >
                            {isSendingBulk ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
                            Send QR Codes ({selectedIds.size})
                        </button>
                    ) : (
                        <h3 className="text-lg font-medium px-2">Attendees List</h3>
                    )}
                </div>
                <div className="flex gap-2 items-center">
                    <select 
                        value={sortBy} 
                        onChange={(e) => setSortBy(e.target.value)} 
                        className="px-2.5 py-1.5 border border-slate-200 text-slate-700 rounded-md text-xs font-medium bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                        <option value="date">Sort: Date Added</option>
                        <option value="conf-first">Sort: Conf. Participant First</option>
                        <option value="custom-first">Sort: Custom First</option>
                        <option value="name-asc">Sort: Name (A-Z)</option>
                    </select>

                    <button 
                        onClick={handleExportCSV}
                        className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 text-slate-700 rounded-md text-xs font-medium hover:bg-slate-50 transition-colors"
                    >
                        <Download className="w-3.5 h-3.5 text-slate-500" />
                        Export CSV
                    </button>
                    <button 
                        onClick={() => setIsImporting(true)}
                        className="flex items-center gap-2 px-3 py-1.5 border border-[var(--border)] rounded-md text-xs font-medium hover:bg-[var(--hover)] transition-colors"
                    >
                        <Upload className="w-3.5 h-3.5 text-slate-500" />
                        Import CSV
                    </button>
                    <button 
                        onClick={() => setIsAdding(true)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-[var(--foreground)] text-white rounded-md text-xs font-medium hover:opacity-90 transition-opacity"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Add Attendee
                    </button>
                </div>
            </div>

            {/* MODALS */}
            {isAdding && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white border border-slate-150 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative text-slate-900">
                        <button onClick={() => setIsAdding(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors">
                            <XCircle className="w-5 h-5" />
                        </button>
                        <h4 className="text-lg font-bold text-slate-900 mb-4">Add Attendee</h4>
                        
                        <div className="mb-6">
                            <label className="block text-xs font-semibold mb-1.5 text-slate-600">Search Conference Participants</label>
                            <div className="relative">
                                <input 
                                    type="text" 
                                    value={searchQuery}
                                    onChange={handleSearch}
                                    placeholder="Type name or email (min 3 chars)..."
                                    className="input-base w-full px-3 bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                                />
                                {isSearching && <div className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin rounded-full h-3 w-3 border-[1.5px] border-blue-600 border-t-transparent"></div>}
                            </div>
                            
                            {searchResults.length > 0 && (
                                <div className="mt-2 border border-slate-100 rounded-lg max-h-40 overflow-y-auto bg-white shadow-sm divide-y divide-slate-100">
                                    {searchResults.map(p => (
                                        <div key={p.participant_id} className="flex justify-between items-center p-2.5 hover:bg-slate-50 transition-colors">
                                            <div className="text-sm">
                                                <div className="font-semibold text-slate-900">{p.name}</div>
                                                <div className="text-xs text-slate-500">{p.email}</div>
                                            </div>
                                            <button 
                                                onClick={() => handleAddParticipant(p)}
                                                disabled={isSubmitting}
                                                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md transition-colors"
                                            >
                                                Add
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="relative flex items-center py-4">
                            <div className="flex-grow border-t border-slate-200"></div>
                            <span className="flex-shrink-0 mx-4 text-slate-400 text-xs font-bold tracking-wider">OR ADD CUSTOM</span>
                            <div className="flex-grow border-t border-slate-200"></div>
                        </div>

                        <form onSubmit={handleAddCustom} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold mb-1.5 text-slate-600">Name</label>
                                <input required type="text" value={customName} onChange={e => setCustomName(e.target.value)} className="input-base w-full bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold mb-1.5 text-slate-600">Email</label>
                                <input required type="email" value={customEmail} onChange={e => setCustomEmail(e.target.value)} className="input-base w-full bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white" />
                            </div>
                            <button disabled={isSubmitting} type="submit" className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-slate-900/10 mt-2">
                                Add Custom Attendee
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {isImporting && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white border border-slate-150 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative text-slate-900">
                        <button onClick={() => setIsImporting(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors">
                            <XCircle className="w-5 h-5" />
                        </button>
                        <h4 className="text-lg font-bold text-slate-900 mb-4">Import via CSV</h4>
                        <p className="text-sm text-slate-600 mb-4">Paste a list of emails (one per line). The system will automatically map them to conference participants if they exist, or create custom attendees if they don't.</p>
                        
                        <textarea 
                            value={csvText}
                            onChange={(e) => setCsvText(e.target.value)}
                            className="input-base w-full h-48 font-mono text-sm mb-4 bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                            placeholder="email1@example.com&#10;email2@example.com"
                        />
                        
                        <button 
                            onClick={handleImportCSV}
                            disabled={!!importingStatus || !csvText.trim()}
                            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-slate-900/10"
                        >
                            {importingStatus || 'Import Attendees'}
                        </button>
                    </div>
                </div>
            )}

            {/* TABLE */}
            <div className="table-container">
                <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead>
                        <tr>
                            <th className="w-10 px-3 py-2">
                                <input 
                                    type="checkbox" 
                                    ref={(el) => {
                                        if (el) {
                                            el.indeterminate = selectedIds.size > 0 && selectedIds.size < attendees.length;
                                        }
                                    }}
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    checked={selectedIds.size === attendees.length && attendees.length > 0}
                                    onChange={toggleSelectAll}
                                />
                            </th>
                            <th className="th-base">Attendee</th>
                            <th className="th-base text-center">Tickets</th>
                            <th className="th-base text-center">Status</th>
                            <th className="th-base">QR Token</th>
                            <th className="th-base">QR Email</th>
                            <th className="th-base text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                        {sortedAttendees.map(a => (
                            <tr key={a.id} className={`transition-colors ${selectedIds.has(a.id) ? 'bg-indigo-50/50 hover:bg-indigo-50/80' : 'hover:bg-[var(--hover)]'}`}>
                                <td className="p-3">
                                    <input 
                                        type="checkbox" 
                                        checked={selectedIds.has(a.id)}
                                        onChange={() => toggleSelect(a.id)}
                                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    />
                                </td>
                                <td className="p-3">
                                    <div className="font-medium text-sm">{a.name}</div>
                                    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                        {a.email_alias ? (
                                            <>
                                                <span className="text-xs text-amber-500 font-medium" title={`Emails redirected to ${a.email_alias}`}>
                                                    {a.email_alias}
                                                </span>
                                                <span className="text-[10px] line-through opacity-50 text-[var(--muted)]" title="Original email">
                                                    ({a.email})
                                                </span>
                                            </>
                                        ) : (
                                            <span className="text-xs text-[var(--muted)]">{a.email}</span>
                                        )}
                                    </div>
                                    {a.participant_id ? (
                                        <span className="inline-block mt-1 px-1.5 py-0.5 bg-[var(--accent)]/10 text-[var(--accent)] text-[9px] font-bold rounded">Conf. Participant</span>
                                    ) : (
                                        <span className="inline-block mt-1 px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[9px] font-bold rounded">Custom</span>
                                    )}
                                </td>
                                <td className="p-3 text-center">
                                    <div className="flex items-center justify-center gap-2">
                                        <button 
                                            onClick={() => handleUpdateTickets(a.id, (a.tickets_count || 1) - 1)}
                                            disabled={(a.tickets_count || 1) <= 1 || isUpdatingTickets === a.id}
                                            className="w-6 h-6 flex items-center justify-center border border-slate-200 rounded-md text-slate-600 hover:bg-slate-100 disabled:opacity-30 transition-colors text-xs font-bold"
                                            title="Subtract Ticket"
                                        >
                                            -
                                        </button>
                                        <span className="font-bold text-sm min-w-[20px] text-slate-800">{a.tickets_count || 1}</span>
                                        <button 
                                            onClick={() => handleUpdateTickets(a.id, (a.tickets_count || 1) + 1)}
                                            disabled={isUpdatingTickets === a.id}
                                            className="w-6 h-6 flex items-center justify-center border border-slate-200 rounded-md text-slate-600 hover:bg-slate-100 transition-colors text-xs font-bold"
                                            title="Add Ticket"
                                        >
                                            +
                                        </button>
                                    </div>
                                </td>
                                <td className="p-3 text-center">
                                    {a.scanned_at ? (
                                        <div className="flex flex-col items-center">
                                            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full flex items-center gap-1">
                                                <CheckCircle2 className="w-3 h-3" />
                                                Checked-in
                                            </span>
                                            <span className="text-[10px] text-[var(--muted)] mt-1">{new Date(a.scanned_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                        </div>
                                    ) : (
                                        <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">Pending</span>
                                    )}
                                </td>
                                <td className="p-3">
                                    <div className="flex items-center gap-2">
                                        <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{a.qr_token.substring(0, 8)}...</code>
                                        <ActivityQRBadge 
                                            attendeeName={a.name} 
                                            activityName={activityName || 'Activity'}
                                            activityId={activityId}
                                            token={a.qr_token}
                                        />
                                    </div>
                                </td>
                                <td className="p-3">
                                    {a.email_sent_at ? (
                                        <div className="text-xs text-[var(--muted)] flex flex-col">
                                            <span>Sent on {new Date(a.email_sent_at).toLocaleDateString()}</span>
                                            <button 
                                                onClick={() => handleSendEmail(a.id)}
                                                className="text-[9px] text-[var(--accent)] hover:underline mt-0.5 w-fit font-medium"
                                            >
                                                Resend Email
                                            </button>
                                        </div>
                                    ) : (
                                        <button 
                                            onClick={() => handleSendEmail(a.id)}
                                            className="text-xs text-[var(--accent)] hover:underline flex items-center gap-1 font-medium"
                                        >
                                            <Mail className="w-3 h-3" /> Send QR
                                        </button>
                                    )}
                                </td>
                                <td className="p-3">
                                    <div className="flex items-center justify-end gap-3">
                                        {!a.scanned_at && (
                                            <button 
                                                onClick={() => handleManualCheckin(a.id)}
                                                className="text-xs font-medium text-green-600 hover:text-green-700 hover:underline"
                                            >
                                                Check-in
                                            </button>
                                        )}
                                        {a.scanned_at && (
                                            <button 
                                                onClick={() => handleResetCheckin(a.id)}
                                                className="text-xs font-medium text-amber-600 hover:text-amber-700 hover:underline"
                                            >
                                                Reset
                                            </button>
                                        )}
                                        <button 
                                            onClick={() => handleDelete(a.id, a.name)}
                                            className="text-[var(--muted)] hover:text-red-500 p-1"
                                            title="Remove Attendee"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {attendees.length === 0 && (
                            <tr>
                                <td colSpan="7" className="p-8 text-center text-sm text-[var(--muted)]">
                                    No attendees added to this activity yet.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
