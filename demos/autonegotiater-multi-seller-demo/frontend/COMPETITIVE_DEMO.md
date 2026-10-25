# Competitive negotiation — integrated Buyer journey

## Open the prototype

Start in Browse Products: http://127.0.0.1:3001/products

1. Choose any available product and open its details.
2. Review matching Sellers, public prices, stock and synthetic delivery estimates.
3. Enter quantity, target and maximum unit prices, delivery deadline and round limit.
4. Confirm **Start Competitive Negotiation**. Viewing a product or visiting a URL never starts a negotiation.
5. Follow Seller status cards, the round timeline and one selected conversation. Pause, resume or advance one message at a time.
6. When the simulation completes, compare all results, select any eligible Agreement and explicitly approve the preference.
7. **Restart demo** removes this Buyer's session for this product and returns to its details to enter fresh requirements.

Details routes: /products/[id]. Progress routes: /products/[id]/competitive. Direct progress URLs without a started session return a Ready to negotiate state linking to product details. The Buyer sidebar links to Browse Products, not to a hardcoded Dell session. One-to-one negotiation remains at /products/[id]/negotiate.

## Catalog matching and local data

All seven seed products have explicit shared catalog identities, including condition/specification distinctions where present. Seller listings refer to these identities; display names and partial similarity are never matching rules. Dell retains its dedicated sample inventory. The other products have deterministic synthetic same-catalog Seller listings with distinct prices, floors, stock and delivery. A new product created through the existing local Seller form gets its own unique local catalog ID and only its registered owner; alternate Sellers are not inferred from a matching name.

Details update exclusions as quantity/deadline change. Insufficient-stock and incompatible-delivery Sellers receive no Buyer messages. Invalid price/quantity/round requirements are rejected before starting. Seller status labels are Ready (discovery only), Negotiating, Agreed, Rejected and Excluded. Buyer views never receive private Seller floors or concession configuration. Seller/Admin competitive views never receive the Buyer's private requirements.

Sessions are isolated by both Buyer ID and product ID and survive client navigation. Refresh resets all local state. The public product price and stock are read from current shared demo state when starting; Seller inventories/requirements are then held as the session snapshot. This experiment does not reserve stock or mutate the original mock dashboards.

## Progressive deterministic engine

The original round-based price engine is retained. A private pending-round queue interleaves the independent histories, then publishes exactly one new message every 400 ms. Pending future messages, target results and private inventory fields are excluded by the view projection. One manual step reveals one message; final comparison and approval are hidden until all queued messages and rounds finish.

Each Buyer Agent opens at the selected target and stays within the maximum. Seller quotes are bounded by their private floors and never increase. Anonymous competition uses only eligible opposing quotes from the previous fully completed round, avoiding processing-order advantage. Seller explanations distinguish scheduled concessions from an actual reduction caused by a competing quote and show public before/after prices. Both agents must explicitly accept the same quote, with catalog, quantity and delivery constraints satisfied, before a Seller is Agreed.

The engine stops at the round limit or after a complete round with no further price improvement. Results rank eligible Agreements by unit price, then delivery, then Seller ID. Agreements during running are provisional agent Agreements, not purchases. Buyer approval is allowed only after completion and only for an eligible matching acceptance pair.

The Dell defaults remain 10 units, target 4,000 SAR, maximum 4,300 SAR and 7 days with six rounds. Sony, furniture and other products default to one unit, product-relative target/maximum prices and a seven-day deadline. Buyers can edit all requirements. Quotes are demo amounts; tax, fees and fulfillment are not modelled.

## Compact interface

The progress page contains a compact requirement summary and timeline, a Seller card grid, one active conversation with a round filter, a compact anonymous-price panel with expandable history, and a completed-only comparison with an explicit approval action. All histories remain saved independently and can be reviewed by selecting a Seller. Existing colors, panels, badges and responsive styling are reused.

## Validation commands

- node tests/verify-competitive.cjs — existing 114 requirement scenarios plus all seven products, 424 progressive ticks, round/step equivalence, exact matching, no name matching, eligibility, anonymity, price bounds, matching acceptances, private view projection, manual approval and restart.
- node tests/verify-demo.cjs — existing one-to-one scenarios and API contract checks.
- node tests/verify-reports.cjs — report/export/privacy checks.
- node tests/verify-english.cjs — English and LTR checks.
- node node_modules/typescript/bin/tsc --noEmit --incremental false
- npm.cmd run build — Next.js compilation/type validation and optimized build. No standalone lint script/configuration is present; no new lint dependency was installed.
- npm.cmd run dev -- --hostname 127.0.0.1 --port 3001

## Scope and safety

Only the isolated copy's frontend source is changed. Keep frontend/.env.local as USE_MOCK_DATA=true. The existing FastAPI helper, legacy engine, backend, infra and package manifests remain unchanged. No Gemini, production API/database, AWS, GitHub, Git initialization or deployment operation is used. The original project's source hashes and protected backend/infra hashes are compared against verification/safety-baseline.json.

All limits and identities are synthetic and client-local; this is not production authorization or confidentiality. Approval records a local preference only, never an order, payment, completed legacy deal or stock reservation. The inherited locked dependency versions are preserved.

## Files modified for the journey improvement

- lib/competitive.ts — catalog-scoped inventory, eligibility and progressive event queue.
- components/competitive-provider.tsx — Buyer/product-scoped state and bound actions.
- components/competitive-negotiation.tsx — reusable details setup and compact progress/results UI.
- components/products.tsx — integrated setup for every product; generic catalog entry.
- components/site-shell.tsx — Browse Products entry instead of a fixed-product session.
- tests/verify-competitive.cjs — expanded matching and progressive tests.
- COMPETITIVE_DEMO.md — current usage and architecture.

Generated verification/build/runtime files stay in this isolated copy. The existing /products/[id]/competitive route implementation and other application route contracts are reused.

## Browser verification for the integrated journey

Starting from Browse Products, Sony and iPhone completed product selection > details/setup > explicit start > progressive messages > final comparison > manual approval. Before confirmation there was no session/transcript; the paused initial state had round 0 and zero messages. A manual tick published one message. Only one active conversation was rendered, Seller switching and the round filter preserved full independent histories, and final comparison was absent while running. Sony's transcript showed an actual anonymous-price-driven reduction of a scheduled quote. Both the best and a faster, non-cheapest eligible alternative were approved only after explicit selection. Restart returned to details with default requirements and no session/history.

Sofa discovery showed stock/deadline exclusions while editing requirements; an impossible request produced no eligible Agreement and disabled approval. Existing Buyer/Seller/Admin overview routes, Admin Seller report preview, and creation/advancement of an original one-to-one negotiation were checked. No browser console errors were recorded. The browser viewport override did not reliably honor the requested phone dimensions in this session, so no exact phone-size visual verification is claimed; the existing responsive utility layout is preserved.
