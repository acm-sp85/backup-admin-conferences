import { query } from '@/lib/db';
import { verifySession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import CustomVotingForm from '../../components/CustomVotingForm';
import { logout } from '@/app/actions/auth';

export default async function CustomVotingPage() {
    const session = await verifySession();
    if (!session) {
        redirect('/login');
    }

    // 1. Get user details from the session
    const [user] = await query('SELECT id, email, role, firstName, lastName FROM users WHERE id = ?', [session.id]);
    if (!user) redirect('/login');

    // 2. Fetch the registration matching this email for a conference that has voting open
    const [participant] = await query(`
        SELECT 
            p.id, 
            CONCAT(COALESCE(p.firstName, ''), ' ', COALESCE(p.lastName, '')) as name,
            p.email,
            r.conference_id, 
            r.custom_voting_group, 
            r.has_custom_voted, 
            r.custom_votes,
            c.acronym as conference_acronym, 
            c.email as conference_email,
            c.voting_window_open,
            c.custom_voting_instructions
        FROM participants p
        JOIN registrations r ON p.id = r.participant_id
        JOIN conferences c ON r.conference_id = c.id
        WHERE p.email = ? AND c.voting_window_open = 1 AND r.custom_voting_group IS NOT NULL
        LIMIT 1
    `, [user.email]);

    // Handle case where user is logged in but doesn't have an active custom voting registration
    if (!participant) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
                <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center space-y-4 border border-slate-100">
                    <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    </div>
                    <h1 className="text-xl font-black text-slate-900">Portal Access Restricted</h1>
                    <p className="text-slate-500 text-sm leading-relaxed px-4">
                        We couldn't find an active evaluation registration under <span className="font-bold text-slate-900">{user.email}</span>.
                    </p>
                    <p className="text-slate-400 text-xs pt-4">
                        Please contact the conference organizers or request access if you believe this is an error.
                    </p>
                    <div className="pt-4">
                        <form action={logout}>
                            <button type="submit" className="px-6 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-200 transition-colors">
                                Sign Out
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        );
    }

    // 3. Load all custom voting groups and slots for this conference
    const allGroups = await query(
        'SELECT * FROM custom_voting_groups WHERE conference_id = ? ORDER BY name ASC',
        [participant.conference_id]
    );

    const allItems = await query(`
        SELECT cvi.*, cvg.name as group_name, cvg.color as group_color,
               ps.title, ps.presenter_name, ps.type, ps.start_time, ps.end_time,
               ps.authors, ps.content, ps.code, ps.toc,
               pss.session_name, pss.full_session_name,
               conf.base_url
        FROM custom_voting_items cvi
        JOIN custom_voting_groups cvg ON cvi.group_id = cvg.id
        JOIN program_slots ps ON cvi.slot_id = ps.id
        JOIN program_sessions pss ON ps.session_id = pss.id
        JOIN conferences conf ON pss.conference_id = conf.id
        WHERE cvg.conference_id = ?
        ORDER BY cvg.name ASC, ps.start_time ASC
    `, [participant.conference_id]);

    // 4. Parse group assignments and filter active list
    let assignedGroupIds = [];
    if (typeof participant.custom_voting_group === 'string') {
        try {
            assignedGroupIds = JSON.parse(participant.custom_voting_group);
        } catch (e) {
            assignedGroupIds = [];
        }
    } else {
        assignedGroupIds = participant.custom_voting_group || [];
    }

    const activeGroups = allGroups.filter(g => assignedGroupIds.includes(g.id));
    const activeItems = allItems.filter(item => assignedGroupIds.includes(item.group_id));

    // Parse votes
    let initialVotes = {};
    if (typeof participant.custom_votes === 'string') {
        try {
            initialVotes = JSON.parse(participant.custom_votes);
        } catch (e) {
            initialVotes = {};
        }
    } else {
        initialVotes = participant.custom_votes || {};
    }

    return (
        <div className="min-h-screen bg-[var(--bg)] pb-32">
            <header className="bg-white border-b border-[var(--border)] sticky top-0 z-50">
                <div className="max-w-[500px] mx-auto px-4 h-16 flex items-center justify-between">
                    <div>
                        <div className="text-[10px] font-black tracking-widest text-[var(--muted)] uppercase mb-0.5">
                            {participant.conference_acronym} Voting
                        </div>
                        <div className="font-bold text-[14px] text-[var(--foreground)] truncate max-w-[150px]">
                            {participant.name}
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="bg-[var(--accent)]/10 text-[var(--accent)] px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                            {activeItems.length} Presentations
                        </div>
                        <form action={logout}>
                            <button type="submit" className="text-[10px] font-bold text-[#ff3b30] bg-[#ff3b30]/5 px-2.5 py-1 rounded-lg border border-[#ff3b30]/10 hover:bg-[#ff3b30]/10 transition-colors uppercase tracking-tight">
                                Sign Out
                            </button>
                        </form>
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
                        initialVotes={initialVotes}
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
