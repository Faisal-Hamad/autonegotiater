"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useDemo } from "./demo-provider";
import { CompetitiveSetup } from "./competitive-negotiation";
import { BackendPending, Badge, Empty, Heading } from "./ui";
import { money, negotiationRoundCount, nextAgent, visibleSessions, type Session } from "@/lib/demo-model";
import { useLanguage } from "@/lib/i18n";

export function NegotiationSetup({ productId }: {
    productId: number;
}) {
    const { enabled, state } = useDemo();
    if (!enabled) return <BackendPending />;
    const p = state.products.find(p => p.id === productId);
    if (!p) return <Empty title="Product not found" description="This listing does not exist in the catalog." href="/products" label="Browse Products" />;
    return <CompetitiveSetup key={`1to1-${p.id}`} product={p} singleListing />;
}

export function SessionDetail({ id }: {
    id: number;
}) {
    const { enabled, state, user, advanceNegotiation, approveNegotiation, endNegotiation, notify } = useDemo();
    const { lang, dir } = useLanguage();
    const [chat, setChat] = useState("");
    const [messages, setMessages] = useState<{
        userId: number;
        sessionId: number;
        text: string;
    }[]>([]);
    const feed = useRef<HTMLDivElement>(null);
    const turnCount = state.sessions.find(s => s.id === id)?.rounds.length ?? 0;
    useEffect(() => {
        if (feed.current) feed.current.scrollTop = feed.current.scrollHeight;
    }, [id, user.id, turnCount, messages.length]);

    if (!enabled) return <BackendPending />;
    const session = visibleSessions(state, user).find(s => s.id === id);
    if (!session) return <Empty title="Negotiation Session unavailable" description="Choose the owning demo identity or return to your Negotiation Sessions." />;
    const product = state.products.find(p => p.id === session.productId);
    const buyer = user.role === "buyer";
    const buyerOffer = session.rounds.filter(t => t.agent === "buyer" && t.action === "offer").at(-1);
    const sellerOffer = session.rounds.filter(t => t.agent === "seller" && t.action === "counteroffer").at(-1);
    const agent = nextAgent(session);
    const agentName = agent === "buyer" ? "Buyer Agent" : "Seller Agent";
    const deal = state.deals.find(d => d.sessionId === id);
    const scenarioHint =
        session.scenario === "rejection"
            ? "Rejection scenario: advance to review, then reject the proposed agreement."
            : session.scenario === "cancellation"
            ? "Cancellation scenario: use Cancel simulation before completion."
            : session.scenario === "failed"
            ? "Failure scenario: conservative buyer and seller strategies deliberately leave a price gap."
            : "An agreement is possible only if the agents reach an acceptable price; it is not guaranteed.";

    return (
        <div dir={dir} lang={lang} className="space-y-6">
            <Heading
                eyebrow={lang === "ar" ? "تفاوض مباشر (١ إلى ١)" : "One-to-One Direct Negotiation"}
                title={product?.name ?? "Negotiation"}
                description={`Negotiation Session #${id} · ${session.mode.replaceAll("_", " ")} · ${negotiationRoundCount(session)} / ${session.maxRounds} rounds`}
                action={<Badge>{session.status.replaceAll("_", " ")}</Badge>}
            />
            <div className="grid lg:grid-cols-[1fr_320px] gap-6">
                <section className="panel">
                    <h2>{lang === "ar" ? "محادثة التفاوض" : "Agent conversation"}</h2>
                    <p className="muted text-sm mt-2">
                        {lang === "ar"
                            ? "كل جولة تتضمن عرضاً من المشتري ورداً من البائع ضمن الحدود السرية المعتمدة لكل طرف."
                            : "Each round contains a buyer offer and seller response within each party's confidential limits."}
                    </p>
                    <p className="text-sm text-indigo-700 mt-3">{scenarioHint}</p>
                    <div ref={feed} className="space-y-4 my-6 max-h-[520px] overflow-y-auto pr-2" tabIndex={0} aria-label="Simulated agent conversation" aria-live="polite" aria-relevant="additions">
                        {session.rounds.map((turn, index) => (
                            <article
                                key={index}
                                className={"rounded-xl border p-4 max-w-[92%] " + (turn.agent === "buyer" ? "bg-indigo-50 border-indigo-100 mr-auto" : "bg-emerald-50 border-emerald-100 ml-auto")}
                            >
                                <div className="flex justify-between gap-3 flex-wrap">
                                    <strong className={turn.agent === "buyer" ? "text-indigo-800" : "text-emerald-800"}>
                                        {turn.agent === "buyer" ? (lang === "ar" ? "وكيل المشتري" : "Buyer Agent") : lang === "ar" ? "وكيل البائع" : "Seller Agent"}
                                    </strong>
                                    <span className="text-xs muted">
                                        Round {turn.number} · {turn.action}
                                    </span>
                                </div>
                                <p className="text-xl font-bold mt-2">{money(turn.price)}</p>
                                <p className="text-sm mt-2">{turn.message}</p>
                            </article>
                        ))}
                        {!session.rounds.length && <p className="muted">{lang === "ar" ? "سيبدأ وكيل المشتري بتقديم العرض الافتتاحي." : "The Buyer Agent will open with a lower offer."}</p>}
                        {buyer &&
                            messages
                                .filter(m => m.userId === user.id && m.sessionId === id)
                                .map((m, index) => (
                                    <div key={"note-" + index} className="rounded-xl bg-slate-50 p-4">
                                        <p>{m.text}</p>
                                        <p className="muted text-xs">Private local note, not sent to the agents and not parsed into prices.</p>
                                    </div>
                                ))}
                    </div>
                    {buyer && session.status === "active" && (
                        <>
                            <button className="btn" onClick={() => advanceNegotiation(id)}>
                                {lang === "ar" ? `تشغيل الدور التالي · ${agentName}` : `Simulate next turn · ${agentName}`}
                            </button>
                            <form
                                className="flex gap-2 mt-5"
                                onSubmit={e => {
                                    e.preventDefault();
                                    if (chat.trim()) {
                                        setMessages([...messages, { userId: user.id, sessionId: id, text: chat.trim() }]);
                                        setChat("");
                                    }
                                }}
                            >
                                <label className="flex-1">
                                    {lang === "ar" ? "ملاحظة خاصة" : "Private demo note"}
                                    <input value={chat} onChange={e => setChat(e.target.value)} maxLength={500} placeholder="Not shared or interpreted by AI" />
                                </label>
                                <button className="btn-secondary self-end" disabled={!chat.trim()}>
                                    Save note
                                </button>
                            </form>
                        </>
                    )}
                    {["failed", "cancelled", "rejected"].includes(session.status) && (
                        <div className="mt-5">
                            <p className="text-rose-700">
                                {session.status === "failed"
                                    ? session.failureReason ?? "No mutually acceptable price was reached."
                                    : "This simulation was " + session.status + ". No Agreement was created."}
                            </p>
                            {buyer && (
                                <Link className="btn-secondary mt-4" href={"/products/" + session.productId + "/negotiate"}>
                                    {lang === "ar" ? "بدء جلسة تفاوض ١ إلى ١ جديدة" : "Start a new 1-to-1 negotiation"}
                                </Link>
                            )}
                        </div>
                    )}
                </section>
                <aside className="space-y-5">
                    <div className="panel">
                        <h2>{lang === "ar" ? "العروض الحالية" : "Current proposals"}</h2>
                        <dl className="space-y-4 mt-4">
                            <div>
                                <dt className="text-sm text-indigo-700">{lang === "ar" ? "عرض المشتري" : "Buyer offer"}</dt>
                                <dd className="text-xl font-bold">{buyerOffer ? money(buyerOffer.price) : "Not submitted"}</dd>
                            </div>
                            <div>
                                <dt className="text-sm text-emerald-700">{lang === "ar" ? "عرض البائع المقابل" : "Seller counteroffer"}</dt>
                                <dd className="text-xl font-bold">{sellerOffer ? money(sellerOffer.price) : "Not submitted"}</dd>
                            </div>
                            {session.agreedPrice !== undefined && (
                                <div>
                                    <dt className="text-sm">
                                        {session.status === "completed" ? "Final agreed price" : session.status === "awaiting_approval" ? "Agreed price · awaiting approval" : "Proposed agreement · not finalized"}
                                    </dt>
                                    <dd className="text-2xl font-bold">{money(session.agreedPrice)}</dd>
                                </div>
                            )}
                        </dl>
                        <p className="muted text-sm mt-4">
                            Warranty: {session.warranty} months
                            <br />
                            Delivery: {session.delivery}
                        </p>
                        {buyer && session.budget !== undefined && (
                            <p className="text-sm mt-4">
                                Your private budget: <strong>{money(session.budget)}</strong>
                            </p>
                        )}
                        <p className="muted text-xs mt-4">Role-specific view data excludes the other party's confidential limits.</p>
                    </div>
                    {buyer && session.status === "awaiting_approval" && (
                        <div className="panel">
                            <h2>Review final agreement</h2>
                            <p className="muted text-sm my-3">Both agents accepted these terms. Your approval is still required in semi-automated mode.</p>
                            <button
                                className="btn w-full"
                                onClick={() => {
                                    approveNegotiation(id);
                                    notify("Agreement processed. Check the final status and Agreements.");
                                }}
                            >
                                Confirm agreement
                            </button>
                            <button
                                className="btn-danger w-full mt-3"
                                onClick={() => {
                                    endNegotiation(id, "rejected");
                                    notify("Agreement rejected; no Agreement was created.");
                                }}
                            >
                                Reject agreement
                            </button>
                        </div>
                    )}
                    {buyer && ["active", "awaiting_approval"].includes(session.status) && (
                        <button
                            className="btn-danger w-full"
                            onClick={() => {
                                endNegotiation(id, "cancelled");
                                notify("Simulation cancelled; no Agreement was created.");
                            }}
                        >
                            Cancel simulation
                        </button>
                    )}
                    {session.status === "completed" && deal && (
                        <Link className="btn w-full" href={"/dashboard/" + user.role + "/deals/" + deal.id}>
                            View completed Agreement →
                        </Link>
                    )}
                    {!buyer && <div className="panel text-sm muted">Monitoring only. Approval, rejection and cancellation remain with the owning buyer.</div>}
                </aside>
            </div>
        </div>
    );
}
