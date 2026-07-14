'use client';

import { useState, useTransition, useEffect } from 'react';
import ParticipantRow from './ParticipantRow';
import { sendParticipantCheckinQR } from '../actions/participants-qr';
import { sendCertificateEmail } from '../actions/certificates';
import { Loader2, Mail, Download, Award, CheckCircle2, UserPlus } from 'lucide-react';
import AddParticipantModal from './AddParticipantModal';

export default function ParticipantsTable({ participants, activeConfId, activeConfEndDate, userRole, sortBy, order, searchParams, registrationTypes }) {
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [isSendingBulk, startSendingBulk] = useTransition();
    const [isSendingCerts, startSendingCerts] = useTransition();
    const [certProgress, setCertProgress] = useState(null); // { done, total, success, fail }
    const [isCompleted, setIsCompleted] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        if (activeConfEndDate) {
            setIsCompleted(new Date() > new Date(activeConfEndDate));
        } else {
            setIsCompleted(false);
        }
    }, [activeConfEndDate]);

    const getSortUrl = (field) => {
        const newOrder = sortBy === field && order === 'asc' ? 'desc' : 'asc';
        const params = new URLSearchParams({ ...searchParams, sortBy: field, order: newOrder });
        return `?${params.toString()}`;
    };

    const SortIcon = ({ field }) => {
        if (sortBy !== field) return <span className="opacity-20 ml-1">↕</span>;
        return <span className="ml-1 text-indigo-600">{order === 'asc' ? '↑' : '↓'}</span>;
    };

    const toggleSelectAll = () => {
        if (selectedIds.size > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(participants.filter(p => !p.is_removed).map(p => p.primary_registration_id).filter(id => id)));
        }
    };

    const toggleSelect = (registrationId) => {
        const next = new Set(selectedIds);
        if (next.has(registrationId)) next.delete(registrationId);
        else next.add(registrationId);
        setSelectedIds(next);
    };

    const handleBulkEmail = () => {
        if (selectedIds.size === 0) return;
        if (!confirm(`Send Check-in QR emails to ${selectedIds.size} participants?`)) return;

        startSendingBulk(async () => {
            let success = 0;
            let fail = 0;
            for (const id of selectedIds) {
                try {
                    await sendParticipantCheckinQR(id);
                    success++;
                    // Pace emails: wait 500ms between each
                    await new Promise(resolve => setTimeout(resolve, 500));
                } catch (e) {
                    fail++;
                }
            }
            alert(`Bulk send complete: ${success} successful, ${fail} failed.`);
            setSelectedIds(new Set());
        });
    };

    const selectCheckedIn = () => {
        const checkedInIds = new Set(
            participants
                .filter(p => !p.is_removed && p.qr_scanned_at && p.primary_registration_id)
                .map(p => p.primary_registration_id)
        );
        setSelectedIds(checkedInIds);
    };

    const handleBulkCertificates = (registrationIds) => {
        const count = registrationIds.length;
        if (count === 0) return;
        if (!confirm(`Send Certificate of Participation emails to ${count} participants?`)) return;

        setCertProgress({ done: 0, total: count, success: 0, fail: 0 });
        startSendingCerts(async () => {
            let success = 0;
            let fail = 0;
            for (let i = 0; i < registrationIds.length; i++) {
                try {
                    await sendCertificateEmail(registrationIds[i]);
                    success++;
                } catch (e) {
                    fail++;
                }
                setCertProgress({ done: i + 1, total: count, success, fail });
                // Pace emails: wait 500ms between each
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            alert(`Certificate send complete: ${success} successful, ${fail} failed.`);
            setCertProgress(null);
            setSelectedIds(new Set());
        });
    };

    const handleSendSelectedCertificates = () => {
        // Filter to only checked-in participants from the selection
        const checkedInSelected = participants
            .filter(p => selectedIds.has(p.primary_registration_id) && p.qr_scanned_at)
            .map(p => p.primary_registration_id);
        
        if (checkedInSelected.length === 0) {
            alert('None of the selected participants have checked in. Certificates can only be sent to checked-in participants.');
            return;
        }
        if (checkedInSelected.length < selectedIds.size) {
            if (!confirm(`Only ${checkedInSelected.length} of ${selectedIds.size} selected participants have checked in. Continue sending to those ${checkedInSelected.length}?`)) return;
        }
        handleBulkCertificates(checkedInSelected);
    };

    const handleSendAllCertificates = () => {
        const allCheckedIn = participants
            .filter(p => p.qr_scanned_at && p.primary_registration_id)
            .map(p => p.primary_registration_id);
        handleBulkCertificates(allCheckedIn);
    };

    const handleDownloadCSV = () => {
        const headers = ["First Name", "Last Name", "Email", "Institution", "Registration Type", "Check-in Status", "Check-in Time", "Payment Status", "Total Paid", "Total Debt"];
        const rows = participants.map(p => {
            const checkinStatus = p.qr_scanned_at ? "Checked In" : "Not Checked In";
            const checkinTime = p.qr_scanned_at ? new Date(p.qr_scanned_at).toLocaleString() : "";
            const paymentStatus = p.payment_statuses || "None";
            
            return [
                p.firstName || "",
                p.lastName || "",
                p.email,
                p.entity || "",
                p.registration_type || "Standard",
                checkinStatus,
                checkinTime,
                paymentStatus,
                p.total_paid,
                p.total_debt
            ];
        });

        const csvContent = [
            headers.join(","),
            ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `participants_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const exportCertificatesCsv = () => {
        const checkedInParticipants = participants.filter(p => p.qr_scanned_at);
        
        const headers = [
            "First Name", 
            "Last Name", 
            "Email", 
            "Institution/Entity", 
            "Address", 
            "Zip Code", 
            "City", 
            "Country", 
            "Registration Type",
            "Presentations"
        ];

        const rows = checkedInParticipants.map(p => [
            p.firstName || "",
            p.lastName || "",
            p.email || "",
            p.entity || "",
            p.entity_address || "",
            p.entity_zip || "",
            p.entity_city || "",
            p.entity_country || "",
            p.registration_type || "Standard",
            p.presentations_summary || ""
        ]);

        const csvContent = [
            headers.join(","),
            ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `certificate_data_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200 shadow-sm min-h-[52px] flex-wrap gap-2">
                <div className="flex items-center gap-3 flex-wrap">
                    {selectedIds.size > 0 ? (
                        <div className="flex items-center gap-2 flex-wrap">
                            <button 
                            onClick={handleBulkEmail}
                            disabled={isSendingBulk || isSendingCerts}
                            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-lg shadow-indigo-100 transition-all disabled:opacity-50 animate-in fade-in zoom-in duration-200"
                        >
                            {isSendingBulk ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
                            Send Check-in QRs ({selectedIds.size})
                        </button>
                        <button 
                            onClick={handleSendSelectedCertificates}
                            disabled={isSendingCerts || isSendingBulk || !isCompleted}
                            className={`flex items-center gap-2 px-3 py-1.5 text-white rounded-lg text-xs font-semibold shadow-lg transition-all animate-in fade-in zoom-in duration-200 ${
                                !isCompleted 
                                    ? 'bg-slate-300 cursor-not-allowed opacity-50 shadow-none' 
                                    : 'bg-amber-600 hover:bg-amber-700 shadow-amber-100 disabled:opacity-50'
                            }`}
                            title={!isCompleted ? "Certificates can only be sent once the conference has completed." : ""}
                        >
                            {isSendingCerts ? <Loader2 className="w-3 h-3 animate-spin" /> : <Award className="w-3 h-3" />}
                            {certProgress 
                                ? `Sending... (${certProgress.done}/${certProgress.total})` 
                                : `Send Certificates (${selectedIds.size})`
                            }
                        </button>
                        <button 
                            onClick={() => {
                                const ids = Array.from(selectedIds).join(',');
                                window.open(`/participants/certificates/print?registrationIds=${ids}&conferenceId=${activeConfId}`, '_blank');
                            }}
                            className="flex items-center gap-2 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-lg shadow-rose-100 transition-all animate-in fade-in zoom-in duration-200"
                        >
                            <Download className="w-3 h-3" />
                            Download PDFs ({selectedIds.size})
                        </button>
                        <button 
                            onClick={() => {
                                const ids = Array.from(selectedIds).join(',');
                                window.open(`/participants/print?registrationIds=${ids}&conferenceId=${activeConfId}`, '_blank');
                            }}
                            className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 hover:bg-black text-white rounded-lg text-xs font-semibold shadow-lg shadow-slate-200 transition-all animate-in fade-in zoom-in duration-200"
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                            Print Badges ({selectedIds.size})
                        </button>
                    </div>
                    ) : (
                        <div className="text-[10px] text-slate-400 font-medium px-1 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                            Select participants to send bulk emails or certificates
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <button 
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 hover:bg-black text-white border border-slate-950 rounded-lg text-xs font-semibold transition-all shadow-sm"
                    >
                        <UserPlus className="w-3.5 h-3.5 animate-in" />
                        Add Participant
                    </button>
                    <button 
                        onClick={selectCheckedIn}
                        className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs font-semibold hover:bg-green-100 transition-all shadow-sm"
                    >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Select Checked-in
                    </button>
                    <button 
                        onClick={handleSendAllCertificates}
                        disabled={isSendingCerts || isSendingBulk || !isCompleted}
                        className={`flex items-center gap-2 px-3 py-1.5 border rounded-lg text-xs font-semibold transition-all shadow-sm ${
                            !isCompleted 
                                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-50' 
                                : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 disabled:opacity-50'
                        }`}
                        title={!isCompleted ? "Certificates can only be sent once the conference has completed." : ""}
                    >
                        <Award className="w-3.5 h-3.5" />
                        {certProgress 
                            ? `Sending... (${certProgress.done}/${certProgress.total})` 
                            : 'Send All Certificates'
                        }
                    </button>
                    <button 
                        onClick={handleDownloadCSV}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-all shadow-sm"
                    >
                        <Download className="w-3.5 h-3.5" />
                        Download CSV
                    </button>
                    <button 
                        onClick={exportCertificatesCsv}
                        className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold hover:bg-indigo-100 transition-all shadow-sm"
                    >
                        <Download className="w-3.5 h-3.5" />
                        Download Certificates in CSV
                    </button>
                </div>
            </div>

            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            <th className="w-10">
                                <input 
                                    type="checkbox" 
                                    ref={(el) => {
                                        if (el) {
                                            el.indeterminate = selectedIds.size > 0 && selectedIds.size < participants.length;
                                        }
                                    }}
                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    checked={selectedIds.size === participants.length && participants.length > 0}
                                    onChange={toggleSelectAll}
                                />
                            </th>
                            <th><a href={getSortUrl('name')} className="hover:text-indigo-600 flex items-center">Name <SortIcon field="name" /></a></th>
                            <th><a href={getSortUrl('email')} className="hover:text-indigo-600 flex items-center">Email <SortIcon field="email" /></a></th>
                            <th><a href={getSortUrl('checkin')} className="hover:text-indigo-600 flex items-center">CHECKED-IN <SortIcon field="checkin" /></a></th>
                            <th>Conferences</th>
                            <th>
                                <div className="flex gap-4">
                                    <a href={getSortUrl('paid')} className="hover:text-indigo-600 flex items-center">Paid <SortIcon field="paid" /></a>
                                    <a href={getSortUrl('debt')} className="hover:text-indigo-600 flex items-center text-red-500">Debt <SortIcon field="debt" /></a>
                                </div>
                            </th>
                            <th className="text-right"><a href={getSortUrl('created_at')} className="hover:text-indigo-600 flex items-center justify-end">Date <SortIcon field="created_at" /></a></th>
                        </tr>
                    </thead>
                    <tbody>
                        {participants.map((person) => (
                            <ParticipantRow 
                                key={person.id} 
                                person={person} 
                                activeConfId={activeConfId} 
                                isCompleted={isCompleted}
                                userRole={userRole}
                                selected={selectedIds.has(person.primary_registration_id)}
                                onSelect={() => toggleSelect(person.primary_registration_id)}
                                registrationTypes={registrationTypes}
                            />
                        ))}
                    </tbody>
                </table>
                
                {participants.length === 0 && (
                    <div className="p-10 text-center text-[var(--muted)] text-xs">
                        No participants found.
                    </div>
                )}
            </div>

            <AddParticipantModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                conferenceAcronym={searchParams.conference} 
                conferenceId={activeConfId}
                registrationTypes={registrationTypes}
            />
        </div>
    );
}
