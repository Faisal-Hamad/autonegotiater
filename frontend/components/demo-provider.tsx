"use client";
import { RealWorkspaceProvider } from "./real-workspace-provider";
import { createContext, useContext, useState, type ReactNode, type Dispatch, type SetStateAction } from "react";
import { useLocalDemoState } from "./local-demo-state";
import { safeTree } from "@/lib/demo-storage";
import type { Product } from "@/lib/api";
import { initialDemoState, validateDemoState, projectDemoState, mergeDemoView, advanceSession, finishDeal, endSession, addAudit, nextId, type DemoViewState, type DemoUser, type Session } from "@/lib/demo-model";
export type NegotiationInput = Pick<Session, "productId" | "budget" | "mode" | "scenario" | "warranty" | "delivery">;
type Context = {
    enabled: boolean;
    state: DemoViewState;
    setState: Dispatch<SetStateAction<DemoViewState>>;
    userId: number;
    setUserId: Dispatch<SetStateAction<number>>;
    user: DemoUser;
    message: string;
    notify: (text: string) => void;
    createNegotiation: (input: NegotiationInput) => number | null | Promise<number | null>;
    advanceNegotiation: (id: number) => void;
    approveNegotiation: (id: number) => void;
    endNegotiation: (id: number, status: "rejected" | "cancelled") => void;
};
const validState=(v:unknown):v is ReturnType<typeof initialDemoState> => safeTree(v)&&validateDemoState(v);
const validIdentity=(v:unknown):v is number => Number.isSafeInteger(v)&&Number(v)>=0;
export const DemoContext = createContext<Context | null>(null);
export function DemoProvider({ enabled, products, children }: {
    enabled: boolean;
    products: Product[];
    children: ReactNode;
}) {
    if (process.env.NEXT_PUBLIC_AUTONEG_REAL_MODE === "true") return <RealWorkspaceProvider>{children}</RealWorkspaceProvider>;
    return <LocalDemoProvider enabled={enabled} products={products}>{children}</LocalDemoProvider>;
}
function LocalDemoProvider({enabled,products,children}:{enabled:boolean;products:Product[];children:ReactNode}) {
    const [engineState, setEngineState,ready,stateWarning] = useLocalDemoState("autonegotiater-legacy",()=>initialDemoState(products),validState,enabled);
    const [userId, setSelectedId,identityReady,identityWarning] = useLocalDemoState("autonegotiater-identity",()=>4,validIdentity,enabled);
    const setUserId: Dispatch<SetStateAction<number>> = value => setSelectedId(old=>{const id=typeof value==="function"?value(old):value;const target=engineState.users.find(u=>u.id===id);return id===0||!target||target.active?id:old;});
    const [message, notify] = useState("");
    const user = engineState.users.find(u => u.id === userId) ?? {id:0,name:"Demo Guest",email:"",role:"buyer" as const,active:false};
    const state = projectDemoState(engineState, user);
    const setState: Dispatch<SetStateAction<DemoViewState>> = update => { if (enabled && (user.active || user.id===0))
        setEngineState(raw => { const view = projectDemoState(raw, user); return mergeDemoView(raw, typeof update === "function" ? update(view) : update, user); }); };
    function createNegotiation(input: NegotiationInput) {
        const p = engineState.products.find(p => p.id === input.productId);
        if (!enabled || !user.active || user.role !== "buyer" || !p || p.stock_quantity < 1 || !Number.isFinite(input.budget) || input.budget < .01 || !Number.isSafeInteger(Math.floor(input.budget * 100)) || input.mode === "automated" && input.scenario === "rejection")
            return null;
        const id = nextId(engineState.sessions);
        const session: Session = { ...input, budget: Math.floor(input.budget * 100 + 1e-7) / 100, id, buyerId: user.id, status: "active", rounds: [], createdAt: new Date().toISOString() };
        setEngineState(s => addAudit({ ...s, sessions: [session, ...s.sessions], notices: [{ id: nextId(s.notices), userId: p.seller_id, text: "New simulated negotiation request.", href: "/dashboard/seller/negotiations/" + id, read: false }, ...s.notices] }, "demo_session_started", id));
        return id;
    }
    function advanceNegotiation(id: number) { if (enabled && user.active && user.role === "buyer")
        setEngineState(s => s.sessions.some(x => x.id === id && x.buyerId === user.id) ? advanceSession(s, id) : s); }
    function approveNegotiation(id: number) { if (enabled && user.active && user.role === "buyer")
        setEngineState(s => { const session = s.sessions.find(x => x.id === id && x.buyerId === user.id); return session ? finishDeal(s, session) : s; }); }
    function endNegotiation(id: number, status: "rejected" | "cancelled") { if (enabled && user.active && user.role === "buyer")
        setEngineState(s => endSession(s, id, status, user.id)); }
    if(!ready||!identityReady)return <div className="panel" role="status">Restoring local demo…</div>;
    return <DemoContext.Provider value={{ enabled, state, setState, userId, setUserId, user, message, notify, createNegotiation, advanceNegotiation, approveNegotiation, endNegotiation }}>{(stateWarning||identityWarning)&&<p role="status" className="demo-strip">{stateWarning||identityWarning}</p>}{children}{message && <div role="status" className="toast">
        <span>{message}</span>
        <button aria-label="Dismiss notification" onClick={() => notify("")}>×</button>
        </div>}</DemoContext.Provider>;
}
export function useDemo() { const value = useContext(DemoContext); if (!value)
    throw new Error("DemoProvider missing"); return value; }
