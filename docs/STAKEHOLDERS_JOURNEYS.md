# Stakeholder Journeys Specification

This document formally specifies the end-to-end user journeys for the primary stakeholders of the **AutoNegotiater** platform: the **Buyer**, the **Seller**, and the **System Administrator**. It outlines the interaction touchpoints, autonomous AI agent delegation, and privacy preservation mechanisms across each phase of the transaction lifecycle.

---

## 1. Buyer Journey

**Primary Goal:** Enable buyers to discover desired products and autonomously negotiate optimal transaction terms (price, warranty, delivery) without psychological friction, time investment, or disclosing their true budget limit.

```
[Discover Product] ➔ [Configure Reservation Limits] ➔ [Delegate to AI Agent] ➔ [Monitor Live Rounds] ➔ [Human-in-the-Loop Confirmation] ➔ [Deal Settlement & Review]
```

### Detailed Lifecycle Phases:
1. **Discovery & Exploration (Pre-Negotiation):**
   - The buyer browses the catalog (`/products`) filtered by category or keyword.
   - Evaluates product condition, descriptions, and public base prices. Secret reservation prices remain strictly obscured (NFR-03).
2. **Preference & Budget Elicitation (Configuration):**
   - Initiates negotiation by selecting *Start Negotiation*.
   - Specifies a confidential **Maximum Budget (`max_budget`)**, securely stored and never shared with the counterparty or seller's agent.
   - Sets non-price condition preferences (acceptable delivery timeframes, required warranty period).
   - Selects operational mode:
     - **Automated Mode:** The agent finalizes the agreement autonomously once terms fall within budget.
     - **Semi-Automated Mode (Default - FR4):** The agent negotiates the terms, but requires explicit final buyer confirmation before closing.
3. **Autonomous Negotiation Execution (During Session):**
   - The buyer's AI agent initiates bargaining rounds via background Celery tasks.
   - Counter-offers are calculated using mathematical concession curves (e.g., time-dependent Boulware/Conceder strategies).
   - The buyer tracks session status, round history, and current offers live from the Buyer Dashboard (`/dashboard/buyer`), with full authority to manually abort the session at any time (FR9).
4. **Human-in-the-Loop Approval & Finalization (Post-Negotiation):**
   - When a mutual convergence occurs, the buyer receives a comprehensive deal summary card detailing final agreed price, warranty duration, and delivery method.
   - In semi-automated mode, the buyer explicitly approves (`Confirm Deal`) or rejects the agreement.
5. **Settlement & Feedback:**
   - The transaction is recorded in the immutable `deals` ledger.
   - The buyer provides a 1-to-5 star rating and feedback on the seller and the negotiation experience (FR6).

---

## 2. Seller Journey

**Primary Goal:** Protect profit margins through confidential floor pricing while providing 24/7 automated bargaining that converts interested buyers without manual intervention.

```
[List Item] ➔ [Set Secret Floor Price & Concession Rules] ➔ [Activate AI Agent] ➔ [Monitor Performance on Dashboard] ➔ [Fulfill Order]
```

### Detailed Lifecycle Phases:
1. **Product Ingestion (Catalog Setup):**
   - The seller lists a new item specifying product title, category, description, physical condition, and initial public base price (`base_price`).
2. **Negotiation Boundary Formulation (Seller Rules - FR8):**
   - Configures the strictly confidential **Minimum Acceptable Price (`min_acceptable_price`)**, acting as an unbreakable floor for the agent.
   - Sets the **Auto-Accept Threshold**: A price boundary where the AI agent is authorized to accept immediately without further counter-offers.
   - Configures operational limits: Maximum negotiation rounds allowed (`max_rounds`, e.g., 6 rounds) to prevent resource exhaustion and stall tactics.
3. **Autonomous Operation & Real-Time Monitoring:**
   - The product enters the `Agent Enabled` state.
   - The seller's agent handles incoming inquiries and counter-proposals concurrently across multiple buyers without performance degradation (NFR-02).
   - From the Seller Dashboard (`/dashboard/seller`), the seller monitors active negotiations, completed transactions, and stock levels.
4. **Fulfillment & Deal Reconciliation:**
   - Upon successful deal closure, the seller receives a notification and order summary containing the agreed terms.
   - Dispatches the physical item according to the agreed shipping condition.

---

## 3. System Administrator Journey

**Primary Goal:** Maintain platform health, monitor operational throughput, enforce compliance with fair trading rules, and audit negotiation integrity.

```
[Authenticated Admin Access] ➔ [System Metrics Oversight] ➔ [User & Role Governance] ➔ [Security & Audit Log Inspection]
```

### Detailed Lifecycle Phases:
1. **Administrative Access & Authentication:**
   - Accesses the dedicated administration portal (`/dashboard/admin`) with role-based access verification.
2. **Platform KPI Oversight:**
   - Monitors aggregate system indicators:
     - Total registered buyers and sellers.
     - Active versus completed negotiation sessions.
     - Successful deal closure rate and average price concession percentage.
     - Catalog inventory across product categories.
3. **Account & Listing Governance:**
   - Reviews registered accounts, manages verification statuses, and handles account suspension for fraudulent behavior.
4. **Security & Audit Trail Verification:**
   - Inspects the immutable `audit_logs` table for system anomalies:
     - Verification that confidential pricing fields (`min_acceptable_price` and `max_budget`) have not been leaked.
     - Investigation of dispute reports or repeated aborted sessions.
     - Monitoring background Celery queue performance and database health.

---

## Stakeholder Interaction Matrix

| Dimension | Buyer | Seller | Administrator |
|---|---|---|---|
| **Primary Input** | Maximum Budget (`max_budget`), utility weights | Floor Price (`min_price`), concession rules | Governance policies, audit queries |
| **Confidential Data** | Reservation price hidden from seller | Floor price hidden from buyer | No access to raw payment credentials |
| **Agent Autonomy** | Full or semi-automated with human approval | Delegated autonomous rule execution | Oversight of agent health and timeouts |
| **Core Interface** | Catalog (`/products`), Buyer Hub (`/dashboard/buyer`) | Seller Hub (`/dashboard/seller`), Rule Editor | Admin Portal (`/dashboard/admin`), Audit Logs |