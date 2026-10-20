"use client";
import { createContext, useContext, useEffect, useState, type ReactNode, type Dispatch, type SetStateAction } from "react";
import type { Product } from "@/lib/api";
import { initialDemoState, projectDemoState, mergeDemoView, advanceSession, finishDeal, endSession, addAudit, nextId, type DemoState, type DemoViewState, type DemoUser, type Session } from "@/lib/demo-model";

export type NegotiationInput = Pick<Session, "productId" | "budget" | "mode" | "scenario" | "warranty" | "delivery">;

export type RequestInput = {
    productIds: number[]; // most preferred first
    budget: number;
    mode: "semi_automated" | "automated";
    priceWeight: number;
    warranty: number;
    delivery: string;
};

type ProductInput = {
    id?: number;
    name: string;
    category: string;
    base_price: number;
    stock_quantity: number;
    description: string | null;
    image_url: string | null;
};

type RulesInput = {
    productId: number;
    minimum: number;
    threshold: number;
    discount: number;
    rounds: number;
    enabled: boolean;
};

type Context = {
    enabled: boolean;
    state: DemoViewState;
    setState: Dispatch<SetStateAction<DemoViewState>>;
    userId: number;
    setUserId: Dispatch<SetStateAction<number>>;
    user: DemoUser;
    message: string;
    notify: (text: string) => void;
    createNegotiation: (input: NegotiationInput) => Promise<number | null>;
    advanceNegotiation: (id: number) => Promise<void>;
    approveNegotiation: (id: number) => Promise<void>;
    endNegotiation: (id: number, status: "rejected" | "cancelled") => Promise<void>;
    createRequest: (input: RequestInput) => Promise<{ id: number } | { error: string }>;
    advanceRequest: (id: number) => Promise<void>;
    approveRequest: (id: number, sessionId?: number) => Promise<void>;
    endRequest: (id: number, status: "rejected" | "cancelled") => Promise<void>;
    saveProduct: (input: ProductInput) => Promise<boolean>;
    saveRules: (input: RulesInput) => Promise<boolean>;
    saveRating: (dealId: number, rating: number, feedback: string) => Promise<void>;
    registerAccount: (name: string, email: string, role: "buyer" | "seller") => Promise<boolean>;
    updateProfile: (name: string, email: string) => Promise<boolean>;
    toggleUserStatus: (targetUserId: number, active: boolean) => Promise<void>;
};

const DemoContext = createContext<Context | null>(null);

export function DemoProvider({ enabled, products, initialData, children }: {
    enabled: boolean;
    products: Product[];
    initialData?: DemoState;
    children: ReactNode;
}) {
    const [engineState, setEngineState] = useState<DemoState>(() => initialData && Array.isArray(initialData.users) && initialData.users.length > 0 ? initialData : initialDemoState(products));
    const [userId, setUserId] = useState(4);
    const [message, notify] = useState("");

    useEffect(() => {
        let active = true;
        fetch("/api/workspace/bootstrap", { cache: "no-store" })
            .then(res => res.ok ? res.json() : null)
            .then(data => {
                if (active && data && Array.isArray(data.users) && data.users.length > 0) {
                    setEngineState(data);
                }
            })
            .catch(() => {
                // Keep initial state when running offline
            });
        return () => { active = false; };
    }, []);

    const user = engineState.users.find(u => u.id === userId) ?? engineState.users.find(u => u.role === "buyer") ?? engineState.users[0];
    const state = projectDemoState(engineState, user);

    const setState: Dispatch<SetStateAction<DemoViewState>> = update => {
        if (enabled) {
            setEngineState(raw => {
                const view = projectDemoState(raw, user);
                return mergeDemoView(raw, typeof update === "function" ? update(view) : update, user);
            });
        }
    };

    async function createNegotiation(input: NegotiationInput): Promise<number | null> {
        const p = engineState.products.find(p => p.id === input.productId);
        if (!enabled || user.role !== "buyer" || !p || p.stock_quantity < 1 || !Number.isFinite(input.budget) || input.budget < .01 || !Number.isSafeInteger(Math.floor(input.budget * 100)) || (input.mode === "automated" && input.scenario === "rejection")) {
            return null;
        }
        const cleanBudget = Math.floor(input.budget * 100 + 1e-7) / 100;
        try {
            const res = await fetch("/api/workspace/sessions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    buyer_id: user.id,
                    product_id: input.productId,
                    budget: cleanBudget,
                    mode: input.mode,
                    scenario: input.scenario,
                    warranty: input.warranty,
                    delivery: input.delivery,
                }),
            });
            if (res.ok) {
                const data = await res.json();
                if (data.state) setEngineState(data.state);
                return Number(data.session_id);
            }
        } catch {
            // Fallback to local state if API is unreachable
        }
        const id = nextId(engineState.sessions);
        const session: Session = { ...input, budget: cleanBudget, id, buyerId: user.id, status: "active", rounds: [], createdAt: new Date().toISOString() };
        setEngineState(s => addAudit({ ...s, sessions: [session, ...s.sessions], notices: [{ id: nextId(s.notices), userId: p.seller_id, text: "New negotiation request started.", href: "/dashboard/seller/negotiations/" + id, read: false }, ...s.notices] }, "session_started", id));
        return id;
    }

    async function advanceNegotiation(id: number): Promise<void> {
        if (!enabled || user.role !== "buyer") return;
        setEngineState(s => s.sessions.some(x => x.id === id && x.buyerId === user.id) ? advanceSession(s, id) : s);
        try {
            const res = await fetch(`/api/workspace/sessions/${id}/advance`, { method: "POST" });
            if (res.ok) {
                const nextState = await res.json();
                if (nextState && Array.isArray(nextState.sessions)) setEngineState(nextState);
            }
        } catch {
            // Keep optimistic state
        }
    }

    async function approveNegotiation(id: number): Promise<void> {
        if (!enabled || user.role !== "buyer") return;
        setEngineState(s => {
            const session = s.sessions.find(x => x.id === id && x.buyerId === user.id);
            return session ? finishDeal(s, session) : s;
        });
        try {
            const res = await fetch(`/api/workspace/sessions/${id}/approve`, { method: "POST" });
            if (res.ok) {
                const nextState = await res.json();
                if (nextState && Array.isArray(nextState.deals)) setEngineState(nextState);
            }
        } catch {
            // Keep optimistic state
        }
    }

    async function endNegotiation(id: number, status: "rejected" | "cancelled"): Promise<void> {
        if (!enabled || user.role !== "buyer") return;
        setEngineState(s => endSession(s, id, status, user.id));
        try {
            const res = await fetch(`/api/workspace/sessions/${id}/end`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ buyer_id: user.id, status }),
            });
            if (res.ok) {
                const nextState = await res.json();
                if (nextState && Array.isArray(nextState.sessions)) setEngineState(nextState);
            }
        } catch {
            // Keep optimistic state
        }
    }

    // Multi-seller requests are coordinated by the backend, so there is no local fallback.
    async function requestAction(path: string, body?: object): Promise<void> {
        if (!enabled || user.role !== "buyer") return;
        try {
            const res = await fetch(`/api/workspace/requests/${path}`, {
                method: "POST",
                ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
            });
            if (!res.ok) {
                notify("The request could not be updated. Try again.");
                return;
            }
            const nextState = await res.json();
            if (nextState && Array.isArray(nextState.sessions)) setEngineState(nextState);
        } catch {
            notify("The server is unreachable. The request was not updated.");
        }
    }

    async function createRequest(input: RequestInput): Promise<{ id: number } | { error: string }> {
        if (!enabled || user.role !== "buyer") return { error: "Choose a buyer identity first." };
        try {
            const res = await fetch("/api/workspace/requests", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    buyer_id: user.id,
                    product_ids: input.productIds,
                    budget: Math.floor(input.budget * 100 + 1e-7) / 100,
                    mode: input.mode,
                    price_weight: input.priceWeight,
                    warranty: input.warranty,
                    delivery: input.delivery,
                }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) return { error: data?.detail ?? "The request could not be created." };
            if (data?.state) setEngineState(data.state);
            return { id: Number(data.request_id) };
        } catch {
            return { error: "The server is unreachable. Multi-seller negotiation needs the backend." };
        }
    }

    const advanceRequest = (id: number) => requestAction(`${id}/advance`);
    const approveRequest = (id: number, sessionId?: number) => requestAction(`${id}/approve`, sessionId === undefined ? undefined : { session_id: sessionId });
    const endRequest = (id: number, status: "rejected" | "cancelled") => requestAction(`${id}/end`, { buyer_id: user.id, status });

    async function saveProduct(input: ProductInput): Promise<boolean> {
        const endpoint = input.id ? `/api/workspace/products/${input.id}` : "/api/workspace/products";
        const method = input.id ? "PUT" : "POST";
        try {
            const res = await fetch(endpoint, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    seller_id: user.id,
                    name: input.name,
                    category: input.category,
                    base_price: input.base_price,
                    stock_quantity: input.stock_quantity,
                    description: input.description,
                    image_url: input.image_url,
                }),
            });
            if (res.ok) {
                const data = await res.json();
                const nextState = data.state ?? data;
                if (nextState && Array.isArray(nextState.products)) {
                    setEngineState(nextState);
                    return true;
                }
            }
        } catch {
            // Fallback to local update
        }
        const existing = input.id ? engineState.products.find(p => p.id === input.id) : undefined;
        const product: Product = {
            id: existing?.id ?? nextId(engineState.products),
            seller_id: user.id,
            name: input.name,
            category: input.category,
            description: input.description,
            base_price: input.base_price.toFixed(2),
            stock_quantity: input.stock_quantity,
            image_url: input.image_url,
            created_at: existing?.created_at ?? new Date().toISOString(),
        };
        setState(s => addAudit({
            ...s,
            products: existing ? s.products.map(item => item.id === existing.id ? product : item) : [product, ...s.products],
        }, existing ? "product_updated" : "product_created", product.id));
        return true;
    }

    async function saveRules(input: RulesInput): Promise<boolean> {
        try {
            const res = await fetch(`/api/workspace/products/${input.productId}/rules`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    seller_id: user.id,
                    minimum: input.minimum,
                    threshold: input.threshold,
                    discount: input.discount,
                    rounds: input.rounds,
                    enabled: input.enabled,
                }),
            });
            if (res.ok) {
                const nextState = await res.json();
                if (nextState && Array.isArray(nextState.rules)) {
                    setEngineState(nextState);
                    return true;
                }
            }
        } catch {
            // Fallback to local update
        }
        setState(s => addAudit({
            ...s,
            rules: [...s.rules.filter(x => x.productId !== input.productId), input],
        }, "rules_updated", input.productId));
        return true;
    }

    async function saveRating(dealId: number, rating: number, feedback: string): Promise<void> {
        setState(s => addAudit({
            ...s,
            deals: s.deals.map(item => item.id === dealId ? { ...item, rating, feedback } : item),
        }, "rating_saved", dealId));
        try {
            const res = await fetch(`/api/workspace/deals/${dealId}/rating`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ buyer_id: user.id, rating, feedback }),
            });
            if (res.ok) {
                const nextState = await res.json();
                if (nextState && Array.isArray(nextState.deals)) setEngineState(nextState);
            }
        } catch {
            // Keep optimistic state
        }
    }

    async function registerAccount(name: string, email: string, role: "buyer" | "seller"): Promise<boolean> {
        try {
            const res = await fetch("/api/workspace/users/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, role }),
            });
            if (res.ok) {
                const data = await res.json();
                if (data.state && Array.isArray(data.state.users)) {
                    setEngineState(data.state);
                    setUserId(Number(data.user_id));
                    return true;
                }
            }
        } catch {
            // Fallback to local update
        }
        const id = nextId(engineState.users);
        setEngineState(s => ({ ...s, users: [...s.users, { id, name, email, role, active: true }] }));
        setUserId(id);
        return true;
    }

    async function updateProfile(name: string, email: string): Promise<boolean> {
        try {
            const res = await fetch(`/api/workspace/users/${user.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email }),
            });
            if (res.ok) {
                const nextState = await res.json();
                if (nextState && Array.isArray(nextState.users)) {
                    setEngineState(nextState);
                    return true;
                }
            }
        } catch {
            // Fallback to local update
        }
        setState(s => ({ ...s, users: s.users.map(u => u.id === user.id ? { ...u, name, email } : u) }));
        return true;
    }

    async function toggleUserStatus(targetUserId: number, active: boolean): Promise<void> {
        setState(s => addAudit({
            ...s,
            users: s.users.map(x => x.id === targetUserId ? { ...x, active } : x),
        }, "account_status_changed", targetUserId));
        try {
            const res = await fetch(`/api/workspace/users/${targetUserId}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ active }),
            });
            if (res.ok) {
                const nextState = await res.json();
                if (nextState && Array.isArray(nextState.users)) setEngineState(nextState);
            }
        } catch {
            // Keep optimistic state
        }
    }

    return <DemoContext.Provider value={{
        enabled,
        state,
        setState,
        userId,
        setUserId,
        user,
        message,
        notify,
        createNegotiation,
        advanceNegotiation,
        approveNegotiation,
        endNegotiation,
        createRequest,
        advanceRequest,
        approveRequest,
        endRequest,
        saveProduct,
        saveRules,
        saveRating,
        registerAccount,
        updateProfile,
        toggleUserStatus,
    }}>
        {children}
        {message && <div role="status" className="toast">
            <span>{message}</span>
            <button aria-label="Dismiss notification" onClick={() => notify("")}>×</button>
        </div>}
    </DemoContext.Provider>;
}

export function useDemo() {
    const value = useContext(DemoContext);
    if (!value) throw new Error("DemoProvider missing");
    return value;
}
