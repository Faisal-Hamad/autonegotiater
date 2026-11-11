import Link from "next/link";
import { privateIntegrationBlocker } from "@/lib/api-contracts";
import { DesignIcon } from "./approved-visuals";
import type { ReactNode } from "react";

export function Heading({ eyebrow, title, description, action }: {
    eyebrow?: string;
    title: string;
    description?: string;
    action?: ReactNode;
}) {
    return (
        <div className="page-heading">
            <div>
                {eyebrow && <p className="eyebrow">{eyebrow}</p>}
                <h1>{title}</h1>
                {description && <p className="muted mt-2 max-w-2xl">{description}</p>}
            </div>
            {action && <div className="flex flex-wrap items-center gap-3">{action}</div>}
        </div>
    );
}

export function Badge({ children, tone }: {
    children: ReactNode;
    tone?: "indigo" | "emerald" | "amber" | "rose" | "slate";
}) {
    const label = typeof children === "string" ? children.toLowerCase() : "";
    const resolved = tone ?? (
        ["completed", "active", "agreed", "deal closed", "recorded", "enabled"].some(k => label.includes(k)) ? "emerald" :
        ["awaiting", "paused", "pending", "in progress", "review"].some(k => label.includes(k)) ? "amber" :
        ["failed", "cancelled", "rejected", "suspended", "excluded", "disabled", "inactive"].some(k => label.includes(k)) ? "rose" :
        "indigo"
    );
    const styles: Record<string, string> = {
        indigo: "bg-indigo-50 text-indigo-700 border border-indigo-100",
        emerald: "bg-emerald-50 text-emerald-700 border border-emerald-200/70",
        amber: "bg-amber-50 text-amber-800 border border-amber-200/70",
        rose: "bg-rose-50 text-rose-700 border border-rose-200/70",
        slate: "bg-slate-100 text-slate-700 border border-slate-200",
    };
    return <span className={`badge ${styles[resolved]}`}>{children}</span>;
}

export function Empty({ title, description, href, label }: {
    title: string;
    description: string;
    href?: string;
    label?: string;
}) {
    return (
        <div className="panel empty">
            <div className="mx-auto mb-4 w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 grid place-items-center" aria-hidden="true">
                <DesignIcon name="box" />
            </div>
            <h2>{title}</h2>
            <p className="muted mt-2 mb-6 max-w-md mx-auto">{description}</p>
            {href && <Link className="btn" href={href}>{label}</Link>}
        </div>
    );
}

export function Stats({ items }: {
    items: {
        label: string;
        value: string | number;
        note?: string;
        icon?: string;
        tone?: "indigo" | "emerald" | "amber" | "slate";
    }[];
}) {
    const iconFor = (label: string, explicit?: string) => {
        if (explicit) return explicit;
        const l = label.toLowerCase();
        if (l.includes("user") || l.includes("seller") || l.includes("buyer")) return "users";
        if (l.includes("rate") || l.includes("saving") || l.includes("value") || l.includes("revenue")) return "trend";
        if (l.includes("deal") || l.includes("agreement")) return "handshake";
        if (l.includes("round") || l.includes("awaiting") || l.includes("active")) return "clock";
        if (l.includes("product")) return "box";
        return "chart";
    };
    return (
        <div className="stats">
            {items.map(item => (
                <div className="panel kpi-card" key={item.label}>
                    <div className="flex items-start justify-between gap-3">
                        <p className="muted text-xs font-semibold uppercase tracking-wider">{item.label}</p>
                        <span className="w-9 h-9 rounded-xl bg-indigo-50/80 text-indigo-600 grid place-items-center shrink-0">
                            <DesignIcon name={iconFor(item.label, item.icon)} />
                        </span>
                    </div>
                    <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-3 tracking-tight">{item.value}</p>
                    {item.note && <p className="text-xs text-slate-500 mt-1.5">{item.note}</p>}
                </div>
            ))}
        </div>
    );
}

export function BackendPending({ title = "Backend integration pending" }: {
    title?: string;
}) {
    return <Empty title={title} description={privateIntegrationBlocker} href="/products" label="Browse products" />;
}
