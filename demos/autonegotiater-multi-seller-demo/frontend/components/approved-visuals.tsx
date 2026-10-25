import type { Product } from "@/lib/api";
export function DesignIcon({ name, className = "" }: { name: string; className?: string }) {
    const shapes: Record<string, React.ReactNode> = {
        dashboard: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
        messages: <><path d="M3 4h15v11H8l-5 4V4Z"/><path d="M8 19h9l4 3V9"/></>,
        user: <><circle cx="12" cy="7" r="4"/><path d="M4 21v-3a8 8 0 0 1 16 0v3"/></>,
        users: <><circle cx="9" cy="7" r="4"/><path d="M2 21v-3a7 7 0 0 1 14 0v3m0-17a4 4 0 0 1 0 8m3 3a6 6 0 0 1 3 6"/></>,
        handshake: <><path d="m2 12 5-7 5 2 5-2 5 7-5 7-5-2-4 2-6-7Z"/><path d="m7 5 5 2-4 5 3 2 5-5m-5 5 6 5"/></>,
        chart: <><path d="M3 3v18h18M7 17v-5m5 5V7m5 10V3"/></>,
        scroll: <><path d="M6 3h13v16a2 2 0 0 1-4 0H3v-2h12M6 3a3 3 0 0 0-3 3h3V3Zm0 3v11m3-10h7m-7 4h7"/></>,
        server: <><rect x="3" y="3" width="18" height="7" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/><path d="M7 6h.01M7 17h.01"/></>,
        box: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9M8 5.2l8 4.5"/></>,
        coins: <><ellipse cx="10" cy="6" rx="6" ry="3"/><path d="M4 6v5c0 1.7 2.7 3 6 3m6-8v4M4 11v5c0 1.7 2.7 3 6 3h1"/><ellipse cx="17" cy="14" rx="4" ry="2"/><path d="M13 14v5c0 1.1 1.8 2 4 2s4-.9 4-2v-5"/></>,
        tag: <><path d="M3 3h8l10 10-8 8L3 11V3Z"/><circle cx="7.5" cy="7.5" r="1"/></>,
        truck: <><path d="M3 5h11v12H3zM14 9h4l3 4v4h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></>,
        shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/></>,
        check: <path d="m5 12 4 4L19 6"/>,
        edit: <><path d="m4 16 11-11 4 4L8 20H4v-4ZM13 7l4 4"/></>,
        bolt: <path d="m13 2-8 12h6l-1 8 9-13h-6l1-7Z"/>,
        trophy: <><path d="M7 3h10v5c0 4-2 6-5 6S7 12 7 8V3ZM7 5H3v3c0 3 4 4 5 4m9-7h4v3c0 3-4 4-5 4M12 14v6m-4 1h8"/></>,
        trend: <><path d="m3 17 6-6 4 3 8-10M15 4h6v6"/></>,
        clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/></>,
        info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v1"/></>,
        refresh: <><path d="M20 8a8 8 0 1 0 0 8M20 3v5h-5"/></>,
        bell: <><path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5l-2 3ZM10 21h4"/></>,
        chip: <><rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4M9 9h6v6H9z"/></>,
    };
    return <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{shapes[name] ?? shapes.box}</svg>;
}
export function BrandMark() { return <svg width="34" height="34" viewBox="0 0 40 40" aria-hidden="true"><path d="M16 5c2-4 6-4 8 0l14 26c2 4 0 7-4 7h-4L16 12Z" fill="#6152ff"/><path d="M16 5 2 31c-2 4 0 7 4 7h4L24 12Z" fill="#8074ff"/><path d="m12 28 4-8 4 8-4 8Z" fill="#4432f6"/><path d="M22 29h9l4 9H18Z" fill="#b6b0ff"/></svg>; }
export function StoreMark({ name, index }: { name: string; index: number }) {
    const initials = name.split(/\s+/).filter(w => !['Store', 'Supply', 'Seller', 'Catalog'].includes(w)).slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'S';
    return <span className={`an-store-mark an-store-mark-${index % 5}`} aria-hidden="true">{initials}</span>;
}
export function ProductIllustration({ product, view = 0 }: { product: Product; view?: number }) {
    const isPhone = product.id === 1;
    const id = `art-${product.id}-${view}`;
    return <svg className="an-product-illustration" viewBox="0 0 300 210" role="img" aria-label={`${product.name} product illustration`}>
        <defs><linearGradient id={`${id}-metal`} x2="1" y2="1"><stop stopColor="#e8e6df"/><stop offset=".4" stopColor="#b4b1a8"/><stop offset="1" stopColor="#76766f"/></linearGradient><linearGradient id={`${id}-screen`} x2="1" y2="1"><stop stopColor="#14151c"/><stop offset=".5" stopColor="#353a47"/><stop offset="1" stopColor="#898d91"/></linearGradient><radialGradient id={`${id}-glow`}><stop stopColor="#d8d8cf"/><stop offset="1" stopColor="#343840"/></radialGradient></defs>
        <ellipse cx="150" cy="194" rx="96" ry="9" fill="#24324d" opacity=".09"/>
        {isPhone ? <g transform={view === 1 ? 'translate(55 0)' : view === 2 ? 'translate(-42 0)' : ''}>
            {view !== 2 && <g transform="rotate(-5 104 104)"><rect x="57" y="12" width="96" height="178" rx="18" fill={`url(#${id}-metal)`} stroke="#8c8b84"/><rect x="64" y="20" width="48" height="55" rx="13" fill="#b8b6af" stroke="#d9d7cf"/>{[[78,34],[98,47],[78,60]].map(([x,y])=><g key={`${x}${y}`}><circle cx={x} cy={y} r="10" fill="#747771" stroke="#d1d1c7"/><circle cx={x} cy={y} r="7.2" fill="#141923"/><circle cx={x-2} cy={y-2} r="2.8" fill="#495d74"/></g>)}<circle cx="99" cy="26" r="3.5" fill="#efe7d4"/><path d="M99 109c-10-8-18 6-10 16 6 8 10 2 12 3 5 2 9-1 12-8-9-4-5-10-5-10-5-4-7-1-9-1Z" fill="#777970" opacity=".7"/></g>}
            {view !== 1 && <g transform="rotate(3 180 100)"><rect x="126" y="10" width="103" height="183" rx="19" fill="#353733" stroke="#a5a49a" strokeWidth="2"/><rect x="131" y="15" width="93" height="173" rx="15" fill={`url(#${id}-screen)`}/><ellipse cx="179" cy="102" rx="41" ry="74" fill="none" stroke="#93968e" strokeWidth="14" opacity=".45"/><ellipse cx="180" cy="108" rx="26" ry="61" fill={`url(#${id}-glow)`} opacity=".5"/><rect x="159" y="20" width="36" height="10" rx="6" fill="#0d1014"/></g>}
        </g> : product.id === 2 ? <g fill="none" stroke="#39445b"><path d="M82 109V85a68 68 0 0 1 136 0v24" strokeWidth="17"/><path d="M81 115V89a69 69 0 0 1 138 0v26" stroke="#71798b" strokeWidth="6"/><rect x="63" y="97" width="43" height="76" rx="18" fill="#242d3d" stroke="#5f687a"/><rect x="195" y="97" width="43" height="76" rx="18" fill="#242d3d" stroke="#5f687a"/><path d="M73 107v54m155-54v54" stroke="#7d8797" strokeWidth="3"/></g> : product.id === 3 ? <g fill="#9aa5b6" stroke="#6b788f" strokeWidth="2"><rect x="51" y="69" width="195" height="70" rx="13"/><rect x="44" y="111" width="210" height="56" rx="10"/><rect x="43" y="92" width="27" height="77" rx="10"/><rect x="226" y="92" width="27" height="77" rx="10"/><rect x="69" y="115" width="75" height="55" rx="8"/><rect x="146" y="115" width="80" height="55" rx="8"/><path d="M60 170v13m174-13v13M145 72v40"/></g> : product.id === 4 ? <g fill="#313e55" stroke="#8894a9" strokeWidth="3"><rect x="107" y="20" width="82" height="105" rx="20"/><rect x="92" y="115" width="112" height="23" rx="10"/><path d="M149 139v41m-52 10 52-10 55 10M96 104v27m109-27v27" fill="none" stroke="#4a5870" strokeWidth="7"/></g> : product.id === 5 ? <g><rect x="63" y="64" width="174" height="87" rx="16" fill="#28354b"/><rect x="76" y="76" width="63" height="47" rx="5" fill="#55647b"/><circle cx="190" cy="108" r="31" fill="#1b2234" stroke="#6a7a91" strokeWidth="6"/><circle cx="190" cy="108" r="16" fill="#253a60"/><path d="M143 62V36h49" stroke="#455371" strokeWidth="8" fill="none"/></g> : product.id === 6 ? <g stroke="#56647b" strokeWidth="7" fill="#344059"><path d="m69 173 111-27 73 26-113 25Z"/><path d="m216 161-22-117-61 7" fill="none"/><rect x="113" y="26" width="74" height="31" rx="5"/><path d="m88 158 68-11" stroke="#78859a" strokeWidth="23"/></g> : <g><rect x="62" y="32" width="178" height="118" rx="9" fill="#c4cbd6" stroke="#8994a6"/><rect x="69" y="39" width="164" height="103" rx="3" fill={`url(#${id}-screen)`}/><path d="M62 151h178l35 27H28Z" fill="#bec7d5" stroke="#8894a6"/><path d="M29 179h245l-12 7H41Z" fill="#8c98ab"/><path d="M132 161h40l10 11h-61Z" fill="#94a0b4"/></g>}
    </svg>;
}
