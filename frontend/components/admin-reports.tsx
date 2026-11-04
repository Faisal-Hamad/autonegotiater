"use client";
import { useMemo, useState } from "react";
import { useCompetitiveWorkspace } from "./competitive-provider";
import { buildIntegratedReport } from "@/lib/integrated-reports";
import { buildPlatformReport } from "@/lib/platform-report";
import { useDemo } from "./demo-provider";
import { BackendPending } from "./ui";
import { DesignIcon } from "./approved-visuals";
import { reportCsv, statuses, type Report, type ReportType } from "@/lib/reports";
import { downloadFile, reportPdf } from "@/lib/report-download";

type Kind = "platform" | ReportType;
type Entity = { id: number | string; title: string; subtitle: string; status: string; date?: string };

const kinds: { kind: Kind; icon: string; title: string; description: string }[] = [
    { kind: "platform", icon: "trend", title: "Platform summary", description: "Overall activity, success rate, agreement value, savings and seller performance." },
    { kind: "seller", icon: "box", title: "Seller report", description: "One seller's listings, negotiations, agreements and sales." },
    { kind: "buyer", icon: "coins", title: "Buyer report", description: "One buyer's negotiations, purchases and agreements." },
    { kind: "session", icon: "bolt", title: "Negotiation session", description: "Every round and message of one negotiation." },
];
const statusLabel = (s: string) => statuses[s] ?? s.replace(/_/g, " ").replace(/^\w/, c => c.toUpperCase());
const statusTone = (s: string) => ["completed", "active"].includes(s) ? "bg-emerald-50 text-emerald-700" : ["failed", "cancelled", "rejected", "inactive"].includes(s) ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-800";

export function AdminReports() {
    const { enabled, user, state } = useDemo();
    const competitive = useCompetitiveWorkspace();
    const [kind, setKind] = useState<Kind>("platform");
    const [query, setQuery] = useState(""), [filter, setFilter] = useState(""), [sort, setSort] = useState<"name" | "recent">("name");
    const [from, setFrom] = useState(""), [to, setTo] = useState("");
    const [selection, setSelection] = useState<number | string | null>(null);
    const [generatedAt, setGeneratedAt] = useState(() => new Date().toISOString());
    const [busy, setBusy] = useState(false), [error, setError] = useState("");

    const platform = useMemo(() => enabled && user.role === "admin" && kind === "platform" ? buildPlatformReport(state, competitive.records, competitive.agreements, from, to, generatedAt) : null, [enabled, user.role, kind, state, competitive.records, competitive.agreements, from, to, generatedAt]);
    const entityReport = useMemo(() => enabled && user.role === "admin" && kind !== "platform" && selection !== null ? buildIntegratedReport(state, kind, selection, generatedAt, competitive.records, competitive.agreements, competitive.reportListings) : null, [enabled, user.role, kind, selection, state, generatedAt, competitive.records, competitive.agreements, competitive.reportListings]);
    const report: Report | null = platform?.report ?? entityReport;

    if (!enabled) return <BackendPending />;
    if (user.role !== "admin") return <p>Reports require an authenticated Admin account.</p>;

    const entities: Entity[] = kind === "session"
        ? [...competitive.records.map(r => ({ id: r.id, title: r.productName, subtitle: `Multi-seller · ${state.users.find(u => u.id === r.buyerId)?.name ?? `Buyer ${r.buyerId}`} · ${r.participants.length} sellers`, status: r.status, date: r.createdAt })),
           ...state.sessions.map(s => ({ id: s.id, title: state.products.find(p => p.id === s.productId)?.name ?? "Product unavailable", subtitle: `${state.deals.some(d => d.sessionId === s.id && d.purchaseType === "direct") ? "Direct purchase" : "One-to-one"} · ${state.users.find(u => u.id === s.buyerId)?.name ?? `Buyer ${s.buyerId}`} · #${s.id}`, status: s.status, date: s.createdAt }))]
        : kind === "platform" ? [] : state.users.filter(u => u.role === kind).map(u => ({ id: u.id, title: u.name, subtitle: u.email, status: u.active ? "active" : "inactive" }));
    const statusOptions = [...new Set(entities.map(e => e.status))];
    const matches = entities
        .filter(e => `${e.id} ${e.title} ${e.subtitle}`.toLowerCase().includes(query.trim().toLowerCase()) && (!filter || filter === e.status))
        .sort((a, b) => sort === "recent" ? String(b.date ?? "").localeCompare(String(a.date ?? "")) : a.title.localeCompare(b.title));

    function choose(next: Kind) { setKind(next); setSelection(null); setQuery(""); setFilter(""); setError(""); setGeneratedAt(new Date().toISOString()); }
    async function pdf() {
        if (!report || busy) return; setBusy(true); setError("");
        try { downloadFile(await reportPdf(report), `${report.id}.pdf`); } catch (e) { setError(e instanceof Error ? e.message : "Unable to generate the report. Please try again."); } finally { setBusy(false); }
    }
    const csv = () => report && downloadFile(new Blob([reportCsv(report)], { type: "text/csv;charset=utf-8" }), `${report.id}.csv`);

    return <div dir="ltr" lang="en" className="space-y-6 min-w-0">
        <header><p className="text-indigo-600 text-sm font-semibold">ADMIN REPORTS</p><h1 className="text-3xl font-bold mt-2">Reports</h1><p className="muted mt-2">Choose a report, preview it here, then download it as PDF or CSV. Private buyer budgets and seller minimum prices are never included.</p></header>

        <section aria-label="Report type">
            <h2 className="text-sm font-semibold text-slate-500 mb-3">1 · Choose a report</h2>
            <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3" role="radiogroup">
                {kinds.map(k => <button key={k.kind} role="radio" aria-checked={kind === k.kind} onClick={() => choose(k.kind)}
                    className={`panel text-left transition hover:border-indigo-300 ${kind === k.kind ? "!border-indigo-500 ring-2 ring-indigo-100 bg-indigo-50/40" : ""}`}>
                    <span className="inline-grid place-items-center w-10 h-10 rounded-full bg-indigo-50 text-indigo-600"><DesignIcon name={k.icon}/></span>
                    <strong className="block mt-3">{k.title}</strong><span className="block text-sm muted mt-1">{k.description}</span>
                </button>)}
            </div>
        </section>

        {kind === "platform" ? <section className="panel flex flex-wrap items-end gap-4" aria-label="Report period">
            <h2 className="text-sm font-semibold text-slate-500 w-full">2 · Choose the period</h2>
            <label className="text-sm">From<input type="date" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)}/></label>
            <label className="text-sm">To<input type="date" value={to} min={from || undefined} onChange={e => setTo(e.target.value)}/></label>
            <div className="flex gap-2">{[["All time", "", ""], ["Last 7 days", 7], ["Last 30 days", 30]].map(([label, days]) => <button key={String(label)} className="btn-secondary text-sm" onClick={() => { if (!days) { setFrom(""); setTo(""); return; } const d = new Date(Date.now() - Number(days) * 864e5); setFrom(d.toISOString().slice(0, 10)); setTo(""); }}>{label}</button>)}</div>
        </section> : <section className="panel space-y-4" aria-label="Choose an item">
            <h2 className="text-sm font-semibold text-slate-500">2 · Choose {kind === "session" ? "a negotiation session" : `a ${kind}`}</h2>
            <div className="grid sm:grid-cols-3 gap-3">
                <label className="text-sm">Search<input value={query} onChange={e => setQuery(e.target.value)} placeholder={kind === "session" ? "Product, buyer or ID" : "Name or email"}/></label>
                <label className="text-sm">Status<select value={filter} onChange={e => setFilter(e.target.value)}><option value="">All statuses</option>{statusOptions.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}</select></label>
                <label className="text-sm">Sort by<select value={sort} onChange={e => setSort(e.target.value as "name" | "recent")}><option value="name">Name (A–Z)</option>{kind === "session" && <option value="recent">Most recent</option>}</select></label>
            </div>
            <p className="text-xs muted">{matches.length} of {entities.length} shown</p>
            {!matches.length ? <p role="status" className="muted">No results. Change the search or the status filter.</p> :
                <ul className="divide-y border rounded-lg max-h-80 overflow-y-auto" aria-label="Results">
                    {matches.map(e => <li key={`${e.id}`}><button onClick={() => { setSelection(e.id); setGeneratedAt(new Date().toISOString()); setError(""); }} aria-pressed={selection === e.id}
                        className={`w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 ${selection === e.id ? "bg-indigo-50" : ""}`}>
                        <span className="min-w-0"><strong className="block truncate">{e.title}</strong><span className="block text-xs muted truncate">{e.subtitle}{e.date ? ` · ${e.date.slice(0, 10)}` : ""}</span></span>
                        <span className={`text-xs rounded-full px-2 py-1 whitespace-nowrap ${statusTone(e.status)}`}>{statusLabel(e.status)}</span>
                    </button></li>)}
                </ul>}
        </section>}

        {!report ? <div className="panel text-center muted py-10">Select {kind === "session" ? "a session" : `a ${kind}`} above to preview its report.</div> : <section className="space-y-4" aria-label="Report preview">
            <div className="flex flex-wrap items-center justify-between gap-3 sticky top-0 z-10 bg-white/90 backdrop-blur py-3 border-b">
                <div><h2 className="text-sm font-semibold text-slate-500">3 · Preview and download</h2><p className="font-bold">{report.title}</p></div>
                <div className="flex gap-2"><button className="btn" disabled={busy} onClick={pdf}>{busy ? "Generating PDF…" : "Download PDF"}</button><button className="btn-secondary" disabled={busy} onClick={csv}>Download CSV</button></div>
            </div>
            {error && <p role="alert" className="text-rose-700">{error}</p>}
            {platform && <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">{platform.kpis.map(k => <div key={k.label} className="panel"><span className="text-sm muted">{k.label}</span><strong className="block text-2xl mt-1">{k.value}</strong>{k.note && <span className="block text-xs muted mt-1">{k.note}</span>}</div>)}</div>}
            <article className="panel space-y-6"><header className="text-sm muted flex flex-wrap gap-x-6 gap-y-1"><span>Report ID: <bdi dir="ltr">{report.id}</bdi></span><span>Generated: <bdi dir="ltr">{report.generatedAt}</bdi></span></header>
                {report.sections.filter(s => !(platform && s.title === "Key figures")).map((s, i) => <details key={i} open={i < 4} className="group">
                    <summary className="cursor-pointer font-bold flex items-center justify-between">{s.title}<span className="text-xs font-normal muted">{s.rows.length} {s.rows.length === 1 ? "row" : "rows"}</span></summary>
                    {!s.rows.length ? <p className="muted mt-2">No data for this section.</p> : <div className="overflow-x-auto mt-3" tabIndex={0} aria-label={s.title}><table className="w-full text-sm"><thead><tr className="bg-slate-50">{s.columns.map(c => <th key={c} className="text-left px-3 py-2 font-medium text-slate-600">{c}</th>)}</tr></thead><tbody>{s.rows.map((row, n) => <tr key={n} className="border-t">{row.map((cell, j) => <td key={j} className="text-left px-3 py-2 max-w-md break-words"><bdi dir="ltr">{cell}</bdi></td>)}</tr>)}</tbody></table></div>}
                </details>)}
            </article>
        </section>}
    </div>;
}
