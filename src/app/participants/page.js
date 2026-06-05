import { query } from '@/lib/db';
import DashboardLayout from '../components/DashboardLayout';
import ParticipantBadge from '../components/ParticipantBadge';
import ParticipantsFilter from '../components/ParticipantsFilter';
import ParticipantVoterToggle from '../components/ParticipantVoterToggle';
import ParticipantRow from '../components/ParticipantRow';
import ParticipantsTable from '../components/ParticipantsTable';
import { verifySession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Camera } from 'lucide-react';
import { cookies } from 'next/headers';

export default async function ParticipantsPage({ searchParams }) {
  const session = await verifySession();
  if (!session || session.role === 'user') {
    redirect(session ? '/voting' : '/login');
  }

  const { search, conference, status, sortBy = 'created_at', order = 'desc' } = await searchParams;
  const conferences = await query('SELECT id, acronym, start_date, end_date FROM conferences ORDER BY acronym ASC');

  // Persistence: If no conference in URL, check cookie
  if (!conference && conferences.length > 0) {
    const cookieStore = await cookies();
    const lastConference = cookieStore.get('last_conference')?.value;
    
    // Validate the cookie value exists in our conferences list
    const validCookie = lastConference && conferences.some(c => c.acronym === lastConference);
    
    if (validCookie) {
      const params = new URLSearchParams(Object.fromEntries(Object.entries(await searchParams).filter(([_, v]) => v !== undefined)));
      params.set('conference', lastConference);
      redirect(`/participants?${params.toString()}`);
    } else {
      // Default to the latest conference if no valid cookie
      const [latest] = await query('SELECT acronym FROM conferences ORDER BY id DESC LIMIT 1');
      if (latest) {
        const params = new URLSearchParams(Object.fromEntries(Object.entries(await searchParams).filter(([_, v]) => v !== undefined)));
        params.set('conference', latest.acronym);
        redirect(`/participants?${params.toString()}`);
      }
    }
  }

  const activeConf = conferences.find(c => c.acronym === conference);
  const activeConfId = activeConf?.id;
  const activeConfEndDate = activeConf?.end_date ? new Date(activeConf.end_date).toISOString() : null;

  // 1. Fetch participants
  let sql = `
    SELECT 
      p.*, 
      p.email_alias,
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
      WHERE c2.acronym = ? AND r2.is_guest = 0
    )`;
    params.push(conference);
  } else {
    // When no conference filter, still exclude anyone who only exists as a guest
    sql += ` AND p.id NOT IN (
      SELECT DISTINCT participant_id FROM registrations WHERE is_guest = 1
    )`;
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
    SELECT r.*, c.acronym, t.email_sent_at as qr_email_sent_at, t.scanned_at as qr_scanned_at, t.token as qr_token, t.is_manual as qr_is_manual, t.cert_sent_at as cert_sent_at
    FROM registrations r
    JOIN conferences c ON r.conference_id = c.id
    LEFT JOIN participant_qr_tokens t ON r.id = t.registration_id
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
    
    // Pick a primary registration for things like cluster_for_review and QR actions
    const primaryReg = pRegs.find(r => r.conference_id === activeConfId) || pRegs[0];

    // Summary data for the row
    const total_paid = pPayments.reduce((sum, pay) => pay.status === 'paid' ? sum + Number(pay.amount) : sum, 0);
    const total_debt = pPayments.reduce((sum, pay) => {
      const balance = pay.balance !== null ? Number(pay.balance) : (pay.status?.toLowerCase() !== 'paid' ? Number(pay.amount) : 0);
      return sum + balance;
    }, 0);
    const payment_statuses = [...new Set(pPayments.map(pay => pay.status))].join(', ');
    const conference_tokens = pRegs.map(r => `${r.acronym}:${r.qr_token || ''}:${r.id}:${r.conference_id}`).join('|');
    
    return {
      ...p,
      total_paid,
      total_debt,
      payment_statuses,
      conference_tokens,
      primary_registration_id: primaryReg?.id,
      qr_email_sent_at: primaryReg?.qr_email_sent_at,
      qr_scanned_at: primaryReg?.qr_scanned_at,
      qr_is_manual: primaryReg?.qr_is_manual,
      qr_token: primaryReg?.qr_token,
      cert_sent_at: primaryReg?.cert_sent_at,
      cluster_for_review: primaryReg?.cluster_for_review,
      all_payments_json: JSON.stringify(pPayments) 
    };
  });

  // 5. Filter and Sort
  let filteredParticipants = participants;
  if (status) {
    if (status === 'paid') {
      filteredParticipants = participants.filter(p => 
        p.payment_statuses.toLowerCase().includes('paid') && 
        !p.payment_statuses.toLowerCase().includes('pending') &&
        p.total_debt <= 0
      );
    } else if (status === 'pending') {
      filteredParticipants = participants.filter(p => 
        p.payment_statuses.toLowerCase().includes('pending') || 
        p.total_debt > 0
      );
    } else if (status === 'none') {
      filteredParticipants = participants.filter(p => !p.payment_statuses);
    }
  }

  const totalCheckedIn = filteredParticipants.filter(p => p.qr_scanned_at).length;
  const totalManual = filteredParticipants.filter(p => p.qr_scanned_at && p.qr_is_manual).length;

  // Apply Sorting
  filteredParticipants.sort((a, b) => {
    let valA, valB;
    switch (sortBy) {
      case 'name': valA = a.name; valB = b.name; break;
      case 'email': valA = a.email; valB = b.email; break;
      case 'paid': valA = a.total_paid; valB = b.total_paid; break;
      case 'debt': valA = a.total_debt; valB = b.total_debt; break;
      case 'checkin': valA = a.qr_scanned_at ? 1 : 0; valB = b.qr_scanned_at ? 1 : 0; break;
      case 'created_at': valA = new Date(a.created_at); valB = new Date(b.created_at); break;
      default: valA = new Date(a.created_at); valB = new Date(b.created_at);
    }
    
    if (valA < valB) return order === 'asc' ? -1 : 1;
    if (valA > valB) return order === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <DashboardLayout>
      <header className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Participants</h2>
          <p className="text-[var(--muted)] text-xs mt-0.5">Manage event attendees and their registrations</p>
        </div>
        <div className="flex items-center gap-3">
          <Link 
            href="/participants/scanner" 
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold shadow-lg shadow-slate-200 hover:bg-black transition-all"
          >
            <Camera className="w-4 h-4" />
            Open Scanner
          </Link>
          <div className="text-xs bg-[var(--accent)]/10 px-3 py-1.5 rounded-full text-[var(--muted)]">
            Total Results: <strong className="text-[var(--foreground)] ml-1">{filteredParticipants.length}</strong>
          </div>
          <div className="text-xs bg-indigo-50 px-3 py-1.5 rounded-full text-indigo-600 font-medium border border-indigo-100">
            Checked-in: <strong className="text-indigo-700 ml-1">{totalCheckedIn}</strong>
          </div>
          {totalManual > 0 && (
            <div className="text-xs bg-amber-50 px-3 py-1.5 rounded-full text-amber-600 font-medium border border-amber-100">
              Manual: <strong className="text-amber-700 ml-1">{totalManual}</strong>
            </div>
          )}
        </div>
      </header>

      <ParticipantsFilter conferences={conferences} />

      <ParticipantsTable 
        participants={filteredParticipants} 
        activeConfId={activeConfId} 
        activeConfEndDate={activeConfEndDate}
        userRole={session.role}
        sortBy={sortBy}
        order={order}
        searchParams={{ search, conference, status }}
      />
    </DashboardLayout>
  );
}