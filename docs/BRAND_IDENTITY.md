# AutoNegotiater visual identity

## Logo: "Meeting Point"
Two offer lines rise and meet to form the letter **A**:
- the white line is the buyer, the light petrol line is the seller;
- the **saffron dot** between them is the agreement both sides reach *in the middle*.

Files: `frontend/components/brand-logo.tsx` (`BrandMark`, `BrandLogo`) and `frontend/app/icon.svg` (browser tab icon).
Wordmark: **Auto**Negotiater — "Auto" in Ink, "Negotiater" in Petrol 600, weight 800.

Rules: keep the rounded square, do not recolour the dot, minimum size 16 px, keep clear space of ¼ of the mark around it.

## Colours

| Role | Name | Hex | Use |
|---|---|---|---|
| Primary | Petrol 600 | `#136476` | Buttons, links, active navigation |
| Primary dark | Petrol 900 | `#103846` | Logo background, hover |
| Primary light | Petrol 50 | `#EEF7F8` | Selected rows, badges |
| Accent | Saffron 400 | `#F0A535` | Agreement point, highlights (sparingly) |
| Text | Ink | `#0B1F26` | Headings and body text |
| Muted text | Ink 500 | `#66787E` | Secondary text |
| Borders | Ink 200 | `#DDE4E6` | Card and input borders |
| Background | Sand | `#F5F4EF` | Page background (cards stay white) |
| Success / Danger / Warning | Emerald / Rose / Amber | Tailwind defaults | Status only, never decoration |

Full scales (50–950) are defined in the `@theme` block of `frontend/app/globals.css`.
The existing `indigo-*` classes map to Petrol, `violet-*` to Saffron and `slate-*` to Ink, so new code may use either name.
