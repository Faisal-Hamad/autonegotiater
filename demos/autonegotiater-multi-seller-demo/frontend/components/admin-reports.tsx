"use client";
import { useMemo, useState } from "react";
import { useCompetitiveWorkspace } from "./competitive-provider";
import { buildIntegratedReport } from "@/lib/integrated-reports";
import { useDemo } from "./demo-provider";
import { BackendPending } from "./ui";
import { buildReport, reportCsv, statuses, type ReportType } from "@/lib/reports";
import { downloadFile, reportPdf } from "@/lib/report-download";

export function AdminReports() {
    const { enabled, user, state } = useDemo();
    const competitive=useCompetitiveWorkspace();
    const [type, setType] = useState<ReportType>("seller");
    const [query, setQuery] = useState(""); const [filter, setFilter] = useState("");
    const [selection, setSelection] = useState<{ id: number|string; date: string } | null>(null);
    const [busy, setBusy] = useState(false); const [error, setError] = useState("");
    const report = useMemo(() => enabled && user.role === "admin" && selection ? buildIntegratedReport(state, type, selection.id, selection.date,competitive.records,competitive.agreements,competitive.reportListings) : null, [enabled, user.role, state, type, selection,competitive.records,competitive.agreements,competitive.reportListings]);
    if (!enabled) return <BackendPending />;
    if (user.role !== "admin") return <p>Reports are available only to the demo Admin identity.</p>;
    const entities = type === "session" ? [...competitive.records.map(r=>({id:r.id,label:`${r.id} — ${r.productName} — Multi-seller`,status:r.status})),...state.sessions.map(s => ({ id: s.id, label: `#${s.id} — ${state.products.find(p => p.id === s.productId)?.name ?? "Product unavailable"} — ${state.users.find(u => u.id === s.buyerId)?.name ?? ""}`, status: s.status }))] : state.users.filter(u => u.role === type).map(u => ({ id: u.id, label: `${u.name} — ${u.email}`, status: u.active ? "active" : "inactive" }));
    const matches = entities.filter(e => `${e.id} ${e.label}`.toLowerCase().includes(query.trim().toLowerCase()) && (!filter || filter === e.status));
    async function pdf() {
        if (!report || busy) return; setBusy(true); setError("");
        try { downloadFile(await reportPdf(report), `${report.id}.pdf`); } catch (e) { setError(e instanceof Error ? e.message : "Unable to generate the report. Please try again."); } finally { setBusy(false); }
    }
    return <div dir="ltr" lang="en" className="space-y-6 min-w-0">
        <header><p className="text-indigo-600 text-sm">DEMO / SAMPLE DATA</p><h1 className="text-3xl font-bold mt-2">Admin Reports</h1><p className="muted mt-3">Reports use the current mock data only. Role selection is not real authorization. Production Reports require authorized backend APIs.</p></header>
        <div className="panel grid sm:grid-cols-2 gap-4">
            <label>Report type<select value={type} onChange={e => { setType(e.target.value as ReportType); setSelection(null); setFilter(""); setQuery(""); setError(""); }}><option value="seller">Seller Report</option><option value="buyer">Buyer Report</option><option value="session">Negotiation Session Report</option></select></label>
            <label>Search by name or ID<input value={query} onChange={e => { setQuery(e.target.value); setSelection(null); }} placeholder="Enter a name or ID" /></label>
            <label>Filter by status<select value={filter} onChange={e => { setFilter(e.target.value); setSelection(null); }}><option value="">All statuses</option>{Object.entries(type === "session" ? statuses : { active: "Active", inactive: "Inactive" }).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>Select entity<select value={selection?.id ?? ""} onChange={e => { setSelection(e.target.value ? { id: e.target.value, date: new Date().toISOString() } : null); setError(""); }}><option value="">Select an entity to preview</option>{matches.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}</select></label>
            {!matches.length && <p role="status">No matching results. Change the search or status filter.</p>}
            <p className="muted text-sm sm:col-span-2">Filters select the entity only. The Report includes all available records for that entity in the current local session.</p>
        </div>
        {!report ? <div className="panel">Select a Seller, Buyer or Negotiation Session to preview and download a Report.</div> : <>
            <div className="flex flex-wrap gap-3 items-center"><button className="btn" disabled={busy} onClick={pdf}>{busy ? "Generating PDF…" : "Download PDF"}</button><button className="btn-secondary" disabled={busy} onClick={() => downloadFile(new Blob([reportCsv(report)], { type: "text/csv;charset=utf-8" }), `${report.id}.csv`)}>Download CSV</button><span className="muted text-sm">English PDFs contain searchable text; unsupported scripts use rendered pages. CSV remains a text alternative. No real payments are recorded.</span></div>
            {error && <p role="alert" className="text-rose-700">{error}</p>}
            <article className="panel space-y-7" aria-label="Report preview"><header><h2>{report.title}</h2><p className="text-amber-700">DEMO / SAMPLE DATA</p><p className="text-sm break-all">Report ID: <bdi dir="ltr">{report.id}</bdi></p><p className="text-sm">Generated at: <bdi dir="ltr">{report.generatedAt}</bdi></p></header>
                {report.sections.map((s, i) => <section key={i}><h3 className="font-bold mb-3">{s.title}</h3>{!s.rows.length ? <p className="muted">No data is available for this section.</p> : <div className="overflow-x-auto" tabIndex={0} aria-label={s.title}><table className="w-full text-sm"><thead><tr>{s.columns.map(c => <th key={c} className="text-left">{c}</th>)}</tr></thead><tbody>{s.rows.map((row, n) => <tr key={n}>{row.map((cell, j) => <td key={j} className="text-left max-w-md break-words"><bdi dir="ltr">{cell}</bdi></td>)}</tr>)}</tbody></table></div>}</section>)}
            </article>
        </>}
    </div>;
}
