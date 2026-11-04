"use client";
import Link from "next/link";
import {realMode} from "@/lib/real-api";
import { useEffect, useState } from "react";
import type { Product } from "@/lib/api";
import { CompetitiveSetup } from "./competitive-negotiation";
import { money } from "@/lib/demo-model";
import { useDemo } from "./demo-provider";
import { Badge, Empty, Heading } from "./ui";
export function ProductImage({ product }: {
    product: Product;
}) {
    const [failed, setFailed] = useState(false);
    const safe = product.image_url && (/^(https?:\/\/|\/(?!\/))/.test(product.image_url));
    return <div className="product-art">{safe && !failed ? <img src={product.image_url!} alt={product.name} loading="lazy" onError={() => setFailed(true)}/> : <div className="text-center">
        <div aria-hidden="true" className="text-5xl mb-3">◇</div>
        <span className="text-xs">No image available</span>
        </div>}</div>;
}
const MAX_PICK = 5;
export function ProductCatalog({ products: realProducts }: {
    products: Product[];
}) {
    const { enabled, state } = useDemo();
    // Native production links remain reliable across reverse proxies and cached RSC variants.
    const ProductLink = realMode ? "a" : Link;
    const products = enabled ? state.products : realProducts;
    const [query, setQuery] = useState("");
    const [category, setCategory] = useState("");
    const [stock, setStock] = useState(false);
    const [sort, setSort] = useState("default");
    // Multi-seller negotiation (option B): the buyer picks 2 to 5 listings they would all accept.
    const [picked, setPicked] = useState<number[]>([]);
    useEffect(() => { const ids = [...new Set((new URLSearchParams(window.location.search).get("select") ?? "").split(",").map(Number).filter(n => Number.isInteger(n) && n > 0))].slice(0, MAX_PICK); if (ids.length) setPicked(ids); }, []);
    const toggle = (id: number) => setPicked(list => list.includes(id) ? list.filter(x => x !== id) : list.length >= MAX_PICK ? list : [...list, id]);
    const filtered = products.filter(p => (!category || p.category === category) && (!stock || p.stock_quantity > 0) && `${p.name} ${p.description ?? ""} ${p.category}`.toLowerCase().includes(query.trim().toLowerCase())).sort((a, b) => sort === "price-asc" ? Number(a.base_price) - Number(b.base_price) : sort === "price-desc" ? Number(b.base_price) - Number(a.base_price) : sort === "name" ? a.name.localeCompare(b.name) : sort === "newest" ? Date.parse(b.created_at) - Date.parse(a.created_at) : a.id - b.id);
    const selected = picked.map(id => products.find(p => p.id === id)).filter((p): p is Product => !!p);
    return <>
    <Heading eyebrow="Marketplace" title="Find your next great deal" description="Explore public listing prices. Choose an item, set your preferences, and delegate the bargaining."/>
 {enabled && <div className="panel mb-6 border-indigo-100"><Badge>Multi-seller negotiation</Badge><p className="text-sm mt-3">Press <strong>+ Multi-seller negotiation</strong> on 2 to {MAX_PICK} listings you would be happy to buy, then <strong>Negotiate with these sellers</strong>: your agent negotiates with all of them at the same time and you choose the best agreement. Or open any product to negotiate with every seller of the same model, negotiate one-to-one, or buy it directly.</p></div>}
 <div className="panel mb-6">
    <div className="grid gap-4 md:grid-cols-3">
    <label>Search products<input placeholder="Name, description or category" value={query} onChange={e => setQuery(e.target.value)}/>
    </label>
    <label>Category<select value={category} onChange={e => setCategory(e.target.value)}>
    <option value="">All categories</option>{[...new Set(products.map(p => p.category))].map(c => <option key={c}>{c}</option>)}</select>
    </label>
    <label>Sort by<select value={sort} onChange={e => setSort(e.target.value)}>
    <option value="default">Default</option>
    <option value="price-asc">Price: low to high</option>
    <option value="price-desc">Price: high to low</option>
    <option value="name">Name</option>
    <option value="newest">Newest</option>
    </select>
    </label>
    </div>
    <div className="flex justify-between flex-wrap gap-3 mt-4">
    <label className="flex gap-2 items-center">
    <input type="checkbox" className="w-auto" checked={stock} onChange={e => setStock(e.target.checked)}/> In stock only</label>
    <button className="text-sm text-indigo-600" onClick={() => { setQuery(""); setCategory(""); setStock(false); setSort("default"); }}>Reset filters</button>
    </div>
    </div>
 <p className="muted text-sm mb-4">{filtered.length} of {products.length} products · Search and sorting apply to the loaded catalog.</p>
 {filtered.length ? <div className="product-grid">{filtered.map(p => <article key={p.id} className="panel flex flex-col gap-4">
            <ProductLink href={`/products/${p.id}`} aria-label={`View ${p.name}`}>
            <ProductImage product={p}/>
            </ProductLink>
            <div>
            <Badge>{p.category}</Badge>
            <h2 className="mt-3">
            <ProductLink href={`/products/${p.id}`}>{p.name}</ProductLink>
            </h2>
            <p className="muted text-sm mt-2 line-clamp-2">{p.description || "No description provided."}</p>
            </div>
            <div className="flex justify-between items-center mt-auto gap-2">
            <strong className="text-xl">{money(p.base_price)}</strong>
            <span className={`text-xs ${p.stock_quantity > 0 ? "text-emerald-700" : "text-rose-700"}`}>{p.stock_quantity > 0 ? `${p.stock_quantity} in stock` : "Out of stock"}</span>
            </div>
            <ProductLink className="btn-secondary" href={`/products/${p.id}`}>View details →</ProductLink>
            <button type="button" aria-pressed={picked.includes(p.id)} disabled={!picked.includes(p.id) && (picked.length >= MAX_PICK || p.stock_quantity < 1)} onClick={() => toggle(p.id)}
                className={`text-sm font-semibold rounded-lg border px-3 py-2 transition ${picked.includes(p.id) ? "bg-indigo-600 border-indigo-600 text-white" : "border-indigo-200 text-indigo-700 hover:bg-indigo-50"} disabled:opacity-50 disabled:cursor-not-allowed`}>
                {picked.includes(p.id) ? "✓ Added · remove" : "+ Multi-seller negotiation"}</button>
            </article>)}</div> : <Empty title="No matching products" description="Try another keyword or clear the filters."/>}
 {selected.length > 0 && <div className="h-24" aria-hidden/>}
 {selected.length > 0 && <section aria-label="Multi-seller selection" className="fixed bottom-0 inset-x-0 z-30 border-t border-indigo-100 bg-white/95 backdrop-blur shadow-[0_-6px_20px_#3240a01a]">
    <div className="max-w-6xl mx-auto px-6 py-3 flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1"><strong className="block">Multi-seller negotiation · {selected.length} of {MAX_PICK} selected</strong>
            <span className="text-xs muted block truncate">{selected.map(p => p.name).join(" · ")}</span>
            {selected.length < 2 && <span className="text-xs text-amber-700 block">Add at least one more listing (2 to {MAX_PICK}).</span>}</div>
        <button type="button" className="text-sm text-indigo-600" onClick={() => setPicked([])}>Clear</button>
        {selected.length >= 2 ? <ProductLink className="btn" href={`/products/${selected[0].id}?select=${selected.map(p => p.id).join(",")}`}>Negotiate with these {selected.length} sellers →</ProductLink> : <button className="btn" disabled>Negotiate with these sellers →</button>}
    </div>
 </section>}</>;
}
export function ProductDetails({ product: original }: {
    product: Product;
}) {
    const { enabled, state, user } = useDemo();
    const p = enabled ? state.products.find(p => p.id === original.id) ?? original : original;
    if (enabled) return <CompetitiveSetup key={`${user.id}:${p.id}`} product={p}/>;
    return <>
    <Link href="/products" className="text-indigo-600 text-sm">← Back to marketplace</Link>
    <div className="grid md:grid-cols-2 gap-8 mt-6">
    <ProductImage product={p}/>
    <div className="panel">
    <Badge>{p.category}</Badge>
    <h1 className="mt-5">{p.name}</h1>
    <p className="text-3xl font-bold mt-6">{money(p.base_price)}</p>
    <p className="muted text-sm mt-1">Public listing price · SAR</p>
    <p className="mt-5 text-sm">{p.stock_quantity > 0 ? `${p.stock_quantity} units available` : "Out of stock"}</p>
    <p className="mt-5 muted whitespace-pre-wrap">{p.description || "No description provided."}</p>
    <div className="mt-8">{p.stock_quantity < 1 ? <button className="btn w-full" disabled>Out of stock</button> : enabled && user.role === "buyer" ? <Link className="btn w-full" href={`/products/${p.id}/negotiate`}>Start one-to-one negotiation →</Link> : <p className="panel text-sm">{enabled ? "Switch to a buyer demo identity to start a simulation." : "Negotiation requires secure buyer authentication and a role-scoped FastAPI integration."}</p>}</div>
    <p className="muted text-xs mt-4">{enabled ? "Local simulation only. No real AI or transaction." : "Existing one-to-one contracts are not enabled here until access control and persistence safeguards pass."}</p>
    </div>
    </div>
    {enabled ? <CompetitiveSetup key={`${user.id}:${p.id}`} product={p}/> : <div className="panel mt-6"><h2>Seller offers</h2><p className="muted mt-2">Competitive negotiation is available only with local Mock Data. The current FastAPI contract provides one listing per product.</p></div>}
    </>;
}
