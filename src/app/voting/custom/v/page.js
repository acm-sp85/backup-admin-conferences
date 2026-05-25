import { getCustomVotingParticipantByToken, getCustomVotingGroups, getCustomVotingItemsByConference } from '../../../actions/customVoting';
import CustomVotingForm from '../../../components/CustomVotingForm';

export default async function CustomParticipantVotingPage({ searchParams }) {
    const { t: token } = await searchParams;
    
    if (!token) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-2xl shadow-sm text-center max-w-sm w-full">
                    <h1 className="text-xl font-bold text-slate-900 mb-2">Invalid Link</h1>
                    <p className="text-slate-500 text-sm">Please use the exact link sent to your email.</p>
                </div>
            </div>
        );
    }

    const participant = await getCustomVotingParticipantByToken(token);
    
    if (!participant) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-2xl shadow-sm text-center max-w-sm w-full">
                    <h1 className="text-xl font-bold text-slate-900 mb-2">Access Denied</h1>
                    <p className="text-slate-500 text-sm">This voting link is invalid or has expired.</p>
                </div>
            </div>
        );
    }

    if (!participant.voting_window_open) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
                <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center space-y-4 border border-slate-100">
                    <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    </div>
                    <h1 className="text-2xl font-black text-slate-900">Voting is Closed</h1>
                    <p className="text-slate-500 text-[15px] leading-relaxed px-4">
                        The voting window for <span className="font-bold text-slate-900">{participant.conference_acronym}</span> is currently closed.
                    </p>
                    <p className="text-slate-400 text-[13px] pt-4">
                        If you believe this is an error, please contact the organizers at <br/>
                        <a href={`mailto:${participant.conference_email}`} className="text-blue-600 font-bold hover:underline mt-1 inline-block">{participant.conference_email}</a>
                    </p>
                </div>
            </div>
        );
    }

    // Get all groups and items for this conference
    const allGroups = await getCustomVotingGroups(participant.conference_id);
    const allItems = await getCustomVotingItemsByConference(participant.conference_id);

    // Filter to only the groups assigned to this participant
    const assignedGroupIds = participant.custom_voting_group || [];
    const activeGroups = allGroups.filter(g => assignedGroupIds.includes(g.id));
    
    // Get the items that belong to the assigned groups
    const activeItems = allItems.filter(item => assignedGroupIds.includes(item.group_id));

    return (
        <div className="min-h-screen bg-[var(--bg)] pb-32">
            <header className="bg-white border-b border-[var(--border)] sticky top-0 z-50">
                <div className="max-w-[500px] mx-auto px-4 h-16 flex items-center justify-between">
                    <div>
                        <div className="text-[10px] font-black tracking-widest text-[var(--muted)] uppercase mb-0.5">
                            {participant.conference_acronym} Voting
                        </div>
                        <div className="font-bold text-[14px] text-[var(--foreground)] truncate max-w-[200px]">
                            {participant.name}
                        </div>
                    </div>
                    <div className="bg-[var(--accent)]/10 text-[var(--accent)] px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest">
                        {activeItems.length} Presentations
                    </div>
                </div>
            </header>

            <main className="max-w-[500px] mx-auto p-4 space-y-6">
                <div className="p-5 bg-white border border-[var(--border)] rounded-2xl shadow-sm">
                    <h2 className="font-black text-lg mb-2 flex items-center gap-2 text-[var(--foreground)]">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--accent)]"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                        Evaluation Portal
                    </h2>
                    <p className="text-[13px] text-[var(--muted)] leading-relaxed whitespace-pre-wrap">
                        {participant.custom_voting_instructions || "Rank your assigned presentations from 1 to 10 (1 being the lowest score and 10 the highest)."}
                    </p>
                </div>

                {activeGroups.length === 0 ? (
                    <div className="p-8 text-center bg-white border border-[var(--border)] rounded-2xl">
                        <div className="text-4xl mb-3">📭</div>
                        <h3 className="font-bold text-slate-900 mb-1">No presentations assigned</h3>
                        <p className="text-xs text-slate-500">You don't have any presentations to evaluate at the moment.</p>
                    </div>
                ) : (
                    <CustomVotingForm 
                        activeGroups={activeGroups}
                        items={activeItems}
                        initialVotes={participant.custom_votes}
                        userId={participant.id}
                        conferenceId={participant.conference_id}
                        conferenceEmail={participant.conference_email}
                        hasVoted={participant.has_custom_voted}
                    />
                )}
            </main>
        </div>
    );
}
