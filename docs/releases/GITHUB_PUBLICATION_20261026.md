# GitHub publication — 26 October 2026

Repository: https://github.com/Faisal-Hamad/autonegotiater
Target: main (explicit owner instruction). Base: 6a0ef7aba45c6668b2b4f43c2808e1edb95ba639.

## Included
- Root frontend: current authenticated Buyer/Seller/Admin UI, competitive multi-seller engine adapters, model/storage matching, Seller ownership, Reports and PDF/CSV utilities.
- Root backend: reviewed production integration/authentication/model-identity additions and additive migration 0003; existing teammate models, worker, public product routes, importer, seed, requirements and previous migrations preserved.
- Original mock prototype under demos/autonegotiater-multi-seller-demo/frontend, including mock/localStorage simulations and tests. Its existing dependencies use the same patched lockfile as the production frontend; no new dependencies were added.
- The seven requested integration reports at repository root, with prior audit history retained and a dated link to newer production evidence.
- Historical project/audit documents under docs/integration/history and verified release reports under docs/releases.
- Reviewed release Containerfiles, guarded release and rollback helpers. Environment files, private account activation helper, private keys, caches, build outputs and large archives are excluded.

Root frontend is the production integration. Its default build is not an isolated mock demo. Use the separate demos app to develop with sample data. The legacy /negotiate URL redirects to Browse Products: the approved journey starts from one product's details. Legacy backend request endpoints and all teammate database models remain in place; their previous UI remains available in Git history at the base commit.

## Validation performed for this publication
- 21 backend unit tests: PASS.
- Production real report regression checks: PASS.
- English/LTR source scan (54 files): PASS.
- Public API allowlist/error handling/production mock isolation: PASS; no external requests from that test.
- Isolated demo two-agent scenarios, modes, privacy and mock protection: PASS.
- Demo PDF/CSV report structure, byte offsets and private-field exclusion: PASS.
- 114 competitive simulations and all seven product progressive-flow checks (424 ticks): PASS.
- Integrated scopes, ownership, agreement persistence/idempotency, Seller isolation, listing navigation and snapshots: PASS.
- Production frontend build and standalone output: PASS with Next.js 15.5.28. An initial Windows junction-copy warning was resolved by using a normal copy of already installed dependencies and a fresh output directory; no new packages were installed.
- Prior release evidence records 45 legacy and 22 model-matching HTTP assertions passing on isolated staging databases. Those HTTP suites were NOT run against production during this publication.
- Credential-pattern scan: no findings among files prepared for commit after redacting connection credentials in documentation examples.
- No private environment/key files, package caches, generated outputs or files over 10MB in the commit selection.

## Deployment automation
The existing workflow deploys on push to main and contains server reset/rebuild/container replacement commands. This publication commit includes [skip ci], the documented GitHub mechanism to skip push workflows. The workflow file itself is unchanged. Manual workflow_dispatch remains possible. This is source publication, not a new deployment.

GitHub Actions reference: https://docs.github.com/en/actions/how-tos/manage-workflow-runs/skip-workflow-runs

Authenticated account Rayan-Alharbi1 has repository push permission, and main was reported unprotected at inspection. This account does not have admin permission; external webhook inspection returned 404, so external webhook automation remains NOT_VERIFIED. Skipping GitHub Actions does not assert that external hooks are disabled.

Before future publishing-only pushes, coordinate the deployment workflow with the current immutable-container release. A teammate's later push without a skip instruction may run the existing deployment workflow. This publication does not modify AWS, Nginx, running containers, or the database.

## Collaboration
Before editing, pull the latest main. Commit each person's changes and push normally. If the remote advances, merge the new commits and resolve conflicts before retrying. Do not force-push or reset shared history. Updates reach each local checkout when its owner pulls them.

The original local project, original demo and deployed-candidate source remain unchanged. A separate publication checkout contains this integration.
