import { getSellerDashboard } from "@/lib/api";
import Link from "next/link";

export const dynamic = "force-dynamic";

const sar = new Intl.NumberFormat("en-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 0 });

const DEMO_SELLERS = [
  { id: 1, name: "Ahmed Alharbi", email: "seller1@demo.autonegotiater.com" },
  { id: 2, name: "Sara Alqahtani", email: "seller2@demo.autonegotiater.com" },
  { id: 3, name: "Khalid Alotaibi", email: "seller3@demo.autonegotiater.com" },
];

export default async function SellerDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const params = await searchParams;
  const currentSellerId = params?.id ? parseInt(params.id, 10) || 1 : 1;
  const data = await getSellerDashboard(currentSellerId);

  return (
    <div className="space-y-8 py-6">
      {/* شريط اختيار وتبديل التاجر */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-slate-100 p-3 border border-slate-200">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
          Switch Demo Seller:
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {DEMO_SELLERS.map((s) => (
            <Link
              key={s.id}
              href={`/dashboard/seller?id=${s.id}`}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                currentSellerId === s.id
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200"
              }`}
            >
              {s.name} (Seller {s.id})
            </Link>
          ))}
        </div>
      </div>

      {/* رأس الصفحة وبيانات التاجر المختار */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Seller Dashboard</h1>
          <p className="text-sm text-slate-500">
            Welcome back, <span className="font-semibold text-slate-700">{data.seller.name}</span> ({data.seller.email})
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
            AI Agent Active
          </span>
        </div>
      </div>

      {/* الكروت الإحصائية للتاجر المختار */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Products</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{data.stats.total_products}</p>
        </div>
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Active Negotiations</p>
          <p className="mt-2 text-3xl font-bold text-indigo-600">{data.stats.active_negotiations}</p>
        </div>
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Completed Deals</p>
          <p className="mt-2 text-3xl font-bold text-emerald-600">{data.stats.completed_deals}</p>
        </div>
      </div>

      {/* جدول المنتجات وقواعد التفاوض الخاصة بالتاجر */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <div className="border-b bg-slate-50 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-800">My Listed Products & Negotiation Rules</h2>
          <p className="text-xs text-slate-500">Confidential floor prices are visible only to you as the seller.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-100 text-xs uppercase text-slate-700 border-b">
              <tr>
                <th className="px-6 py-3">Product</th>
                <th className="px-6 py-3">Category</th>
                <th className="px-6 py-3">Base Price</th>
                <th className="px-6 py-3">Min Secret Price</th>
                <th className="px-6 py-3">Auto-Accept</th>
                <th className="px-6 py-3">Stock</th>
                <th className="px-6 py-3">AI Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.products.map((p: any) => (
                <tr key={p.id} className="hover:bg-slate-50 transition">
                  <td className="px-6 py-4 font-medium text-slate-900">{p.name}</td>
                  <td className="px-6 py-4">
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-700">
                      {p.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-semibold text-slate-900">{sar.format(p.base_price)}</td>
                  <td className="px-6 py-4 text-rose-600 font-medium">{sar.format(p.min_acceptable_price)}</td>
                  <td className="px-6 py-4 text-slate-700">
                    {p.auto_accept_threshold ? sar.format(p.auto_accept_threshold) : "Manual"}
                  </td>
                  <td className="px-6 py-4">{p.stock_quantity} units</td>
                  <td className="px-6 py-4">
                    {p.has_rules ? (
                      <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                        Agent Enabled ({p.max_rounds} rounds)
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
                        Default Rules
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}