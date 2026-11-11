"use client";
import Link from "next/link";
import { RealAccount } from "./real-account";
import { realMode } from "@/lib/real-api";
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
}) {
    const { state } = useDemo();
    const p = state.products.find(p => p.id === id);
    return p ? <ProductDetails product={p} /> : <Empty title="Product not found" description="The local listing was not found. Demo state resets on refresh." href="/products" label="Marketplace" />;
}

function ProductForm({ id }: {
    id?: number;
}) {
    const { state, user, setState, notify } = useDemo();
    const router = useRouter();
    const competitive = useCompetitiveWorkspace();
    const [error, setError] = useState("");
    const p = id ? state.products.find(p => p.id === id && p.seller_id === user.id) : undefined;
    if (id && !p) return <Empty title="Product unavailable" description="This product does not belong to the selected seller." />;

    function save(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const price = Number(f.get("price"));
        const stock = Number(f.get("stock"));
        const name = String(f.get("name")).trim();
        const category = String(f.get("category")).trim();
        const url = String(f.get("image")).trim();
        const rule = state.rules.find(r => r.productId === id);
        if (p && (name !== p.name || category !== p.category)) {
            setError("Catalog identity is immutable. Create a new product for a different variant.");
            return;
        }
        if (
            !name ||
            !category ||
            !Number.isFinite(price) ||
            price <= 0 ||
            price > 1000000 ||
            !Number.isInteger(stock) ||
            stock < 0 ||
            stock > 10000 ||
            (rule && (price < rule.minimum || price < rule.threshold)) ||
            (url && !/^(https?:\/\/|\/(?!\/))/.test(url))
        ) {
            setError("Check name, category, positive price, whole-number stock and image URL. Lower your private floor and auto-accept threshold first if the new public price would be below either.");
            return;
        }
        const product: Product = {
            id: p?.id ?? nextId(state.products),
            seller_id: user.id,
            name,
            category,
            description: String(f.get("description")).trim() || null,
            base_price: price.toFixed(2),
            stock_quantity: stock,
            image_url: url || null,
            created_at: p?.created_at ?? new Date().toISOString(),
        };
        if (p) competitive.savePrimary(product, rule ?? { minimum: Number((price * 0.85).toFixed(2)), discount: 15, rounds: 6, enabled: true });
        setState(s =>
            addAudit(
                { ...s, products: p ? s.products.map(item => (item.id === p.id ? product : item)) : [product, ...s.products] },
                p ? "demo_product_updated" : "demo_product_created",
                product.id
            )
        );
        notify("Product save requested. Server confirmation updates the workspace.");
        router.push("/dashboard/seller/products");
    }

    return (
        <div className="space-y-6">
            <Heading
                eyebrow="Seller Catalog"
                title={p ? "Edit product" : "Add a product"}
                description="Existing product name/category identify a fixed catalog variant and are read-only. Create a new product for a different variant. Descriptions, prices, stock and media remain editable."
            />
            <form onSubmit={save} className="panel space-y-6 max-w-3xl">
                <div className="field-grid">
                    <label>
                        Product name
                        <input name="name" required maxLength={150} readOnly={!!p} defaultValue={p?.name} />
                    </label>
                    <label>
                        Category
                        <input name="category" required maxLength={80} readOnly={!!p} defaultValue={p?.category} />
                    </label>
                    <label>
                        Public price (SAR)
                        <input name="price" required type="number" min="0.01" step="0.01" defaultValue={p?.base_price} />
                    </label>
                    <label>
                        Stock quantity
                        <input name="stock" required type="number" min="0" max="10000" step="1" defaultValue={p?.stock_quantity ?? 1} />
                    </label>
                </div>
                <label>
                    Description
                    <textarea name="description" rows={4} maxLength={3000} defaultValue={p?.description ?? ""} />
                </label>
                <label>
                    Image URL (optional)
                    <input name="image" defaultValue={p?.image_url ?? ""} placeholder="https://… or /media/…" />
                </label>
                <p className="muted text-xs">
                    Image upload and structured product condition are unavailable in the current API. Use the description for condition; no upload endpoint is invented.
                </p>
                {error && (
                    <p role="alert" className="text-rose-700 text-sm font-medium">
                        {error}
                    </p>
                )}
                <div className="flex gap-3">
                    <button className="btn">Save demo product</button>
                    <Link className="btn-secondary" href="/dashboard/seller/products">
                        Cancel
                    </Link>
                </div>
            </form>
        </div>
    );
}

function RulesForm({ id }: {
    id: number;
}) {
    const { state, user, setState, notify } = useDemo();
    const competitive = useCompetitiveWorkspace();
    const [error, setError] = useState("");
    const p = state.products.find(p => p.id === id && p.seller_id === user.id);
    const r = state.rules.find(r => r.productId === id);
    if (!p) return <Empty title="Product unavailable" description="Rules can be edited only for the selected demo seller's products." />;

    function save(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!p) return;
        const f = new FormData(e.currentTarget);
        const minimum = Number(f.get("minimum"));
        const threshold = Number(f.get("threshold"));
        const discount = Number(f.get("discount"));
        const rounds = Number(f.get("rounds"));
        if (
            ![minimum, threshold, discount, rounds].every(Number.isFinite) ||
            minimum <= 0 ||
            minimum > Number(p.base_price) ||
            threshold < minimum ||
            threshold > Number(p.base_price) ||
            discount < 0 ||
            discount > 100 ||
            !Number.isInteger(rounds) ||
            rounds < 1 ||
            rounds > 20
        ) {
            setError("Floor must be positive and no higher than the public price. Auto-accept must be between floor and public price. Discount: 0–100%. Rounds: 1–20.");
            return;
        }
        setError("");
        competitive.savePrimary(p, { minimum, discount, rounds, enabled: f.get("enabled") === "on" });
        setState(s =>
            addAudit(
                { ...s, rules: [...s.rules.filter(x => x.productId !== id), { productId: id, minimum, threshold, discount, rounds, enabled: f.get("enabled") === "on" }] },
                "demo_rules_updated",
                id
            )
        );
        notify("Private rules save requested. Server confirmation updates the workspace.");
    }

    return (
        <div className="space-y-6">
            <Heading eyebrow="Seller Rules" title={`Configure ${p.name}`} description="Private seller negotiation limits. Only your seller interface displays them." />
            <form className="panel max-w-3xl space-y-6" onSubmit={save}>
                <div className="field-grid">
                    <label>
                        Minimum acceptable price (SAR)
                        <input name="minimum" type="number" min="0.01" step="0.01" required defaultValue={r?.minimum ?? Number((Number(p.base_price) * 0.8).toFixed(2))} />
                    </label>
                    <label>
                        Auto-accept threshold (SAR)
                        <input name="threshold" type="number" min="0.01" step="0.01" required defaultValue={r?.threshold ?? Number((Number(p.base_price) * 0.95).toFixed(2))} />
                    </label>
                    <label>
                        Maximum discount (%)
                        <input name="discount" type="number" min="0" max="100" step="0.01" required defaultValue={r?.discount ?? 20} />
                    </label>
                    <label>
                        Maximum rounds
                        <input name="rounds" type="number" min="1" max="20" step="1" required defaultValue={r?.rounds ?? 4} />
                    </label>
                </div>
                <label className="flex gap-2 items-center p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                    <input name="enabled" type="checkbox" className="w-auto" defaultChecked={r?.enabled ?? true} />
                    Enable simulated agent
                </label>
                <p className="muted text-sm">
                    The engine respects floor, discount and round limits. Primary competitive settings apply to new sessions only; active snapshots remain unchanged.
                </p>
                {error && (
                    <p role="alert" className="text-rose-700 text-sm font-medium">
                        {error}
                    </p>
                )}
                <button className="btn">Save demo rules</button>
            </form>
        </div>
    );
}

function DealDetail({ id }: {
    id: number;
}) {
    const { state, user, setState, notify } = useDemo();
    const d = visibleDeals(state, user).find(d => d.id === id);
    const [error, setError] = useState("");
    if (!d) return <Empty title="Agreement unavailable" description="This agreement is not available for the selected demo identity." />;
    const p = state.products.find(p => p.id === d.productId);
    return (
        <div className="space-y-6">
            <Heading eyebrow="Agreement Summary" title={`Agreement #${d.id}`} description={p?.name} action={<Badge tone="emerald">Deal Closed</Badge>} />
            <div className="panel max-w-3xl space-y-6">
                <div className="flex flex-wrap items-baseline justify-between gap-4 pb-4 border-b border-slate-100">
                    <div>
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Agreed Deal Price</span>
                        <p className="text-4xl font-extrabold text-slate-900 mt-1">{money(d.price)}</p>
                    </div>
                    <Badge tone="indigo">{d.purchaseType === "direct" ? "Direct purchase" : "Negotiated deal"}</Badge>
                </div>
                <dl className="grid sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-slate-50">
                        <dt className="muted text-xs uppercase font-semibold">Warranty</dt>
                        <dd className="text-base font-bold text-slate-900 mt-1">{d.warranty} months</dd>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50">
                        <dt className="muted text-xs uppercase font-semibold">Delivery</dt>
                        <dd className="text-base font-bold text-slate-900 mt-1">{d.delivery}</dd>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50">
                        <dt className="muted text-xs uppercase font-semibold">Closed Date</dt>
                        <dd className="text-base font-bold text-slate-900 mt-1">{new Date(d.createdAt).toLocaleDateString("en-GB")}</dd>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50">
                        <dt className="muted text-xs uppercase font-semibold">Fulfillment Note</dt>
                        <dd className="text-xs text-slate-600 mt-1">Agreement recorded on server. Payment & shipping handled externally.</dd>
                    </div>
                </dl>
                <div>
                    <button className="btn-secondary" onClick={() => window.print()}>
                        Print / save summary as PDF
                    </button>
                </div>
            </div>
            {user.role === "buyer" && (
                <form
                    className="panel max-w-3xl space-y-4"
                    onSubmit={e => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        const rating = Number(f.get("rating"));
                        if (rating < 1 || rating > 5) {
                            setError("Select a rating from 1 to 5.");
                            return;
                        }
                        setState(s => addAudit({ ...s, deals: s.deals.map(item => (item.id === id ? { ...item, rating, feedback: String(f.get("feedback")) } : item)) }, "demo_rating_saved", id));
                        notify("Feedback save requested.");
                    }}
                >
                    <h2 className="text-lg font-bold text-slate-900">Your review</h2>
                    <label>
                        Rating
                        <select name="rating" defaultValue={d.rating ?? 5}>
                            {[5, 4, 3, 2, 1].map(n => (
                                <option key={n} value={n}>
                                    {n} stars
                                </option>
                            ))}
                        </select>
                    </label>
                    <label>
                        Feedback
                        <textarea name="feedback" maxLength={500} defaultValue={d.feedback} />
                    </label>
                    {error && <p role="alert" className="text-rose-700 text-sm">{error}</p>}
                    <button className="btn">Save demo rating</button>
                    {d.rating && <p className="text-emerald-700 text-sm font-semibold">Saved rating: {d.rating}/5</p>}
                </form>
            )}
        </div>
    );
}

export function DemoScreen({ role, segments = [] }: {
    role: Role;
    segments?: string[];
}) {
    const { enabled, state, user, setUserId, setState, notify } = useDemo();
    const competitiveSellerSessions = useSellerCompetitive();
    const [filter, setFilter] = useState("");
    const [status, setStatus] = useState("");
    if (realMode && !user.active) return <Empty title="Sign in required" description="Sign in to access your workspace." href="/login" label="Sign in" />;
    if (realMode && user.role !== role) return <Empty title="Access restricted" description="Your signed-in account does not have this role." href={`/dashboard/${user.role}`} label="Open your workspace" />;
    if (!enabled) return <BackendPending />;
    if (user.role !== role)
        return (
            <div className="space-y-6">
                <Heading
                    eyebrow="Identity Switcher"
                    title={`${role[0].toUpperCase() + role.slice(1)} demo workspace`}
                    description="Select a synthetic identity for this workspace. Client-side selection is not authentication or authorization."
                />
                <div className="grid sm:grid-cols-3 gap-4">
                    {state.users
                        .filter(u => u.role === role)
                        .map(u => (
                            <button className="panel text-left hover:border-indigo-300 transition" key={u.id} disabled={!u.active} onClick={() => setUserId(u.id)}>
                                <div className="flex items-center justify-between">
                                    <span className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-700 font-bold grid place-items-center">
                                        {u.name.charAt(0).toUpperCase()}
                                    </span>
                                    <Badge tone={u.active ? "emerald" : "rose"}>{u.active ? "Active" : "Suspended"}</Badge>
                                </div>
                                <h2 className="mt-3 text-base font-bold text-slate-900">{u.name}</h2>
                                <p className="muted text-xs mt-1">{u.email}</p>
                                <p className="text-indigo-600 text-xs font-semibold mt-4">Use demo identity →</p>
                            </button>
                        ))}
                </div>
            </div>
        );
    if (!user.active) return <Empty title="Sign in required" description="Choose an active demo account. This is not production authorization." href="/login" label="Choose identity" />;

    const section = segments[0] ?? "overview";
    const id = Number(segments[1]);
    const sessions = visibleSessions(state, user);
    const deals = visibleDeals(state, user);
    const products = role === "seller" ? state.products.filter(p => p.seller_id === user.id) : state.products;
    const base = `/dashboard/${role}`;

    if (role === "seller" && (section === "storefronts" || (section === "products" && !segments[1]))) return <SellerProductsManager />;
    if (role === "admin" && section === "products") return <AdminProductListings />;
    if (section === "competitive-session" || (section === "competitive" && role !== "seller")) return <UnifiedCompetitiveDetail id={segments[1] ?? ""} />;
    if (section === "agreements" && segments[1]) return <UnifiedAgreementDetail id={segments[1]} />;
    if (section === "overview") return <UnifiedWorkspace kind="overview" />;
    if (section === "negotiations" && !segments[1]) return <UnifiedWorkspace kind="sessions" />;
    if (section === "deals" && !segments[1]) return <UnifiedWorkspace kind="agreements" />;
    if (section === "system" && role === "admin") return <UnifiedWorkspace kind="metrics" />;
    if (section === "audit-logs" && role === "admin") return <UnifiedWorkspace kind="audit" />;
    if (role === "seller" && section === "competitive") return <SellerCompetitiveSessions sessionId={segments[1] ?? ""} />;
    if (section === "negotiations" && segments[1]) return <SessionDetail id={id} />;
    if (section === "deals" && segments[1]) return <DealDetail id={id} />;
    if (role === "seller" && section === "products" && segments[1] === "new") return <ProductForm />;
    if (role === "seller" && section === "products" && segments[2] === "edit") return <ProductForm id={id} />;
    if (role === "seller" && section === "products" && segments[2] === "rules") return <RulesForm id={id} />;
    if (section === "notifications") return <Notifications />;

    if (role === "admin" && (section === "users" || section === "sellers")) {
        const filteredUsers = state.users.filter(u => (section !== "sellers" || u.role === "seller") && `${u.name} ${u.email}`.toLowerCase().includes(filter.toLowerCase()));
        return (
            <div className="space-y-6">
                <Heading
                    eyebrow="Admin Account Governance"
                    title={section === "sellers" ? "Seller Management" : "User Management"}
                    description="Suspending an account blocks sign-in and ends its active sessions immediately. Reactivate it at any time."
                />
                <Stats
                    items={[
                        { label: "Total Accounts", value: state.users.length, note: "Registered platform identities", icon: "users" },
                        { label: "Active Buyers", value: state.users.filter(u => u.role === "buyer" && u.active).length, note: "Authorized buyers", icon: "user" },
                        { label: "Active Sellers", value: state.users.filter(u => u.role === "seller" && u.active).length, note: "Authorized storefronts", icon: "box" },
                        { label: "Suspended Accounts", value: state.users.filter(u => !u.active).length, note: "Blocked from sign-in", icon: "shield" },
                    ]}
                />
                <div className="panel bg-slate-50/60">
                    <label className="max-w-md text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Search accounts
                        <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search by name or email address…" />
                    </label>
                </div>
                <div className="panel table-wrap !p-0 overflow-hidden">
                    <table>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Role</th>
                                <th>Account Status</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map(u => (
                                <tr key={u.id} className="hover:bg-slate-50/80 transition">
                                    <td>
                                        <span className="flex items-center gap-2.5">
                                            <span className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-700 font-bold text-xs grid place-items-center shrink-0">
                                                {u.name.charAt(0).toUpperCase()}
                                            </span>
                                            <strong className="text-slate-900">{u.name}</strong>
                                        </span>
                                    </td>
                                    <td className="text-slate-600">{u.email}</td>
                                    <td>
                                        <Badge tone={u.role === "admin" ? "indigo" : u.role === "seller" ? "emerald" : "slate"}>{u.role}</Badge>
                                    </td>
                                    <td>
                                        <Badge tone={u.active ? "emerald" : "rose"}>{u.active ? "Active" : "Suspended"}</Badge>
                                    </td>
                                    <td>
                                        <button
                                            disabled={u.id === user.id}
                                            className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition ${
                                                u.active
                                                    ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                                                    : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                            } disabled:opacity-40`}
                                            onClick={() => {
                                                setState(s =>
                                                    addAudit(
                                                        { ...s, users: s.users.map(x => (x.id === u.id ? { ...x, active: !x.active } : x)) },
                                                        "demo_account_status_changed",
                                                        u.id
                                                    )
                                                );
                                                notify("Account status update requested.");
                                            }}
                                        >
                                            {u.active ? "Suspend account" : "Restore account"}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    if (role === "admin" && section === "permissions") {
        return (
            <div className="space-y-6">
                <Heading
                    eyebrow="Access Control Matrix"
                    title="Roles & Permissions"
                    description="Documented stakeholder responsibilities and privacy boundaries enforced by the platform."
                />
                <div className="panel table-wrap !p-0 overflow-hidden">
                    <table>
                        <thead>
                            <tr>
                                <th>Stakeholder Role</th>
                                <th>Product Catalog</th>
                                <th>Deals & Negotiations</th>
                                <th>Administration & Reports</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>
                                    <Badge tone="indigo">Buyer</Badge>
                                </td>
                                <td>Browse public listings & direct purchase</td>
                                <td>Own negotiations, private budget & final deal approval</td>
                                <td>None</td>
                            </tr>
                            <tr>
                                <td>
                                    <Badge tone="emerald">Seller</Badge>
                                </td>
                                <td>Manage own listings & private AI floor rules</td>
                                <td>Own product negotiations; buyer budget hidden</td>
                                <td>None</td>
                            </tr>
                            <tr>
                                <td>
                                    <Badge tone="amber">Admin</Badge>
                                </td>
                                <td>Monitor public listings (floors excluded)</td>
                                <td>Monitor deals & activity (private limits excluded)</td>
                                <td>Account governance, audit logs & PDF/CSV reports</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <details className="panel">
                    <summary className="cursor-pointer font-bold text-slate-900">Production authorization & privacy guarantees</summary>
                    <p className="muted text-sm mt-3">
                        Role permissions are verified on the server for every API request. Private buyer budgets and seller minimum acceptable prices are never exposed in cross-party views or admin reports.
                    </p>
                </details>
            </div>
        );
    }

    if (role === "admin" && section === "reports") return <AdminReports />;
    return <Empty title="Page not found" description="This workspace section does not exist." href={base} label="Back to overview" />;
}

export function Notifications() {
    const { enabled, state, user, setState } = useDemo();
    if (enabled) return <UnifiedNotifications />;
    if (!enabled) return <BackendPending />;
    const notices = state.notices.filter(n => n.userId === user.id);
    return (
        <div className="space-y-6">
            {user.role === "seller" && <SellerCompetitiveUpdates />}
            <Heading
                title="Notifications"
                description="Alerts from your authorized negotiation sessions and Agreements."
                action={
                    <button
                        className="btn-secondary"
                        onClick={() => setState(s => ({ ...s, notices: s.notices.map(n => (n.userId === user.id ? { ...n, read: true } : n)) }))}
                    >
                        Mark all read
                    </button>
                }
            />
            {notices.length ? (
                <div className="space-y-4">
                    {notices.map(n => (
                        <div className="panel flex justify-between gap-4 items-center" key={n.id}>
                            <div>
                                <Badge>{n.read ? "Read" : "New"}</Badge>
                                <p className="mt-3">{n.text}</p>
                            </div>
                            <Link
                                className="btn-secondary"
                                href={n.href}
                                onClick={() => setState(s => ({ ...s, notices: s.notices.map(item => (item.id === n.id ? { ...item, read: true } : item)) }))}
                            >
                                Open
                            </Link>
                        </div>
                    ))}
                </div>
            ) : (
                <Empty title="You're all caught up" description="Start or complete a simulation to see local notifications." />
            )}
        </div>
    );
}

export function AccountScreen({ kind }: {
    kind: "login" | "register" | "profile";
}) {
    const { enabled, state, user, setUserId, setState, notify } = useDemo();
    const router = useRouter();
    if (realMode) return <RealAccount kind={kind} />;
    const competitive = useCompetitiveWorkspace();
    const [error, setError] = useState("");
    if (!enabled) return <BackendPending title="Secure sign-in is not available yet" />;
    if (kind === "profile" && !user.active)
        return <Empty title="Active identity required" description="Sign in with a demo identity to edit its profile." href="/login" label="Choose identity" />;
    if (kind === "profile")
        return (
            <div className="max-w-2xl mx-auto space-y-6">
                <Heading eyebrow="My Account" title="Your profile" description="Manage your display identity and workspace preferences." />
                <form
                    className="panel space-y-5"
                    onSubmit={e => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        const name = String(f.get("name")).trim();
                        const email = String(f.get("email")).trim();
                        if (!name || state.users.some(u => u.id !== user.id && u.email.toLowerCase() === email.toLowerCase())) {
                            setError("Enter a name and a unique demo email.");
                            return;
                        }
                        setState(s => ({ ...s, users: s.users.map(u => (u.id === user.id ? { ...u, name, email } : u)) }));
                        setError("");
                        notify("Demo profile updated.");
                    }}
                >
                    <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
                        <span className="w-12 h-12 rounded-full bg-indigo-600 text-white font-bold text-lg grid place-items-center">
                            {user.name.charAt(0).toUpperCase()}
                        </span>
                        <div>
                            <strong className="block text-lg text-slate-900">{user.name}</strong>
                            <Badge>{user.role}</Badge>
                        </div>
                    </div>
                    <label>
                        Display name
                        <input key={`name-${user.id}`} name="name" required maxLength={100} defaultValue={user.name} />
                    </label>
                    <label>
                        Demo email
                        <input key={`email-${user.id}`} name="email" type="email" required defaultValue={user.email} />
                    </label>
                    {error && (
                        <p role="alert" className="text-rose-700 text-sm">
                            {error}
                        </p>
                    )}
                    <div className="flex flex-wrap gap-3 pt-2">
                        <button className="btn">Save demo profile</button>
                        <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => {
                                setUserId(0);
                                router.push("/login");
                                notify("Demo signed out. History remains saved in this browser; no authentication session existed.");
                            }}
                        >
                            Demo sign out
                        </button>
                        <button type="button" className="btn-danger ml-auto" onClick={competitive.reset}>
                            Reset browser-local demo
                        </button>
                    </div>
                </form>
            </div>
        );
    return (
        <div className="max-w-xl mx-auto space-y-6">
            <Heading
                eyebrow="Account Access"
                title={kind === "login" ? "Welcome back" : "Create a demo account"}
                description="Choose an account identity to open your Buyer, Seller, or Admin workspace."
            />
            {kind === "login" ? (
                <div className="panel space-y-3">
                    {state.users.map(u => (
                        <button
                            key={u.id}
                            disabled={!u.active}
                            className="btn-secondary w-full justify-between py-3 px-4 hover:border-indigo-300"
                            onClick={() => {
                                setUserId(u.id);
                                router.push(`/dashboard/${u.role}`);
                            }}
                        >
                            <span className="font-semibold text-slate-900">{u.name}</span>
                            <Badge>{u.role}</Badge>
                        </button>
                    ))}
                    <Link className="text-indigo-600 text-sm font-semibold block pt-3" href="/register">
                        Create a new synthetic buyer or seller →
                    </Link>
                </div>
            ) : (
                <form
                    className="panel space-y-5"
                    onSubmit={e => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        const name = String(f.get("name")).trim();
                        const email = String(f.get("email")).trim();
                        const role = f.get("role") === "seller" ? "seller" : "buyer";
                        if (!name || state.users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
                            setError("Use a name and a unique demo email.");
                            return;
                        }
                        const id = nextId(state.users);
                        setState(s => ({ ...s, users: [...s.users, { id, name, email, role, active: true }] }));
                        setUserId(id);
                        router.push(`/dashboard/${role}`);
                        notify("Synthetic account saved only in this browser.");
                    }}
                >
                    <label>
                        Name
                        <input name="name" required maxLength={100} />
                    </label>
                    <label>
                        Demo email
                        <input name="email" type="email" required placeholder="your-name@example.test" />
                    </label>
                    <label>
                        Role
                        <select name="role">
                            <option value="buyer">Buyer</option>
                            <option value="seller">Seller</option>
                        </select>
                    </label>
                    {error && (
                        <p role="alert" className="text-rose-700 text-sm">
                            {error}
                        </p>
                    )}
                    <button className="btn w-full">Create demo identity</button>
                    <Link href="/login" className="text-indigo-600 text-sm font-semibold block">
                        Already have a demo identity?
                    </Link>
                </form>
            )}
        </div>
    );
}
