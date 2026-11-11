"use client";
import Link from "next/link";
import { realMode } from "@/lib/real-api";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useCompetitiveWorkspace } from "./competitive-provider";
import { DesignIcon } from "./approved-visuals";
import { useDemo } from "./demo-provider";

const sections = {
    buyer: ["Overview", "Negotiations", "Deals", "Notifications"],
    seller: ["Overview", "Products", "Negotiations", "Deals", "Notifications"],
    admin: ["Overview", "Users", "Sellers", "Products", "Negotiations", "Deals", "Reports", "Audit-logs", "System", "Permissions", "Notifications"],
};
const navigationLabels: Record<string, string> = {
    Overview: "Dashboard Overview",
    Negotiations: "Deals & Negotiations",
    Deals: "Closed Agreements",
    Reports: "Reports & Analytics",
    "Audit-logs": "Audit Logs",
    System: "System Metrics",
};
const navigationIcons: Record<string, string> = {
    Overview: "dashboard",
    Products: "box",
    Negotiations: "messages",
    Deals: "handshake",
    Notifications: "bell",
    Users: "users",
    Sellers: "users",
    Reports: "chart",
    "Audit-logs": "scroll",
    System: "server",
    Permissions: "shield",
};

function isActive(path: string, href: string, name: string) {
    if (name === "Overview") return path === href;
    if (name === "Negotiations" && path.endsWith("/competitive")) return true;
    if (name === "Negotiations" && /\/competitive(?:-session)?\//.test(path)) return true;
    if (name === "Deals" && path.includes("/agreements/")) return true;
    if (name === "Products" && path.includes("/storefronts")) return true;
    return path === href || path.startsWith(href + "/");
}

export function SiteShell({ children }: {
    children: ReactNode;
}) {
    const { enabled, state, user, setUserId } = useDemo();
    const competitive = useCompetitiveWorkspace();
    const path = usePathname();
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const role = enabled ? user.role : path.startsWith("/dashboard/seller") ? "seller" : path.startsWith("/dashboard/admin") ? "admin" : "buyer";
    const approvedPage = enabled && /^\/products\/\d+(?:\/competitive)?$/.test(path);
    const workspacePage = path.startsWith("/dashboard") || (enabled && /^\/products\/\d+\/competitive$/.test(path));
    const unreadCount = state.notices.filter(n => n.userId === user.id && !n.read).length + competitive.notices.filter(n => !n.read).length;

    const roleStyles: Record<string, { label: string; badge: string }> = {
        buyer: { label: "Buyer Account", badge: "bg-indigo-50 text-indigo-700 border-indigo-200" },
        seller: { label: "Seller Account", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
        admin: { label: "Admin Account", badge: "bg-violet-50 text-violet-700 border-violet-200" },
    };

    return (
        <>
            <header className="site-header">
                <div className="header-inner">
                    <Link className="brand" href="/">
                        <span className="brand-mark">A</span>
                        <span>AutoNegotiater</span>
                        <span className="text-xs font-medium text-slate-400 hidden sm:inline"> · Smart Deal Platform</span>
                    </Link>
                    <button
                        className="btn-secondary md:hidden"
                        aria-expanded={open}
                        aria-label="Toggle navigation"
                        aria-controls={workspacePage ? "site-navigation workspace-navigation" : "site-navigation"}
                        onClick={() => setOpen(!open)}
                    >
                        Menu
                    </button>
                    <nav id="site-navigation" className={`${open ? "flex" : "hidden"} main-nav md:flex`}>
                        <Link href="/products" onClick={() => setOpen(false)} className="font-medium text-slate-600 hover:text-indigo-600 transition">
                            Marketplace
                        </Link>
                        {enabled ? (
                            <>
                                <Link href={`/dashboard/${user.role}`} onClick={() => setOpen(false)} className="font-medium text-slate-600 hover:text-indigo-600 transition">
                                    Workspace
                                </Link>
                                <Link href="/notifications" onClick={() => setOpen(false)} className="inline-flex items-center gap-1.5 font-medium text-slate-600 hover:text-indigo-600 transition">
                                    <span>Alerts</span>
                                    <span className="badge">{unreadCount}</span>
                                </Link>
                                <Link href="/profile" onClick={() => setOpen(false)} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100/80 hover:bg-indigo-50 text-slate-800 font-semibold transition">
                                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs grid place-items-center">
                                        {user.name.trim().charAt(0).toUpperCase() || "U"}
                                    </span>
                                    <span>{user.name.split(" ")[0]}</span>
                                </Link>
                                {!realMode && (
                                    <label className="text-xs muted">
                                        Demo identity
                                        <select
                                            aria-label="Demo identity, not real authorization"
                                            value={user.id}
                                            onChange={e => {
                                                const id = Number(e.target.value);
                                                setOpen(false);
                                                setUserId(id);
                                                const next = state.users.find(u => u.id === id);
                                                if (next) router.push(`/dashboard/${next.role}`);
                                            }}
                                        >
                                            <option value={0} disabled>Signed out · choose identity</option>
                                            {state.users.map(u => (
                                                <option disabled={!u.active} key={u.id} value={u.id}>
                                                    {u.name} · {u.role[0].toUpperCase() + u.role.slice(1)}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                )}
                                {realMode && (
                                    <Link href={user.active ? "/profile" : "/login"} className="btn-secondary py-1.5 px-3 text-xs">
                                        {user.active ? "My account" : "Sign in"}
                                    </Link>
                                )}
                            </>
                        ) : (
                            <>
                                <Link href="/login">Sign in</Link>
                                <Link href="/register" className="btn">Get started</Link>
                                <Link href="/dashboard/buyer">Buyer</Link>
                                <Link href="/dashboard/seller">Seller</Link>
                                <Link href="/dashboard/admin">Admin</Link>
                            </>
                        )}
                    </nav>
                </div>
            </header>
            {enabled && !realMode && (
                <div className="demo-strip">
                    DEMO MODE · Synthetic data, scripted negotiation, no Gemini or backend calls. Role switching is not authorization. Saved on the server. Reset is available from Profile.
                </div>
            )}
            <div className={workspacePage ? "workspace" : approvedPage ? "an-content-wrap" : "content-wrap"}>
                {workspacePage && (
                    <aside
                        id="workspace-navigation"
                        className={`sidebar ${open ? "sidebar-open" : ""}`}
                        aria-label={`${role} workspace navigation`}
                    >
                        <div className="mb-3 px-3 py-3 rounded-xl bg-slate-50 border border-slate-200/80">
                            <p className="eyebrow !mb-1">{role} workspace</p>
                            {user.active ? (
                                <>
                                    <strong className="block text-sm text-slate-900 truncate">{user.name}</strong>
                                    <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full border mt-1.5 ${roleStyles[role]?.badge ?? ""}`}>
                                        {roleStyles[role]?.label ?? role}
                                    </span>
                                </>
                            ) : (
                                <span className="text-xs muted">Select an active account</span>
                            )}
                        </div>
                        {sections[role].map(name => {
                            const href = `/dashboard/${role}${name === "Overview" ? "" : "/" + name.toLowerCase()}`;
                            const active = isActive(path, href, name);
                            return (
                                <Link
                                    key={name}
                                    href={href}
                                    onClick={() => setOpen(false)}
                                    aria-current={active ? "page" : undefined}
                                    className={active ? "active" : ""}
                                >
                                    <DesignIcon name={navigationIcons[name] ?? "box"} />
                                    <span>
                                        {role === "seller" && name === "Products"
                                            ? "My Products & Agent Settings"
                                            : navigationLabels[name] ?? name}
                                    </span>
                                </Link>
                            );
                        })}
                        {enabled && role === "buyer" && (
                            <Link href="/products" onClick={() => setOpen(false)}>
                                <DesignIcon name="box" />
                                <span>Browse Products</span>
                            </Link>
                        )}
                        <Link href="/profile" onClick={() => setOpen(false)}>
                            <DesignIcon name="user" />
                            <span>My Profile</span>
                        </Link>
                        <div className="mt-auto pt-4 px-3 hidden md:block">
                            <div className="rounded-xl bg-emerald-50/70 border border-emerald-200/60 px-3 py-2.5 text-xs text-emerald-800">
                                <span className="flex items-center gap-2 font-semibold">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                    System Ready
                                </span>
                                <span className="block text-[11px] text-emerald-700/80 mt-0.5">
                                    Rules Engine & Privacy Guard Active
                                </span>
                            </div>
                        </div>
                    </aside>
                )}
                <main className="min-w-0">{children}</main>
            </div>
            <footer className="footer">
                <span>AutoNegotiater · Qassim University graduation project</span>
                <span>Discover. Delegate. Decide.</span>
            </footer>
        </>
    );
}
