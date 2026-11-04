# Testing

This document describes how AutoNegotiater is tested: the tools, the test levels, the test cases and how to run them. It is the basis of the testing chapter.

## 1. Test levels and tools

| Level | What it checks | Tool | Location |
|---|---|---|---|
| Unit tests | Pure logic without a database: the shared decision engine, the buyer and seller agents, the multi-seller engine, the semi-automated seller decision, Gemini input/output validation, product model matching | `pytest` (+ `unittest` test classes) | `backend/tests/test_*.py` |
| API (integration) tests | The real FastAPI application with a real PostgreSQL database migrated by Alembic: authentication, access control, privacy, negotiation, seller decision, direct purchase | `pytest`, FastAPI `TestClient` (`httpx`) | `backend/tests/api/` |
| End-to-end (system) tests | The whole system in a real Chromium browser: frontend, backend and database together, with buyer, seller and admin accounts | Playwright for Python (`pytest-playwright`) | `e2e/` |
| Code coverage | Which backend lines the tests run | `pytest-cov` (coverage.py) | report in CI |
| Continuous integration | All tests run on every push to `main`; deployment runs only if they pass | GitHub Actions | `.github/workflows/deploy.yml` |

The test accounts and listings come from `backend/tests/seed_data.py`: buyers `buyer@test.local` and `buyer2@test.local`, sellers `seller_a@test.local` and `seller_b@test.local`, and `admin@test.local`. Seller A and Seller B sell the same phone model, so they compete in one negotiation:

| Listing | Public price | Private minimum | Role in the tests |
|---|---|---|---|
| Seller A | 3,850 SAR | 3,500 SAR | Minimum below the buyer's maximum: the agents agree |
| Seller B | 4,200 SAR | 3,900 SAR | Minimum above the buyer's maximum: the buyer reaches its last point |

The buyer requirements used in the tests are: target 3,080 SAR, maximum 3,657.50 SAR, 6 rounds, delivery within 7 days. Gemini is disabled in tests (no API key), so the agents use their fixed fallback text and the results are repeatable.

## 2. Test cases

### 2.1 Authentication and access control (API, `test_auth_api.py`)

| ID | Requirement | Steps | Expected result |
|---|---|---|---|
| TC-AUTH-01 | Strong passwords | Register with a 5-character password | 400, account not created |
| TC-AUTH-02 | Only buyer or seller can self-register | Register with role `admin` | 400 |
| TC-AUTH-03 | Registration signs the user in | Register a buyer | 200, `HttpOnly` session cookie, `/auth/me` returns the buyer |
| TC-AUTH-04 | Unique email | Register with an existing email | 400 |
| TC-AUTH-05 | Wrong password rejected | Sign in with a wrong password | 401 |
| TC-AUTH-06 | Old public demo password blocked | Sign in with `Demo@1234` | 403 |
| TC-AUTH-07 | Sign out | Sign in, sign out, call `/auth/me` | 200, 200, then 401 |
| TC-AUTH-08 | Cross-site requests blocked | `POST` from another origin | 403 |
| TC-AUTH-09 | Private pages need sign-in | Call workspace and dashboard APIs without a session | 401 |
| TC-AUTH-10 | Role checks | Buyer opens the admin and seller dashboards | 403; admin gets 200 |
| TC-AUTH-11 | Change password | Wrong current password; short new password; valid change | 400; 422; 200, other sessions signed out, old password stops working |
| TC-AUTH-12 | Suspension | Admin suspends a signed-in buyer | The buyer's next request returns 401 and sign-in fails |
| TC-AUTH-13 | Only admin suspends | Buyer tries to suspend another user | 403 |

### 2.2 Negotiation, semi-automated mode and privacy (API, `test_negotiation_api.py`)

| ID | Requirement | Steps | Expected result |
|---|---|---|---|
| TC-NEG-01 | Seller floors are private | Read the public catalog | No `minimumPrice` field |
| TC-NEG-02 | Only buyers start negotiations | Seller starts a negotiation | 403 |
| TC-NEG-03 | Input validation | Target above maximum, quantity 0, 13 rounds, unknown mode | 400 for each |
| TC-NEG-04 | The buyer concedes | Run all rounds | Buyer offers start at the target, never decrease and end at the maximum |
| TC-NEG-05 | Semi-automated: seller decides at the buyer's last point | Run all rounds in semi-automated mode; Seller B accepts | Session waits; Seller B is `awaiting_seller` with the buyer maximum; Seller B gets a notification; after acceptance the buyer can approve Seller B at 3,657.50 SAR |
| TC-NEG-06 | Only the owning seller decides, once | Buyer, then Seller A, then Seller B twice | 403, 403, 200, then 409 |
| TC-NEG-07 | Seller rejects | Seller B rejects the final offer | Seller B `declined`, buyer review starts |
| TC-NEG-08 | Automated mode | Run all rounds in automated mode | No seller decision; Seller B `declined`, Seller A `agreed` |
| TC-NEG-09 | Approval records a deal | Approve Seller A; then try to cancel | Agreement at the agreed price, stock reduced by 1; cancel returns 409 |
| TC-NEG-10 | Session ownership | Another buyer advances the session | 403 |
| TC-NEG-11 | Privacy between roles | Buyer and seller read their workspaces | Buyer never sees seller minimums; seller never sees the buyer maximum or other sellers' sessions |

### 2.3 Direct purchase without negotiation (API, `test_buy_now_api.py`)

| ID | Requirement | Steps | Expected result |
|---|---|---|---|
| TC-BUY-01 | Buy at the listed price | Buyer buys 2 units | Direct deal at 3,850 SAR, quantity 2, stock 5 → 3 |
| TC-BUY-02 | Stock check | Buy more than the stock | 409 |
| TC-BUY-03 | Buyers only | Seller tries to buy | 403 |
| TC-BUY-04 | Sign-in required | Buy without a session | 401 |
| TC-BUY-05 | Seller sees the sale | Seller A and Seller B read their deals | Only Seller A sees the direct sale |

### 2.4 Engine unit tests (`test_competitive_engine.py`, `test_shared_negotiation_engine.py`, `test_negotiation_agents.py`, `test_gemini_service.py`, `test_product_identity.py`, `test_workspace_negotiation.py`)

These check, among others: price boundaries for many budgets and round limits (no agent ever offers outside its own limits), anonymous competition, removal of private limits from the buyer view, pause and final states, rejection of invalid requirements, that inputs are never modified, the semi-automated seller decision (accept, reject, owner check, only once), that Gemini text is rejected when it changes the approved price, and model/storage matching.

### 2.5 End-to-end browser tests (`e2e/test_e2e.py`)

| ID | Scenario | Expected result |
|---|---|---|
| TC-E2E-01 | Sign in with a wrong password | Error message shown |
| TC-E2E-02 | Open the buyer dashboard without signing in | "Sign in required" |
| TC-E2E-03 | Buyer opens the admin dashboard | "does not have this role" |
| TC-E2E-04 | Buyer uses "Buy now" on a product | Redirected to agreements; "Direct purchase · No negotiation" shown |
| TC-E2E-05 | Full semi-automated negotiation: buyer starts, Seller B is notified, opens the session from the notification, accepts; buyer selects Seller B and confirms | "Recorded Agreement: Seller B" shown |
| TC-E2E-06 | Admin opens Reports, downloads the platform summary as CSV, opens a seller report | KPI tiles shown, CSV file downloaded, preview shown |
| TC-E2E-07 | Buyer changes the password from the profile | "Your password was changed." |

## 3. Results

Latest local run (3 November 2026):

| Suite | Tests | Result |
|---|---|---|
| Backend unit + API (`backend/tests`) | 94 | 94 passed |
| End-to-end (`e2e`) | 7 | 7 passed |
| Backend line coverage | 2,035 statements | 52% overall; `competitive_engine.py` 100%, `engine.py` 90%, agents 91–92%, `integration_auth.py` 72% |

The lowest coverage is in `routers/workspace.py` (26%), the older one-to-one API that the new interface no longer calls for multi-seller negotiation. In GitHub Actions, the coverage report (HTML), the JUnit XML results and screenshots of any failed browser test are saved as artifacts of every run.

## 4. How to run the tests

### Backend (needs an empty PostgreSQL database)

```bash
cd backend
pip install -r requirements.txt pytest pytest-cov httpx
export DATABASE_URL=postgresql+asyncpg://USER:PASSWORD@localhost:5432/autoneg_test
python -m pytest tests -q --cov=app --cov-report=term
```

Never point `DATABASE_URL` at the production database: the tests empty all tables first.

### End-to-end

1. Start the backend on port 8000 with the test accounts: `alembic upgrade head`, `python -m tests.seed_data`, then `uvicorn app.main:app --port 8000`, with `AUTH_COOKIE_SECURE=false` and `AUTH_ALLOWED_ORIGINS=http://127.0.0.1:3000`.
2. Build and start the frontend on port 3000 (`npm run build`, then run `.next/standalone/server.js`).
3. Run the browser tests:

```bash
cd e2e
pip install -r requirements.txt
python -m playwright install chromium
BASE_URL=http://127.0.0.1:3000 python -m pytest -q --browser chromium
```

GitHub Actions runs exactly these steps in the `backend-tests` and `e2e-tests` jobs before the `deploy` job.
