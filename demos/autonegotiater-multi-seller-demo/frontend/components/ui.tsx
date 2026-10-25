import Link from "next/link";
import { privateIntegrationBlocker } from "@/lib/api-contracts";
import type { ReactNode } from "react";
export function Heading({ eyebrow, title, description, action }: {
    eyebrow?: string;
    title: string;
    description?: string;
    action?: ReactNode;
}) {
    return <div className="page-heading">
    <div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description && <p className="muted mt-2 max-w-2xl">{description}</p>}</div>{action}</div>;
}
export function Badge({ children }: {
    children: ReactNode;
}) { return <span className="badge">{children}</span>; }
export function Empty({ title, description, href, label }: {
    title: string;
    description: string;
    href?: string;
    label?: string;
}) {
    return <div className="panel empty">
    <div className="text-3xl mb-3" aria-hidden="true">◇</div>
    <h2>{title}</h2>
    <p className="muted mt-2 mb-5">{description}</p>{href && <Link className="btn" href={href}>{label}</Link>}</div>;
}
export function Stats({ items }: {
    items: {
        label: string;
        value: string | number;
    }[];
}) {
    return <div className="stats">{items.map(item => <div className="panel" key={item.label}>
        <p className="muted text-sm">{item.label}</p>
        <p className="text-3xl font-bold mt-3">{item.value}</p>
        </div>)}</div>;
}
export function BackendPending({ title = "Backend integration pending" }: {
    title?: string;
}) { return <Empty title={title} description={privateIntegrationBlocker} href="/products" label="Browse products"/>; }
