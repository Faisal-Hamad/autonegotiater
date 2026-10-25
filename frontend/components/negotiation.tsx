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
    const p = state.products.find(p => p.id === productId);
    if (!enabled)
        return <BackendPending />;
    if (user.role !== "buyer")
        return <Empty title="Buyer sign-in required" description="Choose a buyer from the demo identity selector. This is not real authorization."/>;
    if (!p)
        return <Empty title="Product not found" description="This local listing does not exist."/>;
    async function submit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const budget = Number(f.get("budget"));
        const scenario = String(f.get("scenario")) as Session["scenario"];
        const mode = f.get("mode") === "automated" ? "automated" : "semi_automated";
        const id = await createNegotiation({ productId, budget, mode, scenario, warranty: Number(f.get("warranty")), delivery: String(f.get("delivery")) });
        if (id === null) {
            setError(mode === "automated" && scenario === "rejection" ? "Buyer rejection needs semi-automated mode; automated mode has already authorized closure." : "Enter a valid positive budget and choose an in-stock product.");
            return;
        }
        notify("Two-agent simulation created. No backend or Gemini request was made.");
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
    <label>Simulation scenario<select name="scenario">
    <option value="agreement">Attempt an agreement within limits</option>
    <option value="failed">Conservative agents · failed negotiation</option>
    <option value="rejection">Reach review, then reject (semi-automated)</option>
    <option value="cancellation">Start a session, then cancel</option>
    </select>
    </label>
    <p className="muted text-sm">Conditions are scripted demo preferences, not promises from a real seller. Semi-automated mode requires your approval. Automated mode closes eligible simulated agreements without another confirmation.</p>{error && <p role="alert" className="text-rose-700">{error}</p>}<div className="flex gap-3 flex-wrap">
    <button className="btn" disabled={p.stock_quantity < 1}>Start simulation</button>
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
        return <Empty title="Negotiation Session unavailable" description="Choose the owning demo identity or return to your Negotiation Sessions."/>;
    const product = state.products.find(p => p.id === session.productId);
    const buyer = user.role === "buyer";
    const buyerOffer = session.rounds.filter(t => t.agent === "buyer" && t.action === "offer").at(-1);
    const sellerOffer = session.rounds.filter(t => t.agent === "seller" && t.action === "counteroffer").at(-1);
    const agent = nextAgent(session);
    const agentName = agent === "buyer" ? "Buyer Agent" : "Seller Agent";
    const deal = state.deals.find(d => d.sessionId === id);
    const scenarioHint = session.scenario === "rejection" ? "Rejection scenario: advance to review, then reject the proposed agreement." : session.scenario === "cancellation" ? "Cancellation scenario: use Cancel simulation before completion." : session.scenario === "failed" ? "Failure scenario: conservative buyer and seller strategies deliberately leave a price gap." : "An agreement is possible only if the agents reach an acceptable price; it is not guaranteed.";
    return <>
      <Heading eyebrow="Two-agent local simulation" title={product?.name ?? "Negotiation"} description={"Negotiation Session #" + id + " · " + session.mode.replaceAll("_", " ") + " · " + negotiationRoundCount(session) + " / " + session.maxRounds + " rounds"} action={<Badge>{session.status.replaceAll("_", " ")}</Badge>}/>
      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        <section className="panel">
          <h2>Agent conversation</h2>
    <p className="muted text-sm mt-2">Deterministic simulation, not real AI. No Gemini or FastAPI request is made. Each round contains a buyer offer and seller response; acceptance may follow the final counteroffer.</p>
          <p className="text-sm text-indigo-700 mt-3">{scenarioHint}</p>
          <div ref={feed} className="space-y-4 my-6 max-h-[520px] overflow-y-auto pr-2" tabIndex={0} aria-label="Simulated agent conversation" aria-live="polite" aria-relevant="additions">
            {session.rounds.map((turn, index) => <article key={index} className={"rounded-xl border p-4 max-w-[92%] " + (turn.agent === "buyer" ? "bg-indigo-50 border-indigo-100 mr-auto" : "bg-emerald-50 border-emerald-100 ml-auto")}>
              <div className="flex justify-between gap-3 flex-wrap">
        <strong className={turn.agent === "buyer" ? "text-indigo-800" : "text-emerald-800"}>{turn.agent === "buyer" ? "Buyer Agent" : "Seller Agent"}</strong>
        <span className="text-xs muted">Round {turn.number} · {turn.action}</span>
        </div>
              <p className="text-xl font-bold mt-2">{money(turn.price)}</p>
        <p className="text-sm mt-2">{turn.message}</p>
            </article>)}
            {!session.rounds.length && <p className="muted">The Buyer Agent will open with a lower offer.</p>}
            {buyer && messages.filter(m => m.userId === user.id && m.sessionId === id).map((m, index) => <div key={"note-" + index} className="rounded-xl bg-slate-50 p-4">
        <p>{m.text}</p>
        <p className="muted text-xs">Private local note, not sent to the agents and not parsed into prices.</p>
        </div>)}
          </div>
          {buyer && session.status === "active" && <>
        <button className="btn" onClick={() => advanceNegotiation(id)}>Simulate next turn · {agentName}</button>
        <form className="flex gap-2 mt-5" onSubmit={e => { e.preventDefault(); if (chat.trim()) {
            setMessages([...messages, { userId: user.id, sessionId: id, text: chat.trim() }]);
            setChat("");
        } }}>
        <label className="flex-1">Private demo note<input value={chat} onChange={e => setChat(e.target.value)} maxLength={500} placeholder="Not shared or interpreted by AI"/>
        </label>
        <button className="btn-secondary self-end" disabled={!chat.trim()}>Save note</button>
        </form>
        </>}
          {['failed', 'cancelled', 'rejected'].includes(session.status) && <div className="mt-5">
        <p className="text-rose-700">{session.status === "failed" ? session.failureReason ?? "No mutually acceptable price was reached." : "This simulation was " + session.status + ". No Agreement was created."}</p>{buyer && <Link className="btn-secondary mt-4" href={"/products/" + session.productId + "/negotiate"}>Try a new simulation</Link>}</div>}
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
        </p>}<p className="muted text-xs mt-4">Role-specific view data excludes the other party's confidential limits.</p>
    </div>
          {buyer && session.status === "awaiting_approval" && <div className="panel">
        <h2>Review final agreement</h2>
        <p className="muted text-sm my-3">Both agents accepted these terms. Your approval is still required in semi-automated mode.</p>
        <button className="btn w-full" onClick={() => { approveNegotiation(id); notify("Agreement processed. Check the final status and Agreements."); }}>Confirm agreement</button>
        <button className="btn-danger w-full mt-3" onClick={() => { endNegotiation(id, "rejected"); notify("Agreement rejected; no Agreement was created."); }}>Reject agreement</button>
        </div>}
          {buyer && ['active', 'awaiting_approval'].includes(session.status) && <button className="btn-danger w-full" onClick={() => { endNegotiation(id, "cancelled"); notify("Simulation cancelled; no Agreement was created."); }}>Cancel simulation</button>}
          {session.status === "completed" && deal && <Link className="btn w-full" href={"/dashboard/" + user.role + "/deals/" + deal.id}>View completed Agreement →</Link>}
          {!buyer && <div className="panel text-sm muted">Monitoring only. Approval, rejection and cancellation remain with the owning buyer.</div>}
        </aside>
      </div>
    </>;
}
