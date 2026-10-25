# AutoNegotiater frontend demo

## Scope and source of truth

This is the local C2C graduation-project frontend described in `docs/STAKEHOLDERS_JOURNEYS.md` and `docs/PLAN.md`, with a SaaS-style presentation. It is not a production negotiation engine, Gemini integration, authentication service or payment system.

## Run and validate on Windows

From `frontend`, with the existing dependencies installed:

```powershell
npm.cmd run dev
node node_modules/typescript/bin/tsc --noEmit --incremental false
node tests/verify-demo.cjs
```

Open the URL printed by Next.js, normally `http://localhost:3000`.

`frontend/.env.local` currently sets `USE_MOCK_DATA=true`. Mock works only when `NODE_ENV=development`. Set it to `false` and restart Next.js to use FastAPI. The server-side base URL remains `API_INTERNAL_URL` or `http://localhost:8000`. No new API contracts are assumed, and network errors do not silently fall back to demo data.

## Routes

| Area | Routes |
| --- | --- |
| Public | `/`, `/products`, `/products/[id]` |
| Buyer setup | `/products/[id]/negotiate` |
| Buyer workspace | `/dashboard/buyer`, `/dashboard/buyer/negotiations`, `/dashboard/buyer/negotiations/[id]`, `/dashboard/buyer/deals`, `/dashboard/buyer/deals/[id]`, `/dashboard/buyer/notifications` |
| Seller workspace | `/dashboard/seller`, `/dashboard/seller/products`, `/dashboard/seller/products/new`, `/dashboard/seller/products/[id]/edit`, `/dashboard/seller/products/[id]/rules`, `/dashboard/seller/negotiations`, `/dashboard/seller/negotiations/[id]`, `/dashboard/seller/deals`, `/dashboard/seller/deals/[id]`, `/dashboard/seller/notifications` |
| Admin workspace | `/dashboard/admin`, `/dashboard/admin/users`, `/dashboard/admin/sellers`, `/dashboard/admin/products`, `/dashboard/admin/negotiations`, `/dashboard/admin/negotiations/[id]`, `/dashboard/admin/reports`, `/dashboard/admin/permissions`, `/dashboard/admin/system`, `/dashboard/admin/audit-logs` |
| Shared | `/login`, `/register`, `/profile`, `/notifications` |

## Local state and scenarios

`DemoProvider` keeps synthetic identities, public products, private demo rules, sessions, deals, notices and audit events in React memory. Navigate using links to retain state. Refreshing, opening another tab or a full development reload resets it. No passwords, cookies, real personal information, database writes or local-storage records are needed.

The default buyer is Noura (4). Use the explicitly labeled identity selector or login demo to explore other accounts. Registration creates a buyer or seller identity locally; it cannot create an administrator. The demo identity selector is not real authorization, and no client state must be used for production access checks.

Buyer: browse/search/filter/sort, compare up to three **public listings**, open details, configure a budget and conditions, choose semi-automated or automated mode and select an agreement or failed scenario. Advance alternating Buyer Agent and Seller Agent turns manually. A round contains a buyer offer and seller response; buyer acceptance of the final counteroffer does not consume another round. Semi-automated sessions require approval; automated eligible agreements close automatically. Reject or cancel without creating a deal. Successful deals update stock, notify both parties and support local ratings and browser print-to-PDF.

Seller: add/edit public listing data and stock, configure confidential floor, discount, auto-accept threshold and maximum rounds. Rules are validated and used only by the deterministic UI simulation, not a production strategy. Disabled agents fail a simulation. Session pricing strategy and round allowance are snapshotted at the first turn. Tightening the effective floor or changing the listing price stops an active simulation rather than generating invalid or non-monotonic offers; disabling the agent or losing stock also stops it. Stock and boundaries are rechecked at approval. Monitor own product sessions and sales. The documented flow requires buyer final approval in semi-automated mode, so an additional seller approval is not invented.

Admin: inspect aggregate demo statistics, public products, accounts and negotiations; toggle synthetic account status; search audit actions; view a responsibility matrix. Reports, product moderation and permission editing are explicitly marked as placeholders pending defined policies and endpoints. Performance screens do not fabricate latency or health measurements.

## Confidentiality boundaries

Role-specific context data is structurally projected before delivery to UI components. Buyer views contain only their own budgets and no seller rule records. Seller/admin session views have no budget or private engine snapshot fields. Seller rules are projected only for the owning seller; public transcript prices remain visible to both parties. Budget is displayed only in the owning buyer's session. Seller floor/rules forms are displayed only for the selected owning seller. Seller/admin session tables omit budgets; admin product views omit floor prices. Notification and audit messages omit confidential reservation values. All demo data remains synthetic and inspectable in a browser: these presentation boundaries are **not security controls**. FastAPI must enforce ownership and roles before production use.

## Existing backend integration preserved

The existing `getProducts`, seller/buyer/admin dashboard calls retain URLs and `cache: no-store`. `getProduct(id)` uses the already-existing `GET /products/{id}` and distinguishes 404 from server/network errors. In real mode the existing dashboard implementations remain available; new mutation and account screens show a backend-pending state instead of sending invented requests. Mock data never activates in production.

## Dependencies awaiting backend work

| Feature | Missing backend capability |
| --- | --- |
| Login/register/profile | authenticated identity, registration, sessions/cookies, roles, profile updates |
| Seller management | product CRUD, image upload, rule writes, actual agent state |
| Negotiation | session creation/details, offers, messages, cancellation, approval/rejection, production engine |
| Gemini | server-side provider integration; structured offers validated by the engine; no hidden limits sent to the LLM |
| Live updates/alerts | WebSocket or SSE, notification ownership and read status |
| Deals/ratings | stable deal contract, authorized details, confirmations and rating writes |
| Export | official agreement/PDF service; demo uses browser print only |
| Administration | authorized moderation, suspension, permission policy, reports and monitoring endpoints |
| Marketplace growth | backend search, sorting and pagination; current search covers the loaded list only |

The current API has one seller listing and one optional image per product. Multiple offers for one item, structured condition, seller public profile and warranty/delivery availability are not supplied. The comparison interface therefore compares public products, not fabricated competing offers. Images use their provided public URL and fall back on absence/error; `/media` must be accessible from the frontend origin.

Known pre-existing backend contract mismatches: buyer dashboard references `agreed_conditions`, confirmation fields and `created_at` absent from the Deal model (`final_conditions`, `closed_at`); admin audit uses `timestamp` while its model defines `created_at`. The real dashboard endpoints also need authentication/ownership checks. No backend file was changed by this frontend task.

`awaiting_approval` and `rejected` are local UI simulation statuses, not additions to the database's current four-state contract. Mapping the approval phase to real API fields requires agreement with the backend team. Gemini is not currently implemented; all chat text is explicitly scripted. Chat notes are not parsed into numerical offers or conditions.

## File manifest

Modified: `app/layout.tsx`, `app/globals.css`, `app/page.tsx`, `app/products/page.tsx`, the three existing `app/dashboard/{buyer,seller,admin}/page.tsx`, and `lib/api.ts`.

Created: `lib/demo-model.ts`; `components/ui.tsx`, `components/demo-provider.tsx`, `components/site-shell.tsx`, `components/products.tsx`, `components/negotiation.tsx`, `components/demo-pages.tsx`; `app/products/[id]/page.tsx`, `app/products/[id]/negotiate/page.tsx`; three `app/dashboard/{buyer,seller,admin}/[...segments]/page.tsx`; `app/login/page.tsx`, `app/register/page.tsx`, `app/profile/page.tsx`, `app/notifications/page.tsx`; `app/loading.tsx`, `app/error.tsx`, `app/not-found.tsx`; `tests/verify-demo.cjs`; this document.

The previous `lib/mock-data.ts`, `.env.local`, package manifests and backend/infra files are preserved. Next.js may write generated development output under `.next`.

Verification artifacts: `verification/desktop.jpg` and `verification/mobile.jpg`.

## Verification performed

- TypeScript: `tsc --noEmit --incremental false` passed.
- `node tests/verify-demo.cjs` passed: both modes, approval/idempotence, rejection/cancellation terminal states, failed scenario, low budget, disabled agent, discount limits, stock recheck, notifications, role-scoped selectors, fixture isolation, preserved API URLs/cache, 404/server errors and production Mock protection. Network calls were test doubles, not connections to FastAPI.
- 34 documented frontend URLs returned HTTP 200 in local development without `fetch failed`.
- Browser: buyer search/details/setup/rounds/approval/deal notification, rejection, failed scenario and cancellation; seller add/edit product, decimal prices, zero stock, invalid and valid rules; admin synthetic suspension; role navigation and absence of buyer budget in seller session display.
- Responsive browser checks: mobile width 390 and tablet width 820; catalog and admin page had no document-level horizontal overflow. Desktop layout was visually reviewed. Temporary viewport settings were reset.
- Browser error log was empty at final inspection. Production deployment, actual FastAPI connectivity, official PDF issuance, image upload and Gemini were not exercised.
- A default auto-accept price with three decimal places was found during browser form testing and fixed to two decimal places.


## Two-agent simulation update

Each deterministic turn records the agent, action (offer/counteroffer/accept), SAR price, round and explanation. Buyer proposals start at a lower public-price-based amount and rise towards the buyer's own willingness, never above the authorized budget. Seller counteroffers start at the public asking price and decrease towards the effective seller floor (minimum plus discount constraint). Each agent evaluates the opposing public proposal against its own limits. No hidden price is included in message explanations.

An acceptance copies the actual opposing proposal into an explicit agreed price, validated against both parties' bounds. Semi-automated sessions wait for buyer confirmation; automated sessions close eligible agreements. Approval is idempotent. Rejection and cancellation never create a deal or reduce stock. History counts rounds, not individual agent messages.

The setup screen offers agreement, conservative failure, buyer rejection and cancellation scenarios. The failure scenario uses conservative willingness (buyer up to 65% and seller down to 95% of asking price, subject to their own limits), so ordinary listings exhaust the allowed rounds without a match. Agreement scenarios can also fail naturally when budget and floor do not overlap or too few rounds are available. Rejection requires semi-automated mode; cancellation is available before completion.

The engine retains synthetic private state inside the provider and exposes only role-projected state plus bound actions to consumers. View updates are merged without erasing another role's private data. This is still a local demo, not a production security boundary: all actual access control must be enforced by FastAPI when integrated.

Validation includes 28 combinations of budget and maximum rounds, strict agent alternation, increasing buyer offers/decreasing seller counteroffers, decimal-price boundaries, final-round acceptance, natural failure, both modes, all four scenarios, stock/deal/notification consistency, and serialized role-projection checks. Existing API-contract and production Mock-protection tests remain in place.

Files changed for this update: lib/demo-model.ts, components/demo-provider.tsx, components/negotiation.tsx, components/demo-pages.tsx, tests/verify-demo.cjs, and this document. The FastAPI API helper and existing Mock-mode environment settings were not changed.

Browser verification for the two-agent update: alternating proposals and semi-automated buyer approval completed a deal; the conservative failure scenario exhausted four rounds; rejection and cancellation created no deal; automated agreement completed without a confirmation step. The completed agreement appeared in the seller workspace with no buyer budget displayed. Mobile width 390 showed no page-level horizontal overflow, and the browser error log was empty. Preview artifact: `verification/two-agents.jpg`.

## Admin reports (mock-only)

The existing Admin > Reports navigation now opens seller, buyer and individual negotiation reports. Search and status filters select an entity; the report covers all its currently available local records. Reports update from the shared projected demo state and never call reporting APIs. The component requires mock mode and the demo admin identity. This is not production authorization.

The report builder uses an explicit allowlist of account, public listing, offer, session and deal fields. It excludes private budgets, seller rules, tokens and passwords. Success rate is completed sessions / all selected-entity sessions; zero sessions is unavailable, not 0% success. Transaction totals sum recorded deal prices in halalas and are not payments, profit or revenue verification. Missing offer timestamps and separate approval audit records are explicitly disclosed. Semi-automated completion is labelled as an inferred approval from status.

Downloads are real files: UTF-8 BOM CSV (quoted cells and formula-prefix protection), and A4 PDF with native browser canvas English text and left-to-right alignment. PDF pages embed JPEG images; PDF text is not searchable/selectable and is not a tagged accessible PDF. The HTML preview and CSV provide text alternatives. No new packages, external fonts, network reporting calls or persistence were added. Generation IDs are local demo identifiers, not backend-issued report records.

Validation: TypeScript no-emit, tests/verify-demo.cjs, tests/verify-reports.cjs; actual seller PDF and CSV downloads; completed session preview/PDF; buyer empty state; mobile 390x844 with no document overflow; PDF parsed/rendered with bundled Poppler and visually checked for readable text, dates and multiple pages. Evidence is in verification/admin-reports.jpg and verification/report-pdf-corrected.png. Earlier report-pdf-page.png and report-pdf-2.png / report-pdf-3.png are pre-correction QA captures.

Production work still needed: authenticated admin authorization, authorized reporting DTOs/APIs, stable seller/session relationships and historical product snapshots, explicit approval events/timestamps, durable report IDs and audit records, and server-enforced data policy. Existing FastAPI contracts and mock environment configuration remain unchanged.


## English-only language and layout

All application-owned text in app/, components/ and lib/ is English. The root document and Reports use lang="en" and dir="ltr". Reports, previews, PDF headings/footers, CSV metadata, validation messages and empty states use English labels. Sidebar links display Negotiation Sessions and Agreements while retaining their existing /negotiations and /deals routes. Account identities display Buyer, Seller and Admin role labels.

Report generation, session start and Agreement dates share en-GB formatting with an explicit UTC timezone (for example, 13 Oct 2026, 10:00:00 UTC); stored timestamps and identifiers retain their original formats. PDF text is left-aligned and rendered as page images; its existing search/accessibility limitations still apply. User-entered content and backend-provided names are preserved rather than automatically translated.

Validation: TypeScript no-emit; verify-english.cjs scans 31 frontend source files for Arabic text/RTL attributes and verifies root/Reports/PDF direction; verify-reports.cjs checks English dates and labels, data scope, privacy and CSV/PDF structure; verify-demo.cjs preserves all negotiation and API checks. Browser verification covered all three role dashboards, Buyer/Seller session histories, two-agent conversation, report types, status/search filters, empty states and actual PDF/CSV downloads. Mobile Reports at 390x844 had no document overflow and browser error logs were empty. The downloaded English PDF was parsed and visually rendered with Poppler. Evidence: verification/admin-reports-english.jpg and verification/reports-english-pdf.png. Older Arabic screenshots are historical QA evidence, not runtime assets.
