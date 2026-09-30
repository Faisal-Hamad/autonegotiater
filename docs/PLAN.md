# AutoNegotiater — IT 499 Implementation Plan (Weeks 2–15)

## Context
- Phase 1 (IT 498) is done: `Automated_Negotiation_System_Final.pdf` covers chapters 1–4. It defines 11 FRs, 10 NFRs and 8 ERD tables: User, Product, SellerRules, NegotiationSession, Offer, Deal, Rating, AuditLog.
- Phase 2 (IT 499) is where we build the system. There are 15 weekly deliveries, and Week 1 (tech stack) is already submitted.
- Where things stand now:
  - The server is set up (AlmaLinux 10, Podman, Cloudflare + Origin Certificate). See `docs/server-setup.md`.
  - The repo has the week 2 skeleton: backend, frontend, infra and the CI workflow.
- **Important:** Fig. 4.1 in the Phase 1 report shows **Laravel + MySQL + Sanctum/Reverb**, but the new stack is **FastAPI + PostgreSQL**. Chapter 5 needs a short "Changes from the design" paragraph that explains why we changed:
  - Python is the natural language for the NLP/AI negotiation engine (FR11).
  - Celery runs the negotiation rounds in the background (NFR-01, NFR-02).
  - PostgreSQL has JSONB for multi-attribute offer conditions (FR2) and `pgcrypto` for encrypting fields (NFR-04).
  - The three-tier idea stays the same: only the Application Layer touches the Data Layer.

---

## 1. Tech stack decision

| Component | Verdict | Note |
|---|---|---|
| AlmaLinux + Podman | ✅ Keep | Watch out for **SELinux**: add `:Z` to volume mounts. Rootless Podman can't bind ports 80/443 by default. |
| nginx | ✅ Keep | Reverse proxy: `/` → nextjs, `/api` → fastapi, `/media` → uploaded images. TLS uses a Cloudflare Origin Certificate. |
| Next.js | ✅ Keep | Same as Phase 1. It talks **only** to FastAPI. |
| FastAPI | ✅ Keep | Holds all the business logic: auth, negotiation engine, privacy filter, scoring. |
| GitHub Actions (SSH deploy) | ✅ Added | CI/CD: a push to `main` connects over SSH, pulls, rebuilds only the changed services and health-checks. |
| celery-worker + redis | ✅ Keep | Redis does three jobs: Celery broker, cache, and pub/sub for live notifications. |
| **PostgreSQL** | ✅ Keep, in Podman | This is the only database. It is **not exposed** outside the Podman network. |
| **Supabase** | ❌ Dropped | We don't need it. The frontend never talks to the DB directly (NFR-03), so what Supabase would really give us is hosted Postgres + Auth. Free projects also get paused after about a week of inactivity, which is a risk on demo day. |

What replaces Supabase features:
- **Auth:** FastAPI issues JWTs. Passwords are hashed with argon2 (`pwdlib`, or use `fastapi-users`). The token goes in an httpOnly cookie.
- **Realtime notifications (FR7):** a FastAPI WebSocket or SSE endpoint, fed by Redis pub/sub. The Celery worker publishes the events.
- **File storage:** a Podman volume served by nginx at `/media`. Moving to S3 later is optional.
- **Backups:** a daily `pg_dump` run by a systemd timer, with the last 7 dumps kept (you can also copy them to S3).
- **DB GUI:** pgAdmin or DBeaver over an SSH tunnel (`ssh -L 5432:...`).

**Privacy rule (NFR-03):** API response schemas (Pydantic) must never include `min_acceptable_price`, `max_budget` or `seller_rules` for the other party. Write a test for this.

Final stack:
```
AlmaLinux (EC2)
└── Podman (podman-compose; podman-restart.service brings containers back on boot)
    ├── nginx          :80/:443  (TLS, reverse proxy, /media)
    ├── nextjs         :3000
    ├── fastapi        :8000
    ├── celery-worker
    ├── redis          :6379 (internal only)
    └── postgresql     :5432 (internal only, volume pgdata:Z)
```

---

## 2. Week 2 — detailed tasks

### 2.1 Server — ✅ done (details in `docs/server-setup.md`)
- AlmaLinux 10, `deploy` user with linger, rootless Podman + podman-compose (from EPEL), low ports allowed with sysctl, firewalld, fail2ban.
- Domain on **Cloudflare (Proxied)** with a **Cloudflare Origin Certificate** in Full (Strict) mode. This replaces certbot: it lasts 15 years with no renewal.
- The repo is cloned at `/var/www/autonegotiater` with a read-only deploy key.
- Still to do on the server:
  1. Copy `.env.example` to `.env` and fill in real values (`chmod 600`).
  2. CI/CD: GitHub Actions deploys over SSH (the secrets are set). Every push to `main` deploys.
  3. Run `systemctl --user enable --now podman-restart.service` as `deploy`, so containers come back after a reboot.
  4. Enable the backup timer from `infra/systemd/`.
- **Smoke test:**
  - `https://autonegotiater.com` shows the Next.js page.
  - `https://autonegotiater.com/api/health` returns `{"status":"ok","db":"ok"}`.

### 2.2 Repo structure (start coding)
```
autonegotiater/
├── frontend/                  Next.js (App Router, TypeScript, Tailwind)
├── backend/
│   ├── app/main.py            FastAPI app, /api/health, /api/products
│   ├── app/db.py              SQLAlchemy async engine (asyncpg) → postgresql
│   ├── app/models/            ORM models mirroring ERD tables
│   ├── app/schemas/           Pydantic response models (privacy filter lives here)
│   ├── app/worker.py          Celery app (broker=redis)
│   ├── alembic/               DB migrations
│   ├── seed.py                fake data script
│   └── Containerfile
├── infra/compose.yaml         nginx, nextjs, fastapi, celery-worker, redis, postgresql
├── infra/nginx/default.conf
├── infra/backup/              pg_dump script
├── infra/systemd/             backup timer units
├── .github/workflows/deploy.yml  CI/CD (SSH deploy)
├── docs/                      PLAN.md, server-setup.md, problems.md
├── .env.example
└── README.md
```
The minimum code to show this week:
- **Backend:** `GET /api/health` (checks the DB), `GET /api/products` and `GET /api/products/{id}`. Neither products endpoint returns `min_acceptable_price`.
- **Frontend:** a landing page, plus a `/products` page that lists products from the API.

### 2.3 Schema (the ERD in PostgreSQL)
The ERD stays almost 1:1 with the Phase 1 report. Type mapping:

| Phase 1 type | PostgreSQL type |
|---|---|
| `INT PK` | `bigint generated always as identity` |
| `NVARCHAR` | `text` / `varchar` |
| `NVARCHAR(MAX)` conditions/details | `jsonb` |
| `DATETIME` | `timestamptz` |
| `BIT` | `boolean` |
| `TINYINT` score | `smallint` with `CHECK (score BETWEEN 1 AND 5)` |
| Status/Role columns | `CHECK` constraints |

Tables: `users`, `products`, `seller_rules`, `negotiation_sessions`, `offers`, `deals`, `ratings`, `audit_logs`. Create them with the first Alembic migration.

Note these differences in Chapter 5:
- The password is hashed with **argon2**, not SHA-256 as in Table 4.1. Plain SHA-256 is too fast to be a safe password hash.
- NFR-04: `max_budget` and `min_acceptable_price` can be encrypted with `pgcrypto` (optional, week 12). The EBS volume should also be encrypted.

### 2.4 Fake products (requirement 1)
`backend/seed.py` is a Python script so it can hash passwords with the same code as the app. It creates:
- 3 sellers and 2 buyers, all with known demo passwords.
- About 25 products across 5 categories: Electronics, Furniture, Vehicles/Parts, Home Appliances, Sports. Prices are in SAR.
- For every product: `min_acceptable_price` < `base_price` (about 70–90% of it), and stock between 1 and 10.
- A `seller_rules` row for about 10 of the products, so we're ready for week 5.

Run it with `podman exec fastapi python seed.py`.

### 2.5 problems.md (requirement 4)
`docs/problems.md` has one entry per problem, grouped by area (Server, Backend, Frontend, CI/CD). Every member adds to it.
```markdown
### N. Short title
- **Problem:** ...
- **Cause:** ...
- **Fix:** ...
```
Problems we'll probably hit and should record:
- SELinux blocking volumes (fix: `:Z`)
- Rootless Podman and port 80
- DNS propagation delay
- Postgres data lost when the container is recreated without a named volume
- The FastAPI container starting before Postgres is ready (fix: healthcheck + retry)
- CORS between the frontend and the API

### 2.6 Suggested split (for 3–4 members)
- A: server + domain + TLS + compose
- B: PostgreSQL schema (Alembic) + seed script
- C: FastAPI skeleton + products endpoints
- D: Next.js skeleton + products page

---

## 3. Roadmap: Weeks 3–15

| Wk | Deliverable | Covers |
|---|---|---|
| 3 | **Auth**: register, login and logout in FastAPI (argon2 + JWT in an httpOnly cookie). Choose a role (buyer or seller). Profile page. Role-based route guards. | FR3, FR5 |
| 4 | **Seller product management**: CRUD for products. Image upload to the `/media` volume. Product search and filter for buyers. | FR8 |
| 5 | **Seller rules UI + API**: min price, max discount, max rounds, auto-accept threshold. Validation. Setup must take under 2 minutes. | FR8, NFR-07 |
| 6 | **Negotiation engine v1 (price only)**: start a session with a max budget. A rule-based concession strategy (time-dependent, Boulware/Conceder). One Celery task per round. Privacy filter. | FR1, NFR-03 |
| 7 | **Offers and sessions**: offer history for each round. Session states (Active/Completed/Failed/Cancelled). Manual abort. Every event goes to the audit log. | FR6, FR9, NFR-06 |
| 8 | **Multi-attribute**: warranty, delivery time and condition stored in `offers.conditions` (JSONB). Offer scoring module with weighted utility. | FR2 |
| 9 | **Human-in-the-loop + deals**: in semi-automated mode, the user must approve before a deal closes. Deal record, plus a deal summary page and PDF. | FR4, FR10, NFR-05 |
| 10 | **NLP chat interface**: an LLM (for example the Claude API) turns engine decisions into natural-language messages, and extracts offers and conditions from user messages. The engine keeps the numbers, so the LLM never sees the hidden limits. | FR11, NFR-08 |
| 11 | **Notifications + ratings**: WebSocket or SSE fed by Redis pub/sub, with in-app alerts for a new offer or a closed deal. Ratings after a deal. Negotiation history dashboard. | FR7, FR6 |
| 12 | **Hardening**: concurrency test with many sessions, Redis caching, rate limiting, HTTPS headers, `pgcrypto` for sensitive fields, test a backup restore, PDPL/data-protection notes. | NFR-01/02/04/10 |
| 13 | **Testing**: pytest unit tests for the engine and the privacy filter. API integration tests. A Playwright end-to-end test of the happy path. Usability test with real users (reuse the survey participants). | Ch. 6 |
| 14 | **Report**: Chapter 5 (Implementation, including the stack changes and screenshots), Chapter 6 (Testing and Evaluation), Chapter 7 (Conclusion). Bug fixes. | Ch. 5–7 |
| 15 | **Final**: feature freeze, demo data, presentation, final report, polished repo README. | — |

Keep a buffer: if any week slips, week 12 (hardening) can shrink.

---

## 4. Verification (how we know each week is done)
- **Week 2:**
  - `https://autonegotiater.com` loads over HTTPS.
  - `/api/health` returns ok, including the DB check.
  - `/products` shows the seeded products **without** `min_acceptable_price` in the JSON.
  - Ports 5432 and 6379 are **not** reachable from outside.
  - The data survives `podman-compose down && up` and `sudo reboot`.
  - The repo has the structure above plus `problems.md`.
- **Each later week:** a short demo of that week's FRs on the live domain, plus a merged PR on GitHub and new entries in problems.md.
