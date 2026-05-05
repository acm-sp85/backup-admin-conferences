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

  let sql = `
    SELECT 
      p.*, 
      CONCAT(COALESCE(p.firstName, ''), ' ', COALESCE(p.lastName, '')) as name,
      MAX(r.cluster_for_review) as cluster_for_review,
      GROUP_CONCAT(DISTINCT CONCAT(c.acronym, ':', COALESCE(r.check_in_token, '')) SEPARATOR '|') as conference_tokens,
      COALESCE(SUM(py.amount), 0) as total_paid,
      GROUP_CONCAT(DISTINCT py.status SEPARATOR ', ') as payment_statuses,
      (
        SELECT CONCAT('[', COALESCE(GROUP_CONCAT(
          JSON_OBJECT(
            'amount', amount,
            'status', status,
            'invoice', invoice_code,
            'client', client_name,
            'group', group_name,
            'method', payment_method,
            'tickets', tickets_info,
            'date', created_at
          )
        ), ''), ']')
        FROM payments 
        WHERE registration_id = MAX(r.id)
      ) as all_payments_json
    FROM participants p
    LEFT JOIN registrations r ON p.id = r.participant_id ${activeConfId ? 'AND r.conference_id = ?' : ''}
    LEFT JOIN conferences c ON r.conference_id = c.id
    LEFT JOIN payments py ON r.id = py.registration_id
    WHERE 1=1
  `;
  const params = [];
  if (activeConfId) params.push(activeConfId);

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

  sql += ` GROUP BY p.id`;

  if (status) {
    if (status === 'paid') {
      sql += ` HAVING payment_statuses LIKE '%paid%' AND payment_statuses NOT LIKE '%pending%'`;
    } else if (status === 'pending') {
      sql += ` HAVING payment_statuses LIKE '%pending%'`;
    } else if (status === 'none') {
      sql += ` HAVING payment_statuses IS NULL`;
    }
  }

  sql += ` ORDER BY p.created_at DESC`;

  const participants = await query(sql, params);

  return (
    <DashboardLayout>
      <header className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Participants</h2>
          <p className="text-[var(--muted)] text-xs mt-0.5">Manage event attendees and their registrations</p>
        </div>
        <div className="text-xs bg-[var(--accent)]/10 px-3 py-1.5 rounded-full text-[var(--muted)]">
          Total Results: <strong className="text-[var(--foreground)] ml-1">{participants.length}</strong>
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
            {participants.map((person) => (
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