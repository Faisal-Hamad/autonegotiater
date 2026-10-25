# Historical checkpoint (superseded by verified deployment below)

# Integration status — 2026-10-25

Production cutover: NOT PERFORMED.

## Authentication prerequisite
The owner confirmed existing access used a demo identity selector, not known passwords. Real role selection must be derived from authenticated server sessions. Existing account passwords must be activated privately by the owner before cutover. Never send passwords in chat. SET_EXISTING_ACCOUNT_PASSWORD.ps1 is an interactive owner-operated helper; it changes an existing account password only when explicitly executed and confirmed. It has not been executed by the agent.

## Validation
- Latest candidate TypeScript check: PASS.
- Deterministic negotiation engine: 8 tests PASS.
- Real report regression test: PASS, including actual catalog identity and unavailable prices.
- Previous isolated staging integration suite: 45 HTTP assertions PASS.
- Previous isolated production build: PASS (r3).
- Latest catalog identity correction: local checks passed; staging image rebuild and retest remain required. Do not treat r3 staging images as containing this correction.

## Remaining release gates
1. Rebuild and retest latest candidate in isolated staging.
2. Verify actual PDF and CSV downloads after the final build.
3. Owner privately activates existing accounts, starting with Admin.
4. Verify backups and guarded rollback routing before production cutover.
5. Apply the reviewed additive migration only during approved release, without replacing existing records.
6. Switch only the intended frontend/API routing, retain old containers for rollback, and verify server-side role isolation.

The staging database contains synthetic test fixtures only. It must never be promoted or copied into production. Production mock data stays disabled. Payment processing, delivery fulfillment and real AI integration are not implemented by the deterministic negotiation engine.


# Verified deployment update — 2026-10-25

Production cutover: COMPLETED. Frontend r6 and authenticated backend r4 are active. Mock data is disabled. Migration 0003 added two integration/auth tables; original business records were not replaced. Owner activated Admin privately. Latest TypeScript, build, staging navigation and 45 HTTP assertions passed; PDF/CSV downloads verified. Public browser confirmed 67 existing products and product details. See PRODUCTION_RELEASE_REPORT_20261025.md for immutable image IDs, rollback, account and listing prerequisites, and remaining limitations. No GitHub changes or pushes.


# New evidence — model/storage matching release (2026-10-25)

Supersedes the r6/r4 runtime and rollback instructions above: frontend r7 and backend r5 are now deployed, Nginx SHA256 79f6c1e809b9cc5befaa78be36aa7c9b5b82afa6ab8ecf255ae68e982450bd37. Existing catalog IDs/records unchanged; no new migration. Three real iPhone 15 Pro 256GB variants now appear with differences. Latest checks: 21 unit tests, 45 legacy HTTP assertions, 22 new variant HTTP assertions, TypeScript and build PASS. See MODEL_MATCHING_RELEASE_20261025.md and release/rollback_model_matching.py for current behavior, limitations and rollback. Historical evidence above is preserved.
