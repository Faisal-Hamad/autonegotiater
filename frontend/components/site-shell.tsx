"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useDemo } from "./demo-provider";

const sections = {
    buyer: ["Overview", "Requests", "Negotiations", "Deals", "Notifications"],
    seller: ["Overview", "Products", "Negotiations", "Deals", "Notifications"],
    admin: ["Overview", "Users", "Sellers", "Products", "Requests", "Negotiations", "Reports", "Permissions", "System", "Audit-logs"],
};

const navigationLabels: Record<string, string> = {
    Requests: "Multi-seller Requests",
    Negotiations: "Negotiation Sessions",
    Deals: "Agreements",
    "Audit-logs": "Audit Logs",
};

export function SiteShell({ children }: {
    children: ReactNode;
}) {
    const { enabled, state, user, setUserId } = useDemo();
    const path = usePathname();
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const role = path.startsWith("/dashboard/seller") ? "seller" : path.startsWith("/dashboard/admin") ? "admin" : "buyer";
    return <>
    <header className="site-header">
    <div className="header-inner">
    <Link className="brand" href="/">
    <span className="brand-mark">A</span>AutoNegotiater<span className="text-xs font-normal muted hidden sm:inline"> / MARKETPLACE</span>
    </Link>
    <button className="btn-secondary md:hidden" aria-expanded={open} aria-label="Toggle navigation" onClick={() => setOpen(!open)}>Menu</button>
    <nav className={`${open ? "flex" : "hidden"} main-nav md:flex`}>
    <Link href="/products" onClick={() => setOpen(false)}>Marketplace</Link>{enabled ? <>
        <Link href={`/dashboard/${user.role}`} onClick={() => setOpen(false)}>Workspace</Link>
        <Link href="/notifications" onClick={() => setOpen(false)}>Alerts <span className="badge">{state.notices.filter(n => n.userId === user.id && !n.read).length}</span>
        </Link>
        <Link href="/profile" onClick={() => setOpen(false)}>{user.name.split(" ")[0]}</Link>
        <label className="text-xs muted">Active identity<select aria-label="Active identity selector" value={user.id} onChange={e => { const id = Number(e.target.value); setUserId(id); const next = state.users.find(u => u.id === id); if (next)
            router.push(`/dashboard/${next.role}`); }}>{state.users.map(u => <option key={u.id} value={u.id}>{u.name} · {u.role[0].toUpperCase() + u.role.slice(1)}</option>)}</select>
        </label>
        </> : <>
        <Link href="/login">Sign in</Link>
        <Link href="/register" className="btn">Get started</Link>
        <Link href="/dashboard/buyer">Buyer</Link>
        <Link href="/dashboard/seller">Seller</Link>
        <Link href="/dashboard/admin">Admin</Link>
        </>}</nav>
    </div>
    </header>
    <div className={path.startsWith("/dashboard") ? "workspace" : "content-wrap"}>{path.startsWith("/dashboard") && <aside className="sidebar">
        <p className="eyebrow">{role} workspace</p>{sections[role].map(name => { const href = `/dashboard/${role}${name === "Overview" ? "" : "/" + name.toLowerCase()}`; return <Link key={name} href={href} className={path === href ? "active" : ""}>{navigationLabels[name] ?? name}</Link>; })}<Link href="/profile">My profile</Link>
        </aside>}<main className="min-w-0">{children}</main>
    </div>
    <footer className="footer">
    <span>AutoNegotiater · Qassim University graduation project</span>
    <span>Discover. Delegate. Decide.</span>
    </footer>
    </>;
}
