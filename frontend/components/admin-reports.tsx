"use client";
import { useMemo, useState } from "react";
import { useCompetitiveWorkspace } from "./competitive-provider";
import { buildIntegratedReport } from "@/lib/integrated-reports";
import { buildPlatformReport } from "@/lib/platform-report";
import { useDemo } from "./demo-provider";
import { BackendPending, Badge } from "./ui";
import { DesignIcon } from "./approved-visuals";
import { reportCsv, statuses, type Report, type ReportType } from "@/lib/reports";
import { downloadFile, reportPdf } from "@/lib/report-download";

type Kind = "platform" | ReportType;
type Entity = { id: number | string; title: string; subtitle: string; status: string; date?: string };

const kinds: { kind: Kind; icon: string; title: string; subtitle: string; description: string }[] = [
    { kind: "platform", icon: "trend", title: "Platform summary", subtitle: "Marketplace overview", description: "Overall deal volume, success rate, agreement value, buyer savings and seller performance." },
    { kind: "seller", icon: "box", title: "Seller report", subtitle: "Storefront analytics", description: "One seller's product listings, active negotiations, closed deals and revenue." },
    { kind: "buyer", icon: "coins", title: "Buyer report", subtitle: "Purchasing activity", description: "One buyer's negotiations, direct purchases and closed agreements." },
    { kind: "session", icon: "handshake", title: "Deals & Negotiations", subtitle: "Negotiation session", description: "Complete round-by-round timeline, offers and final outcome of one deal." },
];

const statusLabel = (s: string) => statuses[s] ?? s.replace(/_/g, " ").replace(/^\w/, c => c.toUpperCase());
const statusTone = (s: string) =>
    ["completed", "active"].includes(s)
        ? "bg-emerald-50 text-emerald-700 border border-emerald-200/80"
        : ["failed", "cancelled", "rejected", "inactive"].includes(s)
        ? "bg-rose-50 text-rose-700 border border-rose-200/80"
        : "bg-amber-50 text-amber-800 border border-amber-200/80";

function parsePercent(v: string): number | null {
    const m = /^(\d+(?:\.\d+)?)%/.exec(v.trim());
    return m ? Math.min(100, Math.max(0, Number(m[1]))) : null;
}

function parseSarValue(v: string): number {
    const cleaned = v.replace(/[^0-9.]/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
}

export function AdminReports() {
    const { enabled, user, state } = useDemo();
    const competitive = useCompetitiveWorkspace();
    const [kind, setKind] = useState<Kind>("platform");
    const [query, setQuery] = useState(""), [filter, setFilter] = useState(""), [sort, setSort] = useState<"name" | "recent">("name");
    const [from, setFrom] = useState(""), [to, setTo] = useState("");
    const [selection, setSelection] = useState<number | string | null>(null);
    const [generatedAt, setGeneratedAt] = useState(() => new Date().toISOString());
    const [busy, setBusy] = useState(false), [error, setError] = useState("");

    const platform = useMemo(
        () => (enabled && user.role === "admin" && kind === "platform" ? buildPlatformReport(state, competitive.records, competitive.agreements, from, to, generatedAt) : null),
        [enabled, user.role, kind, state, competitive.records, competitive.agreements, from, to, generatedAt]
    );
    const entityReport = useMemo(
        () => (enabled && user.role === "admin" && kind !== "platform" && selection !== null ? buildIntegratedReport(state, kind, selection, generatedAt, competitive.records, competitive.agreements, competitive.reportListings) : null),
        [enabled, user.role, kind, selection, state, generatedAt, competitive.records, competitive.agreements, competitive.reportListings]
    );
    const report: Report | null = platform?.report ?? entityReport;

    if (!enabled) return <BackendPending />;
    if (user.role !== "admin") return <p>Reports require an authenticated Admin account.</p>;

    const entities: Entity[] =
        kind === "session"
            ? [
                  ...competitive.records.map(r => ({
                      id: r.id,
                      title: r.productName,
                      subtitle: `Multi-seller deal · ${state.users.find(u => u.id === r.buyerId)?.name ?? `Buyer ${r.buyerId}`} · ${r.participants.length} sellers`,
                      status: r.status,
                      date: r.createdAt,
                  })),
                  ...state.sessions.map(s => ({
                      id: s.id,
                      title: state.products.find(p => p.id === s.productId)?.name ?? "Product unavailable",
                      subtitle: `${state.deals.some(d => d.sessionId === s.id && d.purchaseType === "direct") ? "Direct purchase" : "One-to-one deal"} · ${state.users.find(u => u.id === s.buyerId)?.name ?? `Buyer ${s.buyerId}`} · #${s.id}`,
                      status: s.status,
                      date: s.createdAt,
                  })),
              ]
            : kind === "platform"
            ? []
            : state.users
                  .filter(u => u.role === kind)
                  .map(u => ({
                      id: u.id,
                      title: u.name,
                      subtitle: u.email,
                      status: u.active ? "active" : "inactive",
                  }));

    const statusOptions = [...new Set(entities.map(e => e.status))];
    const matches = entities
        .filter(e => `${e.id} ${e.title} ${e.subtitle}`.toLowerCase().includes(query.trim().toLowerCase()) && (!filter || filter === e.status))
        .sort((a, b) => (sort === "recent" ? String(b.date ?? "").localeCompare(String(a.date ?? "")) : a.title.localeCompare(b.title)));

    function choose(next: Kind) {
        setKind(next);
        setSelection(null);
        setQuery("");
        setFilter("");
        setError("");
        setGeneratedAt(new Date().toISOString());
    }

    async function pdf() {
        if (!report || busy) return;
        setBusy(true);
        setError("");
        try {
            downloadFile(await reportPdf(report), `${report.id}.pdf`);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Unable to generate the report. Please try again.");
        } finally {
            setBusy(false);
        }
    }

    const csv = () => report && downloadFile(new Blob([reportCsv(report)], { type: "text/csv;charset=utf-8" }), `${report.id}.csv`);

    const sellerSection = report?.sections.find(s => s.title === "Seller performance");
    const productSection = report?.sections.find(s => s.title === "Top products");
    const maxSellerRev = sellerSection ? Math.max(1, ...sellerSection.rows.map(r => parseSarValue(r[3] ?? "0"))) : 1;
    const maxProductUnits = productSection ? Math.max(1, ...productSection.rows.map(r => Number(r[2] ?? 0) || 0)) : 1;

    const entityStatsSection = report?.sections.find(s => s.title.startsWith("Combined Statistics"));

    return (
        <div dir="ltr" lang="en" className="space-y-6 min-w-0">
            <header className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <p className="eyebrow">Admin Analytics & Reports</p>
                    <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Reports & Deal Intelligence</h1>
                    <p className="muted mt-2 max-w-2xl">
                        Choose a report view, inspect visual performance indicators, and export clean PDF or CSV summaries. Confidential buyer budgets and seller floor prices remain strictly protected.
                    </p>
                </div>
                {report && (
                    <div className="flex flex-wrap items-center gap-2.5">
                        <button className="btn" disabled={busy} onClick={pdf}>
                            <DesignIcon name="scroll" />
                            <span>{busy ? "Generating PDF…" : "Download PDF"}</span>
                        </button>
                        <button className="btn-secondary" disabled={busy} onClick={csv}>
                            <DesignIcon name="chart" />
                            <span>Download CSV</span>
                        </button>
                    </div>
                )}
            </header>

            <section aria-label="Report type">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">1 · Select Report View</h2>
                    <span className="text-xs text-slate-400">4 specialized views available</span>
                </div>
                <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3.5" role="radiogroup">
                    {kinds.map(k => {
                        const active = kind === k.kind;
                        return (
                            <button
                                key={k.kind}
                                role="radio"
                                aria-checked={active}
                                onClick={() => choose(k.kind)}
                                className={`panel text-left transition-all flex flex-col justify-between ${
                                    active
                                        ? "!border-indigo-500 ring-2 ring-indigo-500/15 bg-gradient-to-b from-indigo-50/50 to-white"
                                        : "hover:border-slate-300 hover:bg-slate-50/40"
                                }`}
                            >
                                <div>
                                    <div className="flex items-center justify-between gap-2">
                                        <span className={`inline-grid place-items-center w-10 h-10 rounded-xl ${active ? "bg-indigo-600 text-white shadow-sm" : "bg-indigo-50 text-indigo-600"}`}>
                                            <DesignIcon name={k.icon} />
                                        </span>
                                        <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                            {k.subtitle}
                                        </span>
                                    </div>
                                    <strong className="block text-base text-slate-900 mt-3.5">{k.title}</strong>
                                    <span className="block text-xs muted mt-1 leading-relaxed">{k.description}</span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </section>

            {kind === "platform" ? (
                <section className="panel flex flex-wrap items-end justify-between gap-4 bg-slate-50/60" aria-label="Report period">
                    <div className="flex flex-wrap items-end gap-4">
                        <div>
                            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">2 · Filter Timeframe</h2>
                            <div className="flex flex-wrap items-center gap-3">
                                <label className="text-xs font-semibold text-slate-600">
                                    From
                                    <input type="date" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)} />
                                </label>
                                <label className="text-xs font-semibold text-slate-600">
                                    To
                                    <input type="date" value={to} min={from || undefined} onChange={e => setTo(e.target.value)} />
                                </label>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {[
                            ["All time", ""],
                            ["Last 7 days", 7],
                            ["Last 30 days", 30],
                        ].map(([label, days]) => {
                            const isAll = !days && !from && !to;
                            return (
                                <button
                                    key={String(label)}
                                    className={`btn-secondary text-xs py-2 px-3.5 ${isAll ? "!border-indigo-300 !bg-indigo-50/60 !text-indigo-700" : ""}`}
                                    onClick={() => {
                                        if (!days) {
                                            setFrom("");
                                            setTo("");
                                            return;
                                        }
                                        const d = new Date(Date.now() - Number(days) * 864e5);
                                        setFrom(d.toISOString().slice(0, 10));
                                        setTo("");
                                    }}
                                >
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                </section>
            ) : (
                <section className="panel space-y-4" aria-label="Choose an item">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            2 · Select {kind === "session" ? "a Deal or Negotiation" : `a ${kind}`}
                        </h2>
                        <span className="text-xs font-medium text-slate-500">
                            Showing {matches.length} of {entities.length} records
                        </span>
                    </div>
                    <div className="grid sm:grid-cols-3 gap-3">
                        <label className="text-xs font-semibold text-slate-600">
                            Search
                            <input
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                placeholder={kind === "session" ? "Product, buyer or deal ID" : "Name or email address"}
                            />
                        </label>
                        <label className="text-xs font-semibold text-slate-600">
                            Status
                            <select value={filter} onChange={e => setFilter(e.target.value)}>
                                <option value="">All statuses</option>
                                {statusOptions.map(s => (
                                    <option key={s} value={s}>
                                        {statusLabel(s)}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="text-xs font-semibold text-slate-600">
                            Sort by
                            <select value={sort} onChange={e => setSort(e.target.value as "name" | "recent")}>
                                <option value="name">Name (A–Z)</option>
                                {kind === "session" && <option value="recent">Most recent</option>}
                            </select>
                        </label>
                    </div>
                    {!matches.length ? (
                        <p role="status" className="muted py-6 text-center">
                            No matching records found. Adjust your search or status filter.
                        </p>
                    ) : (
                        <ul className="divide-y divide-slate-100 border border-slate-200/90 rounded-xl max-h-80 overflow-y-auto bg-white" aria-label="Results">
                            {matches.map(e => {
                                const selected = selection === e.id;
                                return (
                                    <li key={`${e.id}`}>
                                        <button
                                            onClick={() => {
                                                setSelection(e.id);
                                                setGeneratedAt(new Date().toISOString());
                                                setError("");
                                            }}
                                            aria-pressed={selected}
                                            className={`w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left transition ${
                                                selected ? "bg-indigo-50/80 border-l-4 border-l-indigo-600" : "hover:bg-slate-50"
                                            }`}
                                        >
                                            <span className="flex items-center gap-3 min-w-0">
                                                <span className={`w-9 h-9 rounded-full grid place-items-center text-xs font-bold shrink-0 ${selected ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700"}`}>
                                                    {e.title.trim().charAt(0).toUpperCase() || "#"}
                                                </span>
                                                <span className="min-w-0">
                                                    <strong className="block text-sm text-slate-900 truncate">{e.title}</strong>
                                                    <span className="block text-xs muted truncate mt-0.5">
                                                        {e.subtitle}
                                                        {e.date ? ` · ${e.date.slice(0, 10)}` : ""}
                                                    </span>
                                                </span>
                                            </span>
                                            <span className={`text-xs font-semibold rounded-full px-2.5 py-1 whitespace-nowrap ${statusTone(e.status)}`}>
                                                {statusLabel(e.status)}
                                            </span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </section>
            )}

            {!report ? (
                <div className="panel text-center py-12 bg-slate-50/40">
                    <div className="mx-auto mb-3 w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 grid place-items-center">
                        <DesignIcon name="chart" />
                    </div>
                    <strong className="block text-base text-slate-800">Ready to Preview Report</strong>
                    <p className="muted text-sm mt-1">
                        Select {kind === "session" ? "a deal or negotiation session" : `a ${kind}`} from the list above to generate its full analytics view.
                    </p>
                </div>
            ) : (
                <section className="space-y-6" aria-label="Report preview">
                    <div className="panel !py-4 flex flex-wrap items-center justify-between gap-3 sticky top-16 z-10 bg-white/95 backdrop-blur border-indigo-100">
                        <div>
                            <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-600">3 · Preview and download</h2>
                            <p className="text-lg font-extrabold text-slate-900 mt-0.5">{report.title}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs text-slate-400 mr-2 hidden sm:inline">
                                Generated: <bdi dir="ltr">{report.generatedAt}</bdi>
                            </span>
                            <button className="btn text-xs py-2 px-3.5" disabled={busy} onClick={pdf}>
                                {busy ? "Generating PDF…" : "Download PDF"}
                            </button>
                            <button className="btn-secondary text-xs py-2 px-3.5" disabled={busy} onClick={csv}>
                                Download CSV
                            </button>
                        </div>
                    </div>

                    {error && (
                        <p role="alert" className="panel !border-rose-200 !bg-rose-50 text-rose-700 text-sm">
                            {error}
                        </p>
                    )}

                    {platform && (
                        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                            {platform.kpis.map(k => {
                                const pct = parsePercent(k.value);
                                return (
                                    <div key={k.label} className="panel kpi-card flex items-center justify-between gap-4">
                                        <div className="min-w-0">
                                            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">{k.label}</span>
                                            <strong className="block text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2 tracking-tight">
                                                {k.value}
                                            </strong>
                                            {k.note && <span className="block text-xs text-slate-500 mt-1.5">{k.note}</span>}
                                        </div>
                                        {pct !== null ? (
                                            <div className="relative w-14 h-14 shrink-0 grid place-items-center" aria-hidden="true">
                                                <svg viewBox="0 0 36 36" className="w-14 h-14 -rotate-90">
                                                    <path
                                                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                                        fill="none"
                                                        stroke="#e2e8f0"
                                                        strokeWidth="3.4"
                                                    />
                                                    <path
                                                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                                        fill="none"
                                                        stroke="#4f46e5"
                                                        strokeWidth="3.4"
                                                        strokeDasharray={`${pct}, 100`}
                                                        strokeLinecap="round"
                                                    />
                                                </svg>
                                                <span className="absolute text-[10px] font-bold text-indigo-700">{Math.round(pct)}%</span>
                                            </div>
                                        ) : (
                                            <span className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 grid place-items-center shrink-0">
                                                <DesignIcon name={k.label.toLowerCase().includes("user") ? "users" : k.label.toLowerCase().includes("value") ? "coins" : "trend"} />
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {!platform && entityStatsSection && (
                        <div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-3.5">
                            {entityStatsSection.rows
                                .filter(r => r[0] !== "Scope")
                                .map(([label, val]) => (
                                    <div key={label} className="panel kpi-card">
                                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">{label}</span>
                                        <strong className="block text-xl font-extrabold text-slate-900 mt-2">{val}</strong>
                                    </div>
                                ))}
                        </div>
                    )}

                    {platform && (sellerSection || productSection) && (
                        <div className="grid lg:grid-cols-2 gap-5">
                            {sellerSection && (
                                <section className="panel space-y-4" aria-label="Seller performance chart">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-base font-bold text-slate-900">Seller Performance Comparison</h3>
                                            <p className="text-xs muted">Revenue & closed deals across active sellers</p>
                                        </div>
                                        <Badge tone="indigo">{sellerSection.rows.length} sellers</Badge>
                                    </div>
                                    {!sellerSection.rows.length ? (
                                        <p className="text-sm muted py-4">No seller revenue recorded in this period.</p>
                                    ) : (
                                        <div className="space-y-3.5 pt-1">
                                            {sellerSection.rows.map((r, idx) => {
                                                const rev = parseSarValue(r[3] ?? "0");
                                                const width = Math.max(8, Math.round((rev / maxSellerRev) * 100));
                                                return (
                                                    <div key={idx} className="space-y-1.5">
                                                        <div className="flex items-center justify-between text-xs">
                                                            <span className="font-bold text-slate-800">{r[0]}</span>
                                                            <span className="text-slate-600">
                                                                <strong className="text-slate-900">{r[3]}</strong> · {r[1]} deals ({r[4]} avg discount)
                                                            </span>
                                                        </div>
                                                        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-violet-500"
                                                                style={{ width: `${width}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </section>
                            )}

                            {productSection && (
                                <section className="panel space-y-4" aria-label="Top selling products">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-base font-bold text-slate-900">Top-Selling Products</h3>
                                            <p className="text-xs muted">Most negotiated and purchased catalog items</p>
                                        </div>
                                        <Badge tone="emerald">Top {productSection.rows.length}</Badge>
                                    </div>
                                    {!productSection.rows.length ? (
                                        <p className="text-sm muted py-4">No product agreements recorded in this period.</p>
                                    ) : (
                                        <div className="space-y-3.5 pt-1">
                                            {productSection.rows.map((r, idx) => {
                                                const units = Number(r[2] ?? 0) || 0;
                                                const width = Math.max(10, Math.round((units / maxProductUnits) * 100));
                                                return (
                                                    <div key={idx} className="space-y-1.5">
                                                        <div className="flex items-center justify-between text-xs">
                                                            <span className="font-bold text-slate-800 truncate pr-2">{r[0]}</span>
                                                            <span className="text-slate-600 shrink-0">
                                                                <strong className="text-emerald-700">{r[3]}</strong> · {r[2]} units ({r[1]} deals)
                                                            </span>
                                                        </div>
                                                        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500"
                                                                style={{ width: `${width}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </section>
                            )}
                        </div>
                    )}

                    <article className="panel space-y-5">
                        <header className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100 text-xs text-slate-500">
                            <div className="flex flex-wrap gap-x-6 gap-y-1">
                                <span>
                                    Report ID: <strong className="text-slate-700"><bdi dir="ltr">{report.id}</bdi></strong>
                                </span>
                                <span>
                                    Generated: <strong className="text-slate-700"><bdi dir="ltr">{report.generatedAt}</bdi></strong>
                                </span>
                            </div>
                            <span className="inline-flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full font-semibold">
                                <DesignIcon name="shield" className="w-3.5 h-3.5" />
                                Private limits & floor prices excluded
                            </span>
                        </header>

                        <div className="space-y-4">
                            {report.sections
                                .filter(s => !(platform && s.title === "Key figures"))
                                .map((s, i) => (
                                    <details key={i} open={i < 4} className="group border border-slate-200/80 rounded-xl bg-slate-50/30 overflow-hidden">
                                        <summary className="cursor-pointer font-bold text-slate-800 px-4 py-3.5 bg-white hover:bg-slate-50/80 flex items-center justify-between transition">
                                            <span className="flex items-center gap-2.5">
                                                <span className="w-2 h-2 rounded-full bg-indigo-500" />
                                                <span>{s.title}</span>
                                            </span>
                                            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                                {s.rows.length} {s.rows.length === 1 ? "row" : "rows"}
                                            </span>
                                        </summary>
                                        <div className="p-4 bg-white border-t border-slate-100">
                                            {!s.rows.length ? (
                                                <p className="muted text-sm py-2">No data for this section.</p>
                                            ) : (
                                                <div className="overflow-x-auto rounded-lg border border-slate-200/70" tabIndex={0} aria-label={s.title}>
                                                    <table className="w-full text-sm">
                                                        <thead>
                                                            <tr className="bg-slate-50/90">
                                                                {s.columns.map(c => (
                                                                    <th key={c} className="text-left px-3.5 py-2.5 font-semibold text-xs uppercase tracking-wider text-slate-500">
                                                                        {c}
                                                                    </th>
                                                                ))}
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100">
                                                            {s.rows.map((row, n) => (
                                                                <tr key={n} className="hover:bg-slate-50/60 transition">
                                                                    {row.map((cell, j) => (
                                                                        <td key={j} className="text-left px-3.5 py-2.5 max-w-md break-words text-slate-700">
                                                                            <bdi dir="ltr">{cell}</bdi>
                                                                        </td>
                                                                    ))}
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    </details>
                                ))}
                        </div>
                    </article>
                </section>
            )}
        </div>
    );
}
