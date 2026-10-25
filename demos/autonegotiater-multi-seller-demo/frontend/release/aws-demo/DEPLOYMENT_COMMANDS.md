# Isolated AutoNegotiater AWS Demo — Commands for Approval

Prepared locally on 19 October 2026. **NOT DEPLOYED. Do not execute until explicitly approved.** These commands create only a new Demo container and never modify the existing production or staging containers, Nginx or database. No AWS connection or remote inspection was performed.

## Artifact and scope

- ZIP: `artifacts/autonegotiater-isolated-demo-r1.zip`
- Checksum: `artifacts/autonegotiater-isolated-demo-r1.zip.sha256`
- Expected SHA-256: `85ebd2ac366fd8be46141ad7d7196ff83943e88ead35eb75a6f4353a755fcf8f`
- Container: **autoneg-nextjs-demo-r1**
- Image: **localhost/autoneg-frontend-demo:r1**
- New host directory: **/home/deploy/autoneg-frontend-demo-r1**
- Host binding: **127.0.0.1:33117**, container port 3000
- Demo data lives in the visitor's browser localStorage. Buyer/Seller/Admin role selection is synthetic, not real authentication. Different browsers do not share sessions. No orders, payments, stock reservations or real database records are created.

All existing frontend routes/components are packaged: marketplace, product details, one-to-one and multi-seller journeys, Buyer/Seller/Admin workspaces, product and agent settings, Agreements, notifications, profile/login/register demo forms and Admin Reports with existing PDF/CSV generators. Unimplemented planning screens remain as originally designed; no new backend capability is claimed.

The approved UI, CSS, illustrations and negotiation engine are preserved. Only the existing banner wording changes to DEMO MODE. No Storefronts are added.

## Isolation

AUTONEG_ISOLATED_DEMO_BUILD=true is set only during the dedicated image build. next.config.ts bakes NEXT_PUBLIC_AUTONEG_DEMO_BUILD=true into the artifact; regular production builds bake false. Runtime USE_MOCK_DATA cannot convert a standard image into a Demo, and runtime flags cannot connect this Demo to real APIs.

Container startup preloads demo-network-guard.cjs before Next.js. It denies outbound application TCP/TLS/HTTP/fetch while allowing inbound HTTP serving. Browser CSP limits connections to the same origin and blocks remote images. The application uses fixtures and browser-local state only. There are no API proxy routes, DB drivers, production credentials, environment files, backend or infra in the ZIP. The guard is application-level defense, not a claim of host-wide firewall configuration. Do not remove it, add credentials, use --env-file, mount production paths, use host networking or join a production container network.

## 1. Read-only preflight — proposed, NOT EXECUTED

Log in as the existing non-root deploy user using your approved access method. SSH connection details are not in this package. Run in one Bash session:

```sh
set -eu
test "$(id -un)" = deploy
test "$HOME" = /home/deploy
test "$(podman info --format '{{.Host.Security.Rootless}}')" = true
command -v unzip
command -v sha256sum
command -v curl
command -v slirp4netns
test ! -e /home/deploy/autoneg-frontend-demo-r1
test -z "$(podman ps -a --filter 'name=^autoneg-nextjs-demo-r1$' --format '{{.Names}}')"
if podman image exists localhost/autoneg-frontend-demo:r1; then
  echo 'STOP: the new Demo image tag already exists.' >&2
  exit 1
fi
test -z "$(ss -H -ltn 'sport = :33117')"
```

Any collision or missing dependency means STOP and revise/reapprove the plan. Do not remove/restart/rename an existing container, reuse its port, or install software automatically. Rootless network and Linux Node22 image behavior remain unverified locally because no Podman/Docker engine is installed here.

## 2. New directory and separately approved upload

After explicit approval and successful preflight:

```sh
mkdir -m 700 /home/deploy/autoneg-frontend-demo-r1
```

Upload only the ZIP and its checksum into that new directory using a separately approved transport. No scp/SSH command is fabricated because the EC2 hostname and restricted transport are not supplied. The directory must be new; do not upload over /var/www/autonegotiater or an existing staging folder. No transfer has been executed.

## 3. Verify, extract and build — proposed, NOT EXECUTED

```sh
set -eu
cd /home/deploy/autoneg-frontend-demo-r1
printf '%s  %s\n' 85ebd2ac366fd8be46141ad7d7196ff83943e88ead35eb75a6f4353a755fcf8f autonegotiater-isolated-demo-r1.zip | sha256sum -c -
sha256sum -c autonegotiater-isolated-demo-r1.zip.sha256
test ! -e source
unzip autonegotiater-isolated-demo-r1.zip -d source
cd source
podman build --pull=missing --label autoneg.purpose=isolated-demo -f Containerfile -t localhost/autoneg-frontend-demo:r1 .
```

The future build pulls node:22-alpine if absent and runs npm ci --include=dev inside its dependency stage. This needs approved build-time registry access and adequate resources; no host npm install is required. No registry access, package installation or image build was performed by this task. The ZIP contains source, not Windows-generated build output. Build/review the Linux image before approving its run. Do not replace the existing staging image/tag.

## 4. Run a separate localhost-only Demo — proposed, NOT EXECUTED

```sh
podman run -d \
  --name autoneg-nextjs-demo-r1 \
  --label autoneg.purpose=isolated-demo \
  --network slirp4netns:allow_host_loopback=false \
  -p 127.0.0.1:33117:3000 \
  --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=64m,mode=1777 \
  --tmpfs /app/.next/cache:rw,nosuid,uid=1000,gid=1000,size=64m \
  --cap-drop=all \
  --security-opt=no-new-privileges \
  --pids-limit=128 \
  --memory=512m \
  --cpus=1 \
  localhost/autoneg-frontend-demo:r1
```

No production API URL, PostgreSQL connection string, Redis/Celery/Gemini setting, volume or credential is passed. No Nginx routing, production/staging restart, firewall/security-group change, DNS change or public cutover is proposed. If the rootless runtime rejects an option, stop and review; do not fall back to --privileged or --network host.

## 5. Health and isolation checks — proposed, NOT EXECUTED

```sh
podman port autoneg-nextjs-demo-r1
curl --fail --max-time 5 http://127.0.0.1:33117/api/health
curl --fail --max-time 10 http://127.0.0.1:33117/products > /dev/null
podman healthcheck run autoneg-nextjs-demo-r1
podman exec autoneg-nextjs-demo-r1 node --require /app/demo-network-guard.cjs -e "fetch('http://127.0.0.1:9').then(()=>process.exit(1),e=>{if(!e.message.includes('outbound application networking'))process.exit(1);console.log('PASS: outbound fetch blocked')})"
```

Expected mapping: 127.0.0.1:33117. Health JSON must report status=alive, mode=demo, mock=true, backendConnected=false, storage=browser-local, privateFeatures=demo-only, releaseReady=false. The final flag deliberately does not claim readiness for real transactions.

For browser access, use a separately approved SSH tunnel to server loopback port33117; do not expose port33117 publicly or change Nginx. Once the actual approved SSH host is supplied, review that exact tunnel command. Open the tunnel's local localhost URL, then:

1. Marketplace → Dell XPS15 → Start Multi-Seller Negotiation; observe progressive turns, exclusions and comparison.
2. Switch Demo identity to a participating Seller → Negotiation Sessions → the same competitive session.
3. Switch to Demo Administrator → Reports → select an entity → preview/download PDF/CSV.
4. Review Agreements and notifications. All actions remain synthetic; Profile provides a local-data reset.

No authentication security is claimed for demo role selection; never enter real personal, pricing or credential data. Keep the Demo isolated from the public production application.

## 6. Stop only this Demo — future rollback

After verifying this new container's label is isolated-demo:

```sh
podman inspect --format '{{index .Config.Labels "autoneg.purpose"}}' autoneg-nextjs-demo-r1
podman stop autoneg-nextjs-demo-r1
```

There is no production rollback because no production traffic or state changes. Preserve the stopped Demo image/container/package for review; no rm/prune/database rollback or existing staging changes are prescribed.

## Validation actually completed locally

- Nine Node test suites and TypeScript passed, including 114 competitive simulations, seven products and 424 progressive ticks.
- Both dedicated Demo and standard production Next.js builds passed. Demo standalone ran successfully with the same network guard used by the Containerfile.
- Runtime opposite flags did not change either artifact's baked mode. Twenty-four Demo route HTTP checks, CSP/CSS checks and browser Buyer→Seller shared session/Admin report preview passed.
- Exact extracted ZIP compiled successfully with portable config and without .env. A Windows dependency-junction trace-copy warning occurred in that verification context; the separate build against real installed dependencies produced and ran standalone without that warning.
- Podman/Linux/node22 image build/run is NOT_RUN, not asserted as passed; the engine is unavailable locally. No AWS, production database, backend or existing staging container was accessed.

Approval checkpoint: review the ZIP/checksum/Containerfile and these exact proposed directory/build/run commands. Approval of the isolated Demo does not authorize any production or staging replacement.
