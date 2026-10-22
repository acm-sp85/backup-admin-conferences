import { query } from '@/lib/db';
import { getParticipantByToken } from '../../actions/participantVoting';
import VotingForm from '../../components/VotingForm';
import { redirect } from 'next/navigation';
import { logout } from '../../actions/auth';

export default async function ParticipantVotingPortal({ searchParams }) {
    const { t: token } = await searchParams;

    if (!token) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
                <div className="max-w-md w-full bg-white p-10 rounded-3xl shadow-xl border border-slate-200">
                    <h2 className="text-2xl font-bold text-slate-900 mb-4">Invalid Access</h2>
                    <p className="text-slate-500">You need a valid voting token to access this page. Please check your invitation email.</p>
                </div>
            </div>
        );
    }

    const participant = await getParticipantByToken(token);

    if (!participant) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
                <div className="max-w-md w-full bg-white p-10 rounded-3xl shadow-xl border border-slate-200">
                    <h2 className="text-2xl font-bold text-slate-900 mb-4">Participant Not Found</h2>
                    <p className="text-slate-500">We couldn't find a registration matching this token.</p>
                </div>
            </div>
        );
    }

    if (participant.voting_window_open !== 1) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
                <div className="max-w-md w-full bg-white p-10 rounded-3xl shadow-xl border border-slate-200">
                    <h2 className="text-2xl font-bold text-slate-900 mb-4">Voting Closed</h2>
                    <p className="text-slate-500">The voting window for <strong>{participant.conference_acronym}</strong> is currently closed.</p>
                </div>
            </div>
        );
    }

    const isTopicMode = participant.poster_voting_mode === 'topics';
    const clustersIds = participant.cluster_for_review || [];
    if (clustersIds.length === 0) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
                <div className="max-w-md w-full bg-white p-10 rounded-3xl shadow-xl border border-slate-200">
                    <h2 className="text-2xl font-bold text-slate-900 mb-4">{isTopicMode ? 'No Symposia Assigned' : 'No Clusters Assigned'}</h2>
                    <p className="text-slate-500">You haven't been assigned to any poster {isTopicMode ? 'symposia' : 'clusters'} for review yet.</p>
                </div>
            </div>
        );
    }

    let activeClusters = [];
    let posters = [];
    let activeDayName = null;

    if (participant.active_voting_cluster_id) {
        const [cl] = await query('SELECT name FROM clusters WHERE id = ?', [participant.active_voting_cluster_id]);
        if (cl) activeDayName = cl.name;
    }

    if (isTopicMode) {
        const placeholders = clustersIds.map(() => '?').join(',');
        
        // Fetch active symposia/topics assigned to participant
        const topicRows = await query(`
            SELECT mongo_id as id, name, ? as conference_acronym, ? as conference_id 
            FROM topics 
            WHERE mongo_id IN (${placeholders})
            ORDER BY name ASC
        `, [participant.conference_acronym, participant.conference_id, ...clustersIds]);

        activeClusters = topicRows.map(t => ({
            ...t,
            name: (t.name || '').replace(/\s+/g, ' ').trim()
        }));

        // Fetch posters matching assigned symposia/topics, filtered by active day if set
        let posterSql = `
            SELECT p.*, conf.base_url,
                   t.name as topic_name, parent.name as parent_topic_name,
                   COALESCE(parent.mongo_id, t.mongo_id) as symposium_mongo_id
            FROM posters p
            JOIN conferences conf ON p.conference_id = conf.id
            LEFT JOIN topics t ON p.topic_mongo_id COLLATE utf8mb4_unicode_ci = t.mongo_id COLLATE utf8mb4_unicode_ci
            LEFT JOIN topics parent ON t.parent_mongo_id COLLATE utf8mb4_unicode_ci = parent.mongo_id COLLATE utf8mb4_unicode_ci
            WHERE p.conference_id = ?
              AND (
                p.topic_mongo_id IN (${placeholders})
                OR t.parent_mongo_id IN (${placeholders})
              )
        `;
        const posterParams = [participant.conference_id, ...clustersIds, ...clustersIds];

        if (participant.active_voting_cluster_id) {
            posterSql += ` AND p.cluster_id = ?`;
            posterParams.push(participant.active_voting_cluster_id);
        }

        posters = await query(posterSql, posterParams);

        // Filter activeClusters to only those with visible posters for this day
        const visibleSymposia = new Set(posters.map(p => p.symposium_mongo_id || p.topic_mongo_id));
        activeClusters = activeClusters.filter(c => visibleSymposia.has(c.id));
    } else {
        // Fetch active clusters for this participant
        const clustersIdsString = clustersIds.map(Number).filter(n => !isNaN(n)).join(',');
        activeClusters = await query(`
            SELECT c.id, c.name, conf.acronym as conference_acronym, conf.id as conference_id 
            FROM clusters c 
            JOIN conferences conf ON c.conference_id = conf.id 
            WHERE c.id IN (${clustersIdsString || '0'}) AND c.conference_id = ?
        `, [participant.conference_id]);

        let posterSql = `
            SELECT p.*, conf.base_url,
                   t.name as topic_name, parent.name as parent_topic_name
            FROM posters p
            JOIN conferences conf ON p.conference_id = conf.id
            LEFT JOIN topics t ON p.topic_mongo_id COLLATE utf8mb4_unicode_ci = t.mongo_id COLLATE utf8mb4_unicode_ci
            LEFT JOIN topics parent ON t.parent_mongo_id COLLATE utf8mb4_unicode_ci = parent.mongo_id COLLATE utf8mb4_unicode_ci
            WHERE p.conference_id = ?
        `;
        const posterParams = [participant.conference_id];

        if (participant.active_voting_cluster_id) {
            posterSql += ` AND p.cluster_id = ?`;
            posterParams.push(participant.active_voting_cluster_id);
        }

        posters = await query(posterSql, posterParams);

        const visibleClusters = new Set(posters.map(p => p.cluster_id));
        activeClusters = activeClusters.filter(c => visibleClusters.has(c.id));
    }

    if (activeClusters.length === 0) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
                <div className="max-w-md w-full bg-white p-10 rounded-3xl shadow-xl border border-slate-200">
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                        📅
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-3">
                        {activeDayName ? `No Posters for ${activeDayName}` : 'No Active Posters'}
                    </h2>
                    <p className="text-slate-500 leading-relaxed text-sm">
                        {activeDayName 
                            ? `None of your assigned ${isTopicMode ? 'symposia' : 'clusters'} have posters scheduled for ${activeDayName}. Please check back on the other voting day!`
                            : `There are currently no active posters to evaluate for your assigned ${isTopicMode ? 'symposia' : 'clusters'}.`
                        }
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 p-6 md:p-12">
            <div className="max-w-5xl mx-auto">
                <header className="mb-10 text-center md:text-left flex flex-col md:flex-row justify-between items-end gap-6">
                    <div>
                        <div className="bg-indigo-600 text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest inline-block mb-3">
                            {participant.conference_acronym} Voting Portal
                        </div>
                        <h2 className="text-4xl font-black text-slate-900">Welcome, {participant.name}</h2>
                        <p className="text-slate-500 mt-2 text-lg italic">
                            {participant.voting_instructions || 'Please rank the following posters from 1 to 10.'}
                        </p>
                    </div>

                    <form action={logout}>
                        <button type="submit" className="text-[12px] font-bold text-[#ff3b30] bg-white px-4 py-2 rounded-xl border border-[#ff3b30]/10 shadow-sm hover:bg-[#fff5f5] transition-colors">
                            Sign Out
                        </button>
                    </form>
                </header>

                <div className="bg-white rounded-[40px] shadow-2xl shadow-slate-200/60 border border-slate-200/50 overflow-hidden">
                    <VotingForm 
                        activeClusters={activeClusters} 
                        posters={posters} 
                        initialVotes={participant.votes || {}} 
                        userId={participant.id}
                        conferenceId={participant.conference_id}
                        conferenceEmail={participant.conference_email}
                        isParticipant={true}
                        hasVoted={participant.has_voted}
                        votingValidationEnabled={!!participant.voting_validation_enabled}
                        isTopicMode={isTopicMode}
                        activeDayName={activeDayName}
                    />
                </div>
                
                <footer className="mt-16 text-center text-slate-400 text-xs font-medium uppercase tracking-widest">
                    &copy; {new Date().getFullYear()} Smart Conference Admin Dashboard &bull; Secure Voting Portal
                </footer>
            </div>
        </div>
    );
}
