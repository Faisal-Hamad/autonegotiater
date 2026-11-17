"use client";
import Link from "next/link";
import { realMode } from "@/lib/real-api";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Product } from "@/lib/api";
import { useDemo } from "./demo-provider";
import { AgreementLinks } from "./agreement-links";
import { useCompetitiveWorkspace, useCompetitive } from "./competitive-provider";
import { Empty, BackendPending } from "./ui";
import { money } from "@/lib/demo-model";
import { modeLabels, rankedOffers, requirementsFor, sellerStatusLabels, validateRequirements, type NegotiationMode, type Requirements, type SellerView } from "@/lib/competitive";
import { DesignIcon, ProductIllustration, StoreMark } from "./approved-visuals";
import { useLanguage } from "@/lib/i18n";

const deliveryLabel = (days: number | undefined, lang: string) =>
    days && days > 0 ? (lang === "ar" ? `خلال ${days} أيام` : `${days} days`) : lang === "ar" ? "غير محدد" : "Not configured";

function Step({ number, title, children }: { number: number; title: string; children?: React.ReactNode }) {
    return (
        <div className="an-section-heading">
            <h2>
                <span className="an-step">{number}</span>
                {title}
            </h2>
            <div className="an-heading-actions">{children}</div>
        </div>
    );
}

function Conversation({ seller, running }: { seller: SellerView; running: boolean }) {
    const { lang } = useLanguage();
    const log = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (log.current) log.current.scrollTop = log.current.scrollHeight;
    }, [seller.history.length]);

    const agentLabel = (agent: string, sellerName: string) => {
        if (lang !== "ar") {
            return agent === "Seller" ? `Seller decision (${sellerName})` : agent === "Seller Agent" ? `Seller Agent (${sellerName})` : agent;
        }
        if (agent === "Buyer Agent") return "وكيل المشتري (أو عرض المشتري)";
        if (agent === "Seller") return `قرار البائع (${sellerName})`;
        if (agent === "Seller Agent") return `وكيل البائع (${sellerName})`;
        if (agent === "Market update") return "تحديث تنافسي من السوق";
        return "النظام";
    };

    return (
        <div ref={log} className="an-messages" role="log" aria-label={`${seller.name} messages`} aria-live="polite" aria-relevant="additions" tabIndex={0}>
            {!seller.history.length && (
                <div className="an-empty-chat">
                    <DesignIcon name="bolt" />
                    <h3>{seller.status === "excluded" ? (lang === "ar" ? "البائع مستبعد" : "Seller excluded") : lang === "ar" ? "جاهز للتفاوض" : "Ready to negotiate"}</h3>
                    <p>
                        {seller.status === "excluded"
                            ? seller.reason
                            : lang === "ar"
                            ? "ابدأ الجلسة لمتابعة تبادل العروض بين المشتري والبائع."
                            : "Start the session to watch the Buyer Agent and Seller Agent exchange offers."}
                    </p>
                </div>
            )}
            {seller.history.map((m, i) => {
                const isSeller = m.agent === "Seller Agent" || m.agent === "Seller";
                const text = lang === "ar" && m.explanation_ar ? m.explanation_ar : m.explanation;
                return (
                    <div className={`an-message ${m.agent === "Buyer Agent" ? "an-buyer" : isSeller ? "an-seller" : "an-market"}`} key={`${m.round}-${i}`}>
                        <span className="an-agent-avatar">{m.agent === "Buyer Agent" ? "B" : isSeller ? "S" : m.agent === "System" ? "!" : "↗"}</span>
                        <div className="an-bubble">
                            <strong>{agentLabel(m.agent, seller.name)}</strong>
                            <p>
                                {m.price !== undefined && <b>{money(m.price)} / {lang === "ar" ? "وحدة" : "unit"} · </b>}
                                {text}
                            </p>
                        </div>
                        <div className="an-message-meta">
                            #{String(i + 1).padStart(2, "0")}
                            <span>{lang === "ar" ? `الجولة ${m.round}` : `Round ${m.round}`}</span>
                        </div>
                    </div>
                );
            })}
            {running && seller.participates && seller.status === "awaiting_seller" && (
                <div className="an-waiting-note" role="status">
                    <DesignIcon name="info" />
                    {lang === "ar"
                        ? "تم إرسال العرض للبائع، وبانتظار رده أو قراره (قبول / رفض / عرض مقابل)."
                        : "The Buyer Agent reached your maximum price (or Seller is in manual Nil mode). This Seller was notified and must respond."}
                </div>
            )}
            {running && seller.participates && ["ready", "negotiating"].includes(seller.status) && (
                <div className="an-typing">
                    <DesignIcon name="bolt" />
                    <div>
                        <strong>{lang === "ar" ? "التفاوض جارٍ…" : "Negotiation in progress…"}</strong>
                        <p>{lang === "ar" ? "الوكلاء يراجعون العرض القادم." : "Agents are considering the next offer."}</p>
                    </div>
                    <span>● ● ●</span>
                </div>
            )}
        </div>
    );
}

export function CompetitiveSetup({ product, singleListing = false }: { product: Product; singleListing?: boolean }) {
    return <CompetitiveExperience key={`${product.id}:${singleListing ? "1to1" : "multi"}`} product={product} setup singleListing={singleListing} />;
}

export function CompetitiveNegotiation({ productId, attemptId }: { productId: number; attemptId?: string }) {
    const { enabled, user, state } = useDemo();
    const { session } = useCompetitive(productId, attemptId);
    const workspace = useCompetitiveWorkspace();
    if (!enabled) return <BackendPending title="Competitive negotiation is available in local Mock Data mode only" />;
    const product = attemptId ? workspace.records.find(r => r.id === attemptId)?.product : state.products.find(p => p.id === productId);
    if (!product) return <Empty title="Product unavailable" description="Choose a product from the marketplace." href="/products" label="Browse Products" />;
    if (user.role !== "buyer") return <Empty title="Buyer sign-in required" description="Sign in as the owning Buyer to view your negotiation." href="/products" label="Browse Products" />;
    if (!session) return <Empty title="Ready to negotiate" description="Set your requirements on the product details page before starting." href={`/products/${productId}`} label="Open product details" />;
    return <CompetitiveExperience key={`${user.id}:${productId}:${attemptId ?? "latest"}`} product={product} attemptId={attemptId} />;
}

function CompetitiveExperience({ product, attemptId, setup = false, singleListing = false }: { product: Product; attemptId?: string; setup?: boolean; singleListing?: boolean }) {
    const { user } = useDemo();
    const { lang, dir } = useLanguage();
    const { session: latestSession, start, advance, approve, restart, manualOffer } = useCompetitive(product.id, attemptId);
    const [picked, setPicked] = useState<number[] | undefined>(() => (singleListing ? [product.id] : undefined));

    useEffect(() => {
        if (singleListing) {
            setPicked([product.id]);
            return;
        }
        const params = new URLSearchParams(window.location.search);
        if (params.get("oneToOne") === "1") {
            setPicked([product.id]);
            return;
        }
        const ids = [...new Set((params.get("select") ?? "").split(",").map(Number).filter(n => Number.isInteger(n) && n > 0))];
        if (ids.length >= 2 && ids.length <= 5 && ids.includes(product.id)) setPicked(ids);
    }, [product.id, singleListing]);

    const sameSelection = (ids?: number[] | null) => [...(ids ?? [])].sort().join(",") === [...(picked ?? [])].sort().join(",");
    const session =
        setup &&
        latestSession &&
        (["approved", "rejected", "cancelled"].includes(latestSession.phase) ||
            !sameSelection((latestSession as { selectedProductIds?: number[] | null }).selectedProductIds))
            ? null
            : latestSession;

    const isOneToOne = singleListing || picked?.length === 1 || (session as { matchingPolicy?: string } | null)?.matchingPolicy === "single-listing";
    const workspace = useCompetitiveWorkspace();
    const router = useRouter();
    const [draft, setDraft] = useState<Requirements>(() => requirementsFor(product));
    const [editing, setEditing] = useState(false), [error, setError] = useState("");
    const [pendingDecision, setPendingDecision] = useState<"cancel" | "reject">("cancel");
    const decisionDialog = useRef<HTMLDialogElement>(null);

    const [auto, setAutoLocal] = useState(() => (latestSession?.requirements.mode ?? "semi_automated") === "automated" && !latestSession?.paused);
    const [activeId, setActiveId] = useState(""), [selected, setSelected] = useState("");
    const [sort, setSort] = useState("recommended"), [image, setImage] = useState(0), [imageFailed, setImageFailed] = useState(false);
    const [manualPrice, setManualPrice] = useState<number>(() => requirementsFor(product).targetPrice);
    const [manualNote, setManualNote] = useState(""), [sendingManual, setSendingManual] = useState(false);

    const conversation = useRef<HTMLElement>(null), dialog = useRef<HTMLDialogElement>(null), approvalDialog = useRef<HTMLDialogElement>(null);

    function setAuto(value: boolean) {
        setAutoLocal(value);
        if (session) workspace.decision(session.attemptId, value ? "resume" : "pause");
    }
    useEffect(() => {
        if (session?.phase === "running" && session.round > 0 && session.requirements.mode !== "automated") workspace.decision(session.attemptId, "pause");
    }, [session?.attemptId]);

    const playbackRef = useRef({ session, workspace });
    playbackRef.current = { session, workspace };
    useEffect(
        () => () => {
            const current = playbackRef.current;
            if (current.session?.phase === "running" && current.session.round > 0) current.workspace.decision(current.session.attemptId, "pause");
        },
        [session?.attemptId]
    );

    const running = session?.phase === "running";
    const mode: NegotiationMode = (session?.requirements ?? draft).mode ?? "semi_automated";
    const canAdvance = !!running && mode !== "nil" && !!session?.sellers.some(s => s.participates && (s.status === "ready" || s.status === "negotiating"));
    const waitingSellers = session?.sellers.filter(s => s.status === "awaiting_seller") ?? [];

    useEffect(() => {
        if (!canAdvance || !auto || user.role !== "buyer") return;
        const timer = setTimeout(advance, 650);
        return () => clearTimeout(timer);
    }, [canAdvance, auto, session, advance, user.role]);

    const [buyQty, setBuyQty] = useState(1), [buying, setBuying] = useState(false);
    const buyDialog = useRef<HTMLDialogElement>(null);

    async function buyNow() {
        setBuying(true);
        setError("");
        try {
            await workspace.buyNow(product.id, buyQty);
            buyDialog.current?.close();
            router.push("/dashboard/buyer/deals");
        } catch (e) {
            setError(e instanceof Error ? e.message : "Unable to complete the purchase.");
            buyDialog.current?.close();
        } finally {
            setBuying(false);
        }
    }

    const requirements = session?.requirements ?? draft;
    const sellers = session?.sellers ?? workspace.publicListings(product, requirements, picked);
    const active = sellers.find(s => s.id === activeId) ?? sellers.find(s => s.participates) ?? sellers[0];
    const finished = !!session && !running;
    const offers = session && finished ? rankedOffers(session) : [];
    const best = offers[0];
    const comparison = [...offers, ...sellers.filter(s => !offers.some(o => o.id === s.id))];
    const sorted = [...sellers].sort((a, b) =>
        sort === "price" ? a.startingPrice - b.startingPrice : sort === "delivery" ? a.deliveryDays - b.deliveryDays : Number(b.participates) - Number(a.participates)
    );
    const eligible = sellers.filter(s => s.participates);
    const publicPrices = sellers.filter(s => s.stock > 0).map(s => s.startingPrice);
    const received = active?.history.filter(m => m.agent === "Market update").at(-1);
    const approved = sellers.find(s => s.id === session?.approvedSellerId);

    async function begin() {
        const invalid = validateRequirements(draft);
        setError(invalid ?? "");
        if (invalid) {
            setEditing(true);
            return;
        }
        try {
            await start(product.id, draft, picked);
            if (draft.mode === "automated") setAutoLocal(true);
            router.push(`/products/${product.id}/competitive`);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Unable to start negotiation.");
        }
    }

    async function submitManualOffer(offerAction: "offer" | "accept" = "offer") {
        if (!session || sendingManual) return;
        setSendingManual(true);
        setError("");
        try {
            await manualOffer(product.id, manualPrice, manualNote, isOneToOne ? active?.id : undefined, offerAction, session.attemptId);
            setManualNote("");
        } catch (e) {
            setError(e instanceof Error ? e.message : "Unable to send manual offer.");
        } finally {
            setSendingManual(false);
        }
    }

    function apply(e: FormEvent) {
        e.preventDefault();
        const invalid = validateRequirements(draft);
        setError(invalid ?? "");
        if (!invalid) setEditing(false);
    }

    function reset() {
        if (!window.confirm("Start another attempt? Previous records and Agreements are retained. Unfinished attempts must first be cancelled.")) return;
        setAuto(false);
        setSelected("");
        setActiveId("");
        restart();
        router.push(`/products/${product.id}`);
    }

    function details(id: string) {
        setActiveId(id);
        conversation.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    const modeDescriptions: Record<NegotiationMode, { title: string; desc: string }> = {
        nil: {
            title: lang === "ar" ? "يدوي بالكامل (Nil / Manual)" : "Nil (Manual)",
            desc:
                lang === "ar"
                    ? "تفاوض بشري مباشر بدون تدخل الوكيل الذكي؛ تكتب السعر وترسل العرض بنفسك في كل جولة."
                    : "100% human bargaining; you manually enter and send your offer price each round without AI agent intervention.",
        },
        semi_automated: {
            title: lang === "ar" ? "شبه آلي (Semi-automated)" : "Semi-automated",
            desc:
                lang === "ar"
                    ? "وكيلك الذكي يدير الجولات تدريجياً، وعند الوصول للحد الأعلى أو الاتفاق يرجع القرار النهائي لك وللبائع."
                    : "When the Buyer Agent reaches your maximum price, the Seller is notified and decides to accept or reject.",
        },
        automated: {
            title: lang === "ar" ? "آلي بالكامل (Automated)" : "Automated",
            desc:
                lang === "ar"
                    ? "الوكلاء يكملون الجولات تلقائياً ضمن حدودك السرية بدون أي تدخل بشري."
                    : "Agents finish the negotiation alone; offers outside the limits end without agreement.",
        },
    };

    const sellerModeBadge = (sm?: NegotiationMode) => {
        const m = sm ?? "semi_automated";
        if (lang === "ar") {
            return m === "nil" ? "بائع يدوي (Nil)" : m === "automated" ? "بائع آلي (Auto)" : "بائع شبه آلي (Semi)";
        }
        return m === "nil" ? "Seller: Nil (Manual)" : m === "automated" ? "Seller: Auto" : "Seller: Semi";
    };

    return (
        <div className="an-experience" lang={lang} dir={dir}>
            {session && (
                <div className="an-session-actions">
                    <Link className="an-text-link" href="/dashboard/buyer/negotiations">
                        ← {lang === "ar" ? "كل جلسات التفاوض" : "All Negotiation Sessions"}
                    </Link>
                    <span className="an-demo-label">
                        {session.attemptId} · {isOneToOne ? (lang === "ar" ? "تفاوض مباشر (١ إلى ١)" : "One-to-One Deal") : lang === "ar" ? "تفاوض متعدد البائعين" : "Multi-Seller"} ·{" "}
                        {session.phase === "approved" ? "Agreement recorded" : session.phase}
                    </span>
                    {session.phase === "review" && (
                        <button
                            className="an-outline"
                            onClick={() => {
                                setPendingDecision("reject");
                                decisionDialog.current?.showModal();
                            }}
                        >
                            {lang === "ar" ? "رفض كل العروض" : "Reject all offers"}
                        </button>
                    )}
                    {["running", "review"].includes(session.phase) && (
                        <button
                            className="an-outline"
                            onClick={() => {
                                setPendingDecision("cancel");
                                decisionDialog.current?.showModal();
                            }}
                        >
                            {lang === "ar" ? "إلغاء التفاوض" : "Cancel negotiation"}
                        </button>
                    )}
                    <AgreementLinks sessionId={session.attemptId} />
                </div>
            )}

            <div className="an-breadcrumb">
                <Link href="/products">← {lang === "ar" ? "العودة للمتجر" : "Marketplace"}</Link>
                <span className="an-demo-label">
                    {isOneToOne
                        ? lang === "ar"
                            ? "جلسة تفاوض مباشر (مشتري واحد ↔ بائع واحد)"
                            : "Direct One-to-One Negotiation (1 Buyer ↔ 1 Seller)"
                        : lang === "ar"
                        ? "جلسة تفاوض محفوظة على السيرفر"
                        : "Server-persisted negotiation"}
                </span>
            </div>

            <section className="an-panel an-overview" aria-label="Product overview">
                <div className="an-gallery">
                    <div className="an-product-art">
                        {product.image_url && !imageFailed ? (
                            <img src={product.image_url} alt={product.name} onError={() => setImageFailed(true)} />
                        ) : (
                            <ProductIllustration product={product} view={image} />
                        )}
                    </div>
                    <div className="an-thumbnails">
                        {[0, 1, 2, 3, 4].map(n => (
                            <button key={n} aria-label={`Product illustration view ${n + 1}`} aria-pressed={image === n} onClick={() => setImage(n)}>
                                <ProductIllustration product={product} view={n % 3} />
                            </button>
                        ))}
                    </div>
                    <span className="an-art-caption">{product.image_url && !imageFailed ? "Product image" : "Illustration · product photo unavailable"}</span>
                </div>

                <div className="an-product-info">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="an-category">{product.category}</span>
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {isOneToOne ? (lang === "ar" ? "وضع ١ إلى ١ (بائع واحد)" : "One-to-One Mode (Single Seller)") : lang === "ar" ? "وضع متعدد البائعين (١ إلى عدة بائعين)" : "Multi-Seller Mode"}
                        </span>
                    </div>
                    <h1>{product.name}</h1>
                    <p>{product.description || "No description provided."}</p>
                    <div className="an-product-facts">
                        <span>
                            <DesignIcon name="box" />
                            {product.stock_quantity} {lang === "ar" ? "وحدة متوفرة" : "units in listing"}
                        </span>
                        <span>
                            <DesignIcon name="shield" />
                            {isOneToOne ? (lang === "ar" ? "تفاوض مباشر مع صاحب العرض" : "Direct seller negotiation") : realMode ? "Model and storage matching" : "Exact product matching"}
                        </span>
                        <span>
                            <DesignIcon name="tag" />
                            {lang === "ar" ? "الأسعار بالريال السعودي" : "Prices in SAR"}
                        </span>
                        <span>
                            <DesignIcon name="bolt" />
                            {lang === "ar" ? "يدعم Nil و Semi و Auto" : "Supports Nil, Semi & Auto"}
                        </span>
                    </div>
                    <div className="an-buy-now">
                        {user.role === "buyer" && realMode && (
                            <button
                                className="an-outline"
                                disabled={product.stock_quantity < 1}
                                onClick={() => {
                                    setBuyQty(1);
                                    buyDialog.current?.showModal();
                                }}
                            >
                                Buy now at {money(product.base_price)} · no negotiation
                            </button>
                        )}
                        {!session && (
                            isOneToOne ? (
                                <Link href={`/products/${product.id}`} className="an-text-link">
                                    {lang === "ar" ? "التبديل إلى تفاوض متعدد البائعين (One-to-Many) ←" : "Switch to Multi-Seller negotiation →"}
                                </Link>
                            ) : (
                                <Link href={`/products/${product.id}/negotiate`} className="an-text-link">
                                    {lang === "ar" ? "تفاوض مباشر مع هذا البائع فقط (One-to-One) ←" : "One-to-one negotiation →"}
                                </Link>
                            )
                        )}
                    </div>
                </div>

                <div className="an-reference">
                    <span>
                        {lang === "ar" ? "السعر المرجعي المعروض" : "Reference listing price"} <DesignIcon name="info" />
                    </span>
                    <strong>{money(product.base_price)}</strong>
                    <svg viewBox="0 0 210 85" aria-label="Public Seller starting prices" role="img">
                        <defs>
                            <linearGradient id={`an-chart-${product.id}`} x1="0" y1="0" x2="0" y2="1">
                                <stop stopColor="#17798f" stopOpacity=".22" />
                                <stop offset="1" stopColor="#17798f" stopOpacity="0" />
                            </linearGradient>
                        </defs>
                        <path
                            d={`M10,75 ${publicPrices
                                .map((p, i) => `L${10 + (i * 190) / Math.max(publicPrices.length - 1, 1)},${65 - ((p - Math.min(...publicPrices)) / Math.max(Math.max(...publicPrices) - Math.min(...publicPrices), 1)) * 45}`)
                                .join(" ")} L200,85 L10,85Z`}
                            fill={`url(#an-chart-${product.id})`}
                        />
                        <polyline
                            points={publicPrices
                                .map((p, i) => `${10 + (i * 190) / Math.max(publicPrices.length - 1, 1)},${65 - ((p - Math.min(...publicPrices)) / Math.max(Math.max(...publicPrices) - Math.min(...publicPrices), 1)) * 45}`)
                                .join(" ")}
                            fill="none"
                            stroke="#156e82"
                            strokeWidth="2"
                        />
                        {publicPrices.map((p, i) => (
                            <circle
                                key={i}
                                cx={10 + (i * 190) / Math.max(publicPrices.length - 1, 1)}
                                cy={65 - ((p - Math.min(...publicPrices)) / Math.max(Math.max(...publicPrices) - Math.min(...publicPrices), 1)) * 45}
                                r="3"
                                fill="white"
                                stroke="#156e82"
                                strokeWidth="2"
                            />
                        ))}
                    </svg>
                    <small>{lang === "ar" ? "أسعار البائعين المعلنة" : "Public Seller prices"}</small>
                    <p>{publicPrices.length ? `${money(Math.min(...publicPrices))} – ${money(Math.max(...publicPrices))}` : "No Seller quotes"}</p>
                </div>

                <div className="an-basic-facts">
                    {[
                        ["truck", lang === "ar" ? "مدة التوصيل" : "Delivery estimates", sellers.some(s => s.deliveryDays > 0) ? `${Math.min(...sellers.filter(s => s.deliveryDays > 0).map(s => s.deliveryDays))}–${Math.max(...sellers.filter(s => s.deliveryDays > 0).map(s => s.deliveryDays))} days` : "Not configured"],
                        ["shield", lang === "ar" ? "حالة المنتج" : "Condition", lang === "ar" ? "موضحة في الوصف" : "See product description"],
                        ["info", lang === "ar" ? "نوع الجلسة" : "Session Type", isOneToOne ? (lang === "ar" ? "مشتري واحد ↔ بائع واحد" : "One-to-One (1 Seller)") : lang === "ar" ? "تنافسي متعدد البائعين" : "Multi-Seller Competitive"],
                        ["box", lang === "ar" ? "العروض المتاحة" : "Availability", `${sellers.length} ${lang === "ar" ? "عرض بائع" : "Seller listings"}`],
                    ].map(([icon, label, value]) => (
                        <div key={label}>
                            <DesignIcon name={icon} />
                            <span>
                                {label}
                                <strong>{value}</strong>
                            </span>
                        </div>
                    ))}
                </div>
            </section>

            <section className="an-panel" aria-label="Purchase requirements">
                <Step number={1} title={lang === "ar" ? "حدد متطلبات الشراء ونمط التفاوض" : "Set Your Purchase Requirements"}>
                    <span className={`an-status ${session ? "an-agreed" : ""}`}>{session ? (lang === "ar" ? "تم التأكيد" : "Confirmed") : lang === "ar" ? "جاهز" : "Ready"}</span>
                    <button className="an-outline" disabled={!!session || user.role !== "buyer"} onClick={() => setEditing(!editing)}>
                        <DesignIcon name="edit" />
                        {lang === "ar" ? "تعديل الحدود" : "Edit"}
                    </button>
                </Step>
                <div className="an-requirements">
                    {[
                        ["box", lang === "ar" ? "الكمية" : "Quantity", `${requirements.quantity} ${requirements.quantity === 1 ? "unit" : "units"}`, ""],
                        ["coins", lang === "ar" ? "السعر المستهدف" : "Target Price", money(requirements.targetPrice), lang === "ar" ? "لكل وحدة" : "per unit"],
                        ["tag", lang === "ar" ? "أعلى ميزانية (سري)" : "Maximum Price", money(requirements.maximumPrice), lang === "ar" ? "سري للمشتري فقط" : "per unit · private to Buyer"],
                        ["truck", lang === "ar" ? "مهلة التوصيل" : "Delivery Time", `Within ${requirements.deliveryDays} days`, ""],
                    ].map(([icon, label, value, note]) => (
                        <div key={label} className="an-requirement">
                            <span className="an-icon-disc">
                                <DesignIcon name={icon} />
                            </span>
                            <div>
                                <span>{label}</span>
                                <strong>{value}</strong>
                                <small>{note}</small>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="an-mode" role="radiogroup" aria-label="Negotiation mode">
                    {(["nil", "semi_automated", "automated"] as const).map(m => (
                        <label key={m}>
                            <input
                                type="radio"
                                name="negotiation-mode"
                                checked={mode === m}
                                disabled={!!session || user.role !== "buyer"}
                                onChange={() => setDraft(r => ({ ...r, mode: m }))}
                            />
                            <span>
                                <strong>{modeDescriptions[m].title}</strong>
                                <small>{modeDescriptions[m].desc}</small>
                            </span>
                        </label>
                    ))}
                </div>

                {editing && (
                    <form onSubmit={apply} className="an-edit-form">
                        {(
                            [
                                ["quantity", lang === "ar" ? "الكمية المطلوبة" : "Quantity (units)", 1, 10000, 1],
                                ["targetPrice", lang === "ar" ? "السعر المستهدف للوحدة (SAR)" : "Target price per unit (SAR)", 0.01, 1000000, 0.01],
                                ["maximumPrice", lang === "ar" ? "الحد الأعلى للميزانية (SAR)" : "Maximum price per unit (SAR)", 0.01, 1000000, 0.01],
                                ["deliveryDays", lang === "ar" ? "التوصيل خلال (أيام)" : "Required delivery within (days)", 1, 365, 1],
                                ["maxRounds", lang === "ar" ? "أقصى عدد جولات" : "Maximum negotiation rounds", 1, 12, 1],
                            ] as const
                        ).map(([key, label, min, max, step]) => (
                            <label key={key}>
                                {label}
                                <input type="number" min={min} max={max} step={step} required value={draft[key]} onChange={e => setDraft(r => ({ ...r, [key]: Number(e.target.value) }))} />
                            </label>
                        ))}
                        <button className="an-primary" type="submit">
                            {lang === "ar" ? "حفظ المتطلبات" : "Apply requirements"}
                        </button>
                    </form>
                )}
                {error && (
                    <p role="alert" className="an-error">
                        {error}
                    </p>
                )}
            </section>

            <section className="an-panel" aria-label="Participating Sellers">
                <Step number={2} title={isOneToOne ? (lang === "ar" ? "البائع المختار للتفاوض المباشر (١ إلى ١)" : "Selected Seller (One-to-One)") : lang === "ar" ? "البائعون المشاركون" : "Available Sellers"}>
                    {!isOneToOne && (
                        <label className="an-sort">
                            {lang === "ar" ? "ترتيب حسب" : "Sort by"}
                            <select aria-label="Sort Sellers" value={sort} onChange={e => setSort(e.target.value)}>
                                <option value="recommended">{lang === "ar" ? "الموصى به" : "Recommended"}</option>
                                <option value="price">{lang === "ar" ? "السعر الافتتاحي" : "Starting price"}</option>
                                <option value="delivery">{lang === "ar" ? "مدة التوصيل" : "Delivery time"}</option>
                            </select>
                        </label>
                    )}
                </Step>

                <p className="an-section-note">
                    {isOneToOne
                        ? lang === "ar"
                            ? "تفاوض مباشر واحد لواحد مع هذا البائع فقط."
                            : "Direct One-to-One bargaining with this single Seller listing."
                        : `${eligible.length} Sellers meet your quantity and delivery requirements. Select a Seller to view its conversation.`}
                </p>

                {!session && !isOneToOne && (
                    <p className="an-section-note">
                        {picked && picked.length >= 2 ? (
                            <>
                                You chose these {picked.length} listings in the marketplace.{" "}
                                <a className="an-text-link" href={`/products?select=${picked.join(",")}`}>
                                    Change selection
                                </a>{" "}
                                ·{" "}
                                <a className="an-text-link" href={`/products/${product.id}`}>
                                    Use all sellers of this model instead
                                </a>
                            </>
                        ) : (
                            <>
                                All sellers of the same model are included. To choose 2 to 5 listings yourself, use{" "}
                                <a className="an-text-link" href={`/products?select=${product.id}`}>
                                    + Multi-seller negotiation
                                </a>{" "}
                                in the marketplace.
                            </>
                        )}
                    </p>
                )}

                <div className="an-sellers">
                    {sorted.map(s => (
                        <button
                            className={`an-seller-card ${active?.id === s.id ? "an-selected" : ""} ${!s.participates ? "an-ineligible" : ""}`}
                            key={s.id}
                            aria-label={`View ${s.name} conversation`}
                            aria-pressed={active?.id === s.id}
                            onClick={() => setActiveId(s.id)}
                        >
                            <StoreMark name={s.name} index={sellers.findIndex(v => v.id === s.id)} />
                            <strong>{s.name}</strong>
                            <small className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-semibold">{sellerModeBadge(s.sellerMode)}</small>
                            {s.productName && <span className="text-xs font-semibold">{s.productName}</span>}
                            {s.description && <span className="text-xs text-slate-500 line-clamp-2">{s.description}</span>}
                            <div className="an-seller-price">
                                {money(s.startingPrice)}
                                <small> / unit</small>
                            </div>
                            <span>
                                <DesignIcon name="box" />
                                {s.stock} units in stock
                            </span>
                            <span>
                                <DesignIcon name="truck" />
                                {s.deliveryDays > 0 ? `${s.deliveryDays}-day delivery` : "Delivery not configured"}
                            </span>
                            <span className={`an-status an-${s.status}`}>{sellerStatusLabels[s.status]}</span>
                            {s.currentPrice !== undefined && (
                                <b className="an-latest-price">
                                    {s.status === "agreed" ? "Agent Agreement" : "Current offer"}: {money(s.agreedPrice ?? s.currentPrice)}
                                </b>
                            )}
                            {!s.participates && <small className="an-exclusion">{s.reason}</small>}
                        </button>
                    ))}
                </div>

                <div className="an-session-actions">
                    {!session ? (
                        user.role === "buyer" ? (
                            <>
                                <span>
                                    {isOneToOne
                                        ? lang === "ar"
                                            ? "ابدأ جلسة التفاوض المباشر مع هذا البائع."
                                            : "Start direct 1-to-1 negotiation with this seller."
                                        : lang === "ar"
                                        ? "تبدأ الجلسة مع جميع البائعين المؤهلين في نفس الوقت."
                                        : "All eligible Seller Agents start together. No purchase is made."}
                                </span>
                                <div className="flex flex-wrap gap-2">
                                    <button className="an-primary" disabled={!eligible.length || editing} onClick={begin}>
                                        Start Multi-Seller Negotiation
                                    </button>
                                </div>
                            </>
                        ) : (
                            <p>{lang === "ar" ? "سجل الدخول كمشتري لبدء التفاوض." : "Sign in as a Buyer to start a negotiation."}</p>
                        )
                    ) : (
                        <>
                            <span>
                                {session.stopReason ??
                                    (mode === "nil"
                                        ? lang === "ar"
                                            ? "الوضع اليدوي (Nil) مفعل: أرسل عرضك اليدوي من الصندوق بالأسفل."
                                            : "Manual (Nil) mode active: submit your offer below."
                                        : auto
                                        ? "Rounds are playing automatically."
                                        : session.round === 0
                                        ? "Press Run round 1: your agent sends its first offer to every seller."
                                        : `Round ${session.round} done. Read each seller's reply in the conversation below, then press Next round.`)}
                            </span>
                            <div>
                                {canAdvance && (
                                    <>
                                        <button className="an-outline" onClick={() => setAuto(!auto)}>
                                            {auto ? "Pause" : "Play all rounds"}
                                        </button>
                                        <button
                                            className="an-primary"
                                            disabled={auto}
                                            onClick={() => {
                                                setAutoLocal(false);
                                                advance();
                                            }}
                                        >
                                            {session.round === 0 ? "Run round 1 →" : `Next round (${session.round + 1} of ${requirements.maxRounds}) →`}
                                        </button>
                                    </>
                                )}
                                <button className="an-outline" onClick={reset}>
                                    <DesignIcon name="refresh" />
                                    {lang === "ar" ? "محاولة جديدة" : "New attempt"}
                                </button>
                            </div>
                        </>
                    )}
                </div>

                {waitingSellers.length > 0 && (
                    <p className="an-waiting-note" role="status">
                        <DesignIcon name="info" />
                        Waiting for {waitingSellers.map(s => s.name).join(", ")} to accept or reject your final offer of {money(waitingSellers[0].pendingOffer ?? requirements.maximumPrice)} / unit. The Seller was notified.
                    </p>
                )}
            </section>

            {running && mode === "nil" && user.role === "buyer" && (
                <section className="an-panel border-2 border-indigo-500/30 bg-indigo-50/20" aria-label="Manual buyer offer controls">
                    <div className="an-section-heading">
                        <h2>
                            <DesignIcon name="edit" />
                            {lang === "ar" ? "إرسال عرض يدوي مباشر (وضع المشتري: Nil)" : "Manual Buyer Offer Controls (Nil Mode)"}
                        </h2>
                        <span className="an-status an-negotiating">{lang === "ar" ? "بشري بالكامل" : "100% Human Control"}</span>
                    </div>
                    <p className="text-xs text-slate-600 mb-3">
                        {lang === "ar"
                            ? `أدخل سعرك المقترح للوحدة (بحد أقصى ميزانيتك ${money(requirements.maximumPrice)}) وملاحظة اختيارية للبائع:`
                            : `Enter your offer price per unit (up to your maximum budget of ${money(requirements.maximumPrice)}) and an optional message:`}
                    </p>
                    <div className="grid sm:grid-cols-3 gap-3 items-end">
                        <label className="text-xs font-semibold">
                            {lang === "ar" ? "سعر العرض للوحدة (SAR)" : "Your Offer Price (SAR / unit)"}
                            <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                max={requirements.maximumPrice}
                                value={manualPrice}
                                onChange={e => setManualPrice(Number(e.target.value))}
                            />
                        </label>
                        <label className="text-xs font-semibold sm:col-span-2">
                            {lang === "ar" ? "رسالة أو ملاحظة للبائع (اختياري)" : "Message / Note to Seller (optional)"}
                            <input
                                type="text"
                                maxLength={300}
                                placeholder={lang === "ar" ? "مثال: جاد في الشراء اليوم لو السعر مناسب…" : "e.g., Ready to close the deal today if you match this price…"}
                                value={manualNote}
                                onChange={e => setManualNote(e.target.value)}
                            />
                        </label>
                    </div>
                    <div className="flex flex-wrap gap-2.5 mt-4">
                        <button className="an-primary" disabled={sendingManual} onClick={() => submitManualOffer("offer")}>
                            {sendingManual ? "Sending…" : lang === "ar" ? `إرسال العرض (${money(manualPrice)})` : `Send Manual Offer (${money(manualPrice)})`}
                        </button>
                        {active?.currentPrice !== undefined && active.currentPrice <= requirements.maximumPrice && (
                            <button className="an-outline" disabled={sendingManual} onClick={() => submitManualOffer("accept")}>
                                {lang === "ar" ? `قبول عرض البائع الحالي (${money(active.currentPrice)})` : `Accept Seller's Current Price (${money(active.currentPrice)})`}
                            </button>
                        )}
                    </div>
                </section>
            )}

            <section className="an-panel" ref={conversation} aria-label="Live negotiation">
                <Step number={3} title={`${lang === "ar" ? "المحادثة الحية" : "Live Negotiation"}${active ? `: ${active.name}` : ""}`}>
                    <span className={`an-status ${running ? "an-negotiating" : finished ? "an-agreed" : ""}`}>
                        {running ? (lang === "ar" ? "● قيد التفاوض" : "● In Progress") : finished ? (lang === "ar" ? "مكتمل" : "Completed") : lang === "ar" ? "جاهز" : "Ready"}
                    </span>
                    <span className="an-progress-label">
                        Round {session?.round ?? 0} of {requirements.maxRounds}
                    </span>
                    <progress max={requirements.maxRounds} value={session?.round ?? 0} />
                    <span className="an-auto">
                        <DesignIcon name="bolt" />
                        {modeLabels[mode]} · {canAdvance && auto ? "Auto play" : canAdvance ? "Paused" : waitingSellers.length ? "Waiting for Seller" : "Finished"}
                    </span>
                </Step>

                <div className="an-live-grid">
                    <div className="an-chat">
                        <div className="an-chat-toolbar">
                            <label>
                                {lang === "ar" ? "المحادثة" : "Conversation"}
                                <select aria-label="Active Seller conversation" value={active?.id ?? ""} onChange={e => setActiveId(e.target.value)}>
                                    {sellers.map(s => (
                                        <option key={s.id} value={s.id}>
                                            {s.name} ({sellerModeBadge(s.sellerMode)})
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <span>{lang === "ar" ? "المشتري ↔ البائع" : "Buyer Agent ↔ Seller Agent"}</span>
                        </div>
                        {active ? <Conversation key={active.id} seller={active} running={!!running && auto} /> : <p>No Sellers available.</p>}
                        <ol className="an-timeline" aria-label="Round timeline">
                            {Array.from({ length: requirements.maxRounds }, (_, i) => i + 1).map(n => (
                                <li
                                    key={n}
                                    className={n <= (session?.completedRounds ?? 0) ? "complete" : n === session?.round ? "current" : ""}
                                    aria-current={n === session?.round ? "step" : undefined}
                                >
                                    {lang === "ar" ? `جولة ${n}` : `Round ${n}`}
                                </li>
                            ))}
                        </ol>
                    </div>

                    <aside className="an-live-aside">
                        <div className="an-side-card">
                            <h3>
                                {lang === "ar" ? "العرض الحالي" : "Current Offer"} <small>({active?.name ?? "Seller"})</small>
                            </h3>
                            {active?.productName && <p className="text-sm font-semibold mt-3">{active.productName}</p>}
                            {active?.description && <p className="text-xs text-slate-500 mt-2">{active.description}</p>}
                            <div className="an-offer">
                                <span className="an-icon-disc">
                                    <DesignIcon name="tag" />
                                </span>
                                <div>
                                    <strong>
                                        {active?.currentPrice === undefined ? (lang === "ar" ? "بانتظار العرض" : "Awaiting offer") : money(active.currentPrice)}
                                        <small> / unit</small>
                                    </strong>
                                    <p>
                                        {active?.currentPrice !== undefined
                                            ? `${(((active.startingPrice - active.currentPrice) / active.startingPrice) * 100).toFixed(1)}% below opening price`
                                            : lang === "ar"
                                            ? "لم يصل عرض مقابل بعد"
                                            : "No counteroffer received yet"}
                                    </p>
                                </div>
                            </div>
                            <div className="an-offer-facts">
                                <span>
                                    <DesignIcon name="box" />
                                    {lang === "ar" ? "الكمية" : "Quantity"}
                                    <strong>{requirements.quantity} units</strong>
                                </span>
                                <span>
                                    <DesignIcon name="truck" />
                                    {lang === "ar" ? "التوصيل" : "Delivery"}
                                    <strong>{deliveryLabel(active?.deliveryDays, lang)}</strong>
                                </span>
                            </div>
                            <button className="an-primary" disabled={!active?.history.length} onClick={() => dialog.current?.showModal()}>
                                {lang === "ar" ? "عرض المحادثة كاملة" : "View Full Conversation"}
                            </button>
                        </div>

                        {!isOneToOne && (
                            <div className="an-side-card" aria-label="Anonymous competition">
                                <h3>
                                    {lang === "ar" ? "المنافسة السرية" : "Anonymous Competition"} <DesignIcon name="info" />
                                </h3>
                                <div className="an-competition">
                                    <DesignIcon name="trophy" />
                                    <div>
                                        <span>{lang === "ar" ? "أقل عرض منافس مستلم" : "Lowest received competing offer"}</span>
                                        <strong>
                                            {received?.price === undefined ? (lang === "ar" ? "لم يُعلن بعد" : "Not shared yet") : money(received.price)}
                                            <small>{received?.price !== undefined ? " / unit" : ""}</small>
                                        </strong>
                                        <p>{received ? `Round ${received.round} · From another Seller (anonymous)` : "Eligible competing quotes are shared in later rounds."}</p>
                                    </div>
                                </div>
                                <div className="an-competition-note">
                                    <DesignIcon name="trend" />
                                    {lang === "ar" ? "يقوم البائعون بتحسين عروضهم عند وجود عرض منافس أقل." : "Sellers may improve their offers after a competing quote."}
                                </div>
                            </div>
                        )}
                    </aside>
                </div>
            </section>

            <section className="an-panel" aria-label="Final offer comparison">
                <Step number={4} title={lang === "ar" ? "مقارنة العروض واعتماد الصفقة" : "Final Offer Comparison"}>
                    <span className="an-section-note">{finished ? `${offers.length} eligible Agreements` : "Available after negotiation completes"}</span>
                </Step>
                <div className="an-comparison-wrap">
                    <table className="an-comparison">
                        <thead>
                            <tr>
                                {["Select", "Seller", "Product / condition", "Original Price", "Final Negotiated Price", "Savings", "Delivery", "Status", "View details"].map(s => (
                                    <th key={s}>{s}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {comparison.map(s => {
                                const valid = offers.some(o => o.id === s.id);
                                return (
                                    <tr key={s.id} className={best?.id === s.id ? "an-best" : ""}>
                                        <td data-label="Select">
                                            <input
                                                type="radio"
                                                name="preferredSeller"
                                                aria-label={`Select ${s.name}`}
                                                checked={(session?.approvedSellerId ?? selected) === s.id}
                                                disabled={!valid || session?.phase !== "review"}
                                                onChange={() => setSelected(s.id)}
                                            />
                                        </td>
                                        <td data-label="Seller">
                                            <div className="an-table-seller">
                                                <StoreMark name={s.name} index={sellers.findIndex(v => v.id === s.id)} />
                                                <div>
                                                    <strong>{s.name}</strong>
                                                    {best?.id === s.id && <small>Best eligible offer</small>}
                                                </div>
                                            </div>
                                        </td>
                                        <td data-label="Product / condition">
                                            <strong>{s.productName ?? product.name}</strong>
                                            <p className="text-xs text-slate-500 line-clamp-2">{s.description ?? product.description}</p>
                                        </td>
                                        <td data-label="Original Price">{money(s.startingPrice)}</td>
                                        <td data-label="Final Negotiated Price" className={valid ? "an-final-price" : ""}>
                                            {valid ? money(s.agreedPrice!) : finished ? "No Agreement" : "—"}
                                        </td>
                                        <td data-label="Savings">
                                            {valid ? `${(((s.startingPrice - s.agreedPrice!) / s.startingPrice) * 100).toFixed(1)}% (${money(s.startingPrice - s.agreedPrice!)})` : "—"}
                                        </td>
                                        <td data-label="Delivery">{deliveryLabel(s.deliveryDays, lang)}</td>
                                        <td data-label="Status">
                                            <span className={`an-status an-${s.status}`}>{sellerStatusLabels[s.status]}</span>
                                        </td>
                                        <td data-label="View details">
                                            <button className="an-outline" onClick={() => details(s.id)}>
                                                View Details
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {finished && (
                    <p className="an-results-note">
                        {best
                            ? "Agreements are ranked by price, then delivery. The best offer meets quantity and delivery requirements; you may choose any eligible Agreement."
                            : "No eligible Agreements. Restart and adjust your requirements."}
                    </p>
                )}

                <div className="an-approval">
                    <span>
                        {approved
                            ? `Recorded Agreement: ${approved.name} · ${money(approved.agreedPrice!)} / unit. Agreement recorded; no real order or payment.`
                            : "Compare results before approving. Agent Agreements require your final approval."}
                    </span>
                    <button className="an-primary" disabled={session?.phase !== "review" || !offers.some(s => s.id === selected)} onClick={() => approvalDialog.current?.showModal()}>
                        Approve Selected Offer
                    </button>
                </div>
                {approved && (
                    <p className="an-approved-note" role="status">
                        Agreement recorded and available in Agreements and History.
                    </p>
                )}
            </section>

            <p className="an-disclaimer">
                Prices are decided by rules within each party's private limits; Gemini writes the agent messages · Agreements are saved on the server · Payments and shipments are not processed here.
            </p>

            <dialog ref={buyDialog} className="an-dialog">
                <div className="an-section-heading">
                    <h2>Buy Without Negotiation</h2>
                    <button className="an-outline" onClick={() => buyDialog.current?.close()}>
                        Close
                    </button>
                </div>
                <p>
                    You buy <strong>{product.name}</strong> directly at the listed price. No agents and no negotiation rounds are used.
                </p>
                <label className="block mt-4 text-sm">
                    Quantity
                    <input
                        type="number"
                        min={1}
                        max={product.stock_quantity}
                        value={buyQty}
                        onChange={e => setBuyQty(Math.max(1, Math.min(product.stock_quantity, Math.floor(Number(e.target.value) || 1))))}
                    />
                </label>
                <p className="mt-3">
                    Total {money(Number(product.base_price) * buyQty)} · {product.stock_quantity} in stock
                </p>
                <p className="text-xs muted mt-2">The Agreement is recorded and stock is updated. No payment or shipment is processed.</p>
                <button className="an-primary mt-4" disabled={buying} onClick={buyNow}>
                    {buying ? "Recording purchase…" : "Confirm purchase"}
                </button>
            </dialog>

            <dialog ref={decisionDialog} className="an-dialog">
                <div className="an-section-heading">
                    <h2>{pendingDecision === "cancel" ? "Cancel Negotiation" : "Reject All Offers"}</h2>
                    <button className="an-outline" onClick={() => decisionDialog.current?.close()}>
                        Keep session
                    </button>
                </div>
                <p>This final decision is recorded for all roles. Conversation history is retained. No Agreement or real transaction is created.</p>
                <button
                    className="an-primary mt-4"
                    onClick={() => {
                        if (session) workspace.decision(session.attemptId, pendingDecision);
                        setAutoLocal(false);
                        decisionDialog.current?.close();
                    }}
                >
                    {pendingDecision === "cancel" ? "Confirm cancellation" : "Confirm rejection"}
                </button>
            </dialog>

            <dialog ref={approvalDialog} className="an-dialog">
                <div className="an-section-heading">
                    <h2>Review Final Agreement</h2>
                    <button className="an-outline" onClick={() => approvalDialog.current?.close()}>
                        Close
                    </button>
                </div>
                {session && (
                    <>
                        <h3 className="mt-4">{sellers.find(s => s.id === selected)?.productName ?? product.name}</h3>
                        <p className="text-sm mt-2">{sellers.find(s => s.id === selected)?.description ?? product.description}</p>
                        <p className="text-xs muted mt-2">You are approving this Seller's actual listing, including its stated color, condition and included items.</p>
                        <p>
                            {sellers.find(s => s.id === selected)?.name} · {requirements.quantity} units · {money(sellers.find(s => s.id === selected)?.agreedPrice ?? 0)} per unit
                        </p>
                        <p>
                            Total {money((sellers.find(s => s.id === selected)?.agreedPrice ?? 0) * requirements.quantity)} · Delivery {sellers.find(s => s.id === selected)?.deliveryDays} days
                        </p>
                        <p>Approval records the Agreement and updates available stock. No payment or shipment is processed.</p>
                        <button
                            className="an-primary mt-4"
                            onClick={() => {
                                approve(selected);
                                approvalDialog.current?.close();
                            }}
                        >
                            Confirm Agreement
                        </button>
                    </>
                )}
            </dialog>

            <dialog ref={dialog} className="an-dialog">
                <div className="an-section-heading">
                    <h2>Full Conversation · {active?.name}</h2>
                    <button className="an-outline" onClick={() => dialog.current?.close()}>
                        Close
                    </button>
                </div>
                {active && <Conversation key={`full-${active.id}`} seller={active} running={false} />}
            </dialog>
        </div>
    );
}
