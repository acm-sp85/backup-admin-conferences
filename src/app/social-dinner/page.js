import { query } from '@/lib/db';
import DashboardLayout from '../components/DashboardLayout';
import SocialDinnerFilter from '../components/SocialDinnerFilter';
import SocialDinnerTable from '../components/SocialDinnerTable';
import { verifySession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { QrCode } from 'lucide-react';
import { cookies } from 'next/headers';

export default async function SocialDinnerPage({ searchParams }) {
  const session = await verifySession();
  if (!session || session.role === 'user') {
    redirect(session ? '/voting' : '/login');
  }

  const { search, conference, showAll } = await searchParams;
  const isShowAll = showAll === 'true';
  const conferences = await query('SELECT id, acronym FROM conferences ORDER BY acronym ASC');

  // Persistence: If no conference in URL, check cookie
  if (!conference && conferences.length > 0) {
    const cookieStore = await cookies();
    const lastConference = cookieStore.get('last_conference')?.value;
    
    // Validate the cookie value exists in our conferences list
    const validCookie = lastConference && conferences.some(c => c.acronym === lastConference);
    
    if (validCookie) {
      const params = new URLSearchParams(Object.fromEntries(Object.entries(await searchParams).filter(([_, v]) => v !== undefined)));
      params.set('conference', lastConference);
      redirect(`/social-dinner?${params.toString()}`);
    } else {
      // Default to the latest conference if no valid cookie
      const [latest] = await query('SELECT acronym FROM conferences ORDER BY id DESC LIMIT 1');
      if (latest) {
        const params = new URLSearchParams(Object.fromEntries(Object.entries(await searchParams).filter(([_, v]) => v !== undefined)));
        params.set('conference', latest.acronym);
        redirect(`/social-dinner?${params.toString()}`);
      }
    }
  }

  // 1. Fetch basic participant and registration data
  let sql = `
    SELECT 
      p.id as participant_id, 
      CONCAT(COALESCE(p.firstName, ''), ' ', COALESCE(p.lastName, '')) as name,
      p.email, 
      r.id as registration_id,
      r.is_guest,
      c.acronym as conference
    FROM participants p
    JOIN registrations r ON p.id = r.participant_id
    JOIN conferences c ON r.conference_id = c.id
    WHERE (
      r.id IN (SELECT registration_id FROM payments WHERE tickets_info LIKE '%Social Dinner%')
      OR
      r.id IN (SELECT registration_id FROM social_dinner_tickets WHERE is_hidden = 0)
    )
  `;
  const params = [];

  if (search) {
    sql += ` AND (p.firstName LIKE ? OR p.lastName LIKE ? OR p.email LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (conference) {
    sql += ` AND c.acronym = ?`;
    params.push(conference);
  }

  const participants = await query(sql, params);
  
  if (participants.length === 0) {
    return (
      <DashboardLayout>
        <header className="mb-6"><h2 className="text-xl font-semibold">Social Dinner</h2></header>
        <SocialDinnerFilter conferences={conferences} attendees={[]} />
        <SocialDinnerTable attendees={[]} />
      </DashboardLayout>
    );
  }

  const registrationIds = participants.map(p => p.registration_id);

  // 2. Fetch all payments for these registrations
  const payments = await query(`
    SELECT registration_id, amount, balance, status, currency, invoice_code as invoice, client_name as client, payment_method as method, tickets_info as tickets, created_at as date
    FROM payments 
    WHERE registration_id IN (${registrationIds.join(',')})
  `);

  // 3. Fetch all tickets for these registrations
  const tickets = await query(`
    SELECT registration_id, id, token, email_sent_at as sent_at, scanned_at, is_manual, is_hidden
    FROM social_dinner_tickets
    WHERE registration_id IN (${registrationIds.join(',')}) AND is_hidden = 0
  `);

  // 4. Join data in Javascript
  const attendees = [];
  
  participants.forEach(p => {
    const pPayments = payments.filter(pay => pay.registration_id === p.registration_id);
    const pTickets = tickets.filter(t => t.registration_id === p.registration_id);

    // Collect all Social Dinner ticket items across ALL payments
    const dinnerTickets = [];
    let latestPayment = null;
    let latestCurrency = 'EUR';

    pPayments.forEach(pay => {
      if (!isShowAll && pay.status === 'refunded') return;

      try {
        const ticketItems = typeof pay.tickets === 'string' ? JSON.parse(pay.tickets) : pay.tickets;
        if (!Array.isArray(ticketItems)) return;

        ticketItems.forEach(ticket => {
          if (ticket.name === 'Social Dinner' || (ticket.ticket_data && ticket.ticket_data.name === 'Social Dinner')) {
            let dietary_preference = 'Regular (Default)';
            if (ticket.option !== undefined && ticket.ticket_data?.options) {
              dietary_preference = ticket.ticket_data.options[ticket.option] || dietary_preference;
            }
            dinnerTickets.push({ dietary_preference, price: ticket.price, invoice: pay.invoice });
            latestPayment = pay;
            latestCurrency = pay.currency || 'EUR';
          }
        });
      } catch (e) {
        console.error('Error parsing tickets', e);
      }
    });

    // Only add one row per participant if they have dinner tickets (either from payments or manual)
    const totalTicketCount = dinnerTickets.length + pTickets.filter(t => t.is_manual && t.is_hidden === 0).length;
    
    if (totalTicketCount === 0) return;

    const dinnerDebt = pPayments.reduce((sum, p) => {
      const balance = p.balance !== null && p.balance !== undefined ? Number(p.balance) : (p.status?.toLowerCase() !== 'paid' ? Number(p.amount) : 0);
      return sum + balance;
    }, 0);

    // Use the most common dietary preference, or list multiples
    const preferenceMap = {};
    dinnerTickets.forEach(t => {
      preferenceMap[t.dietary_preference] = (preferenceMap[t.dietary_preference] || 0) + 1;
    });
    
    // Manual tickets might not have dietary preference recorded in the same way yet
    const manualCount = pTickets.filter(t => t.is_manual && t.is_hidden === 0).length;
    if (manualCount > 0) {
        preferenceMap['Manual/Added'] = (preferenceMap['Manual/Added'] || 0) + manualCount;
    }

    const dietary_preference = Object.entries(preferenceMap)
      .map(([pref, count]) => count > 1 ? `${pref} ×${count}` : pref)
      .join(', ');

    attendees.push({
      id: `${p.participant_id}-${p.registration_id}`,
      name: p.name,
      email: p.email,
      registration_id: p.registration_id,
      participant_id: p.participant_id,
      conference: p.conference,
      is_guest: !!p.is_guest,
      dietary_preference,
      amount_paid: latestPayment?.amount || 0,
      currency: latestCurrency,
      invoice_code: latestPayment?.invoice,
      purchase_date: latestPayment?.date,
      payment_status: latestPayment?.status,
      dinner_debt: dinnerDebt,
      ticket_count: totalTicketCount,
      all_payments: pPayments,
      tickets_status: pTickets
    });
  });

  const totalPaid = attendees.filter(a => a.payment_status === 'paid' && a.dinner_debt <= 0).length;
  const totalPending = attendees.filter(a => a.payment_status === 'pending' || a.dinner_debt > 0).length;
  const totalRefunded = attendees.filter(a => a.payment_status === 'refunded').length;
  const totalActive = totalPaid + totalPending;
  const totalDebtAmount = attendees.reduce((sum, a) => sum + (a.dinner_debt || 0), 0);
  
  const totalTickets = attendees.reduce((sum, a) => sum + a.ticket_count, 0);
  const totalScanned = attendees.reduce((sum, a) => {
    return sum + (a.tickets_status?.filter(t => t.scanned_at).length || 0);
  }, 0);
  const totalManual = attendees.reduce((sum, a) => {
    return sum + (a.tickets_status?.filter(t => t.scanned_at && t.is_manual).length || 0);
  }, 0);

  return (
    <DashboardLayout>
      <header className="mb-6 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-xl font-semibold">Social Dinner</h2>
            <p className="text-[var(--muted)] text-xs mt-0.5">Manage attendees and dietary preferences</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link 
            href="/social-dinner/scanner"
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-black transition-all shadow-lg shadow-slate-200"
          >
            <QrCode className="w-3.5 h-3.5" />
            Launch Fast Scanner
          </Link>
          <div className="flex gap-2">
            <div className="text-[10px] bg-slate-100 px-3 py-1.5 rounded-full text-slate-500 font-medium">
              People: <strong className="text-slate-900 ml-1">{totalActive}</strong>
            </div>
            <div className="text-[10px] bg-blue-50 px-3 py-1.5 rounded-full text-blue-600 font-medium border border-blue-100">
              Total Tickets: <strong className="text-blue-700 ml-1">{totalTickets}</strong>
            </div>
            <div className="text-[10px] bg-indigo-50 px-3 py-1.5 rounded-full text-indigo-600 font-medium border border-indigo-100">
              Scanned: <strong className="text-indigo-700 ml-1">{totalScanned} / {totalTickets}</strong>
            </div>
            {totalManual > 0 && (
              <div className="text-[10px] bg-amber-50 px-3 py-1.5 rounded-full text-amber-600 font-medium border border-amber-100">
                Manual: <strong className="text-amber-700 ml-1">{totalManual}</strong>
              </div>
            )}
            <div className="text-[10px] bg-green-50 px-3 py-1.5 rounded-full text-green-600 font-medium border border-green-100">
              Paid: <strong className="text-green-700 ml-1">{totalPaid}</strong>
            </div>
            <div className="text-[10px] bg-orange-50 px-3 py-1.5 rounded-full text-orange-600 font-medium border border-orange-100">
              Pending: <strong className="text-orange-700 ml-1">{totalPending}</strong>
            </div>
            {totalDebtAmount > 0 && (
              <div className="text-[10px] bg-red-50 px-3 py-1.5 rounded-full text-red-600 font-medium border border-red-100">
                Debt Owed: <strong className="text-red-700 ml-1">{new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(totalDebtAmount)}</strong>
              </div>
            )}
            {totalRefunded > 0 && (
              <div className="text-[10px] bg-red-50 px-3 py-1.5 rounded-full text-red-600 font-medium border border-red-100">
                Refunded: <strong className="text-red-700 ml-1">{totalRefunded}</strong>
              </div>
            )}
          </div>
        </div>
      </header>

      <SocialDinnerFilter conferences={conferences} attendees={attendees} />

      <SocialDinnerTable attendees={attendees} userRole={session.role} conferenceAcronym={conference} />
    </DashboardLayout>
  );
}
