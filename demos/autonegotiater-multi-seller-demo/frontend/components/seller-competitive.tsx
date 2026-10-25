"use client";
import Link from "next/link";
import { SellerSessionView } from "./seller-session-view";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useDemo } from "./demo-provider";
import { useCompetitiveWorkspace, useSellerCompetitive } from "./competitive-provider";
import { DesignIcon, StoreMark } from "./approved-visuals";
import { money } from "@/lib/demo-model";
import { sellerStatusLabels, type SellerCompetitiveSession } from "@/lib/competitive";
function sessionStatus(s: SellerCompetitiveSession) { if(s.phase==="cancelled")return "Buyer cancelled";if(s.phase==="rejected")return "Buyer rejected all offers";if(s.phase==="running"&&s.status==="agreed")return "Provisional agent Agreement";return s.approval === "selected" ? "Buyer approved" : s.approval === "not_selected" ? "Not selected by Buyer" : s.status === "agreed" ? "Agent Agreement · Buyer approval pending" : sellerStatusLabels[s.status]; }
function Requirements({ session: s }: { session: SellerCompetitiveSession }) {
    return <div className="an-requirements">{[["box","Requested quantity",`${s.requirements.quantity} units`],["coins","Buyer target price",money(s.requirements.targetPrice)],["truck","Required delivery",`Within ${s.requirements.deliveryDays} days`],["tag","Your current offer",s.currentPrice === undefined ? "No offer yet" : money(s.currentPrice)]].map(([icon,label,value])=><div className="an-requirement" key={label}><span className="an-icon-disc"><DesignIcon name={icon}/></span><div><span>{label}</span><strong>{value}</strong></div></div>)}</div>;
}
export function SellerCompetitiveSessions({ sessionId, subset }: { sessionId?: string; subset?: "agreements" }) {
    const sessions = useSellerCompetitive();
    const workspace=useCompetitiveWorkspace();
    const viewFilter = useSearchParams().get("view");
    const { user, state } = useDemo();
    const [search, setSearch] = useState(""), [filter, setFilter] = useState("");
    if (user.role !== "seller") return null;
    const buyerName = (id: number) => state.users.find(u=>u.id===id)?.name ?? `Buyer #${id}`;
    if (sessionId) {
        const s = sessions.find(s=>s.id===sessionId);
        if (!s) return <section className="panel"><h2>Negotiation Session unavailable</h2><p className="muted mt-3">This session does not belong to the selected Seller, or no compatible saved record exists.</p><Link className="btn-secondary mt-4" href="/dashboard/seller/negotiations">Back to Negotiation Sessions</Link></section>;
        return <SellerSessionView session={s} buyerName={buyerName(s.buyerId)} product={workspace.records.find(r=>r.id===s.id.split("--")[0])?.product ?? state.products.find(p=>p.id===s.productId)}/>;
    }
    const rows = sessions.filter(s=>(!subset || s.status === "agreed") && (viewFilter !== "active" || s.phase === "running" && s.status !== "excluded") && (viewFilter !== "completed" || s.phase !== "running") && (viewFilter !== "requests" || s.status !== "excluded" && s.history.length === 0) && (!filter || s.status===filter) && `${s.productName} ${s.storefrontName} ${buyerName(s.buyerId)} ${s.id}`.toLowerCase().includes(search.toLowerCase()));
    return <section className="an-experience mb-6" aria-label="Shared competitive Negotiation Sessions"><div className="an-panel"><div className="an-section-heading"><h2>{subset ? "Competitive Agreements" : "Competitive Negotiation Sessions"}</h2><span className="an-demo-label">DEMO / SAMPLE DATA</span></div><p className="an-results-note">{user.name}'s product listings only. These are the same sessions started by Buyers; no separate Seller simulation runs.</p><div className="field-grid mb-4"><label>Search competitive sessions<input aria-label="Search competitive sessions" placeholder="Product, Buyer, listing or session ID" value={search} onChange={e=>setSearch(e.target.value)}/></label><label>Competitive session status<select aria-label="Competitive session status" value={filter} onChange={e=>setFilter(e.target.value)}><option value="">All statuses</option>{Object.entries(sellerStatusLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label></div>{rows.length ? <div className="grid gap-4">{rows.map(s=><article className="an-side-card" key={s.id}><div className="an-section-heading"><div className="flex items-center gap-3"><StoreMark name={s.storefrontName} index={user.id-1}/><div><h3>{s.productName}</h3><p className="an-results-note">{s.storefrontName} · Buyer: {buyerName(s.buyerId)}</p></div></div><span className={`an-status an-${s.status}`}>{sessionStatus(s)}</span></div><Requirements session={s}/><div className="an-session-actions"><span>Round {s.round} of {s.maxRounds} · {s.phase === "running" ? "In progress" : "Negotiation completed"}</span><Link className="an-primary" href={`/dashboard/seller/competitive/${s.id}`}>Open Negotiation Session</Link></div></article>)}</div> : <p className="an-results-note">{sessions.length ? "No sessions match these filters." : "No competitive sessions for this Seller yet. Start one as a Buyer, then switch Seller identity in this browser. Records survive refresh."}</p>}</div></section>;
}

export function SellerCompetitiveUpdates() {
    const sessions = useSellerCompetitive();
    const { user } = useDemo();
    if (user.role !== "seller") return null;
    return <section className="panel mb-6"><h2>Competitive Negotiation Updates</h2><p className="muted text-sm mt-2">Current shared-session summaries, not a separate notification queue.</p>{sessions.length ? sessions.map(s => <Link key={s.id} className="block border-b border-slate-100 py-3" href={`/dashboard/seller/competitive/${s.id}`}><strong>{s.productName} · {s.storefrontName}</strong><span className="block text-sm muted">{sessionStatus(s)} · Round {s.round} of {s.maxRounds}</span></Link>) : <p className="muted text-sm mt-3">No competitive session updates for this Seller.</p>}</section>;
}
