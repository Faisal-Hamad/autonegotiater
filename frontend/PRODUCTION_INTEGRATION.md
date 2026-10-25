# Production frontend integration

This frontend is the authenticated production application. Buyer, Seller and Admin identities come from server-issued HttpOnly sessions, never a client role selector. Configure the backend origin for your environment; do not place secrets in NEXT_PUBLIC variables. Production mock data remains disabled.

Use the separate app at ../demos/autonegotiater-multi-seller-demo/frontend (relative to repository root: demos/autonegotiater-multi-seller-demo/frontend) for the original local mock prototype. Do not deploy that demo to the production domain.

See ../docs/releases/GITHUB_PUBLICATION_20261026.md and MODEL_MATCHING_RELEASE_20261025.md for source provenance, checks, remaining prerequisites and deployment coordination. Existing listings need actual Seller delivery settings; no values are invented automatically.

Backend/table additions are already deployed in the documented release. Never run migrations or release scripts against another environment without reviewing its current schema, container names, backups and routing. Historical guarded scripts intentionally refuse mismatched state.
