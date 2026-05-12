import { query } from '@/lib/db';
import { getParticipantByToken } from '../../actions/participantVoting';
import VotingForm from '../../components/VotingForm';
import { redirect } from 'next/navigation';

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

    const clustersIds = participant.cluster_for_review || [];
    if (clustersIds.length === 0) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
                <div className="max-w-md w-full bg-white p-10 rounded-3xl shadow-xl border border-slate-200">
                    <h2 className="text-2xl font-bold text-slate-900 mb-4">No Clusters Assigned</h2>
                    <p className="text-slate-500">You haven't been assigned to any poster clusters for review yet.</p>
                </div>
            </div>
        );
    }

    // Fetch active clusters for this participant
    const clustersIdsString = clustersIds.join(',');
    const activeClusters = await query(`
        SELECT c.id, c.name, conf.acronym as conference_acronym, conf.id as conference_id 
        FROM clusters c 
        JOIN conferences conf ON c.conference_id = conf.id 
        WHERE c.id IN (${clustersIdsString}) AND c.conference_id = ?
    `, [participant.conference_id]);

    // Fetch posters for the conference
    const posters = await query(`
        SELECT * FROM posters WHERE conference_id = ?
    `, [participant.conference_id]);

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
                </header>

                {participant.has_voted ? (
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-8 rounded-3xl mb-10 shadow-sm">
                        <div className="flex items-start gap-4">
                            <div className="bg-emerald-500 text-white p-2 rounded-full mt-1">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            </div>
                            <div>
                                <h3 className="font-bold text-xl mb-1">Your votes are in!</h3>
                                <p className="opacity-90 leading-relaxed">Thank you for participating in the voting process. You can see your current rankings below and update them if you've changed your mind.</p>
                            </div>
                        </div>
                    </div>
                ) : null}

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
                    />
                </div>
                
                <footer className="mt-16 text-center text-slate-400 text-xs font-medium uppercase tracking-widest">
                    &copy; {new Date().getFullYear()} Smart Conference Admin Dashboard &bull; Secure Voting Portal
                </footer>
            </div>
        </div>
    );
}
