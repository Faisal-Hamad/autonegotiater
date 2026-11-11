"use client";
import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useDemo } from "./demo-provider";
import { useCompetitiveWorkspace } from "./competitive-provider";
import { AgreementLinks } from "./agreement-links";
import { CompetitiveNegotiation } from "./competitive-negotiation";
import { SellerCompetitiveSessions } from "./seller-competitive";
import { Heading, Stats, Empty, Badge } from "./ui";
import { DesignIcon } from "./approved-visuals";
import { money, visibleDeals } from "@/lib/demo-model";

export function UnifiedWorkspace({ kind }: { kind: "overview" | "sessions" | "agreements" | "audit" | "metrics" }) {
    const { user, state } = useDemo(), c = useCompetitiveWorkspace();
    const [query, setQuery] = useState(""), [status, setStatus] = useState(""), [type, setType] = useState("");
    const params = useSearchParams();
    if (!user.active) return <Empty title="Sign in required" description="Choose an active identity. Your account must be active." href="/login" label="Choose identity" />;

    const history = c.history;
    const active = history.filter(s => ["active", "paused"].includes(s.status)).length;
    const awaiting = history.filter(s => s.status === "awaiting_approval").length;
    const completed = history.filter(s => s.status === "completed").length;
    const legacyDeals = visibleDeals(state, user);
    const totalDealsCount = c.agreements.length + legacyDeals.length;
    const totalDealValue = c.agreements.reduce((sum, g) => sum + g.total, 0) + legacyDeals.reduce((sum, d) => sum + d.price * (d.quantity ?? 1), 0);
    const successRate = history.length ? `${((completed / history.length) * 100).toFixed(1)}%` : "0.0%";

    const metrics = (
        <Stats
            items={[
                { label: "Deals & Negotiations", value: history.length, note: `${active} active · ${completed} completed`, icon: "messages" },
                { label: "Active Negotiations", value: active, note: `${awaiting} awaiting buyer approval`, icon: "bolt" },
                { label: "Closed Deals", value: totalDealsCount, note: money(totalDealValue) + " total volume", icon: "handshake" },
                { label: "Negotiation Success Rate", value: successRate, note: `${completed} of ${history.length} deals closed`, icon: "trend" },
            ]}
        />
    );

    if (kind === "metrics") {
        return (
            <div className="space-y-6">
                <Heading
                    eyebrow="Admin System Monitoring"
                    title="System Metrics & Health"
                    description="Live operational indicators across one-to-one and multi-seller negotiation engines."
                />
                <Stats
                    items={[
                        { label: "Total Negotiations", value: history.length, note: "All recorded sessions", icon: "messages" },
                        { label: "Active / Paused", value: active, note: "In progress right now", icon: "clock" },
                        { label: "Awaiting Buyer Approval", value: awaiting, note: "Ready for final confirmation", icon: "shield" },
                        { label: "Completed Sessions", value: completed, note: `Success rate: ${successRate}`, icon: "check" },
                        { label: "Failed Sessions", value: history.filter(s => s.status === "failed").length, note: "Price gap not bridged", icon: "info" },
                        { label: "Cancelled Sessions", value: history.filter(s => s.status === "cancelled").length, note: "Stopped by buyer", icon: "refresh" },
                        { label: "Recorded Agreements", value: totalDealsCount, note: money(totalDealValue), icon: "handshake" },
                        { label: "Registered Accounts", value: state.users.length, note: `${state.users.filter(u => u.active).length} active accounts`, icon: "users" },
                    ]}
                />
                <div className="panel bg-slate-50/70 flex items-center gap-3 text-sm text-slate-600">
                    <span className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 grid place-items-center shrink-0">
                        <DesignIcon name="server" />
                    </span>
                    <p>Both one-to-one and multi-seller negotiation engines are active. Statistics reflect server-verified negotiation records and closed agreements.</p>
                </div>
            </div>
        );
    }

    if (kind === "audit") {
        const auditRows = [
            ...state.audit.map(a => ({ id: `legacy-${a.id}`, action: a.action, reference: String(a.reference), time: a.time })),
            ...c.audit,
        ]
            .filter(a => a.action.toLowerCase().includes(query.toLowerCase()) || String(a.reference).toLowerCase().includes(query.toLowerCase()))
            .sort((a, b) => b.time.localeCompare(a.time));

        return (
            <div className="space-y-6">
                <Heading
                    eyebrow="Security & Governance"
                    title="Audit Trail & Activity Logs"
                    description="Chronological record of system events, account status updates, and deal approvals."
                />
                <div className="panel bg-slate-50/60">
                    <label className="max-w-md text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Filter action or reference
                        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search event name or reference ID…" />
                    </label>
                </div>
                <div className="panel table-wrap !p-0 overflow-hidden">
                    <table>
                        <thead>
                            <tr>
                                <th>Action / Event</th>
                                <th>Reference ID</th>
                                <th>Timestamp</th>
                            </tr>
                        </thead>
                        <tbody>
                            {auditRows.map(a => (
                                <tr key={a.id} className="hover:bg-slate-50/80 transition">
                                    <td>
                                        <span className="font-semibold text-slate-800">{a.action.replace(/_/g, " ")}</span>
                                    </td>
                                    <td>
                                        <Badge tone="slate">{a.reference}</Badge>
                                    </td>
                                    <td className="text-slate-500 text-xs">{new Date(a.time).toLocaleString("en-GB")}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    if (kind === "agreements") {
        const old = visibleDeals(state, user);
        return (
            <div className="space-y-6">
                <Heading
                    eyebrow={`${user.role} Deals`}
                    title="Closed Deals & Agreements"
                    description="Confirmed agreements from multi-seller negotiations, one-to-one bargaining, and direct purchases."
                />
                {!old.length && !c.agreements.length ? (
                    <Empty title="No recorded Agreements yet" description="Approve a valid matching agent Agreement as the owning Buyer or complete a direct purchase." href="/products" label="Browse Marketplace" />
                ) : (
                    <div className="grid md:grid-cols-2 gap-4">
                        {c.agreements.map(g => (
                            <Link className="panel hover:border-indigo-300 transition flex flex-col justify-between gap-4" href={`/dashboard/${user.role}/agreements/${g.id}`} key={g.id}>
                                <div>
                                    <div className="flex items-center justify-between gap-2">
                                        <Badge tone="emerald">Multi-seller · Deal Closed</Badge>
                                        <span className="text-xs text-slate-400">#{g.id}</span>
                                    </div>
                                    <h2 className="mt-3 text-lg font-bold text-slate-900">{g.productName}</h2>
                                    <p className="text-sm text-slate-600 mt-1">
                                        {g.storefrontName} · {g.quantity} {g.quantity === 1 ? "unit" : "units"} · {money(g.unitPrice)} / unit
                                    </p>
                                </div>
                                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                                    <strong className="text-xl font-extrabold text-slate-900">{money(g.total)} total</strong>
                                    <span className="text-indigo-600 text-sm font-semibold">View Agreement →</span>
                                </div>
                            </Link>
                        ))}
                        {old.map(g => (
                            <Link className="panel hover:border-indigo-300 transition flex flex-col justify-between gap-4" href={`/dashboard/${user.role}/deals/${g.id}`} key={`legacy-${g.id}`}>
                                <div>
                                    <div className="flex items-center justify-between gap-2">
                                        <Badge tone={g.purchaseType === "direct" ? "indigo" : "emerald"}>
                                            {g.purchaseType === "direct" ? "Direct purchase · No negotiation" : "One-to-one · Completed"}
                                        </Badge>
                                        <span className="text-xs text-slate-400">Deal #{g.id}</span>
                                    </div>
                                    <h2 className="mt-3 text-lg font-bold text-slate-900">{state.products.find(p => p.id === g.productId)?.name}</h2>
                                    <p className="text-sm text-slate-500 mt-1">
                                        {g.delivery} · {g.warranty} months warranty
                                    </p>
                                </div>
                                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                                    <strong className="text-xl font-extrabold text-slate-900">
                                        {money(g.price)}
                                        {g.purchaseType === "direct" && (g.quantity ?? 1) > 1 ? ` × ${g.quantity}` : ""}
                                    </strong>
                                    <span className="text-indigo-600 text-sm font-semibold">View Agreement →</span>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    const view = params.get("view");
    const rows = history.filter(
        s =>
            (!status || s.status === status) &&
            (!type || s.type === type) &&
            (!query || `${s.id} ${s.productName}`.toLowerCase().includes(query.toLowerCase())) &&
            (view !== "active" || ["active", "paused"].includes(s.status)) &&
            (view !== "completed" || !["active", "paused", "awaiting_approval"].includes(s.status)) &&
            (view !== "requests" || (s.round === 0 && s.status === "active"))
    );

    const roleSubtitle =
        user.role === "admin"
            ? "Real-time platform overview, active multi-seller negotiations, and closed agreements."
            : user.role === "seller"
            ? "Manage your product inventory, AI negotiation strategies, and incoming buyer inquiries."
            : "Track your active agent negotiations, compare seller offers, and review closed deals.";

    return (
        <div className="space-y-6">
            <Heading
                eyebrow={`${user.role} workspace`}
                title={kind === "overview" ? `Welcome back, ${user.name.split(" ")[0]}` : "Deals & Negotiations"}
                description={roleSubtitle}
                action={
                    <div className="flex flex-wrap items-center gap-2.5">
                        {user.role === "seller" && (
                            <span className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200/80 text-xs font-semibold text-emerald-800">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                Auto-Agent: Active
                            </span>
                        )}
                        <Link
                            className="btn"
                            href={user.role === "buyer" ? "/products" : user.role === "seller" ? "/dashboard/seller/products" : "/dashboard/admin/reports"}
                        >
                            {user.role === "buyer" ? "Browse Products" : user.role === "seller" ? "My Products & Agent Settings" : "Reports & Analytics"} →
                        </Link>
                    </div>
                }
            />

            {kind === "overview" && metrics}

            {kind === "overview" && user.role === "seller" && c.settings.length > 0 && (
                <section className="panel space-y-4" aria-label="Store Inventory & Pricing Rules">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <h2 className="text-base font-bold text-slate-900">Store Inventory & Pricing Rules</h2>
                            <p className="text-xs muted">Your active product listings and AI agent negotiation strategies (private floor prices remain protected)</p>
                        </div>
                        <Link href="/dashboard/seller/products" className="text-xs font-semibold text-indigo-600 hover:underline">
                            Manage all listings →
                        </Link>
                    </div>
                    <div className="table-wrap border border-slate-200/80 rounded-xl overflow-hidden">
                        <table>
                            <thead>
                                <tr>
                                    <th>Product Name</th>
                                    <th>Stock</th>
                                    <th>Public Price</th>
                                    <th>Private Floor</th>
                                    <th>AI Negotiation Strategy</th>
                                </tr>
                            </thead>
                            <tbody>
                                {c.settings.slice(0, 5).map(({ product: p, listing: l }) => (
                                    <tr key={`${p.id}:${l.id}`} className="hover:bg-slate-50/70">
                                        <td className="font-semibold text-slate-900">{p.name}</td>
                                        <td>{l.stock} units</td>
                                        <td className="font-semibold">{money(l.startingPrice)}</td>
                                        <td>
                                            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                                                <DesignIcon name="shield" className="w-3.5 h-3.5 text-indigo-600" />
                                                Protected ({money(l.minimumPrice)})
                                            </span>
                                        </td>
                                        <td>
                                            <Badge tone={l.enabled === false ? "rose" : l.strategy === "steady" ? "slate" : "indigo"}>
                                                {l.enabled === false ? "Agent Disabled" : l.strategy === "steady" ? "Firm / Steady" : "Balanced / Competitive"}
                                            </Badge>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            <section className="space-y-4">
                <div className="panel field-grid !grid-cols-1 md:!grid-cols-3 bg-slate-50/60">
                    <label>
                        Search deals & sessions
                        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Product name or deal/session ID" />
                    </label>
                    <label>
                        Negotiation type
                        <select value={type} onChange={e => setType(e.target.value)}>
                            <option value="">Both types</option>
                            <option value="multi-seller">Multi-seller</option>
                            <option value="one-to-one">One-to-one</option>
                        </select>
                    </label>
                    <label>
                        Deal status
                        <select value={status} onChange={e => setStatus(e.target.value)}>
                            <option value="">All statuses</option>
                            {["active", "paused", "awaiting_approval", "completed", "failed", "rejected", "cancelled", "excluded", "not_selected"].map(s => (
                                <option value={s} key={s}>
                                    {s.replaceAll("_", " ")}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>

                {rows.length ? (
                    <div className="panel table-wrap !p-0 overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <h2 className="text-base font-bold text-slate-900">Active & Recent Deals</h2>
                                <p className="text-xs muted">Showing {rows.length} negotiation records</p>
                            </div>
                            {user.role === "admin" && (
                                <Link href="/dashboard/admin/reports" className="text-xs font-semibold text-indigo-600 hover:underline">
                                    Export in Reports →
                                </Link>
                            )}
                        </div>
                        <table>
                            <thead>
                                <tr>
                                    <th>Deal / Session ID</th>
                                    <th>Product</th>
                                    <th>Type</th>
                                    <th>Status</th>
                                    <th>Round Progress</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map(s => (
                                    <tr key={s.id} className="hover:bg-slate-50/80 transition">
                                        <td className="font-mono text-xs text-slate-600">{s.id}</td>
                                        <td className="font-semibold text-slate-900">{s.productName}</td>
                                        <td>
                                            <Badge tone={s.type === "multi-seller" ? "indigo" : "slate"}>{s.type}</Badge>
                                        </td>
                                        <td>
                                            <Badge>{s.status.replaceAll("_", " ")}</Badge>
                                        </td>
                                        <td>
                                            <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
                                                <span>Round {s.round}</span>
                                            </span>
                                        </td>
                                        <td>
                                            <Link className="text-indigo-600 font-semibold text-xs hover:underline" href={s.href}>
                                                Open session →
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <Empty title="No matching Negotiation Sessions" description="Clear the filters or start a negotiation from Browse Products." href="/products" label="Browse Products" />
                )}
            </section>
        </div>
    );
}

export function UnifiedCompetitiveDetail({ id }: { id: string }) {
    const { user } = useDemo(), c = useCompetitiveWorkspace();
    const record = c.records.find(r => r.id === id);
    if (!record || !user.active)
        return (
            <Empty
                title="Negotiation Session unavailable"
                description="This record does not belong to the selected active identity, or no compatible local record exists."
                href={`/dashboard/${user.role}/negotiations`}
                label="Back to history"
            />
        );
    if (user.role === "buyer") return <CompetitiveNegotiation productId={record.product.id} attemptId={record.id} />;
    if (user.role === "seller") return <SellerSessionPicker id={id} />;
    return (
        <div className="space-y-5">
            <Heading
                title={record.productName}
                eyebrow="Multi-seller · Deal Monitoring"
                description={`${record.id} · ${record.status.replaceAll("_", " ")} · Round ${record.round}/${record.maxRounds}`}
                action={<Badge>{record.status.replaceAll("_", " ")}</Badge>}
            />
            <div className="panel bg-slate-50/70 flex flex-wrap items-center justify-between gap-4 text-sm">
                <span>
                    Buyer #{record.buyerId} · <strong>{record.quantity} units</strong> · Target <strong>{money(record.targetPrice)}</strong> per unit · Delivery within <strong>{record.deliveryDays} days</strong>.
                </span>
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full">
                    Private pricing limits excluded
                </span>
            </div>
            <div className="grid gap-4">
                {record.participants.map(s => (
                    <section className="panel space-y-3" key={s.id}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <h2 className="text-base font-bold text-slate-900">{s.name}</h2>
                            <Badge>{s.status}</Badge>
                        </div>
                        <p className="text-sm text-slate-600">
                            Current Offer: <strong>{s.currentPrice === undefined ? "Not offered" : money(s.currentPrice)}</strong> · Agent Agreement:{" "}
                            <strong>{s.agreedPrice === undefined ? "None" : money(s.agreedPrice)}</strong>
                        </p>
                        <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-xl p-3 bg-slate-50/40">
                            {s.history.map((m, i) => (
                                <p className="text-sm py-2 text-slate-700" key={i}>
                                    <span className="font-mono text-xs text-slate-400 mr-2">#{i + 1} · Round {m.round}</span>
                                    <strong className="text-slate-900">{m.agent}</strong> · {m.price === undefined ? "" : <span className="font-bold text-indigo-700">{money(m.price)} · </span>}
                                    {m.explanation}
                                </p>
                            ))}
                        </div>
                    </section>
                ))}
            </div>
            <AgreementLinks sessionId={id} />
        </div>
    );
}

function SellerSessionPicker({ id }: { id: string }) {
    const c = useCompetitiveWorkspace();
    const own = c.sellerSessions.filter(s => s.id.startsWith(`${id}--`));
    const [selected, setSelected] = useState("");
    if (!own.length) return <Empty title="Session access denied" description="No product listing owned by this Seller belongs to this session." />;
    return (
        <div className="space-y-4">
            <label className="panel block max-w-md">
                Your Negotiation Session
                <select value={own.some(s => s.id === selected) ? selected : own[0].id} onChange={e => setSelected(e.target.value)}>
                    {own.map(s => (
                        <option value={s.id} key={s.id}>
                            {s.productName} · Listing {s.storefrontId}
                        </option>
                    ))}
                </select>
            </label>
            <SellerCompetitiveSessions sessionId={own.some(s => s.id === selected) ? selected : own[0].id} />
            <AgreementLinks sessionId={id} />
        </div>
    );
}

export function UnifiedAgreementDetail({ id }: { id: string }) {
    const { user } = useDemo(), c = useCompetitiveWorkspace();
    const g = c.agreements.find(g => g.id === id);
    if (!g || !user.active) return <Empty title="Agreement unavailable" description="This Agreement is not available to the selected identity." />;
    return (
        <div className="space-y-6">
            <Heading eyebrow="Confirmed Deal Record" title={`Agreement ${g.id}`} description={g.productName} action={<Badge tone="emerald">Deal Closed</Badge>} />
            <section className="panel space-y-5 max-w-3xl">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-100">
                    <div>
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Selected Storefront</span>
                        <h2 className="text-xl font-bold text-slate-900 mt-0.5">{g.storefrontName}</h2>
                    </div>
                    <Badge tone="indigo">SERVER RECORDS · Recorded</Badge>
                </div>
                <div className="grid sm:grid-cols-3 gap-4 py-2">
                    <div className="p-4 rounded-xl bg-slate-50">
                        <span className="text-xs muted block">Quantity & Unit Price</span>
                        <strong className="text-base text-slate-900 mt-1 block">{g.quantity} units × {money(g.unitPrice)}</strong>
                    </div>
                    <div className="p-4 rounded-xl bg-emerald-50/70">
                        <span className="text-xs text-emerald-800 block">Total Deal Value</span>
                        <strong className="text-xl font-extrabold text-emerald-900 mt-1 block">{money(g.total)}</strong>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50">
                        <span className="text-xs muted block">Delivery Commitment</span>
                        <strong className="text-base text-slate-900 mt-1 block">Within {g.deliveryDays} days</strong>
                    </div>
                </div>
                <p className="text-sm text-slate-600">
                    Buyer #{g.buyerId} · Seller #{g.sellerId} · Listing {g.listingId ?? g.storefrontId} · Catalog {g.catalogProductId ?? g.productId}
                </p>
                <p className="text-xs text-slate-500">Approved {new Date(g.approvedAt).toLocaleString("en-GB")} · The Agreement is recorded and available stock is updated once. No payment or shipment is processed.</p>
                <div className="flex flex-wrap gap-3 pt-2">
                    <Link className="btn" href={`/dashboard/${user.role}/${user.role === "seller" ? "competitive-session" : "competitive"}/${g.sessionId}`}>
                        Open Negotiation Session
                    </Link>
                    <button className="btn-secondary" onClick={() => window.print()}>
                        Print / save summary
                    </button>
                </div>
            </section>
        </div>
    );
}

export function UnifiedNotifications() {
    const { user, state, setState } = useDemo(), c = useCompetitiveWorkspace();
    const old = state.notices.filter(n => n.userId === user.id);
    const unread = old.filter(n => !n.read).length + c.notices.filter(n => !n.read).length;
    return (
        <div className="space-y-6">
            <Heading
                eyebrow="Activity Center"
                title={`Notifications (${unread} unread)`}
                description="Real-time updates about your negotiations, seller decisions, and closed agreements."
                action={
                    <button
                        className="btn-secondary"
                        onClick={() => {
                            c.read();
                            setState(s => ({ ...s, notices: s.notices.map(n => ({ ...n, read: true })) }));
                        }}
                    >
                        Mark all read
                    </button>
                }
            />
            {!old.length && !c.notices.length ? (
                <Empty title="You're all caught up" description="Negotiation events will appear here." />
            ) : (
                <div className="space-y-3">
                    {c.notices.map(n => (
                        <article className={`panel flex justify-between items-center gap-4 ${!n.read ? "border-l-4 border-l-indigo-600" : ""}`} key={n.id}>
                            <div className="space-y-1">
                                <Badge tone={n.read ? "slate" : "indigo"}>{n.read ? "Read" : "New"}</Badge>
                                <p className="font-medium text-slate-900 mt-1.5">{n.text}</p>
                                <small className="text-xs text-slate-400 block">{new Date(n.createdAt).toLocaleString("en-GB")}</small>
                            </div>
                            <Link className="btn-secondary shrink-0" href={n.href} onClick={() => c.read(n.id)}>
                                Open
                            </Link>
                        </article>
                    ))}
                    {old.map(n => (
                        <article className={`panel flex justify-between items-center gap-4 ${!n.read ? "border-l-4 border-l-indigo-600" : ""}`} key={`legacy-${n.id}`}>
                            <div className="space-y-1">
                                <Badge tone={n.read ? "slate" : "indigo"}>{n.read ? "Read" : "New"}</Badge>
                                <p className="font-medium text-slate-900 mt-1.5">{n.text}</p>
                            </div>
                            <Link
                                className="btn-secondary shrink-0"
                                href={n.href}
                                onClick={() => setState(s => ({ ...s, notices: s.notices.map(x => (x.id === n.id ? { ...x, read: true } : x)) }))}
                            >
                                Open
                            </Link>
                        </article>
                    ))}
                </div>
            )}
        </div>
    );
}
