/**
 * AutoNegotiater brand mark: "Meeting Point".
 * Two offer lines (buyer in white, seller in light petrol) rise and meet to form an "A";
 * the saffron dot between them is the agreement both sides reach in the middle.
 * Colours: see docs/BRAND_IDENTITY.md.
 */
export function BrandMark({ size = 36, className }: { size?: number; className?: string }) {
    return (
        <svg className={className} width={size} height={size} viewBox="0 0 40 40" role="img" aria-label="AutoNegotiater logo" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="an-mark-bg" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#1F7B8E" />
                    <stop offset="1" stopColor="#103846" />
                </linearGradient>
            </defs>
            <rect width="40" height="40" rx="11" fill="url(#an-mark-bg)" />
            <path d="M11 31 L20 9.5" stroke="#FFFFFF" strokeWidth="4.2" strokeLinecap="round" fill="none" />
            <path d="M20 9.5 L29 31" stroke="#A9D7DE" strokeWidth="4.2" strokeLinecap="round" fill="none" />
            <circle cx="20" cy="24.5" r="3.3" fill="#F0A535" />
        </svg>
    );
}

/** Logo mark plus wordmark, used in the site header. */
export function BrandLogo({ tagline }: { tagline?: string }) {
    return (
        <>
            <BrandMark className="brand-mark" />
            <span className="brand-word">Auto<span className="brand-word-accent">Negotiater</span></span>
            {tagline && <span className="brand-tagline hidden sm:inline">{tagline}</span>}
        </>
    );
}
