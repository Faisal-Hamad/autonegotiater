"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useDemo } from "./demo-provider";
import { BackendPending, Badge, Empty, Heading } from "./ui";
import { money, negotiationRoundCount, nextAgent, visibleSessions, type Session } from "@/lib/demo-model";

export function NegotiationSetup({ productId }: {
    productId: number;
}) {
    const { enabled, state, user, createNegotiation, notify } = useDemo();
    const router = useRouter();
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const p = state.products.find(p => p.id === productId);
    if (!enabled)
        return <BackendPending />;
    if (user.role !== "buyer")
        return <Empty title="Buyer identity required" description="Choose a buyer from the identity selector to initiate a negotiation session."/>;
    if (!p)
        return <Empty title="Product not found" description="This listing does not exist."/>;
    async function submit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (submitting) return;
        const f = new FormData(e.currentTarget);
        const budget = Number(f.get("budget"));
        const scenario = String(f.get("scenario")) as Session["scenario"];
        const mode = f.get("mode") === "automated" ? "automated" : "semi_automated";
        setSubmitting(true);
        const id = await createNegotiation({ productId, budget, mode, scenario, warranty: Number(f.get("warranty")), delivery: String(f.get("delivery")) });
        setSubmitting(false);
        if (id === null) {
            setError(mode === "automated" && scenario === "rejection" ? "Buyer rejection needs semi-automated mode; automated mode has already authorized closure." : "Enter a valid positive budget and choose an in-stock product.");
            return;
        }
        notify("Negotiation session created and saved to the backend.");
        router.push("/dashboard/buyer/negotiations/" + id);
    }
    return <>
    <Heading eyebrow="Step 1 / Configure" title="Set your negotiation preferences" description={`For ${p.name}. Public asking price: ${money(p.base_price)}.`}/>
    <form className="panel max-w-3xl space-y-6" onSubmit={submit}>
    <div className="field-grid">
    <label>Maximum budget (SAR)<input name="budget" type="number" min="0.01" step="0.01" required defaultValue={Math.round(Number(p.base_price) * .9)}/>
    <span className="muted text-xs">Private to this buyer; not displayed to the seller or admin.</span>
    </label>
    <label>Negotiation mode<select name="mode" defaultValue="semi_automated">
    <option value="semi_automated">Semi-automated · I approve the final agreement</option>
    <option value="automated">Automated · close within my limits</option>
    </select>
    </label>
    <label>Required warranty (months)<input name="warranty" type="number" min="0" max="60" step="1" defaultValue="0" required/>
    </label>
    <label>Delivery preference<select name="delivery">
    <option>Buyer pickup</option>
    <option>Delivery within 3 days</option>
    <option>Delivery within 7 days</option>
    </select>
    </label>
    </div>
    <label>Negotiation scenario<select name="scenario">
    <option value="agreement">Attempt an agreement within limits</option>
    <option value="failed">Conservative agents · failed negotiation</option>
    <option value="rejection">Reach review, then reject (semi-automated)</option>
    <option value="cancellation">Start a session, then cancel</option>
    </select>
    </label>
    <p className="muted text-sm">Semi-automated mode requires your explicit final approval. Automated mode closes eligible agreements within your confidential budget automatically.</p>{error && <p role="alert" className="text-rose-700">{error}</p>}<div className="flex gap-3 flex-wrap">
    <button className="btn" disabled={p.stock_quantity < 1 || submitting}>{submitting ? "Starting session..." : "Start negotiation"}</button>
    <Link className="btn-secondary" href={`/products/${p.id}`}>Back to product</Link>
    </div>
    </form>
    </>;
}

export function SessionDetail({ id }: {
    id: number;
}) {
    const { enabled, state, user, advanceNegotiation, approveNegotiation, endNegotiation, notify } = useDemo();
    const [chat, setChat] = useState("");
    const [messages, setMessages] = useState<{
        userId: number;
        sessionId: number;
        text: string;
    }[]>([]);
    const feed = useRef<HTMLDivElement>(null);
    const turnCount = state.sessions.find(s => s.id === id)?.rounds.length ?? 0;
    useEffect(() => { if (feed.current)
        feed.current.scrollTop = feed.current.scrollHeight; }, [id, user.id, turnCount, messages.length]);
    if (!enabled)
        return <BackendPending />;
    const session = visibleSessions(state, user).find(s => s.id === id);
    if (!session)
        return <Empty title="Negotiation Session unavailable" description="Choose the owning identity or return to your Negotiation Sessions."/>;
    const product = state.products.find(p => p.id === session.productId);
    const buyer = user.role === "buyer";
    const buyerOffer = session.rounds.filter(t => t.agent === "buyer" && t.action === "offer").at(-1);
    const sellerOffer = session.rounds.filter(t => t.agent === "seller" && t.action === "counteroffer").at(-1);
    const agent = nextAgent(session);
    const agentName = agent === "buyer" ? "Buyer Agent" : "Seller Agent";
    const deal = state.deals.find(d => d.sessionId === id);
    // Sessions inside a multi-seller request are driven from the request page.
    const managed = session.requestId !== undefined;
    const scenarioHint = session.scenario === "rejection" ? "Rejection scenario: advance to review, then reject the proposed agreement." : session.scenario === "cancellation" ? "Cancellation scenario: use Cancel session before completion." : session.scenario === "failed" ? "Failure scenario: conservative buyer and seller strategies deliberately leave a price gap." : "An agreement is reached when the Buyer Agent and Seller Agent proposals converge within both parties' bounds.";
    return <>
      <Heading eyebrow="Two-agent negotiation engine" title={product?.name ?? "Negotiation"} description={"Negotiation Session #" + id + " · " + session.mode.replaceAll("_", " ") + " · " + negotiationRoundCount(session) + " / " + session.maxRounds + " rounds"} action={<Badge>{session.status.replaceAll("_", " ")}</Badge>}/>
      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        <section className="panel">
          <h2>Agent conversation</h2>
          <p className="muted text-sm mt-2">Each round contains a Buyer Agent offer and Seller Agent response persisted to PostgreSQL; acceptance may follow the final counteroffer.</p>
          {managed ? <p className="text-sm text-indigo-700 mt-3">{buyer ? <>This session is one of the sellers in <Link className="underline" href={`/dashboard/buyer/requests/${session.requestId}`}>multi-seller request #{session.requestId}</Link>. Run rounds and approve from the request page.</> : "This buyer is negotiating with several sellers for this request."}</p> : <p className="text-sm text-indigo-700 mt-3">{scenarioHint}</p>}
          <div ref={feed} className="space-y-4 my-6 max-h-[520px] overflow-y-auto pr-2" tabIndex={0} aria-label="Agent conversation" aria-live="polite" aria-relevant="additions">
            {session.rounds.map((turn, index) => <article key={index} className={"rounded-xl border p-4 max-w-[92%] " + (turn.agent === "buyer" ? "bg-indigo-50 border-indigo-100 mr-auto" : "bg-emerald-50 border-emerald-100 ml-auto")}>
              <div className="flex justify-between gap-3 flex-wrap">
                <strong className={turn.agent === "buyer" ? "text-indigo-800" : "text-emerald-800"}>{turn.agent === "buyer" ? "Buyer Agent" : "Seller Agent"}</strong>
                <span className="text-xs muted">Round {turn.number} · {turn.action}</span>
              </div>
              <p className="text-xl font-bold mt-2">{money(turn.price)}</p>
              {turn.leverageApplied && turn.competingOffer !== undefined && <p className="text-xs font-semibold text-emerald-800 mt-1">↓ Competitive leverage applied (vs {money(turn.competingOffer)} competing offer)</p>}
              {!turn.leverageApplied && turn.competingOffer !== undefined && <p className="text-xs font-semibold text-indigo-700 mt-1">↗ Competitive leverage: referencing {money(turn.competingOffer)} competing offer</p>}
              <p className="text-sm mt-2">{turn.message}</p>
            </article>)}
            {!session.rounds.length && <p className="muted">The Buyer Agent will open with a lower offer.</p>}
            {buyer && messages.filter(m => m.userId === user.id && m.sessionId === id).map((m, index) => <div key={"note-" + index} className="rounded-xl bg-slate-50 p-4">
              <p>{m.text}</p>
              <p className="muted text-xs">Private buyer note, not shared with the seller.</p>
            </div>)}
          </div>
          {buyer && !managed && session.status === "active" && <>
            <button className="btn" onClick={() => advanceNegotiation(id)}>Advance next turn · {agentName}</button>
            <form className="flex gap-2 mt-5" onSubmit={e => { e.preventDefault(); if (chat.trim()) {
                setMessages([...messages, { userId: user.id, sessionId: id, text: chat.trim() }]);
                setChat("");
            } }}>
            <label className="flex-1">Private note<input value={chat} onChange={e => setChat(e.target.value)} maxLength={500} placeholder="Add a private note for this session"/>
            </label>
            <button className="btn-secondary self-end" disabled={!chat.trim()}>Save note</button>
            </form>
          </>}
          {session.status === "not_selected" && <p className="mt-5 muted">{buyer ? "The buyer agent selected another seller's offer for this request." : "The buyer selected another offer. No Agreement was created for this listing."}</p>}
          {['failed', 'cancelled', 'rejected'].includes(session.status) && <div className="mt-5">
            <p className="text-rose-700">{session.status === "failed" ? session.failureReason ?? "No mutually acceptable price was reached." : "This session was " + session.status + ". No Agreement was created."}</p>{buyer && !managed && <Link className="btn-secondary mt-4" href={"/products/" + session.productId + "/negotiate"}>Start a new session</Link>}</div>}
        </section>
        <aside className="space-y-5">
          <div className="panel">
            <h2>Current proposals</h2>
            <dl className="space-y-4 mt-4">
            <div>
              <dt className="text-sm text-indigo-700">Buyer offer</dt>
              <dd className="text-xl font-bold">{buyerOffer ? money(buyerOffer.price) : "Not submitted"}</dd>
            </div>
            <div>
              <dt className="text-sm text-emerald-700">Seller counteroffer</dt>
              <dd className="text-xl font-bold">{sellerOffer ? money(sellerOffer.price) : "Not submitted"}</dd>
            </div>{session.agreedPrice !== undefined && <div>
              <dt className="text-sm">{session.status === "completed" ? "Final agreed price" : session.status === "awaiting_approval" ? "Agreed price · awaiting approval" : "Proposed agreement · not finalized"}</dt>
              <dd className="text-2xl font-bold">{money(session.agreedPrice)}</dd>
            </div>}</dl>
            <p className="muted text-sm mt-4">Warranty: {session.warranty} months<br />Delivery: {session.delivery}</p>{buyer && session.budget !== undefined && <p className="text-sm mt-4">Your private budget: <strong>{money(session.budget)}</strong>
            </p>}<p className="muted text-xs mt-4">Server-enforced role isolation excludes the other party's confidential limits.</p>
          </div>
          {buyer && !managed && session.status === "awaiting_approval" && <div className="panel">
            <h2>Review final agreement</h2>
            <p className="muted text-sm my-3">Both agents accepted these terms. Your approval is required in semi-automated mode.</p>
            <button className="btn w-full" onClick={() => { approveNegotiation(id); notify("Agreement confirmed and persisted to database."); }}>Confirm agreement</button>
            <button className="btn-danger w-full mt-3" onClick={() => { endNegotiation(id, "rejected"); notify("Agreement rejected; no Agreement was created."); }}>Reject agreement</button>
          </div>}
          {buyer && !managed && ['active', 'awaiting_approval'].includes(session.status) && <button className="btn-danger w-full" onClick={() => { endNegotiation(id, "cancelled"); notify("Session cancelled; no Agreement was created."); }}>Cancel session</button>}
          {session.status === "completed" && deal && <Link className="btn w-full" href={"/dashboard/" + user.role + "/deals/" + deal.id}>View completed Agreement →</Link>}
          {!buyer && <div className="panel text-sm muted">Monitoring only. Approval, rejection and cancellation remain with the owning buyer.</div>}
        </aside>
      </div>
    </>;
}

const PRIORITIES = [
    { value: "0.8", label: "Lowest price matters most" },
    { value: "0.5", label: "Balance price and my ranking" },
    { value: "0.2", label: "My preferred listing matters most" },
];

export function RequestSetup({ productIds }: {
    productIds: number[];
}) {
    const { enabled, state, user, createRequest, notify } = useDemo();
    const router = useRouter();
    const [order, setOrder] = useState(productIds);
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);
    if (!enabled)
        return <BackendPending />;
    if (user.role !== "buyer")
        return <Empty title="Buyer identity required" description="Choose a buyer from the identity selector to negotiate with several sellers."/>;
    const listings = order.map(id => state.products.find(p => p.id === id)).filter(p => p !== undefined);
    if (listings.length < 2)
        return <Empty title="Select at least two listings" description="Use Compare in the marketplace to pick 2 to 5 listings from different sellers." href="/products" label="Back to marketplace"/>;
    const move = (index: number, step: number) => {
        const next = [...order];
        [next[index], next[index + step]] = [next[index + step], next[index]];
        setOrder(next);
    };
    async function submit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (submitting) return;
        const f = new FormData(e.currentTarget);
        setSubmitting(true);
        const result = await createRequest({
            productIds: listings.map(p => p.id),
            budget: Number(f.get("budget")),
            mode: f.get("mode") === "automated" ? "automated" : "semi_automated",
            priceWeight: Number(f.get("priority")),
            warranty: Number(f.get("warranty")),
            delivery: String(f.get("delivery")),
        });
        setSubmitting(false);
        if ("error" in result) {
            setError(result.error);
            return;
        }
        notify("Negotiations started with " + listings.length + " sellers.");
        router.push("/dashboard/buyer/requests/" + result.id);
    }
    const highest = Math.max(...listings.map(p => Number(p.base_price)));
    return <>
    <Heading eyebrow="One buyer · many sellers" title="Negotiate with several sellers at once" description="Your agent opens a separate negotiation with each seller, uses the lowest competing offer as leverage across rounds, and scores offers using your ranking and budget."/>
    <form className="panel max-w-3xl space-y-6" onSubmit={submit}>
    <div>
    <h2>1. Rank the listings</h2>
    <p className="muted text-sm mt-1">Put the listing you prefer first. Your agent combines price savings with this preference ranking.</p>
    <ol className="mt-4 space-y-2">{listings.map((p, index) => <li key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
        <span className="text-sm"><strong>#{index + 1}</strong> {p.name} · {money(p.base_price)} · {state.users.find(u => u.id === p.seller_id)?.name ?? "Seller"}</span>
        <span className="flex gap-1">
        <button type="button" className="btn-secondary" aria-label={`Move ${p.name} up`} disabled={index === 0} onClick={() => move(index, -1)}>↑</button>
        <button type="button" className="btn-secondary" aria-label={`Move ${p.name} down`} disabled={index === listings.length - 1} onClick={() => move(index, 1)}>↓</button>
        </span>
        </li>)}</ol>
    </div>
    <div className="field-grid">
    <label>Maximum budget (SAR)<input name="budget" type="number" min="0.01" step="0.01" required defaultValue={Math.round(highest * .9)}/>
    <span className="muted text-xs">One private budget for any of these listings. Sellers never see it.</span>
    </label>
    <label>What matters most?<select name="priority" defaultValue="0.5">{PRIORITIES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
    </label>
    <label>Negotiation mode<select name="mode" defaultValue="semi_automated">
    <option value="semi_automated">Semi-automated · I approve the final agreement</option>
    <option value="automated">Automated · close the best offer within my limits</option>
    </select>
    </label>
    <label>Required warranty (months)<input name="warranty" type="number" min="0" max="60" step="1" defaultValue="0" required/>
    </label>
    <label>Delivery preference<select name="delivery">
    <option>Buyer pickup</option>
    <option>Delivery within 3 days</option>
    <option>Delivery within 7 days</option>
    </select>
    </label>
    </div>
    {error && <p role="alert" className="text-rose-700">{error}</p>}
    <div className="flex gap-3 flex-wrap">
    <button className="btn" disabled={submitting}>{submitting ? "Starting..." : `Start negotiating with ${listings.length} sellers`}</button>
    <Link className="btn-secondary" href="/products">Back to marketplace</Link>
    </div>
    </form>
    </>;
}

export function RequestDetail({ id }: {
    id: number;
}) {
    const { enabled, state, user, advanceRequest, approveRequest, endRequest, notify } = useDemo();
    const [busy, setBusy] = useState(false);
    // The buyer's pick among the agreed offers; nothing is final until they confirm.
    const [picked, setPicked] = useState<number | null>(null);
    if (!enabled)
        return <BackendPending />;
    const request = state.requests.find(r => r.id === id);
    if (!request)
        return <Empty title="Request unavailable" description="Choose the owning buyer identity or return to your requests." href={`/dashboard/${user.role}/requests`} label="Requests"/>;
    const buyer = user.role === "buyer" && request.buyerId === user.id;
    const run = async (action: () => Promise<void>, text?: string) => {
        setBusy(true);
        await action();
        setBusy(false);
        if (text) notify(text);
    };
    const rows = request.sessionIds.map(sid => state.sessions.find(s => s.id === sid)).filter(s => s !== undefined).sort((a, b) => request.productIds.indexOf(a.productId) - request.productIds.indexOf(b.productId));
    const chosen = rows.find(s => s.status === "completed");
    // Offers both agents agreed on; in semi-automated mode the buyer picks one.
    const agreed = rows.filter(s => s.status === "awaiting_approval").map(s => ({ session: s, score: s.rounds.at(-1)?.utility ?? 0 })).sort((a, b) => b.score - a.score);
    const recommended = agreed[0]?.session;
    const selected = agreed.find(a => a.session.id === picked)?.session ?? recommended;
    const selectedName = selected && state.products.find(p => p.id === selected.productId)?.name;
    const round = Math.max(0, ...rows.map(s => negotiationRoundCount(s)));
    const deal = chosen && state.deals.find(d => d.sessionId === chosen.id);
    const sellerQuotes = rows.map(s => s.rounds.filter(t => t.agent === "seller").at(-1)?.price).filter((p): p is number => p !== undefined);
    const bestQuote = sellerQuotes.length ? Math.min(...sellerQuotes) : undefined;
    const leverageTurns = rows.reduce((n, s) => n + s.rounds.filter(t => t.leverageApplied).length, 0);
    return <>
    <Heading eyebrow="One buyer · many sellers" title={`Request #${request.id}`} description={`${rows.length} sellers · ${request.mode.replaceAll("_", " ")} · round ${round}`} action={<Badge>{request.status.replaceAll("_", " ")}</Badge>}/>
    <div className="grid lg:grid-cols-[1fr_320px] gap-6">
    <section className="panel">
    <h2>Seller offers</h2>
    <p className="muted text-sm mt-2">Each row is a separate negotiation with one seller. Score compares the latest price on the table: {Math.round(request.priceWeight * 100)}% savings against your budget and {Math.round((1 - request.priceWeight) * 100)}% your ranking. An offer above your budget scores 0.</p>
    {bestQuote !== undefined && <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-900">
        <strong>Competitive leverage active:</strong> Best current seller quote on the table is <strong>{money(bestQuote)}</strong>{leverageTurns > 0 ? ` · ${leverageTurns} seller counteroffer${leverageTurns === 1 ? "" : "s"} lowered directly by competing offer pressure.` : " · Used in subsequent rounds to pressure higher-priced sellers."}
    </div>}
    <div className="table-wrap mt-4">
    <table>
    <thead>
    <tr>
    <th>Rank</th>
    <th>Listing</th>
    <th>Seller</th>
    <th>Your agent</th>
    <th>Seller agent</th>
    <th>Score</th>
    <th>Status</th>
    </tr>
    </thead>
    <tbody>{rows.map(s => {
        const p = state.products.find(p => p.id === s.productId);
        const last = s.rounds.at(-1);
        const buyerTurn = s.rounds.filter(t => t.agent === "buyer").at(-1);
        const sellerTurn = s.rounds.filter(t => t.agent === "seller").at(-1);
        const leveraged = s.rounds.some(t => t.leverageApplied);
        return <tr key={s.id} className={s.id === chosen?.id || (request.status === "awaiting_approval" && s.id === selected?.id) ? "bg-emerald-50" : ""}>
        <td>#{request.productIds.indexOf(s.productId) + 1}</td>
        <td><Link className="text-indigo-600" href={`/dashboard/${user.role}/negotiations/${s.id}`}>{p?.name ?? "Listing"}</Link><br /><span className="muted text-xs">Listed {p ? money(p.base_price) : "-"}</span></td>
        <td>{state.users.find(u => u.id === p?.seller_id)?.name ?? "Seller"}</td>
        <td>{buyerTurn ? money(buyerTurn.price) : "-"}</td>
        <td>{sellerTurn ? <><span>{money(sellerTurn.price)}{sellerTurn.action === "accept" ? " ✓" : ""}</span>{leveraged && <span className="block text-xs text-emerald-700 font-semibold">↓ Leverage applied</span>}</> : "-"}</td>
        <td>{last?.utility !== undefined ? last.utility.toFixed(2) : "-"}</td>
        <td><Badge>{s.status === "awaiting_approval" ? (s.id === recommended?.id ? "agreed · recommended" : "agreed") : s.status.replaceAll("_", " ")}</Badge></td>
        </tr>;
    })}</tbody>
    </table>
    </div>
    {request.status === "failed" && <p className="text-rose-700 mt-5">No seller reached a price within your budget. No Agreement was created.</p>}
    {request.status === "cancelled" && <p className="text-rose-700 mt-5">This request was cancelled. No Agreement was created.</p>}
    </section>
    <aside className="space-y-5">
    <div className="panel text-sm">
    <h2>How your agent decides</h2>
    <ul className="list-disc ml-5 mt-3 space-y-2 muted">
    <li>Each round, your agent sends an offer to every seller and each seller agent replies.</li>
    <li>From round 2 onwards, your agent uses the lowest competing offer as anonymous leverage so other sellers lower their counteroffers faster.</li>
    <li>Your agent accepts a seller offer only if it is no higher than its own next offer (AC_next).</li>
    <li>Bargaining continues with every seller until the last round, so each one can still lower its price.</li>
    <li>{request.mode === "automated" ? "At the end, your agent closes the agreed offer with the highest score." : "At the end, you choose any agreed offer. The highest score is marked as recommended."}</li>
    </ul>
    {buyer && request.budget !== undefined && <p className="mt-4">Your private budget: <strong>{money(request.budget)}</strong></p>}
    </div>
    {buyer && request.status === "active" && <button className="btn w-full" disabled={busy} onClick={() => run(() => advanceRequest(id))}>{busy ? "Negotiating..." : `Run round ${round + 1} with all sellers`}</button>}
    {buyer && request.status === "awaiting_approval" && agreed.length > 0 && <div className="panel">
    <h2>Choose your offer</h2>
    <p className="muted text-sm my-3">{agreed.length === 1 ? "One seller agreed." : `${agreed.length} sellers agreed.`} You are not limited to the lowest price. Select an offer, change it as often as you like, then confirm.</p>
    <div className="space-y-3" role="radiogroup" aria-label="Agreed offers">{agreed.map(({ session: s, score }) => {
        const isSelected = s.id === selected?.id;
        return <button type="button" role="radio" aria-checked={isSelected} key={s.id} disabled={busy} onClick={() => setPicked(s.id)} className={"block w-full text-left rounded-xl border-2 p-4 " + (isSelected ? "border-indigo-500 bg-indigo-50" : "border-slate-200 bg-white hover:border-indigo-200")}>
        <span className="flex justify-between gap-2"><strong>{state.products.find(p => p.id === s.productId)?.name}</strong><span aria-hidden="true">{isSelected ? "●" : "○"}</span></span>
        <span className="block text-sm mt-1">{s.agreedPrice !== undefined ? money(s.agreedPrice) : "-"} · score {score.toFixed(2)}{s.id === recommended?.id && <span className="text-emerald-700 font-semibold"> · recommended</span>}</span>
        </button>;
    })}</div>
    {selected && <button className="btn w-full mt-4" disabled={busy} onClick={() => run(() => approveRequest(id, selected.id), "Agreement confirmed and saved.")}>Confirm agreement · {selectedName} · {selected.agreedPrice !== undefined ? money(selected.agreedPrice) : ""}</button>}
    <p className="muted text-xs mt-2">After you confirm, the Agreement is final and the other negotiations close.</p>
    <button className="btn-danger w-full mt-4" disabled={busy} onClick={() => run(() => endRequest(id, "rejected"), "All offers rejected. No Agreement was created.")}>Reject all offers</button>
    </div>}
    {buyer && ["active", "awaiting_approval"].includes(request.status) && <button className="btn-danger w-full" disabled={busy} onClick={() => run(() => endRequest(id, "cancelled"), "Request cancelled with all sellers.")}>Cancel request</button>}
    {request.status === "completed" && deal && <Link className="btn w-full" href={`/dashboard/${user.role}/deals/${deal.id}`}>View completed Agreement →</Link>}
    </aside>
    </div>
    </>;
}
