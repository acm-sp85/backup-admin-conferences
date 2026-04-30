import { query } from '@/lib/db';
import DashboardLayout from '../components/DashboardLayout';
import { verifySession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import VotingForm from '../components/VotingForm';
import ParticipantVotingManager from '../components/ParticipantVotingManager';
import { logout } from '@/app/actions/auth';

export default async function VotingPage() {
  const session = await verifySession();
  if (!session) {
    redirect('/login');
  }

  // 1. Get user details
  const [user] = await query('SELECT id, role, cluster_for_review, has_voted, votes FROM users WHERE id = ?', [session.id]);
  if (!user) redirect('/login');

  // IF ADMIN: Show management UI
  if (user.role === 'admin' || user.role === 'superadmin') {
    const conferences = await query('SELECT * FROM conferences ORDER BY name ASC');
    const allClusters = await query('SELECT * FROM clusters ORDER BY name ASC');
    
    return (
      <DashboardLayout>
        <header className="mb-6">
          <h2 className="text-xl font-semibold">Voting Management</h2>
          <p className="text-[var(--muted)] text-xs mt-0.5">Select a conference to manage participant voting clusters</p>
        </header>

        <ParticipantVotingManager 
          conferences={conferences} 
          allClusters={allClusters} 
        />
      </DashboardLayout>
    );
  }

  // IF REGULAR USER: Existing voting logic
  const clustersIds = typeof user.cluster_for_review === 'string' 
    ? JSON.parse(user.cluster_for_review) 
    : (user.cluster_for_review || []);
  
  if (!clustersIds || clustersIds.length === 0) {
    return (
      <DashboardLayout>
        <div className="max-w-md mx-auto mt-20 text-center">
          <h2 className="text-lg font-semibold">No Clusters Assigned</h2>
          <p className="text-[var(--muted)] text-xs mt-1">You haven't been assigned any clusters for review yet.</p>
        </div>
      </DashboardLayout>
    );
  }

  // 2. Fetch clusters that are active
  const clustersIdsString = clustersIds.join(',');
  const activeClusters = await query(`
    SELECT c.id, c.name, conf.acronym as conference_acronym, conf.id as conference_id, conf.email as conference_email
    FROM clusters c 
    JOIN conferences conf ON c.conference_id = conf.id 
    WHERE conf.voting_window_open = 1 AND c.id IN (${clustersIdsString})
  `);

  if (activeClusters.length === 0) {
    return (
      <DashboardLayout>
        <div className="max-w-md mx-auto mt-20 text-center">
          <h2 className="text-lg font-semibold">Voting Closed</h2>
          <p className="text-[var(--muted)] text-xs mt-1">No active voting windows for your assigned clusters.</p>
        </div>
      </DashboardLayout>
    );
  }

  const activeConferenceIds = [...new Set(activeClusters.map(c => c.conference_id))];
  const posters = await query(`
    SELECT * FROM posters 
    WHERE cluster_id IN (${clustersIds.join(',')})
  `);

  const isVoter = user.role === 'user';

  return (
    <DashboardLayout>
      <header className={`mb-6 ${isVoter ? 'flex justify-between items-start' : ''}`}>
        <div>
          <h2 className="text-xl font-semibold">{isVoter ? 'Poster Voting' : 'Voting Management'}</h2>
          <p className="text-[var(--muted)] text-xs mt-0.5">
            {isVoter ? 'Rank your assigned posters (1-10)' : 'Select a conference to manage participant voting clusters'}
          </p>
        </div>
        
        {isVoter && (
          <form action={logout}>
             <button type="submit" className="text-[11px] font-semibold text-[#ff3b30] bg-[#fff5f5] px-3 py-1.5 rounded-full">
               Sign Out
             </button>
          </form>
        )}
      </header>

      {isVoter && user.has_voted && (
        <div className="card p-4 mb-4 border-amber-200 bg-amber-50">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-amber-600">✓</span>
            <span className="text-xs font-bold text-amber-900 uppercase tracking-tight">Your votes have been recorded successfully</span>
          </div>
          <p className="text-[10px] text-amber-700">
            If you need to make any amendments, please contact the organizers at: 
            <a href={`mailto:${activeClusters[0]?.conference_email}`} className="font-bold underline ml-1 text-amber-900">
              {activeClusters[0]?.conference_email}
            </a>
          </p>
        </div>
      )}

      {isVoter ? (
        <VotingForm 
          activeClusters={activeClusters} 
          posters={posters} 
          initialVotes={typeof user.votes === 'string' ? JSON.parse(user.votes) : (user.votes || {})} 
          userId={user.id}
          conferenceEmail={activeClusters[0]?.conference_email}
          hasVoted={user.has_voted}
        />
      ) : (
        <ParticipantVotingManager 
          conferences={conferences} 
          allClusters={allClusters} 
        />
      )}
    </DashboardLayout>
  );
}
