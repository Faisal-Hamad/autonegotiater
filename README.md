# AutoNegotiater

An automated negotiation system for C2C marketplaces. This is the IT 499 graduation project (Qassim University).

**Live:** https://autonegotiater.com · **API docs:** https://autonegotiater.com/api/docs

## Stack
| Layer | Tech |
|---|---|
| Frontend | Next.js 15 (App Router, TypeScript, Tailwind) |
| Backend | FastAPI, SQLAlchemy (async), Alembic |
| Background jobs | Celery + Redis |
| Database | PostgreSQL 17 |
| Proxy / TLS | nginx + Cloudflare Origin Certificate |
| Runtime | Podman (rootless) on AlmaLinux 10, EC2 |
| CI/CD | GitHub Actions, deploy over SSH |

## Repo layout
```
frontend/            Next.js app + Containerfile
backend/             FastAPI app, Alembic migrations, seed.py, Celery worker
infra/compose.yaml   all services (podman-compose)
infra/nginx/         reverse proxy config
infra/backup/        daily pg_dump script
infra/systemd/       backup timer units
.github/workflows/   deploy pipeline
docs/                plan, server setup, problems log
```

## Local development
Backend (needs a local PostgreSQL and Redis, or run the whole stack with compose):
```bash
cd backend
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
export DATABASE_URL=postgresql+asyncpg://autoneg:autoneg@localhost:5432/autoneg
alembic upgrade head
python seed.py
uvicorn app.main:app --reload           # http://localhost:8000/docs
```
Frontend:
```bash
cd frontend
npm install
API_INTERNAL_URL=http://localhost:8000 npm run dev   # http://localhost:3000
```

## Deployment
Every push to `main` deploys automatically. GitHub Actions connects to the server over SSH, pulls the code, rebuilds only the services whose folders changed, and runs a health check. See [.github/workflows/deploy.yml](.github/workflows/deploy.yml).

The first-time server steps are in [docs/server-setup.md](docs/server-setup.md).

Useful commands on the server (as `deploy`):
```bash
cd /var/www/autonegotiater
podman ps
podman logs -f autoneg-fastapi
podman exec autoneg-fastapi python seed.py                          # fake data
podman exec -it autoneg-postgresql psql -U autoneg autoneg           # SQL shell
```

## Demo accounts (from seed.py)
| Email | Role |
|---|---|
| `seller1@demo.autonegotiater.com` … `seller3@…` | seller |
| `buyer1@demo.autonegotiater.com`, `buyer2@…` | buyer |

Password for all demo accounts: `Demo@1234`
