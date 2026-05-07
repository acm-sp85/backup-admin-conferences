import { query } from '@/lib/db';
import DashboardLayout from '../components/DashboardLayout';
import ParticipantBadge from '../components/ParticipantBadge';
import ParticipantsFilter from '../components/ParticipantsFilter';
import ParticipantVoterToggle from '../components/ParticipantVoterToggle';
import ParticipantRow from '../components/ParticipantRow';
import { verifySession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function ParticipantsPage({ searchParams }) {
  const session = await verifySession();
  if (!session || session.role === 'user') {
    redirect(session ? '/voting' : '/login');
  }

  const { search, conference, status } = await searchParams;

  const conferences = await query('SELECT id, acronym FROM conferences ORDER BY acronym ASC');
  const activeConf = conferences.find(c => c.acronym === conference);
  const activeConfId = activeConf?.id;

  // 1. Fetch participants with their registration summary
  let sql = `
    SELECT 
      p.*, 
      CONCAT(COALESCE(p.firstName, ''), ' ', COALESCE(p.lastName, '')) as name
    FROM participants p
    WHERE 1=1
  `;
  const params = [];

  if (search) {
    sql += ` AND (p.firstName LIKE ? OR p.lastName LIKE ? OR p.email LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (conference) {
    sql += ` AND p.id IN (
      SELECT participant_id FROM registrations r2 
      JOIN conferences c2 ON r2.conference_id = c2.id 
      WHERE c2.acronym = ?
    )`;
    params.push(conference);
  }

  sql += ` ORDER BY p.created_at DESC`;

  const rawParticipants = await query(sql, params);
  
  if (rawParticipants.length === 0) {
    return (
      <DashboardLayout>
        <header className="mb-6"><h2 className="text-xl font-semibold">Participants</h2></header>
        <ParticipantsFilter conferences={conferences} />
        <div className="table-container"><div className="p-10 text-center text-xs">No participants found.</div></div>
      </DashboardLayout>
    );
  }

  const pIds = rawParticipants.map(p => p.id);

  // 2. Fetch all registrations for these participants
  const registrations = await query(`
    SELECT r.*, c.acronym
    FROM registrations r
    JOIN conferences c ON r.conference_id = c.id
    WHERE r.participant_id IN (${pIds.join(',')})
  `);

  // 3. Fetch all payments for these registrations
  const rIds = registrations.map(r => r.id);
  const payments = rIds.length > 0 ? await query(`
    SELECT * FROM payments WHERE registration_id IN (${rIds.join(',')})
  `) : [];

  // 4. Map data together
  const participants = rawParticipants.map(p => {
    const pRegs = registrations.filter(r => r.participant_id === p.id);
    const pRIds = pRegs.map(r => r.id);
    const pPayments = payments.filter(pay => pRIds.includes(pay.registration_id));
    
    // Summary data for the row
    const total_paid = pPayments.reduce((sum, pay) => pay.status === 'paid' ? sum + Number(pay.amount) : sum, 0);
    const payment_statuses = [...new Set(pPayments.map(pay => pay.status))].join(', ');
    const conference_tokens = pRegs.map(r => `${r.acronym}:${r.check_in_token || ''}`).join('|');
    
    // Pick a primary registration for things like cluster_for_review
    const primaryReg = pRegs.find(r => r.conference_id === activeConfId) || pRegs[0];

    return {
      ...p,
      total_paid,
      payment_statuses,
      conference_tokens,
      cluster_for_review: primaryReg?.cluster_for_review,
      all_payments_json: JSON.stringify(pPayments) // We stringify here so the component can JSON.parse it back
    };
  });

  // 5. Filter by payment status if requested (since we now have the data in JS)
  let filteredParticipants = participants;
  if (status) {
    if (status === 'paid') {
      filteredParticipants = participants.filter(p => p.payment_statuses.includes('paid') && !p.payment_statuses.includes('pending'));
    } else if (status === 'pending') {
      filteredParticipants = participants.filter(p => p.payment_statuses.includes('pending'));
    } else if (status === 'none') {
      filteredParticipants = participants.filter(p => !p.payment_statuses);
    }
  }

  return (
    <DashboardLayout>
      <header className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Participants</h2>
          <p className="text-[var(--muted)] text-xs mt-0.5">Manage event attendees and their registrations</p>
        </div>
        <div className="text-xs bg-[var(--accent)]/10 px-3 py-1.5 rounded-full text-[var(--muted)]">
          Total Results: <strong className="text-[var(--foreground)] ml-1">{filteredParticipants.length}</strong>
        </div>
      </header>

      <ParticipantsFilter conferences={conferences} />

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Conferences</th>
              <th>Payment</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredParticipants.map((person) => (
              <ParticipantRow 
                key={person.id} 
                person={person} 
                activeConfId={activeConfId} 
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
    </DashboardLayout>
  );
}