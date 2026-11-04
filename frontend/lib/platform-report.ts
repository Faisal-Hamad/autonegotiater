import { reportDate, type Report } from "./reports";
import type { DemoViewState } from "./demo-model";
import type { DemoAgreement } from "./demo-integration";
import type { OperationalSession } from "../components/competitive-provider";

/** One headline number shown as a tile above the report. */
export type Kpi = { label: string; value: string; note?: string };

const sar = (n: number) => `${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR`;
const pct = (part: number, all: number) => (all ? `${((part / all) * 100).toFixed(1)}%` : "—");
const inRange = (iso: string | undefined, from: string, to: string) => {
    if (!iso) return !from && !to;
    const day = iso.slice(0, 10);
    return (!from || day >= from) && (!to || day <= to);
};

/** Whole-platform summary for the admin: activity, outcomes, value and seller performance. */
export function buildPlatformReport(state: DemoViewState, records: OperationalSession[], agreements: DemoAgreement[], from: string, to: string, generatedAt: string): { report: Report; kpis: Kpi[] } {
    const product = (id: number) => state.products.find(p => p.id === id);
    const name = (id: number) => state.users.find(u => u.id === id)?.name ?? `User ${id}`;
    const oneToOne = state.sessions.filter(s => inRange(s.createdAt, from, to));
    const multi = records.filter(r => inRange(r.createdAt, from, to));
    const deals = state.deals.filter(d => inRange(d.createdAt, from, to));
    const direct = deals.filter(d => d.purchaseType === "direct");
    const negotiatedDeals = deals.filter(d => d.purchaseType !== "direct");
    const multiAgreements = agreements.filter(g => inRange(g.createdAt, from, to));

    // Sessions: direct purchases are not negotiations, so they are counted separately.
    const directSessionIds = new Set(direct.map(d => d.sessionId));
    const negotiations = oneToOne.filter(s => !directSessionIds.has(s.id));
    const all = [...negotiations.map(s => ({ type: "One-to-one", status: s.status as string, rounds: s.rounds.length })), ...multi.map(r => ({ type: "Multi-seller", status: r.status, rounds: r.round }))];
    const completed = all.filter(s => s.status === "completed").length;
    const finished = all.filter(s => ["completed", "failed", "cancelled", "rejected"].includes(s.status)).length;
    const roundsDone = all.filter(s => s.status === "completed");
    const avgRounds = roundsDone.length ? (roundsDone.reduce((a, s) => a + s.rounds, 0) / roundsDone.length).toFixed(1) : "—";

    // Value and savings against the public listing price.
    const lines = [
        ...negotiatedDeals.map(d => ({ sellerId: d.sellerId, productName: product(d.productId)?.name ?? `Product ${d.productId}`, quantity: d.quantity ?? 1, price: d.price, listing: d.listingPrice, type: "One-to-one" })),
        ...multiAgreements.map(g => ({ sellerId: g.sellerId, productName: g.productName, quantity: g.quantity, price: g.unitPrice, listing: Number(product(g.productId)?.base_price ?? g.unitPrice), type: "Multi-seller" })),
        ...direct.map(d => ({ sellerId: d.sellerId, productName: product(d.productId)?.name ?? `Product ${d.productId}`, quantity: d.quantity ?? 1, price: d.price, listing: d.price, type: "Direct purchase" })),
    ];
    const value = lines.reduce((a, l) => a + l.price * l.quantity, 0);
    const negotiatedLines = lines.filter(l => l.type !== "Direct purchase" && l.listing > 0);
    const avgSaving = negotiatedLines.length ? negotiatedLines.reduce((a, l) => a + (l.listing - l.price) / l.listing, 0) / negotiatedLines.length * 100 : 0;
    const buyerSavings = negotiatedLines.reduce((a, l) => a + Math.max(0, l.listing - l.price) * l.quantity, 0);

    const kpis: Kpi[] = [
        { label: "Negotiation sessions", value: String(all.length), note: `${negotiations.length} one-to-one · ${multi.length} multi-seller` },
        { label: "Success rate", value: pct(completed, finished), note: `${completed} of ${finished} finished sessions` },
        { label: "Agreements value", value: sar(value), note: `${lines.length} agreements incl. ${direct.length} direct` },
        { label: "Average buyer saving", value: negotiatedLines.length ? `${avgSaving.toFixed(1)}%` : "—", note: `${sar(buyerSavings)} below listing prices` },
        { label: "Average rounds to agree", value: avgRounds, note: "Completed negotiations" },
        { label: "Active users", value: String(state.users.filter(u => u.active).length), note: `${state.users.filter(u => u.role === "buyer").length} buyers · ${state.users.filter(u => u.role === "seller").length} sellers` },
    ];

    const statusRows = ["active", "paused", "awaiting_seller", "awaiting_approval", "completed", "failed", "rejected", "cancelled"].map(status => {
        const one = all.filter(s => s.type === "One-to-one" && s.status === status).length, many = all.filter(s => s.type === "Multi-seller" && s.status === status).length;
        return [status.replace(/_/g, " "), String(one), String(many), String(one + many)];
    }).filter(r => r[3] !== "0");

    const sellers = [...new Set(lines.map(l => l.sellerId))].map(id => {
        const own = lines.filter(l => l.sellerId === id), neg = own.filter(l => l.type !== "Direct purchase" && l.listing > 0);
        const revenue = own.reduce((a, l) => a + l.price * l.quantity, 0);
        return { id, revenue, row: [name(id), String(own.length), String(own.filter(l => l.type === "Direct purchase").length), sar(revenue), neg.length ? `${(neg.reduce((a, l) => a + (l.listing - l.price) / l.listing, 0) / neg.length * 100).toFixed(1)}%` : "—"] };
    }).sort((a, b) => b.revenue - a.revenue);

    const products = [...new Set(lines.map(l => l.productName))].map(p => {
        const own = lines.filter(l => l.productName === p);
        return { units: own.reduce((a, l) => a + l.quantity, 0), row: [p, String(own.length), String(own.reduce((a, l) => a + l.quantity, 0)), sar(own.reduce((a, l) => a + l.price * l.quantity, 0))] };
    }).sort((a, b) => b.units - a.units).slice(0, 10);

    const period = from || to ? `${from || "start"} to ${to || "today"}` : "All time";
    const report: Report = {
        id: `REPORT-platform-${generatedAt.replace(/[^0-9]/g, "").slice(0, 14)}`,
        title: `Platform Summary Report (${period})`,
        generatedAt: reportDate(generatedAt),
        sections: [
            { title: "Key figures", columns: ["Metric", "Value", "Details"], rows: kpis.map(k => [k.label, k.value, k.note ?? ""]) },
            { title: "Sessions by status", columns: ["Status", "One-to-one", "Multi-seller", "Total"], rows: statusRows },
            { title: "Agreements by type", columns: ["Type", "Agreements", "Units", "Value"], rows: ["One-to-one", "Multi-seller", "Direct purchase"].map(t => { const own = lines.filter(l => l.type === t); return [t, String(own.length), String(own.reduce((a, l) => a + l.quantity, 0)), sar(own.reduce((a, l) => a + l.price * l.quantity, 0))]; }) },
            { title: "Seller performance", columns: ["Seller", "Agreements", "Direct sales", "Revenue", "Average discount given"], rows: sellers.map(s => s.row) },
            { title: "Top products", columns: ["Product", "Agreements", "Units", "Value"], rows: products.map(p => p.row) },
            { title: "Privacy note", columns: ["Note"], rows: [["Private buyer budgets and seller minimum prices are not included in this report."]] },
        ],
    };
    return { report, kpis };
}
