import { query } from '@/lib/db';
import DashboardLayout from '../components/DashboardLayout';
import SocialDinnerFilter from '../components/SocialDinnerFilter';
import SocialDinnerTable from '../components/SocialDinnerTable';
import { verifySession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { QrCode } from 'lucide-react';

export default async function SocialDinnerPage({ searchParams }) {
  const session = await verifySession();
  if (!session || session.role === 'user') {
    redirect(session ? '/voting' : '/login');
  }

  const { search, conference, showAll } = await searchParams;
  const isShowAll = showAll === 'true';
  const conferences = await query('SELECT id, acronym FROM conferences ORDER BY acronym ASC');

  // 1. Fetch basic participant and registration data
  let sql = `
    SELECT 
      p.id as participant_id, 
      CONCAT(COALESCE(p.firstName, ''), ' ', COALESCE(p.lastName, '')) as name,
      p.email, 
      r.id as registration_id,
      c.acronym as conference
    FROM participants p
    JOIN registrations r ON p.id = r.participant_id
    JOIN conferences c ON r.conference_id = c.id
    WHERE r.id IN (
      SELECT registration_id FROM payments WHERE tickets_info LIKE '%Social Dinner%'
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
    SELECT registration_id, amount, status, currency, invoice_code as invoice, client_name as client, payment_method as method, tickets_info as tickets, created_at as date
    FROM payments 
    WHERE registration_id IN (${registrationIds.join(',')})
  `);

  // 3. Fetch all tickets for these registrations
  const tickets = await query(`
    SELECT registration_id, id, token, email_sent_at as sent_at, scanned_at
    FROM social_dinner_tickets
    WHERE registration_id IN (${registrationIds.join(',')})
  `);

  // 4. Join data in Javascript
  const attendees = [];
  
  participants.forEach(p => {
    const pPayments = payments.filter(pay => pay.registration_id === p.registration_id);
    const pTickets = tickets.filter(t => t.registration_id === p.registration_id);

    pPayments.forEach(pay => {
      if (!isShowAll && pay.status === 'refunded') return;

      try {
        const ticketItems = typeof pay.tickets === 'string' ? JSON.parse(pay.tickets) : pay.tickets;
        if (!Array.isArray(ticketItems)) return;

        const seenPreferences = new Set();

        ticketItems.forEach(ticket => {
          if (ticket.name === 'Social Dinner' || (ticket.ticket_data && ticket.ticket_data.name === 'Social Dinner')) {
            let dietary_preference = 'Regular (Default)';
            if (ticket.option !== undefined && ticket.ticket_data?.options) {
              dietary_preference = ticket.ticket_data.options[ticket.option] || dietary_preference;
            }

            if (!isShowAll && seenPreferences.has(dietary_preference)) return;
            seenPreferences.add(dietary_preference);

            attendees.push({
              id: `${p.participant_id}-${p.registration_id}-${pay.invoice || Math.random()}-${ticket._id || Math.random()}`,
              name: p.name,
              email: p.email,
              registration_id: p.registration_id,
              conference: p.conference,
              dietary_preference,
              amount_paid: pay.amount,
              currency: pay.currency,
              invoice_code: pay.invoice,
              purchase_date: pay.date,
              payment_status: pay.status,
              all_payments: pPayments,
              tickets_status: pTickets
            });
          }
        });
      } catch (e) {
        console.error('Error parsing tickets', e);
      }
    });
  });

  const totalPaid = attendees.filter(a => a.payment_status === 'paid').length;
  const totalPending = attendees.filter(a => a.payment_status === 'pending').length;
  const totalRefunded = attendees.filter(a => a.payment_status === 'refunded').length;
  const totalActive = totalPaid + totalPending;

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
              Active: <strong className="text-slate-900 ml-1">{totalActive}</strong>
            </div>
            <div className="text-[10px] bg-green-50 px-3 py-1.5 rounded-full text-green-600 font-medium border border-green-100">
              Paid: <strong className="text-green-700 ml-1">{totalPaid}</strong>
            </div>
            <div className="text-[10px] bg-orange-50 px-3 py-1.5 rounded-full text-orange-600 font-medium border border-orange-100">
              Pending: <strong className="text-orange-700 ml-1">{totalPending}</strong>
            </div>
            {totalRefunded > 0 && (
              <div className="text-[10px] bg-red-50 px-3 py-1.5 rounded-full text-red-600 font-medium border border-red-100">
                Refunded: <strong className="text-red-700 ml-1">{totalRefunded}</strong>
              </div>
            )}
          </div>
        </div>
      </header>

      <SocialDinnerFilter conferences={conferences} attendees={attendees} />

      <SocialDinnerTable attendees={attendees} userRole={session.role} />
    </DashboardLayout>
  );
}
