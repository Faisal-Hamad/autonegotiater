"use client";
import Link from "next/link";
import {realMode} from "@/lib/real-api";
import { useState } from "react";
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
    const [compare, setCompare] = useState<number[]>([]);
    const filtered = products.filter(p => (!category || p.category === category) && (!stock || p.stock_quantity > 0) && `${p.name} ${p.description ?? ""} ${p.category}`.toLowerCase().includes(query.trim().toLowerCase())).sort((a, b) => sort === "price-asc" ? Number(a.base_price) - Number(b.base_price) : sort === "price-desc" ? Number(b.base_price) - Number(a.base_price) : sort === "name" ? a.name.localeCompare(b.name) : sort === "newest" ? Date.parse(b.created_at) - Date.parse(a.created_at) : a.id - b.id);
    const selected = products.filter(p => compare.includes(p.id));
    return <>
    <Heading eyebrow="Marketplace" title="Find your next great deal" description="Explore public listing prices. Choose an item, set your preferences, and delegate the bargaining."/>
 {enabled && <div className="panel mb-6 border-indigo-100"><Badge>Competitive negotiation</Badge><p className="text-sm mt-3">Choose a product below, open its details, then enter your requirements to negotiate with Sellers offering the same catalog item.</p></div>}
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
        <h2>Compare public listings ({selected.length}/3)</h2>
        <button onClick={() => setCompare([])} className="text-sm text-indigo-600">Clear comparison</button>
        </div>
        <p className="muted text-sm mb-4">These are different products, not competing seller offers for the same item. Each product detail page has its own catalog-matched Seller negotiation.</p>
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
            <ProductLink href={`/products/${p.id}`} className="text-indigo-600">{p.name}</ProductLink>
            </td>
            <td>{money(p.base_price)}</td>
            <td>{p.category}</td>
            <td>{p.stock_quantity}</td>
            </tr>)}</tbody>
        </table>
        </div>
        </div>}
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
            <label className="flex gap-2 items-center text-xs">
            <input className="w-auto" type="checkbox" checked={compare.includes(p.id)} disabled={!compare.includes(p.id) && compare.length >= 3} onChange={e => setCompare(e.target.checked ? [...compare, p.id] : compare.filter(id => id !== p.id))}/>Compare listing</label>
            </article>)}</div> : <Empty title="No matching products" description="Try another keyword or clear the filters."/>}</>;
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
