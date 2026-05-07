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

  let sql = `
    SELECT 
      p.id, 
      CONCAT(COALESCE(p.firstName, ''), ' ', COALESCE(p.lastName, '')) as name,
      p.email, 
      r.id as registration_id,
      c.acronym as conference,
      (
        SELECT CONCAT('[', COALESCE(GROUP_CONCAT(
          JSON_OBJECT(
            'amount', amount,
            'status', status,
            'currency', currency,
            'invoice', invoice_code,
            'client', client_name,
            'method', payment_method,
            'tickets', tickets_info,
            'date', created_at
          )
        ), ''), ']')
        FROM payments 
        WHERE registration_id = r.id
      ) as all_payments_json,
      (
        SELECT CONCAT('[', COALESCE(GROUP_CONCAT(
          JSON_OBJECT(
            'id', id,
            'token', token,
            'sent_at', email_sent_at,
            'scanned_at', scanned_at
          )
        ), ''), ']')
        FROM social_dinner_tickets
        WHERE registration_id = r.id
      ) as tickets_status_json
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

  sql += ` ORDER BY p.lastName ASC`;

  const rawData = await query(sql, params);

  // Intelligent Deduplication
  let processedData = [];
  if (isShowAll) {
    processedData = rawData;
  } else {
    // Group by registration_id
    const grouped = rawData.reduce((acc, row) => {
      if (!acc[row.registration_id]) acc[row.registration_id] = [];
      acc[row.registration_id].push(row);
      return acc;
    }, {});

    Object.values(grouped).forEach(group => {
      const paid = group.filter(r => r.payment_status === 'paid');
      if (paid.length > 0) {
        // If there are paid records, only show those (could be multiple if they bought extra tickets)
        processedData.push(...paid);
      } else {
        // If none are paid, just show the most recent attempt
        const mostRecent = group.sort((a, b) => new Date(b.purchase_date) - new Date(a.purchase_date))[0];
        processedData.push(mostRecent);
      }
    });
  }

  // Parse tickets to extract dietary preferences
  const attendees = [];
  const sourceData = isShowAll ? rawData : processedData;
  
  sourceData.forEach(person => {
    try {
      const allPayments = JSON.parse(person.all_payments_json || '[]');
      
      allPayments.forEach(pay => {
        // In default view, we only care about the specific payment status that led us here
        // or we filter by status. Let's make it robust.
        if (!isShowAll && pay.status === 'refunded') return;

        try {
          const tickets = typeof pay.tickets === 'string' ? JSON.parse(pay.tickets) : pay.tickets;
          const seenPreferences = new Set();
          
          if (!Array.isArray(tickets)) return;

          tickets.forEach(ticket => {
            // Look for Social Dinner tickets
            if (ticket.name === 'Social Dinner' || (ticket.ticket_data && ticket.ticket_data.name === 'Social Dinner')) {
              let dietary_preference = 'Regular (Default)';
              
              if (ticket.option !== undefined && ticket.ticket_data && ticket.ticket_data.options) {
                dietary_preference = ticket.ticket_data.options[ticket.option] || dietary_preference;
              }

              // In default view, if we see the exact same dietary preference in the same payment, skip it
              if (!isShowAll) {
                if (seenPreferences.has(dietary_preference)) return;
                seenPreferences.add(dietary_preference);
              }
              
              attendees.push({
                id: `${person.id}-${person.registration_id}-${pay.invoice || Math.random()}-${ticket._id || Math.random()}`,
                name: person.name,
                email: person.email,
                registration_id: person.registration_id,
                conference: person.conference,
                dietary_preference,
                amount_paid: pay.amount,
                currency: pay.currency,
                invoice_code: pay.invoice,
                purchase_date: pay.date,
                payment_status: pay.status,
                all_payments: allPayments,
                tickets_status: JSON.parse(person.tickets_status_json || '[]')
              });
            }
          });
        } catch (e) {
          console.error('Error parsing payment tickets', e);
        }
      });
    } catch (e) {
      console.error('Failed to parse all_payments_json for participant', person.id);
    }
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

      <SocialDinnerTable attendees={attendees} />
    </DashboardLayout>
  );
}
