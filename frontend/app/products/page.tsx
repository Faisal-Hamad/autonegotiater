import { getProducts } from "@/lib/api";

export const dynamic = "force-dynamic";

const sar = new Intl.NumberFormat("en-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 0 });

export default async function ProductsPage() {
  const products = await getProducts();

  return (
    <section>
      <h1 className="text-2xl font-bold">Products</h1>
      <p className="mt-1 text-sm text-slate-500">{products.length} items available for negotiation</p>

      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => (
          <li key={p.id} className="flex flex-col rounded-xl border bg-white p-5 shadow-sm">
            <span className="w-fit rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
              {p.category}
            </span>
            <h2 className="mt-3 font-semibold">{p.name}</h2>
            <p className="mt-1 flex-1 text-sm text-slate-600">{p.description}</p>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-lg font-bold">{sar.format(Number(p.base_price))}</span>
              <span className="text-xs text-slate-500">{p.stock_quantity} in stock</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
