import type { DemoViewState, SessionView } from "./demo-model";

export type ReportType = "seller" | "buyer" | "session" | "request";
export type ReportSection = { title: string; columns: string[]; rows: string[][] };
export type Report = { id: string; title: string; generatedAt: string; sections: ReportSection[] };
export const statuses: Record<string, string> = {
    active: "Active",
    awaiting_approval: "Awaiting Buyer approval",
    completed: "Completed",
    failed: "Failed",
    rejected: "Buyer rejected",
    cancelled: "Cancelled",
    not_selected: "Not selected",
};
const na = "Not available in the current data";
export function reportDate(value: string) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return na;
    return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", timeZone: "UTC" }).format(date) + " UTC";
}
const sar = (n: number) => `${n.toFixed(2)} SAR`;
export function approval(s: SessionView) {
    if (s.status === "rejected") return "Buyer rejected";
    if (s.status === "not_selected") return "Not selected — another seller's offer was chosen in the multi-seller request";
    if (s.status === "awaiting_approval") return "Awaiting Buyer approval";
    if (s.status === "completed") return s.mode === "automated" ? "Automated completion within the demo authorization" : "Completed — approval inferred from status; no separate decision record is available";
    return s.status === "cancelled" ? "Negotiation Session cancelled" : "No final approval";
}
// Explicit field allowlist: never serialize state, private rules or session limits.
export function buildReport(state: DemoViewState, type: ReportType, id: number, generatedAt: string): Report | null {
    const requests = state.requests ?? [];
    const person = (type === "seller" || type === "buyer") ? state.users.find(u => u.id === id && u.role === type) : undefined;
    const session = type === "session" ? state.sessions.find(s => s.id === id) : undefined;
    const request = type === "request" ? requests.find(r => r.id === id) : undefined;
    if (type === "session" ? !session : type === "request" ? !request : !person) return null;
    const product = (pid: number) => state.products.find(p => p.id === pid);
    const name = (uid: number | undefined) => state.users.find(u => u.id === uid)?.name ?? na;
    const sessions = state.sessions.filter(s =>
        type === "session" ? s.id === id :
        type === "request" ? (request!.sessionIds.includes(s.id) || s.requestId === id) :
        type === "buyer" ? s.buyerId === id :
        product(s.productId)?.seller_id === id
    );
    const deals = state.deals.filter(d =>
        type === "session" ? d.sessionId === id :
        type === "request" ? sessions.some(s => s.id === d.sessionId) :
        type === "buyer" ? d.buyerId === id :
        d.sellerId === id
    );
    const products = state.products.filter(p =>
        type === "seller" ? p.seller_id === id :
        type === "request" ? request!.productIds.includes(p.id) || sessions.some(s => s.productId === p.id) :
        sessions.some(s => s.productId === p.id) || deals.some(d => d.productId === p.id)
    );
    const buyerRequests = type === "buyer" ? requests.filter(r => r.buyerId === id) : type === "request" && request ? [request] : [];
    const sections: ReportSection[] = [];
    const fields = (title: string, rows: string[][]) => sections.push({ title, columns: ["Field", "Value"], rows });
    if (person) fields("Permitted Account Details", [["ID", String(person.id)], ["Name", person.name], ["Demo email", person.email], ["Role", type === "buyer" ? "Buyer" : "Seller"], ["Account status", person.active ? "Active" : "Inactive"]]);
    if (request) {
        fields("Multi-Seller Request Details", [
            ["Request ID", `#${request.id}`],
            ["Buyer", name(request.buyerId)],
            ["Mode", request.mode === "automated" ? "Automated" : "Semi-automated"],
            ["Status", statuses[request.status] ?? request.status],
            ["Scoring Weights", `${Math.round(request.priceWeight * 100)}% Price Savings / ${Math.round((1 - request.priceWeight) * 100)}% Buyer Ranking`],
            ["Ranked Listings", request.productIds.map((pid, idx) => `#${idx + 1} ${product(pid)?.name ?? `Listing #${pid}`}`).join(", ") || na],
            ["Participating Sessions", request.sessionIds.map(sid => `#${sid}`).join(", ") || na],
            ["Required Warranty", `${request.warranty} months`],
            ["Delivery Preference", request.delivery],
            ["Created at", reportDate(request.createdAt)],
        ]);
    }
    const completed = sessions.filter(s => s.status === "completed").length;
    const leverageCount = sessions.reduce((n, s) => n + s.rounds.filter(r => r.leverageApplied).length, 0);
    fields("Demo Statistics", [
        ["Negotiation Sessions", String(sessions.length)],
        ...(type === "buyer" || type === "request" ? [["Multi-Seller Requests", String(buyerRequests.length)]] : []),
        ["Recorded Agreements", String(deals.length)],
        ["Offers and counteroffers (excluding acceptance messages)", String(sessions.reduce((n, s) => n + s.rounds.filter(r => r.action !== "accept").length, 0))],
        ["Competitive leverage adjustments", String(leverageCount)],
        ["Success rate: completed Negotiation Sessions / all Negotiation Sessions", sessions.length ? `${(completed / sessions.length * 100).toFixed(1)}% (${completed}/${sessions.length})` : "Not available: no Negotiation Sessions"],
        [type === "buyer" || type === "request" ? "Total demo purchase value" : "Total demo Agreement value", sar(deals.reduce((n, d) => n + Math.round(d.price * 100), 0) / 100)],
    ]);
    if (type === "buyer" || type === "request") {
        sections.push({
            title: "Multi-Seller Requests",
            columns: ["Request", "Buyer", "Mode", "Status", "Ranked Listings", "Sessions", "Delivery", "Created at"],
            rows: buyerRequests.map(r => [
                `#${r.id}`,
                name(r.buyerId),
                r.mode === "automated" ? "Automated" : "Semi-automated",
                statuses[r.status] ?? r.status,
                r.productIds.map((pid, idx) => `#${idx + 1} ${product(pid)?.name ?? `Listing #${pid}`}`).join("; "),
                r.sessionIds.map(sid => `#${sid}`).join(", "),
                r.delivery,
                reportDate(r.createdAt),
            ]),
        });
    }
    sections.push({ title: "Products — Current Listing Data", columns: ["ID", "Product", "Category", "Public listing price", "Stock"], rows: products.map(p => [String(p.id), p.name, p.category ?? na, sar(Number(p.base_price)), String(p.stock_quantity)]) });
    sections.push({ title: "Negotiation Session History", columns: ["Negotiation Session", "Buyer", "Seller", "Product", "Started at", "Mode", "Status"], rows: sessions.map(s => [String(s.id), name(s.buyerId), name(product(s.productId)?.seller_id), product(s.productId)?.name ?? na, reportDate(s.createdAt), s.mode === "automated" ? "Automated" : "Semi-automated", statuses[s.status] ?? s.status]) });
    for (const s of sessions) {
        fields(`Negotiation Session Outcome #${s.id}`, [
            ["Session type", s.requestId !== undefined ? `Multi-seller Request #${s.requestId}` : "One-to-one"],
            ["Approval decision", approval(s)],
            ["Final Agreement price", s.status === "completed" && s.agreedPrice !== undefined ? sar(s.agreedPrice) : "No finalized Agreement price"],
            ["Agent-accepted price (may not be final)", s.agreedPrice === undefined ? "The agents have not reached an Agreement" : sar(s.agreedPrice)],
            ["Agreement completed at", deals.find(d => d.sessionId === s.id) ? reportDate(deals.find(d => d.sessionId === s.id)!.createdAt) : na],
        ]);
        sections.push({ title: `Chronological Offers — Negotiation Session #${s.id}`, columns: ["Sequence", "Round", "Agent", "Action", "Price", "Explanation"], rows: s.rounds.map((r, i) => [String(i + 1), String(r.number), r.agent === "buyer" ? "Buyer Agent" : "Seller Agent", r.action === "accept" ? "Acceptance" : r.action === "offer" ? "Offer" : "Counteroffer", sar(r.price), r.message]) });
    }
    sections.push({ title: "Completed Agreements", columns: ["Agreement", "Negotiation Session", "Product", "Value", "Date"], rows: deals.map(d => [String(d.id), String(d.sessionId), product(d.productId)?.name ?? na, sar(d.price), reportDate(d.createdAt)]) });
    fields("Report Scope and Limitations", [["Source", "DEMO / SAMPLE DATA — local simulation; no real financial transactions"], ["Dates", "Dates use English formatting in UTC. Individual offer and approval timestamps are not recorded."], ["Statistics", "Includes all current records for the selected entity. Search filters select the entity only. Values do not represent payments or profit."], ["Privacy", "Private Buyer budgets, Seller limits and credentials are excluded. Demo Admin role selection is not real authorization."]]);
    const titleLabel = type === "seller" ? "Seller Report" : type === "buyer" ? "Buyer Report" : type === "request" ? "Multi-Seller Request Report" : "Negotiation Session Report";
    return { id: `DEMO-${type}-${id}-${generatedAt.replace(/[^0-9]/g, "")}`, title: `${titleLabel} #${id}`, generatedAt: reportDate(generatedAt), sections };
}
export function reportCsv(report: Report) {
    const cell = (value: string) => `"${(/^[\s]*[=+@-]/.test(value) ? "'" : "") + value.replaceAll('"', '""')}"`;
    const rows = [["Report title", report.title], ["Report ID", report.id], ["Generated at", report.generatedAt], ["Data source", "DEMO / SAMPLE DATA"], ...report.sections.flatMap(s => [[s.title], s.columns, ...(s.rows.length ? s.rows : [["No data is available for this section."]]), []])];
    return "\ufeff" + rows.map(r => r.map(cell).join(",")).join("\r\n");
}
