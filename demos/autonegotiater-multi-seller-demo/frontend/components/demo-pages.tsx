"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useDemo } from "./demo-provider";
import { Badge, BackendPending, Empty, Heading, Stats } from "./ui";
import { ProductDetails } from "./products";
import { SessionDetail } from "./negotiation";
import { UnifiedWorkspace, UnifiedCompetitiveDetail, UnifiedAgreementDetail, UnifiedNotifications } from "./unified-workspace";
import { SellerProductsManager, AdminProductListings } from "./storefront-manager";
import { useCompetitiveWorkspace, useSellerCompetitive } from "./competitive-provider";
import { SellerCompetitiveSessions, SellerCompetitiveUpdates } from "./seller-competitive";
import { AdminReports } from "./admin-reports";
import { addAudit, money, nextId, negotiationRoundCount, visibleDeals, visibleSessions, type Role } from "@/lib/demo-model";
import type { Product } from "@/lib/api";
export function LocalProductDetails({ id }: {
    id: number;
}) { const { state } = useDemo(); const p = state.products.find(p => p.id === id); return p ? <ProductDetails product={p}/> : <Empty title="Product not found" description="The local listing was not found. Demo state resets on refresh." href="/products" label="Marketplace"/>; }
function ProductForm({ id }: {
    id?: number;
}) {
    const { state, user, setState, notify } = useDemo();
    const router = useRouter();
    const competitive=useCompetitiveWorkspace();
    const [error, setError] = useState("");
    const p = id ? state.products.find(p => p.id === id && p.seller_id === user.id) : undefined;
    if (id && !p)
        return <Empty title="Product unavailable" description="This product does not belong to the selected seller."/>;
    function save(e: FormEvent<HTMLFormElement>) { e.preventDefault(); const f = new FormData(e.currentTarget); const price = Number(f.get("price")); const stock = Number(f.get("stock")); const name = String(f.get("name")).trim(); const category = String(f.get("category")).trim(); const url = String(f.get("image")).trim(); const rule = state.rules.find(r => r.productId === id); if (p && (name!==p.name || category!==p.category)) { setError("Catalog identity is immutable. Create a new product for a different variant."); return; } if (!name || !category || !Number.isFinite(price) || price <= 0 || price > 1000000 || !Number.isInteger(stock) || stock < 0 || stock > 10000 || (rule && (price < rule.minimum || price < rule.threshold)) || (url && !/^(https?:\/\/|\/(?!\/))/.test(url))) {
        setError("Check name, category, positive price, whole-number stock and image URL. Lower your private floor and auto-accept threshold first if the new public price would be below either.");
        return;
    } const product: Product = { id: p?.id ?? nextId(state.products), seller_id: user.id, name, category, description: String(f.get("description")).trim() || null, base_price: price.toFixed(2), stock_quantity: stock, image_url: url || null, created_at: p?.created_at ?? new Date().toISOString() }; if(p)competitive.savePrimary(product,rule??{minimum:Number((price*.85).toFixed(2)),discount:15,rounds:6,enabled:true}); setState(s => addAudit({ ...s, products: p ? s.products.map(item => item.id === p.id ? product : item) : [product, ...s.products] }, p ? "demo_product_updated" : "demo_product_created", product.id)); notify("Product saved locally. No database write."); router.push("/dashboard/seller/products"); }
    return <>
    <Heading eyebrow="Seller catalog" title={p ? "Edit product" : "Add a product"} description="Existing product name/category identify a fixed catalog variant and are read-only. Create a new product for a different variant. Descriptions, prices, stock and media remain editable."/>
    <form onSubmit={save} className="panel space-y-6 max-w-3xl">
    <div className="field-grid">
    <label>Product name<input name="name" required maxLength={150} readOnly={!!p} defaultValue={p?.name}/>
    </label>
    <label>Category<input name="category" required maxLength={80} readOnly={!!p} defaultValue={p?.category}/>
    </label>
    <label>Public price (SAR)<input name="price" required type="number" min="0.01" step="0.01" defaultValue={p?.base_price}/>
    </label>
    <label>Stock quantity<input name="stock" required type="number" min="0" max="10000" step="1" defaultValue={p?.stock_quantity ?? 1}/>
    </label>
    </div>
    <label>Description<textarea name="description" rows={4} maxLength={3000} defaultValue={p?.description ?? ""}/>
    </label>
    <label>Image URL (optional)<input name="image" defaultValue={p?.image_url ?? ""} placeholder="https://… or /media/…"/>
    </label>
    <p className="muted text-xs">Image upload and structured product condition are unavailable in the current API. Use the description for condition; no upload endpoint is invented.</p>{error && <p role="alert" className="text-rose-700">{error}</p>}<div className="flex gap-3">
    <button className="btn">Save demo product</button>
    <Link className="btn-secondary" href="/dashboard/seller/products">Cancel</Link>
    </div>
    </form>
    </>;
}
function RulesForm({ id }: {
    id: number;
}) {
    const { state, user, setState, notify } = useDemo();
    const competitive = useCompetitiveWorkspace();
    const [error, setError] = useState("");
    const p = state.products.find(p => p.id === id && p.seller_id === user.id);
    const r = state.rules.find(r => r.productId === id);
    if (!p)
        return <Empty title="Product unavailable" description="Rules can be edited only for the selected demo seller's products."/>;
    function save(e: FormEvent<HTMLFormElement>) { e.preventDefault(); if (!p)
        return; const f = new FormData(e.currentTarget); const minimum = Number(f.get("minimum")); const threshold = Number(f.get("threshold")); const discount = Number(f.get("discount")); const rounds = Number(f.get("rounds")); if (![minimum, threshold, discount, rounds].every(Number.isFinite) || minimum <= 0 || minimum > Number(p.base_price) || threshold < minimum || threshold > Number(p.base_price) || discount < 0 || discount > 100 || !Number.isInteger(rounds) || rounds < 1 || rounds > 20) {
        setError("Floor must be positive and no higher than the public price. Auto-accept must be between floor and public price. Discount: 0–100%. Rounds: 1–20.");
        return;
    } setError(""); competitive.savePrimary(p,{minimum,discount,rounds,enabled:f.get("enabled")==="on"}); setState(s => addAudit({ ...s, rules: [...s.rules.filter(x => x.productId !== id), { productId: id, minimum, threshold, discount, rounds, enabled: f.get("enabled") === "on" }] }, "demo_rules_updated", id)); notify("Confidential demo rules saved locally."); }
    return <>
    <Heading eyebrow="Seller rules" title={`Configure ${p.name}`} description="Synthetic private seller limits. Only the owning seller's interface displays them."/>
    <form className="panel max-w-3xl space-y-6" onSubmit={save}>
    <div className="field-grid">
    <label>Minimum acceptable price (SAR)<input name="minimum" type="number" min="0.01" step="0.01" required defaultValue={r?.minimum ?? Number((Number(p.base_price) * .8).toFixed(2))}/>
    </label>
    <label>Auto-accept threshold (SAR)<input name="threshold" type="number" min="0.01" step="0.01" required defaultValue={r?.threshold ?? Number((Number(p.base_price) * .95).toFixed(2))}/>
    </label>
    <label>Maximum discount (%)<input name="discount" type="number" min="0" max="100" step="0.01" required defaultValue={r?.discount ?? 20}/>
    </label>
    <label>Maximum rounds<input name="rounds" type="number" min="1" max="20" step="1" required defaultValue={r?.rounds ?? 4}/>
    </label>
    </div>
    <label className="flex gap-2 items-center">
    <input name="enabled" type="checkbox" className="w-auto" defaultChecked={r?.enabled ?? true}/>Enable simulated agent</label>
    <p className="muted text-sm">This is not the production concession strategy. The demo respects floor, discount and round limits; warranty and delivery are scripted preferences. Competitive rounds are capped at 12; legacy allows up to 20. Primary competitive settings apply to new sessions only; active snapshots remain unchanged. Use My Products & Agent Settings for listing-specific delivery and Agent controls. Legacy execution keeps its existing rule checks.</p>{error && <p role="alert" className="text-rose-700">{error}</p>}<button className="btn">Save demo rules</button>
    </form>
    </>;
}
function DealDetail({ id }: {
    id: number;
}) {
    const { state, user, setState, notify } = useDemo();
    const d = visibleDeals(state, user).find(d => d.id === id);
    const [error, setError] = useState("");
    if (!d)
        return <Empty title="Agreement unavailable" description="This agreement is not available for the selected demo identity."/>;
    const p = state.products.find(p => p.id === d.productId);
    return <>
    <Heading eyebrow="Agreement summary" title={`Agreement #${d.id}`} description={p?.name} action={<Badge>Simulated agreement</Badge>}/>
    <div className="panel max-w-3xl">
    <p className="text-4xl font-bold mb-6">{money(d.price)}</p>
    <dl className="grid sm:grid-cols-2 gap-5">
    <div>
    <dt className="muted text-sm">Warranty</dt>
    <dd>{d.warranty} months</dd>
    </div>
    <div>
    <dt className="muted text-sm">Delivery</dt>
    <dd>{d.delivery}</dd>
    </div>
    <div>
    <dt className="muted text-sm">Closed</dt>
    <dd>{new Date(d.createdAt).toLocaleDateString("en-GB")}</dd>
    </div>
    <div>
    <dt className="muted text-sm">Payment / fulfillment</dt>
    <dd>No payment or shipment is processed in this demo.</dd>
    </div>
    </dl>
    <button className="btn-secondary mt-6" onClick={() => window.print()}>Print / save summary as PDF</button>
    <p className="muted text-xs mt-3">Browser print export only. This is not an official backend-issued agreement.</p>
    </div>{user.role === "buyer" && <form className="panel max-w-3xl mt-6 space-y-4" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); const rating = Number(f.get("rating")); if (rating < 1 || rating > 5) {
            setError("Select a rating from 1 to 5.");
            return;
        } setState(s => addAudit({ ...s, deals: s.deals.map(item => item.id === id ? { ...item, rating, feedback: String(f.get("feedback")) } : item) }, "demo_rating_saved", id)); notify("Demo feedback saved."); }}>
        <h2>Your review</h2>
        <label>Rating<select name="rating" defaultValue={d.rating ?? 5}>{[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} stars</option>)}</select>
        </label>
        <label>Feedback<textarea name="feedback" maxLength={500} defaultValue={d.feedback}/>
        </label>{error && <p role="alert">{error}</p>}<button className="btn">Save demo rating</button>{d.rating && <p className="text-emerald-700 text-sm">Saved rating: {d.rating}/5</p>}</form>}</>;
}
export function DemoScreen({ role, segments = [] }: {
    role: Role;
    segments?: string[];
}) {
    const { enabled, state, user, setUserId, setState, notify } = useDemo();
    const competitiveSellerSessions = useSellerCompetitive();
    const [filter, setFilter] = useState("");
    const [status, setStatus] = useState("");
    if (!enabled)
        return <BackendPending />;
    if (user.role !== role)
        return <>
        <Heading title={`${role[0].toUpperCase() + role.slice(1)} demo workspace`} description="Select a synthetic identity for this workspace. Client-side selection is not authentication or authorization."/>
        <div className="grid sm:grid-cols-3 gap-4">{state.users.filter(u => u.role === role).map(u => <button className="panel text-left" key={u.id} disabled={!u.active} onClick={() => setUserId(u.id)}>
            <h2>{u.name}</h2>
            <p className="muted text-sm mt-2">{u.email}</p>
            <p className="text-indigo-600 text-sm mt-4">Use demo identity →</p>
            </button>)}</div>
        </>;
    if(!user.active)return <Empty title="Active demo identity required" description="Choose an active demo account. This is not production authorization." href="/login" label="Choose identity"/>;
    const section = segments[0] ?? "overview";
    const id = Number(segments[1]);
    const sessions = visibleSessions(state, user);
    const deals = visibleDeals(state, user);
    const products = role === "seller" ? state.products.filter(p => p.seller_id === user.id) : state.products;
    const base = `/dashboard/${role}`;
    if(role === "seller" && (section === "storefronts" || section === "products" && !segments[1]))return <SellerProductsManager/>;
    if(role === "admin" && section === "products")return <AdminProductListings/>;
    if(section === "competitive-session" || section === "competitive" && role !== "seller")return <UnifiedCompetitiveDetail id={segments[1] ?? ""}/>;
    if(section === "agreements" && segments[1])return <UnifiedAgreementDetail id={segments[1]}/>;
    if(section === "overview")return <UnifiedWorkspace kind="overview"/>;
    if(section === "negotiations" && !segments[1])return <UnifiedWorkspace kind="sessions"/>;
    if(section === "deals" && !segments[1])return <UnifiedWorkspace kind="agreements"/>;
    if(section === "system" && role === "admin")return <UnifiedWorkspace kind="metrics"/>;
    if(section === "audit-logs" && role === "admin")return <UnifiedWorkspace kind="audit"/>;
    if (role === "seller" && section === "competitive") return <SellerCompetitiveSessions sessionId={segments[1] ?? ""}/>;
    if (section === "negotiations" && segments[1])
        return <SessionDetail id={id}/>;
    if (section === "deals" && segments[1])
        return <DealDetail id={id}/>;
    if (role === "seller" && section === "products" && segments[1] === "new")
        return <ProductForm />;
    if (role === "seller" && section === "products" && segments[2] === "edit")
        return <ProductForm id={id}/>;
    if (role === "seller" && section === "products" && segments[2] === "rules")
        return <RulesForm id={id}/>;
    if (section === "notifications")
        return <Notifications />;
    if (section === "overview")
        return <>
        <Heading eyebrow={`${role} workspace`} title={`Welcome back, ${user.name.split(" ")[0]}`} description="Your local demo overview. Explore the workflow with synthetic data." action={<Link className="btn" href={role === "seller" ? `${base}/products/new` : role === "buyer" ? "/products" : `${base}/users`}>{role === "seller" ? "Add product" : role === "buyer" ? "Find a product" : "Manage users"} →</Link>}/>
        {role === "seller" && <SellerCompetitiveSessions/>}
        <Stats items={[{ label: role === "admin" ? "Registered users" : "Products", value: role === "admin" ? state.users.length : products.length }, { label: "Active Negotiation Sessions", value: sessions.filter(s => s.status === "active").length + (role === "seller" ? competitiveSellerSessions.filter(s => s.phase === "running" && s.status !== "excluded").length : 0) }, { label: "Awaiting buyer approval", value: sessions.filter(s => s.status === "awaiting_approval").length + (role === "seller" ? competitiveSellerSessions.filter(s => s.phase === "review" && s.status === "agreed").length : 0) }, { label: "Completed agreements", value: deals.length }]}/>
        <div className="grid md:grid-cols-2 gap-6">
        <div className="panel">
        <h2>{role === "seller" ? "Recent one-to-one Negotiation Sessions" : "Recent Negotiation Sessions"}</h2>{sessions.slice(0, 4).map(s => <Link className="flex justify-between items-center border-b border-slate-100 py-4 gap-3" key={s.id} href={`${base}/negotiations/${s.id}`}>
            <span className="text-sm">{state.products.find(p => p.id === s.productId)?.name}</span>
            <Badge>{s.status.replaceAll("_", " ")}</Badge>
            </Link>)}{!sessions.length && <p className="muted mt-4">No sessions for this demo account.</p>}<Link className="text-indigo-600 text-sm inline-block mt-5" href={`${base}/negotiations`}>View all Negotiation Sessions →</Link>
        </div>
        <div className="panel">
        <h2>Your next step</h2>
        <p className="muted mt-4">{role === "buyer" ? "Choose a product, set a confidential budget and follow scripted bargaining rounds." : role === "seller" ? "Review your listings and configure private floor prices before incoming simulations." : "Inspect account activity and audit events. Sensitive reservation prices are excluded from monitoring screens."}</p>
        <Link className="btn-secondary mt-6" href={role === "seller" ? `${base}/products` : role === "buyer" ? "/products" : `${base}/audit-logs`}>Continue journey →</Link>
        </div>
        </div>
        </>;
    if (section === "negotiations") {
        const rows = sessions.filter(s => (!status || s.status === status) && `${s.id} ${state.products.find(p => p.id === s.productId)?.name}`.toLowerCase().includes(filter.toLowerCase()));
        return <>
        {role === "seller" && <SellerCompetitiveSessions/>}
        <Heading title={role === "seller" ? "One-to-one Negotiation Sessions" : "Negotiation Session History"} description="Status and round history of local simulations. No production queue or Gemini service is connected."/>
        <div className="panel mb-5 field-grid">
        <label>Search Negotiation Sessions<input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Product or session number"/>
        </label>
        <label>Status<select value={status} onChange={e => setStatus(e.target.value)}>
        <option value="">All statuses</option>{['active', 'awaiting_approval', 'completed', 'failed', 'cancelled', 'rejected'].map(s => <option key={s}>{s}</option>)}</select>
        </label>
        </div>{rows.length ? <div className="panel table-wrap">
            <table>
            <thead>
            <tr>
            <th>Negotiation Session</th>
            <th>Product</th>
            <th>Mode</th>
            <th>Status</th>
            <th>Rounds</th>
            <th>Details</th>
            </tr>
            </thead>
            <tbody>{rows.map(s => <tr key={s.id}>
                <td>#{s.id}</td>
                <td>{state.products.find(p => p.id === s.productId)?.name}</td>
                <td>{s.mode.replaceAll("_", " ")}</td>
                <td>
                <Badge>{s.status.replaceAll("_", " ")}</Badge>
                </td>
                <td>{negotiationRoundCount(s)}</td>
                <td>
                <Link className="text-indigo-600" href={`${base}/negotiations/${s.id}`}>Open →</Link>
                </td>
                </tr>)}</tbody>
            </table>
            </div> : <Empty title="No matching Negotiation Sessions" description="Choose a product to start a buyer simulation, or clear the filters."/>}</>;
    }
    if (section === "deals")
        return <>
        {role === "seller" && <SellerCompetitiveSessions subset="agreements"/>}
        <Heading title={role === "seller" ? "Sales history" : "Your agreements"} description="Completed simulated transactions. No payment or shipping integration."/>{deals.length ? <div className="grid md:grid-cols-2 gap-5">{deals.map(d => <Link className="panel" key={d.id} href={`${base}/deals/${d.id}`}>
                <Badge>Completed</Badge>
                <h2 className="mt-4">{state.products.find(p => p.id === d.productId)?.name}</h2>
                <p className="text-2xl font-bold mt-3">{money(d.price)}</p>
                <p className="muted text-sm mt-2">{d.delivery} · {d.warranty} months warranty</p>
                <p className="text-indigo-600 text-sm mt-5">View agreement #{d.id} →</p>
                </Link>)}</div> : <Empty title="No Agreements yet" description="Complete a buyer simulation to create an agreement."/>}</>;
    if (section === "products")
        return <>
        <Heading title={role === "admin" ? "Product monitoring" : "My product catalog"} description={role === "admin" ? "Public listing information only. Seller confidential limits are excluded." : "Manage public prices, availability, and private negotiation rules."} action={role === "seller" ? <Link className="btn" href={`${base}/products/new`}>Add product</Link> : undefined}/>
        <label className="mb-5">Search products<input value={filter} onChange={e => setFilter(e.target.value)}/>
        </label>
        <div className="panel table-wrap">
        <table>
        <thead>
        <tr>
        <th>Product</th>
        <th>Public price</th>
        <th>Stock</th>
        <th>Actions</th>
        </tr>
        </thead>
        <tbody>{products.filter(p => p.name.toLowerCase().includes(filter.toLowerCase())).map(p => <tr key={p.id}>
            <td>
            <Link href={`/products/${p.id}`} className="text-indigo-600">{p.name}</Link>
            <p className="muted text-xs">{p.category}</p>
            </td>
            <td>{money(p.base_price)}</td>
            <td>{p.stock_quantity}</td>
            <td>{role === "seller" ? <div className="flex gap-4">
                <Link className="text-indigo-600" href={`${base}/products/${p.id}/edit`}>Edit price / stock</Link>
                <Link className="text-indigo-600" href={`${base}/products/${p.id}/rules`}>Private rules</Link>
                </div> : <button className="text-indigo-600" onClick={() => notify("Listing moderation is a placeholder: removal policy and backend endpoint must be defined.")}>Review listing</button>}</td>
            </tr>)}</tbody>
        </table>
        </div>
        <p className="muted text-sm mt-4">Multiple seller offers per item are not supported by the current API. No alternative offers are invented.</p>
        </>;
    if (role === "admin" && (section === "users" || section === "sellers"))
        return <>
        <Heading title={section === "sellers" ? "Seller management" : "User management"} description="Synthetic account status changes only. Real verification and suspension require an authorized backend."/>
        <label className="mb-5">Search accounts<input value={filter} onChange={e => setFilter(e.target.value)}/>
        </label>
        <div className="panel table-wrap">
        <table>
        <thead>
        <tr>
        <th>Name</th>
        <th>Email</th>
        <th>Role</th>
        <th>Demo status</th>
        <th>Action</th>
        </tr>
        </thead>
        <tbody>{state.users.filter(u => (section !== "sellers" || u.role === "seller") && `${u.name} ${u.email}`.toLowerCase().includes(filter.toLowerCase())).map(u => <tr key={u.id}>
            <td>{u.name}</td>
            <td>{u.email}</td>
            <td>
            <Badge>{u.role}</Badge>
            </td>
            <td>{u.active ? "Active" : "Suspended (demo)"}</td>
            <td>
            <button disabled={u.id === user.id} className="text-indigo-600" onClick={() => { setState(s => addAudit({ ...s, users: s.users.map(x => x.id === u.id ? { ...x, active: !x.active } : x) }, "demo_account_status_changed", u.id)); notify("Synthetic account flag changed; no real access control was changed."); }}>{u.active ? "Suspend demo account" : "Restore demo account"}</button>
            </td>
            </tr>)}</tbody>
        </table>
        </div>
        </>;
    if (role === "admin" && section === "audit-logs")
        return <>
        <Heading title="Audit trail" description="Local, mutable demonstration log. It is not a production immutable security ledger."/>
        <label className="mb-5">Filter action<input value={filter} onChange={e => setFilter(e.target.value)}/>
        </label>
        <div className="panel table-wrap">
        <table>
        <thead>
        <tr>
        <th>Event</th>
        <th>Reference</th>
        <th>Timestamp</th>
        </tr>
        </thead>
        <tbody>{state.audit.filter(a => a.action.includes(filter)).map(a => <tr key={a.id}>
            <td>{a.action}</td>
            <td>#{a.reference}</td>
            <td>{new Date(a.time).toLocaleString("en-GB")}</td>
            </tr>)}</tbody>
        </table>
        </div>
        </>;
    if (role === "admin" && section === "system")
        return <>
        <Heading title="System performance" description="Illustrative monitoring only. No AWS, database or queue health check is performed."/>
        <Stats items={[{ label: "Demo Negotiation Sessions", value: state.sessions.length }, { label: "Successful agreements", value: state.deals.length }, { label: "Completion rate", value: `${Math.round(state.deals.length / Math.max(1, state.sessions.length) * 100)}%` }, { label: "Average concession", value: `${(state.deals.reduce((sum, d) => sum + (1 - d.price / d.listingPrice) * 100, 0) / Math.max(1, state.deals.length)).toFixed(1)}%` }]}/>
        <div className="panel">
        <h2>Live services unavailable</h2>
        <p className="muted mt-3">API latency, Celery queue depth, Gemini availability and database health are not measured. The current /health endpoint offers only a database connection check.</p>
        </div>
        </>;
    if (role === "admin" && section === "permissions")
        return <>
        <Heading title="Roles & permissions" description="Documented role responsibilities. This matrix is a planning interface, not an authorization system."/>
        <div className="panel table-wrap">
        <table>
        <thead>
        <tr>
        <th>Role</th>
        <th>Catalog</th>
        <th>Negotiations</th>
        <th>Administration</th>
        </tr>
        </thead>
        <tbody>
        <tr>
        <td>Buyer</td>
        <td>Browse public listings</td>
        <td>Own sessions, budget and approvals</td>
        <td>None</td>
        </tr>
        <tr>
        <td>Seller</td>
        <td>Own products and private rules</td>
        <td>Own product sessions; no buyer budget</td>
        <td>None</td>
        </tr>
        <tr>
        <td>Admin</td>
        <td>Monitor public listings</td>
        <td>Monitor activity; no reservation prices</td>
        <td>Account governance and audit</td>
        </tr>
        </tbody>
        </table>
        <details className="mt-5"><summary className="cursor-pointer font-semibold">Production authorization requirements</summary><p className="muted text-sm mt-3">This demo applies role projections and local account flags only. Real permission editing requires authenticated server policies, account verification and an authorized backend. No permission is changed by this panel.</p></details>
        </div>
        </>;
    if (role === "admin" && section === "reports")
        return <AdminReports />;
    return <Empty title="Page not found" description="This demo workspace section does not exist." href={base} label="Back to overview"/>;
}
export function Notifications() {
    const { enabled, state, user, setState } = useDemo();
    if (enabled) return <UnifiedNotifications/>;
    if (!enabled)
        return <BackendPending />;
    const notices = state.notices.filter(n => n.userId === user.id);
    return <>
    {user.role === "seller" && <SellerCompetitiveUpdates/>}
    <Heading title="Notifications" description="Local alerts generated by demo actions. No WebSocket, SSE or email is connected." action={<button className="btn-secondary" onClick={() => setState(s => ({ ...s, notices: s.notices.map(n => n.userId === user.id ? { ...n, read: true } : n) }))}>Mark all read</button>}/>{notices.length ? <div className="space-y-4">{notices.map(n => <div className="panel flex justify-between gap-4 items-center" key={n.id}>
            <div>
            <Badge>{n.read ? "Read" : "New"}</Badge>
            <p className="mt-3">{n.text}</p>
            </div>
            <Link className="btn-secondary" href={n.href} onClick={() => setState(s => ({ ...s, notices: s.notices.map(item => item.id === n.id ? { ...item, read: true } : item) }))}>Open</Link>
            </div>)}</div> : <Empty title="You're all caught up" description="Start or complete a simulation to see local notifications."/>}</>;
}
export function AccountScreen({ kind }: {
    kind: "login" | "register" | "profile";
}) {
    const { enabled, state, user, setUserId, setState, notify } = useDemo();
    const router = useRouter();
    const competitive = useCompetitiveWorkspace();
    const [error, setError] = useState("");
    if (!enabled)
        return <BackendPending title="Secure sign-in is not available yet"/>;
    if(kind === "profile" && !user.active)return <Empty title="Active identity required" description="Sign in with a demo identity to edit its profile." href="/login" label="Choose identity"/>;
    if (kind === "profile")
        return <>
        <Heading title="Your profile" description="Synthetic identity only. Do not enter real personal information. Saved only in this browser."/>
        <form className="panel max-w-xl space-y-5" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); const name = String(f.get("name")).trim(); const email = String(f.get("email")).trim(); if (!name || state.users.some(u => u.id !== user.id && u.email.toLowerCase() === email.toLowerCase())) {
            setError("Enter a name and a unique demo email.");
            return;
        } setState(s => ({ ...s, users: s.users.map(u => u.id === user.id ? { ...u, name, email } : u) })); setError(""); notify("Demo profile updated."); }}>
        <label>Display name<input key={`name-${user.id}`} name="name" required maxLength={100} defaultValue={user.name}/>
        </label>
        <label>Demo email<input key={`email-${user.id}`} name="email" type="email" required defaultValue={user.email}/>
        </label>
        <p>
        <Badge>{user.role}</Badge>
        </p>{error && <p role="alert" className="text-rose-700">{error}</p>}<button className="btn">Save demo profile</button>
        <button type="button" className="btn-secondary ml-3" onClick={() => { setUserId(0); router.push("/login"); notify("Demo signed out. History remains saved in this browser; no authentication session existed."); }}>Demo sign out</button>
        <button type="button" className="btn-danger mt-4" onClick={competitive.reset}>Reset browser-local demo</button></form>
        </>;
    return <div className="max-w-xl mx-auto">
    <Heading eyebrow="Local identity demo" title={kind === "login" ? "Welcome back" : "Create a demo account"} description="No password, token or real account is created. This screen demonstrates the user journey only."/>{kind === "login" ? <div className="panel space-y-4">{state.users.map(u => <button key={u.id} disabled={!u.active} className="btn-secondary w-full justify-between" onClick={() => { setUserId(u.id); router.push(`/dashboard/${u.role}`); }}>
            <span>{u.name}</span>
            <Badge>{u.role}</Badge>
            </button>)}<Link className="text-indigo-600 text-sm block mt-5" href="/register">Create a new synthetic buyer or seller →</Link>
        </div> : <form className="panel space-y-5" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); const name = String(f.get("name")).trim(); const email = String(f.get("email")).trim(); const role = f.get("role") === "seller" ? "seller" : "buyer"; if (!name || state.users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
            setError("Use a name and a unique demo email.");
            return;
        } const id = nextId(state.users); setState(s => ({ ...s, users: [...s.users, { id, name, email, role, active: true }] })); setUserId(id); router.push(`/dashboard/${role}`); notify("Synthetic account saved only in this browser."); }}>
        <label>Name<input name="name" required maxLength={100}/>
        </label>
        <label>Demo email<input name="email" type="email" required placeholder="your-name@example.test"/>
        </label>
        <label>Role<select name="role">
        <option value="buyer">Buyer</option>
        <option value="seller">Seller</option>
        </select>
        </label>{error && <p role="alert" className="text-rose-700">{error}</p>}<button className="btn w-full">Create demo identity</button>
        <Link href="/login" className="text-indigo-600 text-sm block">Already have a demo identity?</Link>
        </form>}</div>;
}
