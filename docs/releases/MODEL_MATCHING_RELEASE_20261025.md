# Model and Storage Matching — verified production update, 25 October 2026

## Approved behavior

The owner chose the same model and storage with color, condition, battery-health and included-item differences explicitly displayed. Different capacities, Pro/Pro Max editions, generations and accessories must not be merged.

## Deployed

- Frontend: `autoneg-frontend-web-r7`, image `064ea24d544bda94cca9d67b815e9a228d697d23691f55db2f88d7226d26db99`.
- Backend: `autoneg-backend-web-r5`, image `c4d05f08274bfe6dbdc9b9310abfe38d572794e2d7adae4d5b017c860c7548cc`.
- Nginx SHA-256: `79f6c1e809b9cc5befaa78be36aa7c9b5b82afa6ab8ecf255ae68e982450bd37`.
- Frontend internal API target is versioned to backend r5. Original integrated r6/r4 containers remain running for rollback.
- Production mock data remains disabled. No schema migration, production fixtures, listing creation or bulk record changes were performed for this update. Existing catalog IDs and historical sessions remain intact.

## Matching and safeguards

`product_identity.py` adds a separate read-time match key. It parses complete recognized iPhone/Galaxy model-and-capacity names with validated color/condition suffixes. It does not use substring or fuzzy-name similarity. Other products use explicit existing catalog links or identical complete public identity data; ambiguous unstructured names are not guessed. Structured SKU/model attributes remain the preferable future general solution.

The new frontend explicitly requests `matchingPolicy=model-storage-v1`. Older clients retain exact-catalog matching by default, preventing a cached older UI from silently starting negotiations for undisclosed variants. Existing sessions retain their original participants; they are not retroactively expanded.

All matching listings are displayed, including excluded stock/delivery offers with their exclusion reasons. Each card shows its own product title and public condition description. The selected conversation, comparison, approval dialog and reports preserve these details.

Final approval rechecks the selected listing and its public terms. A changed title/description or changed eligibility rejects stale approval. The canonical Agreement refers to the actual selected Seller product ID/name/description/catalog ID, not the originally browsed color. Quantity is deducted from that selected product only. Buyer budgets and Seller private floors remain server-only and role-projected.

Seller session/history projections use that Seller's actual product. No other Seller conversation or private limit is added to Seller views.

## Verified production example

`https://autonegotiater.com/products/1` now displays:

| Seller | Listing ID | Variant | Public opening price | Delivery |
|---|---|---|---|---|
| Ahmed Alharbi | 1 | Natural Titanium; 95% battery; retail box and stated warranty | SAR 3,850 | Not configured |
| Sara Alqahtani | 92 | Blue Titanium; 89% battery; two protective cases | SAR 3,700 | Not configured |
| Khalid Alotaibi | 93 | Black Titanium; 92% battery; handset only | SAR 3,790 | Not configured |

These values were read through the existing public catalog API and verified in the public browser. No direct private production record query was needed. All three currently remain excluded from negotiating because delivery is unconfigured; they still appear. No delivery estimate was invented.

## Validation

- 21 unit tests passed: 8 negotiation engine and 13 model-identity tests.
- 45 previous HTTP regression assertions passed on a fresh isolated staging database.
- 22 new HTTP assertions passed on another isolated staging database: three independent color listings matched without rewriting catalog IDs; Pro Max, 128GB and accessories excluded; old-client exact behavior retained; stale condition rejected; actual Blue variant recorded; stock deducted once; private limits isolated.
- TypeScript and final frontend production build passed (Next.js 15.5.28).
- Report regression checks passed. Report participant and Agreement fields now include actual offered product/condition.
- Staging browser verified three cards, distinct condition descriptions and switching the active Seller conversation.
- Production browser verified Ahmed/Sara/Khalid cards and their real public listing details. Production health checks passed; anonymous private workspace/auth endpoints returned 401.
- No live production negotiation or Agreement was created by the agent for testing. No real AI or payment was invoked.

## Files changed for this update

Backend:
- `backend/app/product_identity.py` (new).
- `backend/app/routers/integration.py`.
- `backend/app/competitive_engine.py`.
- `backend/tests/test_product_identity.py` (new).
- `backend/tests/model_matching_smoke.py` (new).

Frontend:
- `frontend/lib/api.ts`.
- `frontend/lib/competitive.ts`.
- `frontend/lib/demo-integration.ts`.
- `frontend/lib/integrated-reports.ts`.
- `frontend/components/competitive-provider.tsx`.
- `frontend/components/real-workspace-provider.tsx`.
- `frontend/components/competitive-negotiation.tsx`.

Release/documentation:
- `release/Frontend.Containerfile` (versioned internal API target).
- `release/deploy_model_matching.py`.
- `release/rollback_model_matching.py`.
- This report and appended release/status evidence. Previous reports remain historical evidence.

## Rollback

Private configuration backup:
`/home/deploy/backups/autoneg-model-matching-20261025-r1/nginx-before-model-matching.conf`

Expected prior SHA-256:
`be0b2f703702c47734edb708dec7f5d3ecbb3947a3bdcdfb67016ee506699aef`

The current rollback helper restores the previous authenticated r6/r4 routing only and verifies the current config hash and previous container images. It performs no database restore, downgrade or deletion. New model-matched sessions retain their records; if rolled back, an older backend may reject approval of another catalog variant, so resume such sessions only on a compatible release or restart after review.

Use the model-matching rollback helper for this release, not the historical original-release script whose hash guard targets the earlier config.

```bash
sudo -n -u deploy python3 /home/deploy/autoneg-releases/model-matching-20261025-r1/rollback_model_matching.py --check
# Only if rollback is intentionally required:
sudo -n -u deploy python3 /home/deploy/autoneg-releases/model-matching-20261025-r1/rollback_model_matching.py --apply
```

The original project, local multi-seller demo and GitHub remain untouched. Existing GitHub deployment automation was not modified; coordinate it before future pushes to avoid replacing this manually released version.