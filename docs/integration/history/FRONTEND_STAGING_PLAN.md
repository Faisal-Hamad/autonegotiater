# Frontend Staging Preparation — 19 October 2026

## Status and approval checkpoint

PREPARED LOCALLY ONLY. Do not execute these server commands, transfer files, create containers, alter Nginx, or cut over traffic without explicit approval of the final commands and targets. Public release is NO-GO. This package provides a frontend-only isolated preview with private features blocked; it is NOT a replacement for the running application.

The AWS reference is partial working-tree source, not verified against the running image. Reported frontend target: `autoneg-nextjs-secure`; backend: `autoneg-fastapi`. Reported branch main/SHA `0be5da348fd7c38da41f1628a4420135e02e2cd8` does not include a proven record of dirty source changes. No production Nginx/Podman configuration is copied into the package.

## Package

`frontend/release/artifacts/autonegotiater-frontend-staging-20261019.zip` and adjacent `.zip.sha256`. `SOURCE_MANIFEST.json` inside records each file SHA-256. This is an allowlisted source package, not a Linux image or a bundle built on Windows for deployment. Rebuild on the target-compatible Linux platform only after approval.

Included: frontend app/components/lib/public, package/lockfile and necessary Next/TypeScript/PostCSS config, staging Containerfile and ignore files. Excluded: all `.env*`, private keys, backend, infra, Git, tests/fixtures, node_modules, caches, verification files and all build output. Review manifest/checksum before approving transfer. The source scan blocks common private-key/AWS/GitHub token patterns; it is not proof that every possible secret format is absent.

The local `.env.local` remains unchanged with local Mock mode. It is NOT packaged. The package forces USE_MOCK_DATA=false at build and runtime; the code additionally requires NODE_ENV=development to enable Mock. No production credentials or API origins are provided. API_INTERNAL_URL defaults to loopback port 9, intentionally unreachable. This is an offline frontend preview, not a claim of working persistence.

## Exact proposed isolated-container commands — NOT EXECUTED

Run as existing non-root `deploy` user on AlmaLinux only after approval. First confirm actual home, directory/name/port availability and rootless network support. Proposed new directory `/home/deploy/autoneg-frontend-staging-r1`, image `localhost/autoneg-frontend-staging:r1`, container `autoneg-nextjs-staging-r1`, host port **127.0.0.1:33107**. Any collision or different deploy home requires revising and reapproving the commands; never overwrite an existing path/container/tag.

Read-only preflight:

```sh
id -un
podman info --format '{{.Host.Security.Rootless}}'
ss -ltn '( sport = :33107 )'
podman ps -a --filter name=autoneg-nextjs-staging-r1 --format '{{.Names}} {{.Status}}'
podman images localhost/autoneg-frontend-staging:r1 --format '{{.ID}}'
test ! -e /home/deploy/autoneg-frontend-staging-r1
```

The port query must show no listener; name/image/path checks must confirm no collision. Check availability of unzip/curl and cached node:22-alpine without installing anything. Existing production containers need no change. Transfer approval remains pending: SSH host, restricted transport and exact upload command must be confirmed separately; none is invented or executed here.

After approval and successful preflight, create the new directory with `mkdir -m 700 /home/deploy/autoneg-frontend-staging-r1`. Stop if it already exists. The exact file-transfer command still requires separate review of the SSH destination. After approved upload of the ZIP and checksum into that directory, verify using the checksum generated locally (also compare it through a trusted channel), then extract/build:

```sh
cd /home/deploy/autoneg-frontend-staging-r1
sha256sum -c autonegotiater-frontend-staging-20261019.zip.sha256
unzip autonegotiater-frontend-staging-20261019.zip -d source
cd source
podman build --pull=never --label autoneg.purpose=isolated-staging -f Containerfile -t localhost/autoneg-frontend-staging:r1 .
podman run -d --name autoneg-nextjs-staging-r1 --label autoneg.purpose=isolated-staging --network slirp4netns:allow_host_loopback=false -p 127.0.0.1:33107:3000 --read-only --tmpfs /tmp:rw,noexec,nosuid,size=64m --tmpfs /app/.next/cache:rw,nosuid,uid=1000,gid=1000,size=64m --cap-drop=all --security-opt=no-new-privileges --pids-limit=128 --memory=512m --cpus=1 -e NODE_ENV=production -e USE_MOCK_DATA=false -e API_INTERNAL_URL=http://127.0.0.1:9 localhost/autoneg-frontend-staging:r1
```

`--pull=never` requires an approved cached base image; if missing, STOP and approve a digest-pinned base before any pull. Build-time npm ci occurs inside a future isolated container, not on the server host; it downloads dependencies from the registry and needs review/network access. It was not run by this task. Resolve/pin the Linux base digest and validate Node 22 before release; local checks used Node 24.21.0. Rootless Podman/slirp/read-only compatibility has NOT been tested on EC2. If unsupported, stop and revise the plan; never fall back to host networking or privileged mode.

Do not mount production paths/secrets, join the production Podman network, use --env-file, point API_INTERNAL_URL at autoneg-fastapi, or change autoneg-nextjs-secure. No production DB writes occur because no production API connection is configured. Default rootless outbound networking is not an egress firewall; if policy requires network-enforced denial, obtain a separately reviewed network policy rather than claiming this command provides one.

## Explicit health checks

```sh
curl --fail --max-time 5 http://127.0.0.1:33107/api/health
curl --fail --max-time 5 http://127.0.0.1:33107/
curl --fail --max-time 15 http://127.0.0.1:33107/products
podman inspect --format '{{.State.Health.Status}}' autoneg-nextjs-staging-r1
```

Liveness JSON must contain status=alive, mock=false, privateFeatures=blocked, releaseReady=false. This is a NEW Next.js health route, not an invented FastAPI endpoint, and never probes bootstrap or DB. HTTP 200 on /products may contain the intended “Products are unavailable” state, so it is NOT a catalog-readiness test. Account/Reports pages must show the integration boundary, no private data and no simulated success. Check CSS/static assets in a browser via a separately approved SSH tunnel; no public Nginx route is proposed.

For genuine functional staging, a separately authorized backend and isolated non-production DB are still required. No such URL/credentials/endpoint contracts have been supplied. Do not reuse production FastAPI: GET workspace/bootstrap may write data. No tests may target production PostgreSQL.

## Rollback / cleanup — proposed, not executed

Because traffic and production containers are untouched, this preview requires no production rollback. To stop this new preview only, after verifying its staging label:

```sh
podman inspect --format '{{index .Config.Labels "autoneg.purpose"}}' autoneg-nextjs-staging-r1
podman stop autoneg-nextjs-staging-r1
```

Expected label: isolated-staging. Keep the stopped container/image/package/logs for review; no rm/prune/volume deletion is prescribed. If anything points at production, stop the staging preview and investigate without changing production data.

Future cutover remains separately blocked on exact image/source provenance, backend auth/privacy/persistence fixes, migration/backups/restore proof, verified runtime configs and all role E2E gates. Preserve existing records/Agreements and direct Seller-owned listings. Reverting an application image must not delete new Agreements or restore a database backup blindly. Neither an approved staging preview nor successful liveness authorizes public cutover.


## New evidence — 26 October 2026

This document preserves the earlier audit history. For the current authenticated production integration and model/storage matching, see docs/releases/PRODUCTION_RELEASE_REPORT_20261025.md and docs/releases/MODEL_MATCHING_RELEASE_20261025.md. Earlier NOT_VERIFIED/NO-GO statements must be interpreted with the later evidence; the copied AWS source was not proof of an identical running image. Production mock data is disabled. No staging fixtures are promoted.
