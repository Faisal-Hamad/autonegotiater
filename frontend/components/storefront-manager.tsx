"use client";
import Link from "next/link";
import { realMode } from "@/lib/real-api";
import { ProductIllustration, DesignIcon } from "./approved-visuals";
import { catalogIdentity } from "@/lib/competitive";
import { money } from "@/lib/demo-model";
import { useState, type FormEvent } from "react";
import { useDemo } from "./demo-provider";
import { useCompetitiveWorkspace } from "./competitive-provider";
import { validateListing } from "@/lib/demo-integration";
import { Heading, Empty, Badge, Stats } from "./ui";
import type { Inventory } from "@/lib/competitive";

function ListingImage({ product, image }: { product: import("@/lib/api").Product; image?: string }) {
    const [failed, setFailed] = useState(false);
    return image && !failed ? (
        <img src={image} alt={product.name} onError={() => setFailed(true)} className="rounded-xl w-full h-full object-contain" />
    ) : (
        <ProductIllustration product={product} />
    );
}

export function SellerProductsManager() {
    const { user, state, setState, notify } = useDemo(), c = useCompetitiveWorkspace();
    const [query, setQuery] = useState(""), [key, setKey] = useState(""), [mode, setMode] = useState<"product" | "agent" | "new" | null>(null), [catalog, setCatalog] = useState(state.products[0]?.id ?? 0), [error, setError] = useState("");
    const item = c.settings.find(x => `${x.product.id}:${x.listing.id}` === key);
    const product = mode === "new" ? state.products.find(p => p.id === catalog) : item?.product, listing = item?.listing;

    if (!user.active || user.role !== "seller") return <Empty title="Active Seller required" description="Sign in as the owning Seller." />;

    async function save(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!product) return;
        const data = new FormData(e.currentTarget), start = Number(data.get("opening")), discount = Number(data.get("discount")), minimum = Number(data.get("minimum"));
        const next: Inventory = {
            ...(mode !== "new" && listing ? listing : { id: "new", storefrontKey: "new", name: user.name, ownerSellerId: user.id, productKey: product.catalog_id ?? catalogIdentity(product.id) }),
            startingPrice: start,
            declaredMinimumPrice: minimum,
            maximumDiscount: discount,
            minimumPrice: Math.max(minimum, Math.ceil(start * (1 - discount / 100) * 100 - 0.000001) / 100),
            stock: Number(data.get("stock")),
            deliveryDays: Number(data.get("delivery")),
            concession: Number(data.get("concession")),
            maxRounds: Number(data.get("rounds")),
            enabled: data.get("enabled") === "on",
            strategy: data.get("strategy") === "steady" ? "steady" : "competitive",
            description: String(data.get("description") ?? ""),
            imageUrl: String(data.get("image") ?? "").trim(),
        };
        if (!Number.isFinite(discount) || discount < 0 || discount > 100 || !Number.isFinite(minimum) || minimum <= 0 || minimum > start || !validateListing(next)) {
            setError("Check positive cent-precision prices, minimum ≤ opening, discount 0–100%, whole stock, delivery 1–365 days, rounds 1–12 and positive concession. Images must use a local /media path.");
            return;
        }
        try {
            if (mode === "new") await c.createListing(product.id, next);
            else await c.saveListing(product.id, next);
            if (!realMode && mode !== "new" && listing && (listing.id === "riyadh" || listing.id === `p${product.id}-listing`))
                setState(s => ({
                    ...s,
                    products: s.products.map(p => (p.id === product.id ? { ...p, base_price: start.toFixed(2), stock_quantity: next.stock } : p)),
                    rules: [
                        ...s.rules.filter(r => r.productId !== product.id),
                        { productId: product.id, minimum: next.minimumPrice, discount, rounds: next.maxRounds!, threshold: Math.max(next.minimumPrice, Math.min(start, state.rules.find(r => r.productId === product.id)?.threshold ?? start)), enabled: next.enabled! },
                    ],
                }));
            setError("");
            setMode(null);
            notify("Seller product listing saved. Future sessions use these settings; existing snapshots remain unchanged.");
        } catch (e) {
            setError(e instanceof Error ? e.message : "Unable to save settings.");
        }
    }

    function edit(value: string, nextMode: "product" | "agent") {
        setKey(value);
        setMode(nextMode);
        setError("");
    }

    const totalStock = c.settings.reduce((sum, x) => sum + x.listing.stock, 0);
    const activeAgents = c.settings.filter(x => x.listing.enabled !== false).length;

    return (
        <div className="space-y-6">
            <Heading
                eyebrow="Seller Storefront & AI Rules"
                title="My Products & Agent Settings"
                description="Each listing belongs directly to you and has independent pricing, availability, and private AI Agent rules."
                action={
                    <button
                        className="btn"
                        onClick={() => {
                            setMode("new");
                            setError("");
                        }}
                    >
                        + Add Product Listing
                    </button>
                }
            />

            <Stats
                items={[
                    { label: "Owned Listings", value: c.settings.length, note: "Active storefront items", icon: "box" },
                    { label: "Total Available Stock", value: `${totalStock} units`, note: "Ready for immediate deals", icon: "truck" },
                    { label: "AI Agents Enabled", value: `${activeAgents} / ${c.settings.length}`, note: "Automated bargaining active", icon: "bolt" },
                    { label: "Floor Price Privacy", value: "100% Protected", note: "Hidden from buyers & reports", icon: "shield" },
                ]}
            />

            {mode && (
                <section className="panel border-indigo-200 bg-gradient-to-b from-indigo-50/30 to-white space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                        <div>
                            <span className="eyebrow !mb-1">{mode === "new" ? "New Catalog Listing" : mode === "agent" ? "AI Negotiation Rules" : "Listing Details"}</span>
                            <h2 className="text-xl font-bold text-slate-900">{mode === "new" ? "Add Product Listing" : mode === "agent" ? "Configure Agent" : "Edit Product Listing"}</h2>
                        </div>
                        <button className="btn-secondary" onClick={() => setMode(null)}>
                            Close editor
                        </button>
                    </div>
                    {mode === "new" && (
                        <label>
                            Exact catalog product / variant
                            <select value={catalog} onChange={e => setCatalog(Number(e.target.value))}>
                                {state.products.map(p => (
                                    <option key={p.id} value={p.id}>
                                        {p.name} · {p.catalog_id ?? catalogIdentity(p.id)}
                                    </option>
                                ))}
                            </select>
                        </label>
                    )}
                    <p className="text-xs font-medium text-slate-500 bg-slate-100/80 px-3.5 py-2 rounded-lg">
                        {product?.name} · Catalog: {product ? product.catalog_id ?? catalogIdentity(product.id) : "Unavailable"} ·{" "}
                        {mode === "new" ? "A new, separate listing ID is created; existing listings are never merged." : `Listing ID: ${listing?.id}`}
                    </p>
                    {product && (
                        <form key={`${mode}:${catalog}:${key}`} className="space-y-5" onSubmit={save}>
                            <div className="field-grid">
                                <label>
                                    Product description / specifications
                                    <textarea name="description" rows={3} maxLength={3000} defaultValue={mode === "new" ? product.description ?? "" : listing?.description ?? product.description ?? ""} />
                                </label>
                                <label>
                                    Local image path (optional)
                                    <input name="image" placeholder="/media/product.png" defaultValue={mode === "new" ? "" : listing?.imageUrl ?? ""} />
                                </label>
                                <label>
                                    Opening price (SAR per unit)
                                    <input name="opening" type="number" min="0.01" max="1000000" step="0.01" required defaultValue={mode === "new" ? product.base_price : listing?.startingPrice} />
                                </label>
                                <label>
                                    Private minimum acceptable price (SAR)
                                    <input
                                        name="minimum"
                                        type="number"
                                        min="0.01"
                                        step="0.01"
                                        required
                                        defaultValue={mode === "new" ? Number((Number(product.base_price) * 0.85).toFixed(2)) : listing?.declaredMinimumPrice ?? listing?.minimumPrice}
                                    />
                                </label>
                                <label>
                                    Maximum allowed discount (%)
                                    <input
                                        name="discount"
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="0.01"
                                        required
                                        defaultValue={mode === "new" ? 15 : listing?.maximumDiscount ?? Math.ceil((1 - listing!.minimumPrice / listing!.startingPrice) * 10000) / 100}
                                    />
                                </label>
                                <label>
                                    Available units
                                    <input name="stock" type="number" min="0" max="10000" step="1" required defaultValue={mode === "new" ? 1 : listing?.stock} />
                                </label>
                                <label>
                                    Delivery within (days)
                                    <input name="delivery" type="number" min="1" max="365" step="1" required defaultValue={mode === "new" ? 5 : listing?.deliveryDays} />
                                </label>
                                <label>
                                    Maximum Agent rounds
                                    <input name="rounds" type="number" min="1" max="12" step="1" required defaultValue={mode === "new" ? 6 : listing?.maxRounds ?? 6} />
                                </label>
                                <label>
                                    Concession per round (SAR)
                                    <input name="concession" type="number" min="0.01" max="1000000" step="0.01" required defaultValue={mode === "new" ? Number((Number(product.base_price) * 0.04).toFixed(2)) : listing?.concession} />
                                </label>
                                <label>
                                    Concession strategy
                                    <select name="strategy" defaultValue={mode === "new" ? "competitive" : listing?.strategy ?? "competitive"}>
                                        <option value="competitive">Steady concessions + anonymous competition</option>
                                        <option value="steady">Steady concessions only</option>
                                    </select>
                                </label>
                            </div>
                            <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                                <input className="w-auto" name="enabled" type="checkbox" defaultChecked={mode === "new" || listing?.enabled !== false} />
                                <span>Enable Seller Agent for automated and semi-automated deals</span>
                            </label>
                            <p className="text-xs muted">
                                The effective floor is the greater of your private minimum and the opening price after maximum allowed discount. Changes apply only to future sessions.
                            </p>
                            {error && (
                                <p role="alert" className="text-rose-700 text-sm font-medium">
                                    {error}
                                </p>
                            )}
                            <button className="btn">Save Product Listing</button>
                        </form>
                    )}
                    <Link className="text-indigo-600 text-sm font-semibold inline-block pt-2" href="/dashboard/seller/products/new">
                        Create a new catalog product / variant →
                    </Link>
                </section>
            )}

            <div className="panel bg-slate-50/60">
                <label className="max-w-md text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Search your products
                    <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Product name or listing ID" />
                </label>
            </div>

            {!c.settings.length ? (
                <Empty title="No owned product listings" description="Add a listing for an existing catalog product, or create a new variant." />
            ) : (
                <div className="grid xl:grid-cols-2 gap-5">
                    {c.settings
                        .filter(x => `${x.product.name} ${x.listing.id}`.toLowerCase().includes(query.toLowerCase()))
                        .map(({ product: p, listing: l }) => (
                            <article className="panel flex flex-col justify-between gap-5 hover:border-indigo-200 transition" key={`${p.id}:${l.id}`}>
                                <div className="flex items-start gap-4">
                                    <div className="w-24 h-24 rounded-xl bg-slate-50 border border-slate-100 p-2 shrink-0 grid place-items-center overflow-hidden">
                                        <ListingImage product={p} image={l.imageUrl} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <Badge tone={l.enabled === false ? "rose" : "emerald"}>{l.enabled === false ? "Agent Disabled" : "Agent Active"}</Badge>
                                            <span className="text-xs font-mono text-slate-400">Listing {l.id}</span>
                                        </div>
                                        <h2 className="text-lg font-bold text-slate-900 mt-2">{p.name}</h2>
                                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{l.description ?? p.description}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-slate-50/80 border border-slate-100 text-xs">
                                    <div>
                                        <span className="muted block">Opening price</span>
                                        <strong className="text-sm text-slate-900 mt-0.5 block">{money(l.startingPrice)}</strong>
                                    </div>
                                    <div>
                                        <span className="muted block">Private floor</span>
                                        <strong className="text-sm text-indigo-700 mt-0.5 block">{money(l.minimumPrice)}</strong>
                                    </div>
                                    <div>
                                        <span className="muted block">Available stock</span>
                                        <strong className="text-sm text-slate-900 mt-0.5 block">{l.stock} units</strong>
                                    </div>
                                    <div>
                                        <span className="muted block">Delivery</span>
                                        <strong className="text-sm text-slate-900 mt-0.5 block">Within {l.deliveryDays} days</strong>
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                                    <span className="text-xs text-slate-500">
                                        Strategy: <strong className="text-slate-700">{l.strategy === "steady" ? "Steady / Firm" : "Competitive / Balanced"}</strong>
                                    </span>
                                    <div className="flex flex-wrap gap-2.5">
                                        <button className="btn-secondary text-xs py-2 px-3.5" onClick={() => edit(`${p.id}:${l.id}`, "product")}>
                                            Edit Product
                                        </button>
                                        <button className="btn text-xs py-2 px-3.5" onClick={() => edit(`${p.id}:${l.id}`, "agent")}>
                                            Configure Agent
                                        </button>
                                    </div>
                                </div>
                            </article>
                        ))}
                </div>
            )}
        </div>
    );
}

export function AdminProductListings() {
    const { state, user } = useDemo(), c = useCompetitiveWorkspace();
    const [query, setQuery] = useState("");
    if (user.role !== "admin" || !user.active) return null;
    const rows = c.reportListings.filter(l => `${l.productName} ${l.storefrontName} ${l.storefrontKey}`.toLowerCase().includes(query.toLowerCase()));
    return (
        <div className="space-y-6">
            <Heading
                eyebrow="Admin Catalog Governance"
                title="Product Monitoring"
                description="Public Seller product listing information only. Private Agent floor prices and concession rules are strictly excluded."
            />
            <div className="panel bg-slate-50/60">
                <label className="max-w-md text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Search products or Sellers
                    <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Filter by product, seller name or listing ID…" />
                </label>
            </div>
            <div className="panel table-wrap !p-0 overflow-hidden">
                <table>
                    <thead>
                        <tr>
                            <th>Seller ID</th>
                            <th>Seller</th>
                            <th>Product Listing ID</th>
                            <th>Catalog Product ID</th>
                            <th>Product</th>
                            <th>Opening Price</th>
                            <th>Stock</th>
                            <th>Delivery</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(l => (
                            <tr key={`${l.productId}:${l.storefrontKey}`} className="hover:bg-slate-50/80 transition">
                                <td className="text-xs font-mono text-slate-500">#{l.sellerId}</td>
                                <td className="font-semibold text-slate-800">{state.users.find(u => u.id === l.sellerId)?.name ?? `Seller #${l.sellerId}`}</td>
                                <td>
                                    <Badge tone="slate">{l.storefrontKey}</Badge>
                                </td>
                                <td className="text-xs font-mono text-slate-500">{l.catalogId ?? catalogIdentity(l.productId)}</td>
                                <td>
                                    <Link href={`/products/${l.productId}`} className="font-semibold text-indigo-600 hover:underline">
                                        {l.productName}
                                    </Link>
                                </td>
                                <td className="font-bold text-slate-900">{money(l.price)}</td>
                                <td>
                                    <Badge tone={l.stock > 0 ? "emerald" : "rose"}>{l.stock} units</Badge>
                                </td>
                                <td className="text-slate-600">{l.deliveryDays} days</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
