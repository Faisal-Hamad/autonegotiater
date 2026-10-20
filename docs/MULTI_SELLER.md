# One Buyer, Many Sellers (with Competitive Leverage & Data Isolation)

Following the supervisor's feedback, the main negotiation flow is **one buyer negotiating with many sellers at the same time**. The earlier flow, **one buyer with one seller**, is kept as an option on each product page.

## How it works

1. **Select:**
   - **1-Click Category Selection (`/products/<id>`):** On any product page, the buyer can press **Negotiate with N competing sellers in `<Category>`** to automatically select up to 5 competing listings in the same category and start immediately.
   - **Custom Selection (`/products`):** Or in the marketplace, the buyer presses **Add to multi-seller negotiation** on 2 to 5 listings that would all satisfy them, then **Negotiate with these sellers** in the bar at the bottom of the screen.
2. **Configure (`/negotiate?products=1,2,3`):** The buyer ranks the listings (most preferred first) and sets:
   - one private **maximum budget** for any of the listings;
   - **what matters most**: lowest price (weight 0.8), balanced (0.5) or preferred listing (0.2);
   - the **mode** (semi-automated or automated), warranty and delivery.
3. **Negotiate with Competitive Leverage (`/dashboard/buyer/requests/<id>`):**
   - The system creates one **request** and one negotiation session per listing.
   - Each press of **Run round** plays one round (buyer offer, then seller response) in every session that is still bargaining.
   - **Competitive Leverage (Round 2+):** Before each round runs, the system captures a snapshot of the **lowest seller counteroffer from the previous round** across all sellers in the request (`competing_offer`). The buyer agent uses this anonymous competing offer as leverage with the other sellers, and competing seller agents accelerate their concessions to undercut the competing quote (without ever crossing their confidential floor price).
4. **Choose:** When no session is bargaining any more:
   - **semi-automated:** the buyer sees every agreed offer, with the highest score marked as recommended. They select any offer, can change the selection freely, then press **Confirm agreement**. Confirmation is final. The other sessions close as `not_selected`.
   - **automated:** the agent closes the agreed offer with the highest score.
   - If no seller agreed, the request fails.

## Comparing different products (Utility Score)

Each offer gets a **utility score** from 0 (worst) to 1 (best):

```
score = w × price_score + (1 − w) × preference_score

price_score      = (budget − price) / (budget × 0.5), limited to 0..1
                   (full marks when the price is half the budget or less)
preference_score = 1 − rank / (listings − 1)
                   (1 for the buyer's first choice, 0 for the last)
w                = the "what matters most" weight
```

An offer above the budget scores **0**. The score is stored in `offers.utility_score` (the `weighted_score` attribute of the ERD figure) and is visible to the buyer only.

## The buyer and seller agents' rules

- **Price cap per listing:** In each session the buyer agent never offers more than the listing's public price (`min(budget, base_price)`).
- **Competitive Leverage:** In round $r \ge 2$, if another seller in the same request offered $p_{\text{comp}}$ in round $r - 1$ lower than a seller's scheduled concession, the seller agent lowers its counteroffer toward $\max(\text{floor}, p_{\text{comp}} - \max(25\text{ SAR}, 2\% \times p_{\text{comp}}))$.
- **Acceptance (`AC_next`):** In multi-seller sessions the buyer agent accepts a seller counteroffer only if it is no higher than the agent's own next offer (accounting for competitive leverage), or if no rounds are left.
- **Run to the last round:** Bargaining continues with every seller until each session has agreed or failed, so every seller can still lower its price before the buyer chooses.
- **One agreement per request:** Request actions lock the request row (`SELECT ... FOR UPDATE`), and only the confirmed session creates a deal.

## Server-Side Role-Scoped Data Isolation (`NFR-03`)

All `/api/workspace/*` endpoints enforce role-scoped projections and ownership checks on the server using `viewer_id` / `X-Viewer-Id`:
- **Buyer view:** Receives only the buyer's own sessions, requests, deals, and notifications. Seller `rules` (`minimum`, `discount`, `threshold`) and engine `privateLimits` are stripped on the server.
- **Seller view:** Receives only rules and sessions for products owned by that seller. Buyer `budget`, `utility` scores, and multi-seller `requests` are stripped on the server.
- **Admin view:** Receives operational monitoring data for sessions, multi-seller requests, deals, and audit logs, with confidential buyer `budget`, `utility` scores, and seller `rules`/`privateLimits` stripped on the server.
- **Admin Reports (`PDF` / `CSV`):** Includes a dedicated **Multi-Seller Request Report** as well as a **Multi-Seller Requests** section inside Buyer Reports.
