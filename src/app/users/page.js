import { query } from '@/lib/db';
import DashboardLayout from '../components/DashboardLayout';
import InviteUserForm from '../components/InviteUserForm';
import UserActions from '../components/UserActions';
import UsersFilter from '../components/UsersFilter';
import { verifySession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function UsersPage({ searchParams }) {
  const session = await verifySession();
  if (session?.role !== 'superadmin') {
    redirect('/');
  }

  const params = await searchParams;
  const search = params.search || '';
  const showAll = params.showAll === 'true';

  let sql = 'SELECT id, email, role, firstName, lastName, created_at FROM users WHERE 1=1';
  const queryParams = [];

  if (!showAll) {
    sql += " AND role != 'user'";
  }

  if (search) {
    sql += " AND (firstName LIKE ? OR lastName LIKE ? OR email LIKE ?)";
    const searchVal = `%${search}%`;
    queryParams.push(searchVal, searchVal, searchVal);
  }

  sql += ' ORDER BY role DESC, created_at DESC';

  const users = await query(sql, queryParams);

  return (
    <DashboardLayout>
      <header className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Admin Users</h2>
          <p className="text-[var(--muted)] text-xs mt-0.5">Manage platform administrators and their permissions</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-semibold text-[var(--muted)] bg-slate-100 px-2 py-1 rounded-md">
            {users.length} Users Found
          </span>
          <InviteUserForm />
        </div>
      </header>

      <UsersFilter />

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Administrator</th>
              <th style={{ width: 180 }}>Platform Role</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-400 uppercase">
                      {user.firstName?.charAt(0) || user.email.charAt(0)}
                    </div>
                    <div>
                      <div className="font-medium text-[var(--foreground)]">
                        {user.firstName || user.lastName ? `${user.firstName || ''} ${user.lastName || ''}` : 'Pending Invite'}
                      </div>
                      <div className="text-[11px] text-[var(--muted)]">{user.email}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <UserActions user={user} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardLayout>
  );
}
