# One Buyer, Many Sellers

Following the supervisor's feedback, the main negotiation flow is **one buyer negotiating with many sellers at the same time**. The earlier flow, **one buyer with one seller**, is kept as an option on each product page.

## How it works

1. **Select.** In the marketplace (`/products`) the buyer presses **Add to multi-seller negotiation** on 2 to 5 listings that would all satisfy them, then **Negotiate with these sellers** in the bar at the bottom of the screen. A product page can add its listing with **Add to multi-seller negotiation** (`/products?select=<id>`).
2. **Configure** (`/negotiate?products=1,2,3`). The buyer ranks the listings (most preferred first) and sets:
   - one private **maximum budget** for any of the listings;
   - **what matters most**: lowest price (weight 0.8), balanced (0.5) or preferred listing (0.2);
   - the **mode** (semi-automated or automated), warranty and delivery.
3. **Negotiate** (`/dashboard/buyer/requests/<id>`). The system creates one **request** and one ordinary negotiation session per listing. Each press of **Run round** plays one round (buyer offer, then seller response) in every session that is still bargaining.
4. **Choose.** When no session is bargaining any more:
   - **semi-automated:** the buyer sees every agreed offer, with the highest score marked as recommended. They select any offer, can change the selection freely, then press **Confirm agreement**. Confirmation is final. The other sessions close as `not_selected`.
   - **automated:** the agent closes the agreed offer with the highest score.
   - If no seller agreed, the request fails.

The seller side does not change: each seller's agent negotiates one session with its own rules, and the seller does not see the buyer's budget, ranking or scores.

## Comparing different products

The listings are different products, so their prices cannot be compared directly. Each offer gets a **utility score** from 0 (worst) to 1 (best):

```
score = w × price_score + (1 − w) × preference_score

price_score      = (budget − price) / (budget × 0.5), limited to 0..1
                   (full marks when the price is half the budget or less)
preference_score = 1 − rank / (listings − 1)
                   (1 for the buyer's first choice, 0 for the last)
w                = the "what matters most" weight
```

An offer above the budget scores **0**. The score is stored in `offers.utility_score` (the `weighted_score` attribute of the ERD figure) and is visible to the buyer only.

## The buyer agent's rules

- **Price cap per listing.** In each session the buyer agent never offers more than the listing's public price (`min(budget, base_price)`).
- **Acceptance (AC_next).** In multi-seller sessions the buyer agent accepts a seller counteroffer only if it is no higher than the agent's own next offer, or if no rounds are left. Without this rule the agent accepted the seller's opening price (the full listing price) whenever it was within the budget, so no bargaining happened. One-to-one sessions keep their original rule.
- **Run to the last round.** Bargaining continues with every seller until each session has agreed or failed, so every seller can still lower its price before the buyer chooses.
- **One agreement per request.** Request actions lock the request row (`SELECT ... FOR UPDATE`), and only the confirmed session creates a deal.

## Database (migration `0002`)

| Change | Purpose |
|---|---|
| New table `buyer_requests`: `buyer_id`, `max_budget`, `mode`, `status` (`active`, `awaiting_approval`, `completed`, `failed`, `cancelled`), `preferences` (JSONB: `price_weight`, `ranking`, `warranty`, `delivery`), `created_at`, `ended_at` | One row per multi-seller request |
| `negotiation_sessions.request_id` (FK, nullable) | Links a session to its request. `NULL` means a one-to-one session |
| `offers.utility_score` (`NUMERIC(5,4)`) | The buyer-side score of each offer |

The migration runs automatically when the backend container starts (`alembic upgrade head`). Existing data is not changed.

## API (`backend/app/routers/workspace.py`)

| Endpoint | Action |
|---|---|
| `POST /workspace/requests` | Create a request: `buyer_id`, `product_ids` (2–5, most preferred first), `budget`, `mode`, `price_weight`, `warranty`, `delivery` |
| `POST /workspace/requests/{id}/advance` | Play one round in every session still bargaining |
| `POST /workspace/requests/{id}/approve` | Confirm an agreed offer: optional `session_id`, defaults to the highest score |
| `POST /workspace/requests/{id}/end` | Reject all offers or cancel the request: `buyer_id`, `status` |

The single-session endpoints (`/workspace/sessions/{id}/advance`, `approve`, `end`) return `400` for a session that belongs to a request, so a request cannot be bypassed. `GET /workspace/bootstrap` returns the requests, and each session carries its `requestId` and each turn its `utility`.

## Known limitations and next steps

- The buyer agent does not yet use the best current offer as leverage with the other sellers, and sellers do not know they are competing.
- The budget and scores are hidden by the frontend only. Like the rest of the workspace API, the endpoints have no authentication yet, so the server does not enforce who can read or change a request.
- Related literature for the report: one-to-many and concurrent negotiation (Rahwan, Kowalczyk & Pham, 2002; Nguyen & Jennings, 2004) and acceptance conditions such as AC_next (Baarslag et al.). Check the exact references before citing.
