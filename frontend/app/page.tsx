import Link from "next/link";
export default function Home() {
    return <>
    <section className="hero grid lg:grid-cols-[1.2fr_1fr] gap-12 items-center">
    <div>
    <p className="eyebrow">Smarter C2C commerce</p>
    <h1 className="text-5xl sm:text-6xl">Great deals.<br />
    <span className="text-indigo-600">Less back-and-forth.</span>
    </h1>
    <p className="muted mt-6 max-w-lg">Discover products, define your limits, and let an agent handle the bargaining. You decide when to approve in semi-automated mode.</p>
    <div className="flex gap-3 flex-wrap mt-8">
    <Link href="/products" className="btn">Explore marketplace →</Link>
    <Link href="/login" className="btn-secondary">Open your workspace</Link>
    </div>
    <p className="muted text-xs mt-5">Private limits · Transparent negotiation rounds</p>
    </div>
    <div className="panel">
    <div className="flex justify-between mb-6">
    <span className="badge">Negotiation journey</span>
    <span className="muted text-xs">RULES-BASED ENGINE</span>
    </div>
    <p className="text-sm muted">Your next agreement</p>
    <p className="text-3xl font-bold mt-2">On your terms.</p>
    <div className="space-y-4 mt-7">{["01 · Discover a product", "02 · Set budget and conditions", "03 · Follow negotiation rounds", "04 · Review the final agreement"].map(t => <div className="p-4 rounded-xl bg-slate-50 text-sm" key={t}>{t}</div>)}</div>
    <p className="muted text-xs mt-5">Negotiations use a deterministic, rules-based engine. No payment is processed.</p>
    </div>
    </section>
    <section className="grid md:grid-cols-3 gap-6 mt-10">{[["For buyers", "Set confidential limits and follow every offer.", "buyer"], ["For sellers", "Manage your catalog and configure negotiation rules.", "seller"], ["For administrators", "Review activity, accounts and platform indicators.", "admin"]].map(([title, description, role]) => <Link href={'/dashboard/' + role} className="panel" key={role}>
        <p className="eyebrow">{role} workspace</p>
        <h2>{title}</h2>
        <p className="muted text-sm mt-3">{description}</p>
        <p className="text-indigo-600 text-sm mt-6">Explore workspace →</p>
        </Link>)}</section>
    </>;
}
