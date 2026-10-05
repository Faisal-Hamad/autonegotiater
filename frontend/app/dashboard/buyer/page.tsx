import { getBuyerDashboard } from "@/lib/api";
import Link from "next/link";

export const dynamic = "force-dynamic";

const sar = new Intl.NumberFormat("en-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 0 });

export default async function BuyerDashboardPage() {
  const data = await getBuyerDashboard(4); // Buyer 4 (Noura Alshammari)

  return (
    <div className="space-y-8 py-6">
      {/* رأس الصفحة وبيانات المشتري */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Buyer Dashboard</h1>
          <p className="text-sm text-slate-500">
            Welcome back, <span className="font-semibold text-slate-700">{data.buyer.name}</span> ({data.buyer.email})
          </p>
        </div>
        <Link
          href="/products"
          className="w-fit rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition"
        >
          Explore More Products
        </Link>
      </div>

      {/* الكروت الإحصائية السريعة */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Active Negotiations</p>
          <p className="mt-2 text-3xl font-bold text-indigo-600">{data.stats.active_negotiations}</p>
        </div>
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Closed Deals</p>
          <p className="mt-2 text-3xl font-bold text-emerald-600">{data.stats.completed_deals}</p>
        </div>
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Sessions</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{data.stats.total_sessions}</p>
        </div>
      </div>

      {/* جدول جلسات التفاوض */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <div className="border-b bg-slate-50 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-800">My Negotiation Sessions</h2>
          <p className="text-xs text-slate-500">Track real-time autonomous AI bargaining sessions.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-100 text-xs uppercase text-slate-700 border-b">
              <tr>
                <th className="px-6 py-3">Session #</th>
                <th className="px-6 py-3">Product</th>
                <th className="px-6 py-3">Original Price</th>
                <th className="px-6 py-3">Max Budget</th>
                <th className="px-6 py-3">Mode</th>
                <th className="px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.sessions.length > 0 ? (
                data.sessions.map((s: any) => (
                  <tr key={s.session_id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4 font-mono font-medium">#{s.session_id}</td>
                    <td className="px-6 py-4 font-medium text-slate-900">{s.product_name}</td>
                    <td className="px-6 py-4 text-slate-500 line-through">{sar.format(s.base_price)}</td>
                    <td className="px-6 py-4 font-semibold text-slate-900">
                      {s.max_budget ? sar.format(s.max_budget) : "N/A"}
                    </td>
                    <td className="px-6 py-4 capitalize">{s.mode.replace("_", "-")}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                          s.status === "active"
                            ? "bg-indigo-50 text-indigo-700 ring-indigo-600/20"
                            : s.status === "completed"
                            ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
                            : "bg-slate-50 text-slate-600 ring-slate-500/10"
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    No active sessions found. Start a negotiation from the products catalog!
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