import { hasAdminAccess } from '@/lib/roles';
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
  const [user] = await query('SELECT id, email, role, cluster_for_review, has_voted, votes FROM users WHERE id = ?', [session.id]);
  if (!user) redirect('/login');

  const clustersIds = typeof user.cluster_for_review === 'string' 
    ? JSON.parse(user.cluster_for_review) 
    : (user.cluster_for_review || []);
  
  const hasAssignedClusters = clustersIds && clustersIds.length > 0;
  const isStaff = hasAdminAccess(user.role);

  // 2. Check if user is registered in an active conference with voting window open
  const [activeRegConf] = await query(`
    SELECT 
      conf.id as conference_id, 
      conf.acronym as conference_acronym, 
      conf.email as conference_email, 
      conf.voting_instructions, 
      conf.voting_validation_enabled, 
      conf.poster_voting_mode,
      conf.voting_window_open,
      r.cluster_for_review as reg_review
    FROM registrations r
    JOIN participants part ON r.participant_id = part.id
    JOIN conferences conf ON r.conference_id = conf.id
    WHERE part.email = ? AND conf.voting_window_open = 1 AND r.cluster_for_review IS NOT NULL
    ORDER BY conf.start_date DESC
    LIMIT 1
  `, [user.email]);

  let activeClusters = [];
  let posters = [];
  let isTopicMode = false;

  const effectiveMode = activeRegConf?.poster_voting_mode || 
    (clustersIds.some(id => typeof id === 'string' && id.length > 10) ? 'topics' : 'clusters');

  if (effectiveMode === 'topics') {
    isTopicMode = true;
    const topicIds = activeRegConf?.reg_review 
      ? (typeof activeRegConf.reg_review === 'string' ? JSON.parse(activeRegConf.reg_review) : activeRegConf.reg_review)
      : clustersIds;

    if (topicIds && topicIds.length > 0 && activeRegConf) {
      const placeholders = topicIds.map(() => '?').join(',');
      const topicRows = await query(`
        SELECT mongo_id as id, name, ? as conference_acronym, ? as conference_id, ? as conference_email, ? as voting_instructions, ? as voting_validation_enabled
        FROM topics
        WHERE mongo_id IN (${placeholders})
        ORDER BY name ASC
      `, [activeRegConf.conference_acronym, activeRegConf.conference_id, activeRegConf.conference_email, activeRegConf.voting_instructions, activeRegConf.voting_validation_enabled, ...topicIds]);

      activeClusters = topicRows.map(t => ({
        ...t,
        name: (t.name || '').replace(/\s+/g, ' ').trim()
      }));

      if (activeClusters.length > 0) {
        posters = await query(`
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
        `, [activeRegConf.conference_id, ...topicIds, ...topicIds]);
      }
    }
  } else if (hasAssignedClusters) {
    // Cluster mode
    const numericClusterIds = clustersIds.map(Number).filter(n => !isNaN(n));
    if (numericClusterIds.length > 0) {
      const clustersIdsString = numericClusterIds.join(',');
      activeClusters = await query(`
          SELECT c.id, c.name, conf.acronym as conference_acronym, conf.id as conference_id, conf.email as conference_email, conf.voting_instructions, conf.voting_validation_enabled
          FROM clusters c 
          JOIN conferences conf ON c.conference_id = conf.id 
          WHERE conf.voting_window_open = 1 AND c.id IN (${clustersIdsString})
      `);

      if (activeClusters.length > 0) {
        posters = await query(`
          SELECT p.*, conf.base_url,
                 t.name as topic_name, parent.name as parent_topic_name
          FROM posters p
          JOIN conferences conf ON p.conference_id = conf.id
          LEFT JOIN topics t ON p.topic_mongo_id COLLATE utf8mb4_unicode_ci = t.mongo_id COLLATE utf8mb4_unicode_ci
          LEFT JOIN topics parent ON t.parent_mongo_id COLLATE utf8mb4_unicode_ci = parent.mongo_id COLLATE utf8mb4_unicode_ci
          WHERE p.cluster_id IN (${clustersIdsString})
        `);
      }
    }
  }

  // LOGIC:
  // If user is Staff AND has NO active clusters/topics to vote on -> Show Management UI
  // If user is Staff AND HAS active clusters/topics -> Show Voting UI
  // If user is regular Voter -> Show Voting UI (or "No clusters" / "Closed")

  const isVoter = user.role === 'user';

  // 4. Define Shared Header for Voting UI
  const votingHeader = (
    <header className="mb-6 flex justify-between items-start">
      <div>
        <h2 className="text-xl font-semibold">Poster Voting</h2>
        <p className="text-[var(--muted)] text-xs mt-0.5">
          {activeClusters[0]?.voting_instructions || 'Rank your assigned posters from 1 to 10(1 being the lowest score and 10 the highest)'}
        </p>
      </div>
      
      <form action={logout}>
         <button type="submit" className="text-[10px] font-bold text-[#ff3b30] bg-[#ff3b30]/5 px-3 py-1.5 rounded-lg border border-[#ff3b30]/10 hover:bg-[#ff3b30]/10 transition-colors uppercase tracking-tight">
           Sign Out
         </button>
      </form>
    </header>
  );

  if (isStaff && (activeClusters.length === 0 || !hasAssignedClusters)) {
    const conferences = await query('SELECT * FROM conferences ORDER BY name ASC');
    const allClusters = await query('SELECT * FROM clusters ORDER BY name ASC');
    
    return (
      <DashboardLayout>
        <header className="mb-6 flex justify-between items-start">
          <div>
            <h2 className="text-xl font-semibold">Voting Management</h2>
            <p className="text-[var(--muted)] text-xs mt-0.5">Select a conference to manage participant voting clusters</p>
          </div>
          
          <form action={logout}>
            <button type="submit" className="text-[10px] font-bold text-[#ff3b30] bg-[#ff3b30]/5 px-3 py-1.5 rounded-lg border border-[#ff3b30]/10 hover:bg-[#ff3b30]/10 transition-colors uppercase tracking-tight">
              Sign Out
            </button>
          </form>
        </header>

        <ParticipantVotingManager 
          conferences={conferences} 
          allClusters={allClusters} 
          userRole={user.role}
        />
      </DashboardLayout>
    );
  }

  // VOTING UI FLOW (for everyone else or staff with active votes)
  
  if (!hasAssignedClusters) {
    return (
      <DashboardLayout>
        {votingHeader}
        <div className="max-w-md mx-auto mt-20 text-center">
          <h2 className="text-lg font-semibold">{isTopicMode ? 'No Symposia Assigned' : 'No Clusters Assigned'}</h2>
          <p className="text-[var(--muted)] text-xs mt-1">You haven't been assigned any {isTopicMode ? 'symposia' : 'clusters'} for review yet.</p>
        </div>
      </DashboardLayout>
    );
  }

  if (activeClusters.length === 0) {
    return (
      <DashboardLayout>
        {votingHeader}
        <div className="max-w-md mx-auto mt-20 text-center">
          <h2 className="text-lg font-semibold">Voting Closed</h2>
          <p className="text-[var(--muted)] text-xs mt-1">No active voting windows for your assigned {isTopicMode ? 'symposia' : 'clusters'}.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {votingHeader}

      {!!user.has_voted && (
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

      <VotingForm 
        activeClusters={activeClusters} 
        posters={posters} 
        initialVotes={typeof user.votes === 'string' ? JSON.parse(user.votes) : (user.votes || {})} 
        userId={user.id}
        conferenceId={activeClusters[0]?.conference_id}
        conferenceEmail={activeClusters[0]?.conference_email}
        hasVoted={!!user.has_voted}
        votingValidationEnabled={!!activeClusters[0]?.voting_validation_enabled}
        isTopicMode={isTopicMode}
      />
    </DashboardLayout>
  );
}
