import type { Product } from "./api";
export type Role = "buyer" | "seller" | "admin";
export type DemoUser = {
    id: number;
    name: string;
    email: string;
    role: Role;
    active: boolean;
};
export type Rule = {
    productId: number;
    minimum: number;
    discount: number;
    rounds: number;
    threshold: number;
    enabled: boolean;
};
export type Round = {
    number: number;
    agent: "buyer" | "seller";
    action: "offer" | "counteroffer" | "accept";
    price: number;
    message: string;
};
export type Session = {
    id: number;
    buyerId: number;
    productId: number;
    budget: number;
    mode: "semi_automated" | "automated";
    status: "active" | "awaiting_approval" | "completed" | "failed" | "cancelled" | "rejected";
    scenario: "agreement" | "failed" | "rejection" | "cancellation";
    agreedPrice?: number;
    failureReason?: string;
    // Engine-only snapshots. Never passed to a role-specific view.
    privateLimits?: {
        asking: number;
        floor: number;
        buyerTarget: number;
        rounds: number;
        threshold: number;
    };
    warranty: number;
    delivery: string;
    rounds: Round[];
    createdAt: string;
};
export type Deal = {
    id: number;
    sessionId: number;
    productId: number;
    buyerId: number;
    sellerId: number;
    price: number;
    listingPrice: number;
    warranty: number;
    delivery: string;
    createdAt: string;
    rating?: number;
    feedback?: string;
};
export type Notice = {
    id: number;
    userId: number;
    text: string;
    href: string;
    read: boolean;
};
export type Audit = {
    id: number;
    action: string;
    time: string;
    reference: number;
};
export type DemoState = {
    products: Product[];
    users: DemoUser[];
    rules: Rule[];
    sessions: Session[];
    deals: Deal[];
    notices: Notice[];
    audit: Audit[];
};
export type SessionView = Omit<Session, "budget" | "privateLimits"> & {
    budget?: number;
    maxRounds: number;
};
export type DemoViewState = Omit<DemoState, "sessions"> & {
    sessions: SessionView[];
};
export const demoUsers: DemoUser[] = [
    { id: 1, name: "Ahmed Alharbi", email: "seller1@demo.autonegotiater.com", role: "seller", active: true },
    { id: 2, name: "Sara Alqahtani", email: "seller2@demo.autonegotiater.com", role: "seller", active: true },
    { id: 3, name: "Khalid Alotaibi", email: "seller3@demo.autonegotiater.com", role: "seller", active: true },
    { id: 4, name: "Noura Alshammari", email: "buyer1@demo.autonegotiater.com", role: "buyer", active: true },
    { id: 5, name: "Faisal Aldosari", email: "buyer2@demo.autonegotiater.com", role: "buyer", active: true },
    { id: 6, name: "Demo Administrator", email: "admin@demo.autonegotiater.com", role: "admin", active: true },
];
export function initialDemoState(products: Product[]): DemoState {
    return { products: structuredClone(products), users: structuredClone(demoUsers), rules: products.map(p => ({ productId: p.id, minimum: Number((Number(p.base_price) * .8).toFixed(2)), discount: 20, rounds: 4, threshold: Number((Number(p.base_price) * .95).toFixed(2)), enabled: true })),
        sessions: [{ id: 101, buyerId: 4, productId: 1, budget: 3500, mode: "semi_automated", status: "active", scenario: "agreement", warranty: 1, delivery: "Pickup within 3 days", rounds: [], createdAt: "2026-10-13T08:00:00Z" }, { id: 102, buyerId: 4, productId: 3, budget: 1900, mode: "semi_automated", status: "completed", scenario: "agreement", agreedPrice: 1850, warranty: 0, delivery: "Buyer pickup", rounds: [{ number: 1, agent: "buyer", action: "offer", price: 1800, message: "Opening proposal for this demo listing." }, { number: 1, agent: "seller", action: "counteroffer", price: 1850, message: "I propose a revised price for the same terms." }, { number: 1, agent: "buyer", action: "accept", price: 1850, message: "I accept the seller's counteroffer." }], createdAt: "2026-10-12T08:00:00Z" }],
        deals: [{ id: 201, sessionId: 102, productId: 3, buyerId: 4, sellerId: 2, price: 1850, listingPrice: 2200, warranty: 0, delivery: "Buyer pickup", createdAt: "2026-10-12T09:00:00Z" }],
        notices: [{ id: 1, userId: 4, text: "A demo negotiation is ready to continue.", href: "/dashboard/buyer/negotiations/101", read: false }, { id: 2, userId: 2, text: "Demo sofa agreement completed.", href: "/dashboard/seller/deals/201", read: false }], audit: [{ id: 1, action: "demo_initialized", time: "2026-10-13T08:00:00Z", reference: 101 }] };
}
export function money(value: number | string) { return new Intl.NumberFormat("en-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 2 }).format(Number(value)); }
export function nextId(items: {
    id: number;
}[]) { return Math.max(0, ...items.map(i => i.id)) + 1; }
export function visibleSessions(state: Pick<DemoViewState, "products" | "sessions">, user: DemoUser) { return state.sessions.filter(s => user.role === "admin" || (user.role === "buyer" ? s.buyerId === user.id : state.products.some(p => p.id === s.productId && p.seller_id === user.id))); }
export function visibleDeals(state: Pick<DemoState, "deals">, user: DemoUser) { return state.deals.filter(d => user.role === "admin" || (user.role === "buyer" ? d.buyerId === user.id : d.sellerId === user.id)); }
export function addAudit<T extends {
    audit: Audit[];
}>(state: T, action: string, reference: number): T { return { ...state, audit: [{ id: nextId(state.audit), action, time: new Date().toISOString(), reference }, ...state.audit] }; }
export function finishDeal(state: DemoState, session: Session): DemoState {
    const stored = state.sessions.find(s => s.id === session.id);
    if (!stored)
        return state;
    session = stored;
    if (session.status !== "awaiting_approval")
        return state;
    if (state.deals.some(d => d.sessionId === session.id))
        return state;
    const p = state.products.find(p => p.id === session.productId);
    const price = session.agreedPrice;
    const rule = state.rules.find(r => r.productId === session.productId);
    const floor = p ? Math.max(rule?.minimum ?? 0, Number(p.base_price) * (1 - (rule?.discount ?? 100) / 100), (session.privateLimits?.floor ?? 0) / 100) : 0;
    if (!p || p.stock_quantity < 1 || price === undefined || session.rounds.at(-1)?.action !== "accept" || session.rounds.at(-1)?.price !== price || price > session.budget || price < floor || (rule && !rule.enabled))
        return addAudit({ ...state, sessions: state.sessions.map(s => s.id === session.id ? { ...s, status: "failed" } : s) }, "demo_agreement_unavailable", session.id);
    const deal: Deal = { id: nextId(state.deals), sessionId: session.id, productId: p.id, buyerId: session.buyerId, sellerId: p.seller_id, price, listingPrice: Number(p.base_price), warranty: session.warranty, delivery: session.delivery, createdAt: new Date().toISOString() };
    const noticeId = nextId(state.notices);
    return addAudit({ ...state, products: state.products.map(item => item.id === p.id ? { ...item, stock_quantity: item.stock_quantity - 1 } : item), sessions: state.sessions.map(s => s.id === session.id ? { ...session, status: "completed" } : s), deals: [deal, ...state.deals], notices: [{ id: noticeId, userId: session.buyerId, text: "Your simulated agreement is complete.", href: `/dashboard/buyer/deals/${deal.id}`, read: false }, { id: noticeId + 1, userId: p.seller_id, text: "A simulated sale is ready for fulfillment.", href: `/dashboard/seller/deals/${deal.id}`, read: false }, ...state.notices] }, "demo_deal_completed", session.id);
}
// Integer halalas keep all offers inside the limits, including decimal boundaries.
function cents(value: number) { return Math.floor(value * 100 + 1e-7); }
function sellerFloor(value: number) { return Math.ceil(value * 100 - 1e-7); }
export function negotiationRoundCount(session: Pick<Session, "rounds">) {
    return Math.max(0, ...session.rounds.map(turn => turn.number));
}
export function nextAgent(session: Pick<Session, "rounds">): "buyer" | "seller" {
    return session.rounds.at(-1)?.agent === "buyer" ? "seller" : "buyer";
}
export function advanceSession(state: DemoState, id: number): DemoState {
    const session = state.sessions.find(s => s.id === id);
    if (!session || session.status !== "active")
        return state;
    const product = state.products.find(p => p.id === session.productId);
    const rule = state.rules.find(r => r.productId === session.productId);
    const fail = (reason: string): DemoState => addAudit<DemoState>({ ...state, sessions: state.sessions.map(s => s.id === id ? { ...s, status: "failed", failureReason: reason } : s) }, "demo_negotiation_failed", id);
    if (!product || product.stock_quantity < 1)
        return fail("The product is unavailable. No agreement was created.");
    if (rule && !rule.enabled)
        return fail("The simulated seller agent is disabled.");
    const asking = cents(Number(product.base_price));
    const floor = sellerFloor(Math.max(rule?.minimum ?? Number(product.base_price) * .8, Number(product.base_price) * (1 - (rule?.discount ?? 20) / 100)));
    const budget = cents(session.budget);
    if (!Number.isSafeInteger(asking) || !Number.isSafeInteger(budget) || !Number.isSafeInteger(floor) || asking < 1 || budget < 1 || floor < 1 || floor > asking || !Number.isInteger(rule?.rounds ?? 4) || (rule?.rounds ?? 4) < 1 || (rule?.rounds ?? 4) > 20)
        return fail("The simulation configuration is invalid.");
    const limits = session.privateLimits ?? {
        asking, floor,
        buyerTarget: session.scenario === "failed" ? Math.min(budget, Math.max(1, Math.floor(asking * .65))) : budget,
        rounds: Math.max(1, Math.min(20, Math.floor(rule?.rounds ?? 4))),
        threshold: Math.max(floor, cents(rule?.threshold ?? Number(product.base_price)))
    };
    if (floor > limits.floor || asking !== limits.asking)
        return fail("The listing terms changed. Start a new simulation to use the updated terms.");
    const agent = nextAgent(session);
    const last = session.rounds.at(-1);
    const previousRound = negotiationRoundCount(session);
    let turn: Round;
    let agreed = false;
    if (agent === "buyer" && last?.agent === "seller" && last.action === "counteroffer" && cents(last.price) <= limits.buyerTarget) {
        // Evaluate the public counteroffer using only the buyer's own willingness.
        turn = { number: last.number, agent, action: "accept", price: last.price, message: "I accept this counteroffer and the proposed conditions." };
        agreed = true;
    }
    else if (agent === "buyer") {
        const number = previousRound + 1;
        if (number > limits.rounds)
            return fail("The maximum negotiation rounds were exhausted without agreement.");
        const opening = Math.min(limits.buyerTarget, Math.max(1, Math.floor(limits.asking * .55)));
        const progress = limits.rounds === 1 ? 0 : (number - 1) / (limits.rounds - 1);
        const price = Math.floor(opening + (limits.buyerTarget - opening) * progress);
        turn = { number, agent, action: "offer", price: price / 100, message: number === 1 ? "I am opening with a lower proposal for these terms." : "I can increase my previous proposal to move the discussion forward." };
    }
    else {
        const number = last!.number;
        const progress = limits.rounds === 1 ? 0 : (number - 1) / (limits.rounds - 1);
        const target = session.scenario === "failed" ? Math.max(limits.floor, Math.ceil(limits.asking * .95)) : limits.floor;
        const price = Math.ceil(limits.asking + (target - limits.asking) * progress);
        const offer = cents(last!.price);
        agreed = offer >= price || (session.scenario !== "failed" && offer >= limits.threshold);
        turn = agreed
            ? { number, agent, action: "accept", price: last!.price, message: "I accept the buyer's proposal and the proposed conditions." }
            : { number, agent, action: "counteroffer", price: price / 100, message: number === 1 ? "My opening counteroffer reflects the public listing price." : "I can reduce my previous counteroffer for these terms." };
    }
    // Recheck both private boundaries before recording an acceptance.
    if (agreed && (cents(turn.price) > budget || cents(turn.price) < Math.max(limits.floor, floor)))
        return fail("The terms changed and this proposal is no longer available.");
    const exhausted = !agreed && agent === "seller" && turn.number >= limits.rounds && cents(turn.price) > limits.buyerTarget;
    const updated: Session = { ...session, privateLimits: limits, rounds: [...session.rounds, turn], status: agreed ? "awaiting_approval" : exhausted ? "failed" : "active",
        ...(agreed ? { agreedPrice: turn.price } : {}), ...(exhausted ? { failureReason: "The agents did not reach a mutually acceptable price within the allowed rounds." } : {}) };
    let result = addAudit({ ...state, sessions: state.sessions.map(s => s.id === id ? updated : s) }, agreed ? "demo_agent_accepted" : "demo_agent_turn", id);
    if (agreed && updated.mode === "automated")
        result = finishDeal(result, updated);
    return result;
}
export function endSession(state: DemoState, id: number, status: "rejected" | "cancelled", buyerId: number): DemoState {
    const session = state.sessions.find(s => s.id === id && s.buyerId === buyerId);
    if (!session || (status === "rejected" ? session.status !== "awaiting_approval" : !["active", "awaiting_approval"].includes(session.status)))
        return state;
    return addAudit({ ...state, sessions: state.sessions.map(s => s.id === id ? { ...s, status } : s) }, "demo_" + status, id);
}
// Views receive projections, never the engine's shared private state.
export function projectDemoState(state: DemoState, user: DemoUser): DemoViewState {
    const sessions = state.sessions.filter(s => user.role === "admin" || (user.role === "buyer" ? s.buyerId === user.id : state.products.some(p => p.id === s.productId && p.seller_id === user.id))).map(s => {
        const { budget, privateLimits, ...publicSession } = s;
        return { ...structuredClone(publicSession), maxRounds: privateLimits?.rounds ?? state.rules.find(r => r.productId === s.productId)?.rounds ?? 4, ...(user.role === "buyer" ? { budget } : {}) };
    });
    return { products: structuredClone(state.products), users: structuredClone(state.users), audit: structuredClone(state.audit), sessions,
        rules: user.role === "seller" ? structuredClone(state.rules.filter(r => state.products.some(p => p.id === r.productId && p.seller_id === user.id))) : [],
        deals: structuredClone(visibleDeals(state, user)), notices: structuredClone(state.notices.filter(n => n.userId === user.id)) };
}
export function mergeDemoView(state: DemoState, view: DemoViewState, user: DemoUser): DemoState {
    const mergeById = <T extends {
        id: number;
    }>(old: T[], updates: T[]) => [...updates, ...old.filter(item => !updates.some(u => u.id === item.id))];
    // Session transitions and private limits are changed only through engine actions.
    return { ...state, products: view.products, users: view.users, audit: view.audit,
        deals: mergeById(state.deals, view.deals), notices: mergeById(state.notices, view.notices),
        rules: user.role === "seller" ? [...view.rules.filter(r => state.products.some(p => p.id === r.productId && p.seller_id === user.id)), ...state.rules.filter(r => !state.products.some(p => p.id === r.productId && p.seller_id === user.id))] : state.rules };
}

// Restore only complete compatible demo envelopes. Unknown secret fields are rejected.
export function validateDemoState(value: unknown): value is DemoState {
    try {
        const s=value as DemoState;
        if(!s||![s.products,s.users,s.rules,s.sessions,s.deals,s.notices,s.audit].every(Array.isArray))return false;
        if(s.users.length<1||[s.users,s.products,s.sessions,s.deals,s.notices,s.audit].some(rows=>new Set(rows.map(r=>r.id)).size!==rows.length))return false;
        const id=(v:number)=>Number.isSafeInteger(v)&&v>0;
        const number=(v:number)=>Number.isFinite(v)&&v>=0;
        return s.users.every(u=>id(u.id)&&typeof u.name==="string"&&typeof u.email==="string"&&["buyer","seller","admin"].includes(u.role)&&typeof u.active==="boolean")
            &&s.products.every(p=>id(p.id)&&id(p.seller_id)&&typeof p.name==="string"&&typeof p.category==="string"&&Number.isFinite(Number(p.base_price))&&Number(p.base_price)>0&&Number.isInteger(p.stock_quantity)&&p.stock_quantity>=0)
            &&s.rules.every(r=>id(r.productId)&&number(r.minimum)&&number(r.threshold)&&number(r.discount)&&Number.isInteger(r.rounds)&&r.rounds>=1&&r.rounds<=20&&typeof r.enabled==="boolean")
            &&s.sessions.every(x=>id(x.id)&&s.users.some(u=>u.id===x.buyerId)&&s.products.some(p=>p.id===x.productId)&&number(x.budget)&&["active","awaiting_approval","completed","failed","rejected","cancelled"].includes(x.status)&&["automated","semi_automated"].includes(x.mode)&&Array.isArray(x.rounds)&&x.rounds.every(m=>number(m.price)&&Number.isInteger(m.number)&&typeof m.message==="string"&&["buyer","seller"].includes(m.agent)&&["offer","counteroffer","accept"].includes(m.action)))
            &&s.deals.every(d=>id(d.id)&&number(d.price)&&s.sessions.some(x=>x.id===d.sessionId))
            &&s.notices.every(n=>id(n.id)&&id(n.userId)&&typeof n.text==="string"&&typeof n.read==="boolean"&&typeof n.href==="string"&&n.href.startsWith("/")&&!n.href.startsWith("//"))
            &&s.audit.every(a=>id(a.id)&&typeof a.action==="string"&&typeof a.time==="string");
    }catch{return false;}
}
