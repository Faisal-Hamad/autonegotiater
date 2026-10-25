import type { Product } from "./api";
// Deterministic local prototype. Synthetic private inventory stays inside engine state.
export const competitiveProductId = 7;
export const exactProductKey = "DELL-XPS15-9530-I7-16GB-512GB-NEW";
export const competitiveProduct = {
    id: competitiveProductId, seller_id: 1, name: "Dell XPS 15", category: "Electronics",
    description: "Exact demo specification: XPS 15 9530, Intel Core i7, 16 GB RAM, 512 GB SSD, new. Compare independent mock sellers for this same specification.",
    base_price: "4700.00", stock_quantity: 25, image_url: null, created_at: "2026-10-18T08:00:00Z",
};
export type Requirements = { quantity: number; targetPrice: number; maximumPrice: number; deliveryDays: number; maxRounds: number };
export const defaultRequirements: Requirements = { quantity: 10, targetPrice: 4000, maximumPrice: 4300, deliveryDays: 7, maxRounds: 6 };
export type Inventory = { declaredMinimumPrice?: number; maximumDiscount?: number; description?: string; imageUrl?: string; storefrontKey: string; ownerSellerId: number; id: string; name: string; productKey: string; startingPrice: number; minimumPrice: number; stock: number; deliveryDays: number; concession: number; enabled?: boolean; maxRounds?: number; strategy?: "steady" | "competitive" };
const inventory: Inventory[] = [
    { storefrontKey: "dell-riyadh", ownerSellerId: 1, id: "riyadh", name: "Riyadh Tech Supply", productKey: exactProductKey, startingPrice: 4700, minimumPrice: 4050, stock: 25, deliveryDays: 5, concession: 150 },
    { storefrontKey: "dell-jeddah", ownerSellerId: 2, id: "jeddah", name: "Jeddah Digital Store", productKey: exactProductKey, startingPrice: 4550, minimumPrice: 3980, stock: 18, deliveryDays: 6, concession: 150 },
    { storefrontKey: "dell-dammam", ownerSellerId: 3, id: "dammam", name: "Dammam Computing", productKey: exactProductKey, startingPrice: 4600, minimumPrice: 4100, stock: 12, deliveryDays: 9, concession: 150 },
    { storefrontKey: "dell-premium", ownerSellerId: 1, id: "premium", name: "Premium Business Devices", productKey: exactProductKey, startingPrice: 4750, minimumPrice: 4400, stock: 20, deliveryDays: 4, concession: 150 },
    { storefrontKey: "dell-limited", ownerSellerId: 2, id: "limited", name: "Najd Laptop Outlet", productKey: exactProductKey, startingPrice: 4250, minimumPrice: 3900, stock: 6, deliveryDays: 3, concession: 150 },
    { storefrontKey: "dell-different", ownerSellerId: 3, id: "different", name: "XPS 13 Listing (Different Product)", productKey: "DELL-XPS13-I7-16GB-512GB-NEW", startingPrice: 3900, minimumPrice: 3600, stock: 30, deliveryDays: 3, concession: 150 },
];
export type Message = { timestamp?: string; round: number; agent: "Buyer Agent" | "Seller Agent" | "Market update"; action: "offer" | "counteroffer" | "accept" | "decline" | "announcement"; price?: number; explanation: string };
export type SellerStatus = "ready" | "negotiating" | "agreed" | "rejected" | "excluded";
export const sellerStatusLabels: Record<SellerStatus, string> = { ready: "Ready", negotiating: "Negotiating", agreed: "Agreed", rejected: "Rejected", excluded: "Excluded" };
type SellerState = { sellerAccountId: number; inventory: Inventory; status: SellerStatus; reason: string; currentPrice?: number; agreedPrice?: number; history: Message[] };
type PendingRound = { target: CompetitiveSession; events: { sellerId: string; message: Message }[]; index: number };
export type CompetitiveSession = { productId: number; productName: string; catalogId: string; pending?: PendingRound; buyerId: number; requirements: Requirements; round: number; phase: "running" | "review" | "approved" | "rejected" | "cancelled"; stopReason?: string; sellers: SellerState[]; announcements: { round: number; price: number; eligibleCount: number }[]; approvedSellerId?: string };
export type SellerView = { catalogId: string; id: string; name: string; exactProduct: boolean; startingPrice: number; stock: number; deliveryDays: number; participates: boolean; status: SellerStatus; reason: string; currentPrice?: number; agreedPrice?: number; history: Message[] };
export type CompetitiveView = Omit<CompetitiveSession, "sellers" | "pending"> & { completedRounds: number; sellers: SellerView[] };
const cents = (value: number) => Math.round(value * 100);
const currency = (value: number) => `${value.toFixed(2)} SAR`;
export function validateRequirements(r: Requirements): string | null {
    if (!Number.isInteger(r.quantity) || r.quantity < 1 || r.quantity > 10000) return "Quantity must be a whole number from 1 to 10,000.";
    if (![r.targetPrice, r.maximumPrice].every(n => Number.isFinite(n) && n >= .01 && n <= 1000000 && Math.abs(n * 100 - Math.round(n * 100)) < .000001)) return "Enter positive prices with no more than two decimal places (maximum 1,000,000 SAR per unit).";
    if (r.targetPrice > r.maximumPrice) return "Target price must not exceed the maximum price per unit.";
    if (!Number.isInteger(r.deliveryDays) || r.deliveryDays < 1 || r.deliveryDays > 365) return "Delivery deadline must be a whole number from 1 to 365 days.";
    if (!Number.isInteger(r.maxRounds) || r.maxRounds < 1 || r.maxRounds > 12) return "Maximum rounds must be a whole number from 1 to 12.";
    return null;
}
// Explicit shared catalog IDs: names, categories and partial strings are never matching keys.
const catalogIds: Record<number, string> = {
    1: "IPHONE-15-PRO-256GB-USED-94", 2: "SONY-WH1000XM5-LIKE-NEW",
    3: "SOFA-L-SHAPED-GREY-USED", 4: "CHAIR-ERGONOMIC-MESH",
    5: "DASHCAM-4K-FRONT-REAR-64GB", 6: "TREADMILL-FOLDABLE-14KMH", 7: exactProductKey,
};
export function catalogIdentity(productId: number) { return catalogIds[productId] ?? `LOCAL-LISTING-${productId}`; }
export function requirementsFor(product: Product): Requirements {
    if (product.id === competitiveProductId) return { ...defaultRequirements };
    const price = Number(product.base_price);
    return { quantity: 1, targetPrice: Math.max(.01, Math.round(price * .85 * 100) / 100), maximumPrice: Math.max(.01, Math.round(price * .92 * 100) / 100), deliveryDays: 7, maxRounds: 6 };
}
export function inventoryFor(product: Product): Inventory[] {
    const key = catalogIdentity(product.id), price = Number(product.base_price);
    const amount = (ratio: number) => Math.max(.01, Math.round(price * ratio * 100) / 100);
    if (!Number.isFinite(price) || price <= 0 || !Number.isInteger(product.stock_quantity) || product.stock_quantity < 0) throw new Error("This listing has invalid public price or stock data.");
    if (product.id === competitiveProductId) return inventory.filter(i => i.productKey === key).map(i => i.id === "riyadh" ? { ...i, ownerSellerId: product.seller_id, startingPrice: price, minimumPrice: amount(4050 / 4700), stock: product.stock_quantity } : { ...i });
    const primaryStores: Record<number, { key: string; name: string }> = { 1: { key: "riyadh-direct", name: "Riyadh Direct Store" }, 2: { key: "sara-home", name: "Sara Home Store" }, 3: { key: "khalid-direct", name: "Khalid Direct Store" } };
    const primaryStore = primaryStores[product.seller_id] ?? { key: `account-${product.seller_id}-direct`, name: `Seller ${product.seller_id} Direct Store` };
    const own: Inventory = { storefrontKey: primaryStore.key, ownerSellerId: product.seller_id, id: `p${product.id}-listing`, name: primaryStore.name, productKey: key, startingPrice: price, minimumPrice: amount(.85), stock: product.stock_quantity, deliveryDays: 5, concession: amount(.04) };
    // New locally-created listings have only their registered owner. Do not infer alternate sellers.
    if (!catalogIds[product.id]) return [own];
    return [own,
        { storefrontKey: "red-palm", ownerSellerId: 2, id: `p${product.id}-alternative`, name: "Red Palm Store", productKey: key, startingPrice: amount(.97), minimumPrice: amount(.82), stock: 8, deliveryDays: 6, concession: amount(.04) },
        { storefrontKey: "eastern-market", ownerSellerId: 3, id: `p${product.id}-late`, name: "Eastern Market", productKey: key, startingPrice: amount(.95), minimumPrice: amount(.84), stock: 12, deliveryDays: 10, concession: amount(.04) },
        { storefrontKey: "prime", ownerSellerId: 1, id: `p${product.id}-premium`, name: "Prime Store", productKey: key, startingPrice: amount(1.02), minimumPrice: amount(.96), stock: 10, deliveryDays: 4, concession: amount(.04) },
        { storefrontKey: "najd-outlet", ownerSellerId: 2, id: `p${product.id}-limited`, name: "Najd Outlet", productKey: key, startingPrice: amount(.94), minimumPrice: amount(.83), stock: 0, deliveryDays: 3, concession: amount(.04) },
    ];
}
function exclusionReason(i: Inventory, r: Requirements) {
    if (i.enabled === false) return "Excluded: this Seller Agent is disabled.";
    if (i.stock < r.quantity) return `Excluded: ${i.stock} units in stock; ${r.quantity} required.`;
    if (i.deliveryDays > r.deliveryDays) return `Excluded: delivery takes ${i.deliveryDays} days; deadline is ${r.deliveryDays} days.`;
    return "";
}
export function sellerCatalog(product: Product, requirements: Requirements): SellerView[] {
    return inventoryFor(product).filter(i => i.productKey === catalogIdentity(product.id)).map(i => {
        const reason = exclusionReason(i, requirements);
        return { catalogId: i.productKey, id: i.id, name: i.name, exactProduct: true, startingPrice: i.startingPrice, stock: i.stock, deliveryDays: i.deliveryDays,
            participates: !reason, status: reason ? "excluded" : "ready", reason: reason || "Ready: exact catalog ID, quantity and delivery all match.", history: [] };
    });
}
export function createCompetitiveSession(requirements: Requirements, buyerId: number, product: Product = competitiveProduct, configured?: Inventory[]): CompetitiveSession {
    const error = validateRequirements(requirements); if (error) throw new Error(error);
    if (!Number.isInteger(buyerId) || buyerId < 1) throw new Error("A demo Buyer identity is required.");
    const catalogId = catalogIdentity(product.id);
    return { productId: product.id, productName: product.name, catalogId, buyerId, requirements: { ...requirements }, round: 0, phase: "running", announcements: [], sellers: (configured ?? inventoryFor(product)).filter(i => i.productKey === catalogId).map(i => {
        const reason = exclusionReason(i, requirements);
        return { sellerAccountId: i.ownerSellerId, inventory: { ...i }, status: reason ? "excluded" : "negotiating", reason: reason || "Waiting for the Buyer Agent's opening offer.", history: [] };
    }) };
}
// A Seller Agent receives only its own inventory, a public offer and an anonymous price.
// The Buyer maximum and competing seller identities are never passed to this function.
export function sellerCounteroffer(own: Pick<Inventory, "startingPrice" | "minimumPrice" | "concession">, round: number, previous?: number, anonymousPrice?: number) {
    const scheduled = cents(own.startingPrice) - (round - 1) * cents(own.concession);
    const competition = anonymousPrice === undefined ? Infinity : cents(anonymousPrice) - 2500;
    return Math.max(cents(own.minimumPrice), Math.min(scheduled, previous === undefined ? Infinity : cents(previous), competition)) / 100;
}
function eligible(s: SellerState, r: Requirements, catalogId: string) { return s.inventory.productKey === catalogId && s.inventory.stock >= r.quantity && s.inventory.deliveryDays <= r.deliveryDays; }
export function advanceCompetitiveRound(input: CompetitiveSession): CompetitiveSession {
    if (input.phase !== "running") return input;
    const s = structuredClone(input), r = s.requirements;
    if (validateRequirements(r)) throw new Error("Invalid negotiation requirements.");
    s.round += 1;
    const max = cents(r.maximumPrice), target = cents(r.targetPrice);
    for (let index = 0; index < s.sellers.length; index++) {
        const seller = s.sellers[index];
        if (seller.status === "excluded" || seller.status === "rejected") continue;
        const own = seller.inventory;
        if (s.round > (own.maxRounds ?? r.maxRounds)) continue;
        if (!eligible(seller, r, s.catalogId)) {
            seller.status = "rejected"; seller.agreedPrice = undefined;
            seller.reason = `Delivery takes ${own.deliveryDays} days, exceeding the ${r.deliveryDays}-day deadline.`;
            seller.history.push({ round: s.round, agent: "Buyer Agent", action: "offer", price: r.targetPrice, explanation: `Requesting ${r.quantity} units of the exact specification, delivered within ${r.deliveryDays} days.` }, { round: s.round, agent: "Seller Agent", action: "decline", explanation: seller.reason });
            continue;
        }
        // Use the previous round snapshot so processing order cannot advantage a seller.
        const competing = input.sellers.filter(other => other.inventory.id !== own.id && eligible(other, r, s.catalogId) && other.currentPrice !== undefined && cents(other.currentPrice) <= max).map(other => other.currentPrice!);
        const bestCompeting = competing.length ? Math.min(...competing) : undefined;
        if (bestCompeting !== undefined) seller.history.push({ round: s.round, agent: "Market update", action: "announcement", price: bestCompeting, explanation: "An eligible competing seller offered this price for the same quantity and delivery requirement. Seller identity is withheld." });
        const progress = r.maxRounds === 1 ? 0 : (s.round - 1) / (r.maxRounds - 1);
        const proposed = Math.min(target + Math.floor((max - target) * progress), seller.currentPrice === undefined ? max : cents(seller.currentPrice));
        const buyerPrice = proposed / 100;
        seller.history.push({ round: s.round, agent: "Buyer Agent", action: "offer", price: buyerPrice, explanation: s.round === 1 ? `Opening at the requested target for ${r.quantity} units, delivered within ${r.deliveryDays} days.` : "Revising the proposal while considering the latest public offers and requested terms." });
        const previous = seller.currentPrice;
        const scheduled = sellerCounteroffer(own, s.round, previous);
        const price = sellerCounteroffer(own, s.round, previous, own.strategy === "steady" ? undefined : bestCompeting);
        seller.currentPrice = price; seller.agreedPrice = undefined; seller.status = "negotiating";
        seller.history.push({ round: s.round, agent: "Seller Agent", action: "counteroffer", price, explanation: bestCompeting !== undefined && price < scheduled ? `The anonymous competing quote of ${currency(bestCompeting)} lowered my scheduled unit price from ${currency(scheduled)} to ${currency(price)}. Quantity and delivery are unchanged.` : s.round === 1 ? "My opening unit price for the requested quantity and delivery terms." : price === previous ? "This is my unchanged offer for the requested terms." : "I can reduce my previous unit price for this order." });
        if (cents(price) <= max && eligible(seller, r, s.catalogId)) {
            // Explicit, matching acceptance messages are required; a counteroffer alone is not an Agreement.
            seller.history.push({ round: s.round, agent: "Buyer Agent", action: "accept", price, explanation: "I accept this unit price for the required quantity and delivery deadline, subject to the Buyer's final approval." }, { round: s.round, agent: "Seller Agent", action: "accept", price, explanation: "I confirm the same unit price, quantity and delivery terms. This agent Agreement remains open to competitive improvements before Buyer approval." });
            seller.agreedPrice = price; seller.status = "agreed";
            seller.reason = "Both agents accepted the same unit price; quantity and delivery requirements are satisfied. Buyer approval is still required.";
        } else seller.reason = "The current counteroffer has not produced an eligible Agreement.";
    }
    const current = s.sellers.filter(seller => eligible(seller, r, s.catalogId) && seller.currentPrice !== undefined && cents(seller.currentPrice) <= max);
    if (current.length) s.announcements.push({ round: s.round, price: Math.min(...current.map(seller => seller.currentPrice!)), eligibleCount: current.length });
    const competingSellers = s.sellers.filter(seller => seller.status === "negotiating" || seller.status === "agreed");
    const improved = s.sellers.some((seller, i) => seller.currentPrice !== undefined && (input.sellers[i].currentPrice === undefined || cents(seller.currentPrice) < cents(input.sellers[i].currentPrice!)));
    if (!competingSellers.length || s.round >= r.maxRounds || (s.round > 1 && !improved)) {
        s.phase = "review";
        s.stopReason = !competingSellers.length ? "No sellers can negotiate the requested quantity and delivery terms." : s.round >= r.maxRounds ? "Maximum negotiation rounds reached. Compare all results before approval." : "No Seller Agent improved its price this round. Compare the final results.";
        for (const seller of s.sellers) if (seller.status === "negotiating") { seller.status = "rejected"; seller.reason = seller.currentPrice !== undefined && seller.currentPrice > r.maximumPrice ? "The final counteroffer exceeds your maximum price per unit; no Agreement was reached." : "Negotiation ended without a mutually accepted price meeting all Buyer requirements."; }
    }
    return s;
}
export function competitiveView(session: CompetitiveSession, buyerId: number): CompetitiveView | null {
    if (session.buyerId !== buyerId) return null;
    // Explicit allowlist: no inventory object, minimumPrice or concession strategy reaches a view.
    return { productId: session.productId, productName: session.productName, catalogId: session.catalogId, completedRounds: session.pending ? session.round - 1 : session.round, buyerId: session.buyerId, requirements: { ...session.requirements }, round: session.round, phase: session.phase, stopReason: session.stopReason, approvedSellerId: session.approvedSellerId,
        announcements: structuredClone(session.announcements), sellers: session.sellers.map(s => ({ catalogId: s.inventory.productKey, id: s.inventory.id, name: s.inventory.name, exactProduct: s.inventory.productKey === session.catalogId, startingPrice: s.inventory.startingPrice, stock: s.inventory.stock, deliveryDays: s.inventory.deliveryDays, participates: s.status !== "excluded", status: s.status, reason: s.reason, currentPrice: s.currentPrice, agreedPrice: s.agreedPrice, history: structuredClone(s.history) })) };
}
export function rankedOffers(view: CompetitiveView) {
    return view.sellers.filter(s => s.status === "agreed" && s.exactProduct && s.stock >= view.requirements.quantity && s.deliveryDays <= view.requirements.deliveryDays && s.agreedPrice !== undefined && s.agreedPrice <= view.requirements.maximumPrice)
        .sort((a, b) => a.agreedPrice! - b.agreedPrice! || a.deliveryDays - b.deliveryDays || a.id.localeCompare(b.id));
}
export function approveCompetitiveOffer(input: CompetitiveSession, sellerId: string, buyerId: number): CompetitiveSession {
    if (input.phase !== "review" || input.buyerId !== buyerId) return input;
    const view = competitiveView(input, buyerId)!;
    if (!rankedOffers(view).some(s => s.id === sellerId)) return input;
    const seller = input.sellers.find(s => s.inventory.id === sellerId)!;
    const pair = seller.history.slice(-2);
    if (pair.length !== 2 || pair[0].agent !== "Buyer Agent" || pair[1].agent !== "Seller Agent" || !pair.every(m => m.action === "accept" && m.price === seller.agreedPrice) || cents(seller.agreedPrice!) < cents(seller.inventory.minimumPrice)) return input;
    return { ...input, phase: "approved", approvedSellerId: sellerId };
}

// Reveal exactly one message per tick. The precomputed round and private limits never enter a view.
export function advanceCompetitiveStep(input: CompetitiveSession): CompetitiveSession {
    if (input.phase !== "running") return input;
    const next = structuredClone(input);
    if (!next.pending) {
        const target = advanceCompetitiveRound(input);
        const batches = target.sellers.map(s => ({ sellerId: s.inventory.id, messages: s.history.slice(input.sellers.find(old => old.inventory.id === s.inventory.id)!.history.length) }));
        const events: PendingRound["events"] = [];
        const count = Math.max(0, ...batches.map(batch => batch.messages.length));
        for (let index = 0; index < count; index++) for (const batch of batches) if (batch.messages[index]) events.push({ sellerId: batch.sellerId, message: batch.messages[index] });
        if (!events.length) return target;
        next.round = target.round;
        for (const seller of next.sellers) if (seller.status === "agreed") { seller.status = "negotiating"; seller.agreedPrice = undefined; seller.reason = "A new competitive round is in progress."; }
        next.pending = { target, events, index: 0 };
    }
    const pending = next.pending;
    const event = pending.events[pending.index++];
    const seller = next.sellers.find(s => s.inventory.id === event.sellerId)!;
    seller.history.push(event.message);
    if (event.message.action === "counteroffer") { seller.currentPrice = event.message.price; seller.reason = event.message.explanation; }
    const lastForSeller = !pending.events.slice(pending.index).some(e => e.sellerId === event.sellerId);
    if (lastForSeller) {
        const result = pending.target.sellers.find(s => s.inventory.id === event.sellerId)!;
        seller.status = result.status; seller.agreedPrice = result.agreedPrice; seller.reason = result.reason;
    }
    return pending.index === pending.events.length ? pending.target : next;
}

// Every inventory record explicitly declares its owning demo Seller account.
export type SellerCompetitiveSession = {
    id: string; productId: number; productName: string; buyerId: number; storefrontId: string; storefrontKey: string; storefrontName: string;
    requirements: Pick<Requirements, "quantity" | "targetPrice" | "deliveryDays">;
    round: number; maxRounds: number; phase: CompetitiveSession["phase"]; status: SellerStatus;
    startingPrice: number; minimumPrice: number; currentPrice?: number; agreedPrice?: number; stock: number; deliveryDays: number;
    announcements: Message[]; approval: "pending" | "selected" | "not_selected"; history: Message[];
};
export function sellerCompetitiveViews(session: CompetitiveSession, sellerAccountId: number): SellerCompetitiveSession[] {
    return session.sellers.filter(s => s.sellerAccountId === sellerAccountId && s.inventory.ownerSellerId === sellerAccountId).map(s => ({
        id: `${session.buyerId}-${session.productId}-${s.inventory.id}`,
        productId: session.productId, productName: session.productName, buyerId: session.buyerId,
        storefrontId: s.inventory.id, storefrontKey: s.inventory.storefrontKey, storefrontName: s.inventory.name,
        requirements: { quantity: session.requirements.quantity, targetPrice: session.requirements.targetPrice, deliveryDays: session.requirements.deliveryDays },
        round: session.round, maxRounds: session.requirements.maxRounds, phase: session.phase, status: s.status,
        startingPrice: s.inventory.startingPrice, minimumPrice: s.inventory.minimumPrice, currentPrice: s.currentPrice, agreedPrice: s.agreedPrice,
        stock: s.inventory.stock, deliveryDays: s.inventory.deliveryDays,
        approval: session.phase !== "approved" ? "pending" : session.approvedSellerId === s.inventory.id ? "selected" : "not_selected",
        // Only messages delivered to this storefront, verbatim. Announcements are
        // already anonymous in engine state; no global market snapshot is exposed.
        history: structuredClone(s.history),
        announcements: structuredClone(s.history.filter(m => m.agent === "Market update"))
    }));
}

// Direct session lookup follows the identical ownership projection used by lists.
export function sellerCompetitiveSession(session: CompetitiveSession, sellerAccountId: number, sessionId: string) {
    return sellerCompetitiveViews(session, sellerAccountId).find(s => s.id === sessionId) ?? null;
}
