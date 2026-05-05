import { query } from '@/lib/db';
import DashboardLayout from '../components/DashboardLayout';
import SocialDinnerFilter from '../components/SocialDinnerFilter';
import SocialDinnerTable from '../components/SocialDinnerTable';
import { verifySession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function SocialDinnerPage({ searchParams }) {
  const session = await verifySession();
  if (!session || session.role === 'user') {
    redirect(session ? '/voting' : '/login');
  }

  const { search, conference } = await searchParams;
  const conferences = await query('SELECT id, acronym FROM conferences ORDER BY acronym ASC');

  let sql = `
    SELECT 
      p.id, 
      CONCAT(COALESCE(p.firstName, ''), ' ', COALESCE(p.lastName, '')) as name,
      p.email, 
      py.tickets_info,
      py.amount as amount_paid,
      py.currency,
      py.invoice_code,
      py.created_at as purchase_date,
      py.status as payment_status,
      c.acronym as conference
    FROM participants p
    JOIN registrations r ON p.id = r.participant_id
    JOIN conferences c ON r.conference_id = c.id
    JOIN payments py ON r.id = py.registration_id
    WHERE py.tickets_info LIKE '%Social Dinner%'
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

  sql += ` ORDER BY py.created_at DESC`;

  const rawData = await query(sql, params);

  // Parse tickets to extract dietary preferences
  const attendees = [];
  
  rawData.forEach(person => {
    try {
      const tickets = JSON.parse(person.tickets_info || '[]');
      tickets.forEach(ticket => {
        // Look for Social Dinner tickets
        if (ticket.name === 'Social Dinner' || (ticket.ticket_data && ticket.ticket_data.name === 'Social Dinner')) {
          let dietary_preference = 'Regular (Default)';
          
          if (ticket.option !== undefined && ticket.ticket_data && ticket.ticket_data.options) {
            dietary_preference = ticket.ticket_data.options[ticket.option] || dietary_preference;
          }
          
          attendees.push({
            id: `${person.id}-${ticket._id || Math.random()}`, // Unique key
            name: person.name,
            email: person.email,
            conference: person.conference,
            dietary_preference,
            amount_paid: person.amount_paid,
            currency: person.currency,
            invoice_code: person.invoice_code,
            purchase_date: person.purchase_date,
            payment_status: person.payment_status
          });
        }
      });
    } catch (e) {
      console.error('Failed to parse tickets_info for participant', person.id);
    }
  });

  return (
    <DashboardLayout>
      <header className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Social Dinner</h2>
          <p className="text-[var(--muted)] text-xs mt-0.5">Manage attendees and dietary preferences</p>
        </div>
        <div className="text-xs bg-[var(--accent)]/10 px-3 py-1.5 rounded-full text-[var(--muted)]">
          Total Attendees: <strong className="text-[var(--foreground)] ml-1">{attendees.length}</strong>
        </div>
      </header>

      <SocialDinnerFilter conferences={conferences} />

      <SocialDinnerTable attendees={attendees} />
    </DashboardLayout>
  );
}
