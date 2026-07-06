import { query } from '@/lib/db';
import { verifySession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import DashboardLayout from '../components/DashboardLayout';
import { Activity, Search } from 'lucide-react';

export default async function AuditLogsPage({ searchParams }) {
    const session = await verifySession();
    // Restrict strictly to Superadmins as requested
    if (!session || session.role !== 'superadmin') {
        redirect('/login');
    }

    const { admin_email, entity_type } = await searchParams || {};

    let sql = 'SELECT * FROM audit_logs WHERE 1=1';
    let queryParams = [];

    if (admin_email) {
        sql += ' AND admin_email LIKE ?';
        queryParams.push(`%${admin_email}%`);
    }

    if (entity_type) {
        sql += ' AND entity_type LIKE ?';
        queryParams.push(`%${entity_type}%`);
    }

    sql += ' ORDER BY created_at DESC LIMIT 500';

    const logs = await query(sql, queryParams);

    return (
        <DashboardLayout>
            <div className="mb-6 flex justify-between items-center bg-[var(--card)] p-5 rounded-xl border border-[var(--border)]">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Activity className="w-6 h-6 text-indigo-500" /> 
                        Audit Logs
                    </h2>
                    <p className="text-sm text-[var(--muted)] mt-1">Superadmin only. Showing the last 500 administrative actions taken on the platform.</p>
                </div>
            </div>

            <div className="card p-5 border border-[var(--border)] bg-white overflow-hidden shadow-sm">
                <form className="flex gap-4 mb-6">
                    <div className="flex-1 relative">
                        <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                        <input 
                            name="admin_email"
                            defaultValue={admin_email || ''}
                            placeholder="Filter by admin email..."
                            className="input-base w-full pl-9 h-9 text-sm bg-slate-50"
                        />
                    </div>
                    <div className="flex-1">
                        <input 
                            name="entity_type"
                            defaultValue={entity_type || ''}
                            placeholder="Filter by entity (e.g. PAYMENT, ACTIVITY)..."
                            className="input-base w-full h-9 text-sm bg-slate-50"
                        />
                    </div>
                    <button type="submit" className="px-4 h-9 bg-black text-white text-sm font-semibold rounded-lg hover:bg-slate-800 transition-colors shadow-md">
                        Filter
                    </button>
                    {(admin_email || entity_type) && (
                        <a href="/audit-logs" className="px-4 flex items-center h-9 bg-slate-100 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-200 transition-colors">
                            Clear
                        </a>
                    )}
                </form>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-50">
                                <th className="p-3 font-semibold text-slate-600">Time</th>
                                <th className="p-3 font-semibold text-slate-600">Admin</th>
                                <th className="p-3 font-semibold text-slate-600">Action</th>
                                <th className="p-3 font-semibold text-slate-600">Entity</th>
                                <th className="p-3 font-semibold text-slate-600">Entity ID</th>
                                <th className="p-3 font-semibold text-slate-600">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {logs.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="p-8 text-center text-slate-500">No logs found matching your filters.</td>
                                </tr>
                            ) : (
                                logs.map(log => (
                                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="p-3 text-slate-500 text-xs">
                                            {new Date(log.created_at).toLocaleString()}
                                        </td>
                                        <td className="p-3 font-medium text-slate-800">
                                            {log.admin_email}
                                        </td>
                                        <td className="p-3">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                                log.action_type === 'CREATE' ? 'bg-green-100 text-green-700' :
                                                log.action_type === 'UPDATE' ? 'bg-blue-100 text-blue-700' :
                                                log.action_type === 'DELETE' ? 'bg-red-100 text-red-700' :
                                                log.action_type === 'SEND_EMAIL' ? 'bg-purple-100 text-purple-700' :
                                                'bg-slate-100 text-slate-700'
                                            }`}>
                                                {log.action_type}
                                            </span>
                                        </td>
                                        <td className="p-3 text-slate-600 font-medium">
                                            {log.entity_type}
                                        </td>
                                        <td className="p-3 text-slate-500 font-mono text-xs">
                                            {log.entity_id || '-'}
                                        </td>
                                        <td className="p-3">
                                            <div className="max-w-[300px] overflow-hidden text-ellipsis group-hover:max-w-none group-hover:whitespace-normal transition-all duration-200 ease-in-out cursor-default">
                                                {log.details ? (
                                                    <pre className="text-[10px] text-slate-500 bg-slate-50 p-1.5 rounded border border-slate-100 m-0 w-full overflow-hidden">
                                                        {typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}
                                                    </pre>
                                                ) : <span className="text-slate-300 text-xs italic">No details</span>}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </DashboardLayout>
    );
}
