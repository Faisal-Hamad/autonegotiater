"use client";
import Link from "next/link";
import { realMode } from "@/lib/real-api";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useCompetitiveWorkspace } from "./competitive-provider";
import { DesignIcon } from "./approved-visuals";
import { useDemo } from "./demo-provider";
const sections = { buyer: ["Overview", "Negotiations", "Deals", "Notifications"], seller: ["Overview", "Products", "Negotiations", "Deals", "Notifications"], admin: ["Overview", "Users", "Sellers", "Products", "Negotiations", "Deals", "Reports", "Audit-logs", "System", "Permissions", "Notifications"] };
const navigationLabels: Record<string, string> = { Negotiations: "Negotiation Sessions", Deals: "Agreements", "Audit-logs": "Audit Logs" };
const navigationIcons:Record<string,string>={Overview:"dashboard",Products:"box",Negotiations:"messages",Deals:"handshake",Notifications:"bell",Users:"users",Sellers:"users",Reports:"chart", "Audit-logs":"scroll",System:"server",Permissions:"shield"};
function isActive(path:string,href:string,name:string){if(name==="Overview")return path===href;if(name==="Negotiations"&&path.endsWith("/competitive"))return true;if(name==="Negotiations"&&/\/competitive(?:-session)?\//.test(path))return true;if(name==="Deals"&&path.includes("/agreements/"))return true;if(name==="Products"&&path.includes("/storefronts"))return true;return path===href||path.startsWith(href+"/");}
export function SiteShell({ children }: {
    children: ReactNode;
}) {
    const { enabled, state, user, setUserId } = useDemo();
    const competitive=useCompetitiveWorkspace();
    const path = usePathname();
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const role = enabled ? user.role : path.startsWith("/dashboard/seller") ? "seller" : path.startsWith("/dashboard/admin") ? "admin" : "buyer";
    const approvedPage = enabled && /^\/products\/\d+(?:\/competitive)?$/.test(path);
    const workspacePage=path.startsWith("/dashboard") || enabled && /^\/products\/\d+\/competitive$/.test(path);
    return <>
    <header className="site-header">
    <div className="header-inner">
    <Link className="brand" href="/">
    <span className="brand-mark">A</span>AutoNegotiater<span className="text-xs font-normal muted hidden sm:inline"> / MARKETPLACE</span>
    </Link>
    <button className="btn-secondary md:hidden" aria-expanded={open} aria-label="Toggle navigation" aria-controls={workspacePage?"site-navigation workspace-navigation":"site-navigation"} onClick={() => setOpen(!open)}>Menu</button>
    <nav id="site-navigation" className={`${open ? "flex" : "hidden"} main-nav md:flex`}>
    <Link href="/products" onClick={() => setOpen(false)}>Marketplace</Link>{enabled ? <>
        <Link href={`/dashboard/${user.role}`} onClick={() => setOpen(false)}>Workspace</Link>
        <Link href="/notifications" onClick={()=>setOpen(false)}>Alerts <span className="badge">{state.notices.filter(n => n.userId === user.id && !n.read).length + competitive.notices.filter(n=>!n.read).length}</span></Link>
        <Link href="/profile" onClick={()=>setOpen(false)}>{user.name.split(" ")[0]}</Link>
        {!realMode && <label className="text-xs muted">Demo identity<select aria-label="Demo identity, not real authorization" value={user.id} onChange={e => { const id = Number(e.target.value); setOpen(false); setUserId(id); const next = state.users.find(u => u.id === id); if (next)
            router.push(`/dashboard/${next.role}`); }}><option value={0} disabled>Signed out · choose identity</option>{state.users.map(u => <option disabled={!u.active} key={u.id} value={u.id}>{u.name} · {u.role[0].toUpperCase() + u.role.slice(1)}</option>)}</select>
        </label>}{realMode && <Link href={user.active?"/profile":"/login"}>{user.active?"My account":"Sign in"}</Link>}
        </> : <>
        <Link href="/login">Sign in</Link>
        <Link href="/register" className="btn">Get started</Link>
        <Link href="/dashboard/buyer">Buyer</Link>
        <Link href="/dashboard/seller">Seller</Link>
        <Link href="/dashboard/admin">Admin</Link>
        </>}</nav>
    </div>
    </header>
 {enabled && !realMode && <div className="demo-strip">DEMO MODE · Synthetic data, scripted negotiation, no Gemini or backend calls. Role switching is not authorization. Saved on the server. Reset is available from Profile.</div>}
 <div className={workspacePage ? "workspace" : approvedPage ? "an-content-wrap" : "content-wrap"}>{workspacePage && <aside id="workspace-navigation" className={`sidebar ${open ? "sidebar-open" : ""}`} aria-label={`${role} workspace navigation`}>
        <p className="eyebrow">{role} workspace</p>{sections[role].map(name => { const href = `/dashboard/${role}${name === "Overview" ? "" : "/" + name.toLowerCase()}`; return <Link key={name} href={href} onClick={()=>setOpen(false)} aria-current={isActive(path,href,name) ? "page" : undefined} className={isActive(path,href,name) ? "active" : ""}><DesignIcon name={navigationIcons[name] ?? "box"}/><span>{role === "seller" && name === "Products" ? "My Products & Agent Settings" : navigationLabels[name] ?? name}</span></Link>; })}{enabled && role === "buyer" && <Link href="/products" onClick={()=>setOpen(false)}><DesignIcon name="box"/>Browse Products</Link>}<Link href="/profile" onClick={()=>setOpen(false)}><DesignIcon name="user"/>My Profile</Link>
        </aside>}<main className="min-w-0">{children}</main>
    </div>
    <footer className="footer">
    <span>AutoNegotiater · Qassim University graduation project</span>
    <span>Discover. Delegate. Decide.</span>
    </footer>
    </>;
}
