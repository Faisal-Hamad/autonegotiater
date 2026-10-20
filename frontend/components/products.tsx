"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Product } from "@/lib/api";
import { money } from "@/lib/demo-model";
import { useDemo } from "./demo-provider";
import { Badge, Empty, Heading } from "./ui";
const MAX_SELLERS = 5;
export function ProductImage({ product }: {
    product: Product;
}) {
    const [failed, setFailed] = useState(false);
    const safe = product.image_url && (/^(https?:\/\/|\/)/.test(product.image_url));
    return <div className="product-art">{safe && !failed ? <img src={product.image_url!} alt={product.name} loading="lazy" onError={() => setFailed(true)}/> : <div className="text-center">
        <div aria-hidden="true" className="text-5xl mb-3">◇</div>
        <span className="text-xs">No image available</span>
        </div>}</div>;
}
export function ProductCatalog({ products: realProducts }: {
    products: Product[];
}) {
    const { enabled, state, user } = useDemo();
    const products = enabled ? state.products : realProducts;
    const [query, setQuery] = useState("");
    const [category, setCategory] = useState("");
    const [stock, setStock] = useState(false);
    const [sort, setSort] = useState("default");
    const [compare, setCompare] = useState<number[]>([]);
    useEffect(() => {
        const id = Number(new URLSearchParams(window.location.search).get("select"));
        if (Number.isInteger(id) && id > 0)
            setCompare(ids => ids.includes(id) ? ids : [...ids, id].slice(0, MAX_SELLERS));
    }, []);
    const multiSeller = enabled && user.role === "buyer";
    const toggle = (id: number) => setCompare(ids => ids.includes(id) ? ids.filter(x => x !== id) : ids.length < MAX_SELLERS ? [...ids, id] : ids);
    const filtered = products.filter(p => (!category || p.category === category) && (!stock || p.stock_quantity > 0) && `${p.name} ${p.description ?? ""} ${p.category}`.toLowerCase().includes(query.trim().toLowerCase())).sort((a, b) => sort === "price-asc" ? Number(a.base_price) - Number(b.base_price) : sort === "price-desc" ? Number(b.base_price) - Number(a.base_price) : sort === "name" ? a.name.localeCompare(b.name) : sort === "newest" ? Date.parse(b.created_at) - Date.parse(a.created_at) : a.id - b.id);
    const selected = products.filter(p => compare.includes(p.id));
    const available = selected.filter(p => p.stock_quantity > 0);
    return <>
    <Heading eyebrow="Marketplace" title="Find your next great deal" description="Explore public listing prices. Choose an item, set your preferences, and delegate the bargaining."/>
    {multiSeller && <div className="panel mb-6 border-indigo-200 bg-indigo-50">
        <p className="eyebrow">Recommended · one buyer, many sellers</p>
        <h2>Let your agent negotiate with several sellers at once</h2>
        <ol className="list-decimal ml-5 mt-3 space-y-1 text-sm">
        <li>Press <strong>Add to multi-seller negotiation</strong> on 2 to {MAX_SELLERS} listings that would all satisfy you.</li>
        <li>Press <strong>Negotiate with these sellers</strong> in the bar at the bottom of the screen.</li>
        <li>Your agent bargains with every seller in parallel and keeps the best offer.</li>
        </ol>
        <p className="muted text-sm mt-3">Want one specific item? Open it and choose <strong>Negotiate with this seller only</strong>.</p>
        </div>}
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
 {selected.length > 0 && <div className="panel mb-6">
        <div className="flex justify-between gap-3 mb-3">
        <h2>{multiSeller ? "Selected for multi-seller negotiation" : "Compare public listings"} ({selected.length}/{MAX_SELLERS})</h2>
        <button onClick={() => setCompare([])} className="text-sm text-indigo-600">Clear comparison</button>
        </div>
        <p className="muted text-sm mb-4">Select 2 to 5 listings that would all satisfy you. Your agent negotiates with each seller at once and keeps the best offer.</p>
        <div className="table-wrap">
        <table>
        <thead>
        <tr>
        <th>Listing</th>
        <th>Public price</th>
        <th>Category</th>
        <th>Stock</th>
        </tr>
        </thead>
        <tbody>{selected.map(p => <tr key={p.id}>
            <td>
            <Link href={`/products/${p.id}`} className="text-indigo-600">{p.name}</Link>
            </td>
            <td>{money(p.base_price)}</td>
            <td>{p.category}</td>
            <td>{p.stock_quantity}</td>
            </tr>)}</tbody>
        </table>
        </div>
        </div>}
 {filtered.length ? <div className="product-grid">{filtered.map(p => <article key={p.id} className="panel flex flex-col gap-4">
            <Link href={`/products/${p.id}`} aria-label={`View ${p.name}`}>
            <ProductImage product={p}/>
            </Link>
            <div>
            <Badge>{p.category}</Badge>
            <h2 className="mt-3">
            <Link href={`/products/${p.id}`}>{p.name}</Link>
            </h2>
            <p className="muted text-sm mt-2 line-clamp-2">{p.description || "No description provided."}</p>
            </div>
            <div className="flex justify-between items-center mt-auto gap-2">
            <strong className="text-xl">{money(p.base_price)}</strong>
            <span className={`text-xs ${p.stock_quantity > 0 ? "text-emerald-700" : "text-rose-700"}`}>{p.stock_quantity > 0 ? `${p.stock_quantity} in stock` : "Out of stock"}</span>
            </div>
            <Link className="btn-secondary" href={`/products/${p.id}`}>View details →</Link>
            {multiSeller ? <button type="button" className={compare.includes(p.id) ? "btn" : "btn-secondary border-indigo-300 text-indigo-700"} aria-pressed={compare.includes(p.id)} disabled={p.stock_quantity < 1 || (!compare.includes(p.id) && compare.length >= MAX_SELLERS)} onClick={() => toggle(p.id)}>{p.stock_quantity < 1 ? "Out of stock" : compare.includes(p.id) ? "✓ Added · tap to remove" : "+ Add to multi-seller negotiation"}</button> : <label className="flex gap-2 items-center text-xs">
            <input className="w-auto" type="checkbox" checked={compare.includes(p.id)} disabled={!compare.includes(p.id) && compare.length >= MAX_SELLERS} onChange={() => toggle(p.id)}/>Compare listing</label>}
            </article>)}</div> : <Empty title="No matching products" description="Try another keyword or clear the filters."/>}
    {multiSeller && selected.length > 0 && <div className="h-24" aria-hidden="true"/>}
    {multiSeller && selected.length > 0 && <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 shadow-[0_-8px_30px_#0000001a]" role="region" aria-label="Multi-seller selection">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
        <div className="min-w-0">
        <p className="font-bold">{available.length} of {MAX_SELLERS} listings selected</p>
        <p className="muted text-xs truncate">{available.map(p => p.name).join(" · ")}</p>
        </div>
        <div className="flex gap-2">
        <button type="button" className="btn-secondary" onClick={() => setCompare([])}>Clear</button>
        {available.length >= 2 ? <Link className="btn" href={`/negotiate?products=${available.map(p => p.id).join(",")}`}>Negotiate with these {available.length} sellers →</Link> : <span className="btn opacity-50" aria-disabled="true">Add at least one more listing</span>}
        </div>
        </div>
        </div>}</>;
}
export function ProductDetails({ product: original }: {
    product: Product;
}) {
    const { enabled, state, user } = useDemo();
    const p = enabled ? state.products.find(p => p.id === original.id) ?? original : original;
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
    <div className="mt-8">{p.stock_quantity < 1 ? <button className="btn w-full" disabled>Out of stock</button> : enabled && user.role === "buyer" ? <div className="space-y-3">
    <Link className="btn w-full" href={`/products?select=${p.id}`}>+ Add to multi-seller negotiation →</Link>
    <p className="muted text-xs text-center">Recommended: pick 2 to {MAX_SELLERS} similar listings and your agent keeps the best offer.</p>
    <Link className="btn-secondary w-full" href={`/products/${p.id}/negotiate`}>Negotiate with this seller only</Link>
    </div> : <p className="panel text-sm">{enabled ? "Switch to a buyer demo identity to start a simulation." : "Negotiation setup requires an authenticated buyer and a future FastAPI endpoint."}</p>}</div>
    <p className="muted text-xs mt-4">{enabled ? "Local simulation only. No real AI or transaction." : "No negotiation will start without a supported backend."}</p>
    </div>
    </div>
    <div className="panel mt-6">
    <h2>Compare sellers</h2>
    <p className="muted mt-2">Each listing has one seller. To compare sellers, add this listing and other similar ones to a multi-seller negotiation: your agent bargains with each seller at the same time and scores their offers against your budget and your ranking.</p>
    </div>
    </>;
}
