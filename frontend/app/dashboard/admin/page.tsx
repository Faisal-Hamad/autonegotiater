import { getAdminDashboard } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const data = await getAdminDashboard();

  return (
    <div className="space-y-8 py-6">
      {/* رأس الصفحة */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">System Administration</h1>
          <p className="text-sm text-slate-500">Platform-wide overview, active sessions, and security audit logs.</p>
        </div>
        <span className="w-fit rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
          Admin Portal
        </span>
      </div>

      {/* كروت الإحصائيات الشاملة للنظام */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Users</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{data.metrics.total_users}</p>
          <p className="mt-1 text-xs text-slate-400">
            {data.metrics.total_buyers} Buyers · {data.metrics.total_sellers} Sellers
          </p>
        </div>
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Listed Products</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{data.metrics.total_products}</p>
          <p className="mt-1 text-xs text-slate-400">Active catalog items</p>
        </div>
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Negotiation Sessions</p>
          <p className="mt-2 text-2xl font-bold text-indigo-600">{data.metrics.total_sessions}</p>
          <p className="mt-1 text-xs text-indigo-500">{data.metrics.active_sessions} currently live</p>
        </div>
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Deals Finalized</p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">{data.metrics.completed_deals}</p>
          <p className="mt-1 text-xs text-emerald-500">Successful agreements</p>
        </div>
      </div>

      {/* جدول سجل التدقيق الأمني (Audit Logs) */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <div className="border-b bg-slate-50 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-800">Security & Activity Audit Logs</h2>
          <p className="text-xs text-slate-500">Immutable ledger of system events and negotiation activities.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-100 text-xs uppercase text-slate-700 border-b">
              <tr>
                <th className="px-6 py-3">Log ID</th>
                <th className="px-6 py-3">User ID</th>
                <th className="px-6 py-3">Action</th>
                <th className="px-6 py-3">Details</th>
                <th className="px-6 py-3">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.recent_audit_logs.length > 0 ? (
                data.recent_audit_logs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-3 font-mono font-medium text-xs">#{log.id}</td>
                    <td className="px-6 py-3">User {log.user_id}</td>
                    <td className="px-6 py-3 font-medium text-slate-800">{log.action}</td>
                    <td className="px-6 py-3 text-xs font-mono text-slate-500">
                      {JSON.stringify(log.details)}
                    </td>
                    <td className="px-6 py-3 text-xs text-slate-400">{log.timestamp}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    No audit logs recorded yet. System events will be logged automatically.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}