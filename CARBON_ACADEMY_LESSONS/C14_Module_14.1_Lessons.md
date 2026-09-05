# C14: Marketplace & Trading
## Module 14.1: Market Participants & Trading (3 lessons × 40min = 2h)

### Lesson 14.1.1: Market Participants — Roles, Incentives & Interactions
**Lesson Code:** C14.1.1
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** india_ether_track

**Learning Objectives:**
1. Identify and categorize all major carbon market participants and their incentives (Bloom: Understand)
2. Analyze the interaction dynamics between project developers, intermediaries, buyers, and regulators (Bloom: Analyze)
3. Map the value chain from project origination to credit retirement (Bloom: Apply)

**Prerequisites:** C10.1.1, C11.1.1, C11.2.1

**Why This Matters:**
The carbon market is not a single entity — it's an ecosystem of diverse participants with different motivations, constraints, and power dynamics. Understanding who does what, why, and how they interact is essential for navigating the market, structuring deals, and anticipating market moves.

**Core Concept: Market = Participants × Incentives × Interactions × Rules**

### 14.1.1.1 Participant Taxonomy — The Carbon Market Ecosystem

| Participant Category | Sub-Categories | Primary Motivation | Key Constraints |
|----------------------|----------------|-------------------|-----------------|
| **Project Developers** | RE, Forestry, Industrial, Cookstoves, Blue Carbon | Revenue from credit sales; project ROI | CAPEX, additionality, MRV costs, methodology |
| **Intermediaries** | Brokers, Aggregators, Exchanges, Retailers | Commission, spread, arbitrage | License, capital req, reputation |
| **Compliance Buyers** | Airlines (CORSIA), Industrials (CCTS, EU ETS), Utilities | Regulatory compliance at lowest cost | Mandates, vintage rules, quality floors |
| **Voluntary Buyers** | Corporates (Net Zero), Events, Individuals | Brand, ESG, stakeholder pressure | Claim rules (VCMI, SBTi), budget |
| **Financial Investors** | PE/VC, Carbon Funds, Banks, Insurance | Financial return, portfolio diversification | Liquidity, horizon, ESG mandate |
| **Standards Bodies** | Verra, GS, ACR, ART, BEE, CERC | Market integrity, methodology rigor | Governance, credibility, funding |
| **VVBs/Verifiers** | DOE, VVB, Auditors | Fee income, reputation | Accreditation, liability, independence |
| **Registries** | Verra, GS, ICMS, CDM, ICMS | Transaction fees, data integrity | Governance, tech, regulatory approval |
| **Regulators** | BEE, CERC, MoP, DNA, ICAO, UNFCCC | Policy goals, market integrity | Legislation, enforcement, treaties |

### 14.1.1.2 Value Chain — From Project to Retirement

```
PROJECT DEVELOPER
    │
    ├── Project Design & PDD
    ├── Validation (VVB)
    ├── Registration (Standard Body)
    │
    ↓ ISSUANCE (Registry)
    ↓
INTERMEDIARIES
    ├── Broker/Dealer (OTC)
    ├── Exchange (IEX, PXIL, Xpansiv, CBL)
    ├── Aggregator (Pooling small projects)
    ├── Carbon Fund/Structured Products
    │
    ↓ TRADING (Multiple hops possible)
    ↓
BUYER
    ├── Compliance (CORSIA, CCTS, EU ETS, Article 6)
    ├── Voluntary (Net Zero, Carbon Neutral, BRSR, ESG)
    ├── Financial (Trading, Hedging, Arbitrage)
    │
    ↓ RETIREMENT / CANCELLATION (Registry)
    │
    ══════════════════════════════════════
    CLAIM MADE (VCMI, SBTi, CORSIA, CCTS, BRSR, Net Zero)
    ══════════════════════════════════════
```

### 14.1.1.3 Incentive Alignment & Misalignment

| Participant | Incentive | Potential Misalignment | Mitigation |
|-------------|-----------|------------------------|------------|
| **Developer** | Maximize volume, minimize cost | Overstate additionality; cut MRV corners | CCP, VVB oversight, ICVCM |
| **Broker** | Maximize volume/fee | Push low-quality credits; churn | Reputation; repeat business |
| **Buyer (Compliance)** | Minimize cost | Buy lowest quality eligible | VCMI/ICVCM quality floors |
| **Buyer (Voluntary)** | Claim credibility | Greenwashing risk; low quality | VCMI Claims Code, ICVCM |
| **VVB** | Maximize fees | Lenient verification | Accreditation; standard body oversight |
| **Standard Body** | Maximize volume/listings | Lower quality thresholds | ICVCM, stakeholder governance |
| **Registry** | Transaction volume | Lax controls for volume | Regulatory oversight; audits |

### 14.1.1.4 Interaction Dynamics — Key Relationships

| Relationship | Typical Structure | Key Tension | Governance Mechanism |
|--------------|-------------------|-------------|---------------------|
| **Developer ↔ VVB** | Developer pays VVB | Conflict of interest | Accreditation; rotation; standard body oversight |
| **Developer ↔ Standard** | Developer pays registration/issuance fees | Volume vs quality | Methodology rigor; ICVCM |
| **Broker ↔ Buyer** | Commission on volume | Push low quality | Reputation; repeat business |
| **Exchange ↔ Trader** | Fees on volume | Liquidity vs manipulation | Surveillance; position limits |
| **Buyer ↔ Registry** | Account holder | Accurate retirement | Registry rules; audits |
| **Standard ↔ Registry** | Standard sets rules; registry executes | Sync on rules; data integrity | MOU; API integration; audits |

### 14.1.1.5 Professional Judgement Points
- **Follow the money:** Trace revenue flows to understand true incentives
- **Quality > Quantity:** One high-integrity credit > ten low-integrity
- **Long-term relationships:** Repeat buyers/developers build trust; reduces due diligence cost
- **Regulatory arbitrage:** Participants will exploit gaps — anticipate regulatory evolution
- **Data asymmetry:** Sellers know more than buyers; DD is essential

### 14.1.1.5 Practical Exercise: Market Mapping
*Scenario:* Map the participant ecosystem for a **50 MW Solar Project in Rajasthan (VCS, AMS-I.D)** from development to retirement.
*Tasks:*
1. List all participant categories involved (min 8)
2. Map the value chain with revenue/fee flows
2. Identify 3 key misalignment risks and mitigations
*Time:* 30 min
*Deliverable:* Participant map + Value chain diagram + Risk mitigation table
*Time:* 35 min
*Rubric:* Completeness (40%), accuracy (30%), insight (30%)

**Knowledge Check:**
1. Who bears the risk if a VVB is found negligent after issuance?
2. Why might a broker prefer selling older vintages?
3. What is the "regulatory arbitrage" in carbon markets?
4. How does ICVCM change the Standard ↔ Developer dynamic?

**Sources:**
1. ICROA — Code of Best Practice (Market Participants)
2. ICVCM — Core Carbon Principles (Market Integrity)
3. Verra/GS — Participant Guidelines
4. ICVCM — Assessment Framework
4. IETA — Market Participant Survey (2024)
5. IETA — Market Integrity Report (2024)

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC (Market structure evolving) | Regulatory Review: Quarterly*

---

### Lesson 14.1.2: Trading Mechanics — OTC, Exchange, Settlement & Products
**Lesson Code:** C14.1.2
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** professional

**Learning Objectives:**
1. Compare OTC vs Exchange trading: mechanics, liquidity, price discovery, counterparty risk (Bloom: Analyze)
2. Execute trade workflows: negotiation, confirmation, settlement, registry transfer (Bloom: Apply)
3. Structure carbon products: spot, forwards, options, structured notes (Bloom: Create)

**Prerequisites:** C14.1.1, C10.1.1, C10.2.1

**Why This Matters:**
Trading is where carbon credits become financial assets. Understanding the mechanics — from negotiation to settlement — lets you execute efficiently, manage risk, and structure products that meet both buyer and seller needs. Poor trade execution leads to failed deliveries, price disputes, and regulatory breaches.

**Core Concept: Trade = Agreement + Settlement + Registry Transfer = Risk Transfer**

### 14.1.2.1 Trading Venues — OTC vs Exchange

| Dimension | **OTC (Over-the-Counter)** | **Exchange (IEX, PXIL, Xpansiv, CTX)** |
|-----------|----------------------------|----------------------------------------|
| **Liquidity** | Low-Medium (bilateral) | High (centralized order book) |
| **Price Discovery** | Bilateral negotiation; opaque | Transparent; order book; VWAP |
| **Counterparty Risk** | Bilateral (KYC, credit checks) | Cleared (CCP) or Exchange-guaranteed |
| **Standardization** | Bespoke contracts | Standardized contracts (lot, vintage, quality) |
| **Transparency** | Low (bilateral) | High (pre/post-trade reporting) |
| **Regulation** | Bilateral contract law | Exchange rules + CERC/SEBI |
| **Settlement** | Bilateral (DvP via registry) | DvP via exchange clearing corp |
| **Cost** | Negotiated (broker fee ~0.5-1%) | Exchange fees + clearing fees |
| **Volume Suitability** | Large blocks, bespoke | Standard lots, high frequency |
| **Anonymity** | High (bilateral) | Low (pre/post-trade transparency) |

**When to Use Which:**
- **OTC:** Large blocks (>50k), bespoke terms, vintage-specific, structured products
- **Exchange:** Standard lots, price discovery, high frequency, compliance buying
- **Hybrid:** Exchange for price discovery → OTC for execution (common)

### 14.1.2.2 Trade Workflow — From Negotiation to Settlement

**OTC Trade Lifecycle:**
```
1. NEGOTIATION
   Buyer ↔ Seller (or Broker) → Term Sheet → SPA/ERPA
       Key Terms: Volume, Vintage, Price, Delivery Date, Registry, Labels, Reps & Warranties

2. PRE-SETTLEMENT
   KYC/AML (both parties)
   Registry Account Setup (both parties)
   SPA/ERPA Execution (digital signature)
   Escrow Setup (if applicable)

3. SETTLEMENT (T+0 to T+2)
   a) Seller initiates Registry Transfer (Serial Range → Buyer Account)
   b) Registry validates (balance, freeze, vintage, labels)
   c) Registry confirms Transfer → Credits in Buyer Account
   d) Buyer confirms receipt → Releases Payment (Escrow/DvP)
   e) Registry confirms Settlement Complete

4. POST-TRADE
   Trade Reporting (Exchange/Registry)
   Confirmation & Documentation
   Invoice & Payment (if not DvP)
```

**Exchange Trade Lifecycle (IEX/PXIL/Xpansiv):**
```
1. ORDER ENTRY → 2. MATCHING → 3. CLEARING (CCP) → 4. SETTLEMENT (T+1 DvP) → 5. REPORTING
```

### 14.1.2.3 Settlement — DvP, Escrow, Atomic Swap

**Delivery vs Payment (DvP) — The Gold Standard:**
```
LEG 1 (Carbon): Registry Transfer (Seller → Buyer)
                    ↓ (Atomic / Simultaneous)
LEG 2 (Cash):     Payment Transfer (Buyer → Seller)
```
- **Registry DvP:** Verra/GS/ICMS support atomic transfer+payment
- **Escrow Agent:** Holds funds until registry confirms transfer
- **Atomic Swap (Blockchain):** ERC-1155/ERC-20; smart contract enforces DvP

**Settlement Risk Mitigation:**
| Risk | Mitigation |
|------|------------|
| **Settlement Failure** | DvP; Escrow agent; CCP clearing |
| **Partial Fill** | Pro-rata allocation; kill switch |
| **Registry Failure** | Contingency clause; manual fallback |
| **Counterparty Default** | Margin; collateral; parent guarantee; credit insurance |
| **Regulatory Block** | Force majeure; termination rights; price adjustment |

### 14.1.2.3 Carbon Products — Beyond Spot

| Product | Structure | Use Case | Pricing |
|---------|-----------|----------|---------|
| **Spot** | Immediate delivery, T+0/T+1 | Immediate compliance, spot arbitrage | Spot price |
| **Forward** | Fixed price, future delivery (3M-24M) | Hedging; budget certainty | Forward curve (spot + carry) |
| **Forward (Indexed)** | CPI+spread; GCF-linked | Inflation hedge; long-term contracts | Index + spread |
| **Option (Call/Put)** | Right to buy/sell at strike | Hedging; speculation | Black-Scholes + carbon vol |
| **Swap** | Fixed-for-floating carbon price | Hedging carbon price risk | Swap curve |
| **Tolling** | Project delivers credits; buyer markets | Project upside; buyer takes market risk | Revenue share |
| **Pre-Payment** | Buyer pays upfront for future delivery | Capex funding; discount to spot | Construction finance |
| **Streaming/Royalty** | Upfront payment for % of future credits | Non-dilutive capex | Expansion finance |
| **Carbon-Linked Bond** | Coupon/principal paid in credits | Green bond alternative | Project finance |
| **Tokenized Credit** | ERC-20/1155 on blockchain | DeFi, fractional, programmable | Emerging |

### 14.1.2.4 Professional Judgement Points
- **OTC for relationships, Exchange for liquidity:** Use both strategically
- **DvP is non-negotiable:** Never release credits without payment confirmation
- **Vintage specificity:** Always specify vintage in contract; avoid "current vintage" ambiguity
- **Force Majeure must include:** Registry outage, standard body rule change, export ban
- **Know your counterparty:** KYC/AML is not optional — regulatory requirement

### 14.1.2.4 Practical Exercise: Trade Structuring Workshop
*Scenario:* Structure a trade for **50,000 tCO2e VCS Solar 2023 Vintage** from a Gujarat solar farm. Buyer: EU ETS compliance fund. Seller: Indian project developer.
*Tasks:*
1. Choose venue (OTC vs Exchange) and justify
2. Draft key term sheet (10 key terms)
3. Design settlement workflow (DvP, escrow, registry transfer)
4. Identify 5 key risks and mitigations
*Time:* 40 min
*Deliverable:* Term sheet + Settlement flow diagram + Risk matrix
*Time:* 40 min
*Rubric:* Commercial logic (30%), risk allocation (30%), operational feasibility (20%), India specifics (20%)

**Knowledge Check:**
1. Why is DvP (Delivery vs Payment) critical in carbon trades?
2. What is the difference between "ex-warehouse" and "delivered" in registry terms?
3. Why might a buyer prefer OTC over exchange for a 50k credit block?
4. What is "vintage risk" and how do you contract for it?

**Sources:**
1. ICROA — Code of Best Practice (Trading)
2. Verra/GS/ICMS — Trading & Settlement Guides
3. IEX/PXIL — Trading Rules & Settlement Procedures
4. ICROA — Code of Best Practice (Trading)
4. IETA — Market Structure Report (2024)
5. ISDA — Emission Reduction Transaction Documentation

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC (Market structure evolving) | Regulatory Review: Quarterly*

---

### Lesson 14.1.3: Market Products & Structuring — Spot, Forwards, Options & Structured Notes
**Lesson Code:** C14.1.3
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** professional

**Learning Objectives:**
1. Design carbon financial products: spot, forwards, options, swaps, structured notes (Bloom: Create)
2. Analyze pricing, hedging, and risk management for each product type (Bloom: Analyze)
3. Structure products for specific buyer mandates: compliance, voluntary, financial (Bloom: Create)

**Prerequisites:** C14.1.1, C14.1.2

**Why This Matters:**
The carbon market is evolving beyond simple spot trades. Forwards, options, swaps, and structured products enable hedging, speculation, and tailored risk-return profiles. Understanding product structuring lets you create value, manage risk, and serve diverse buyer mandates.

**Core Concept: Carbon Product = Payoff Profile × Risk Allocation × Regulatory Compliance**

### 14.1.3.1 Product Taxonomy — The Carbon Product Spectrum

| Product Category | Instruments | Typical Tenor | Primary Users |
|------------------|-------------|---------------|---------------|
| **Spot** | Spot credits | Immediate | Compliance, spot arbitrage |
| **Forwards** | Fixed/Indexed forwards | 3M-36M | Hedgers, corporates |
| **Futures** | Exchange-traded futures | 1M-24M | Exchanges, hedgers, speculators |
| **Options** | Calls, Puts, Collars, Swaptions | 3M-24M | Hedgers, speculators, structurers |
| **Swaps** | Carbon swaps, Basis swaps | 1-10 yr | Corporates, utilities, funds |
| **Structured** | Tolling, Pre-pay, Streaming, Linked notes | 5-20 yr | Project finance, corporates |
| **Tokenized** | ERC-20/1155, fractional | Perpetual | DeFi, retail, fractional |

### 14.1.3.1 Forward & Futures — The Workhorses

**Forward Contract (OTC):**
```
TERM SHEET:
• Underlying: X tCO2e Vintage Y VCS/GS/CCC
• Price: $X/tCO2e (Fixed) OR Index + Spread (e.g., GCF + $2)
• Volume: X tCO2e (firm) OR Range (min/max)
• Delivery: Registry transfer to Buyer account by [Date]
• Settlement: T+1 DvP (Registry + Cash)
• Force Majeure: Policy, Registry, Verification, Force Majeure events
```

**Futures Contract (Exchange):**
| Feature | Carbon Futures (e.g., ICE, CME, future IEX) |
|---------|---------------------------------------------|
| **Contract Size** | 1,000 tCO2e (standard lot) |
| **Tick Size** | $0.01/t or ₹1/t |
| **Expiry** | Monthly/Quarterly (Mar, Jun, Sep, Dec) |
| **Settlement** | Physical (registry transfer) or Cash |
| **Margins** | Initial + Variation (SPAN) |

**Pricing — Forward Curve Construction:**
```
Forward Price = Spot × (1 + r)^T + Storage Cost - Convenience Yield
For Carbon: Forward ≈ Spot + Cost of Carry (registry fees, insurance) - Convenience Yield
```
- **Contango:** Forward > Spot (normal; storage cost > convenience yield)
- **Backwardation:** Forward < Spot (scarcity; high convenience yield)

### 14.1.3.2 Options & Volatility Products

**Option Structures:**
| Option Type | Payoff | Use Case |
|-------------|--------|----------|
| **Call** | Max(Spot - Strike, 0) | Buyer hedges price rise |
| **Put** | Max(Strike - Spot, 0) | Seller hedges price fall |
| **Collar** | Long Put + Short Call | Floor + Ceiling; zero-cost collar |
| **Swaption** | Option to enter swap | Hedging forward exposure |
| **Asian Option** | Avg price over period | Smooth volatility |
| **Barrier Option** | Knock-in/out at barrier | Tail risk hedging |

**Volatility Surface (Carbon):**
| Tenor | ATM Vol | 25Δ Call Skew | 25Δ Put Skew |
|-------|---------|--------------|--------------|
| 3M    | 35%     | +2%          | -3%          |
| 6M    | 40%     | +3%          | -4%          |
| 12M   | 45%     | +4%          | -5%          |
| 24M   | 50%     | +5%          | -6%          |

*Carbon vol is high (30-60%) due to policy/event driven jumps*

### 14.1.3.2 Swaps & Structured Products

**Carbon Swap:**
```
Party A pays: Fixed $/tCO2e × Volume
Party B pays: Floating (Index) × Volume
Settlement: Net cash (quarterly/annual)
```
- **Use Case:** Project locks in carbon revenue; Buyer hedges compliance cost

**Structured Products:**
| Product | Structure | Target Investor |
|---------|-----------|----------------|
| **Carbon-Linked Note** | Principal protected; coupon = f(Carbon Price) | Yield-seeking, ESG |
| **Carbon-Linked Bond** | Principal repaid in credits/cash | Green bond investors |
| **Streaming/Royalty** | Upfront $ for % of future credits | Project finance |
| **Pre-Pay / Forward Purchase** | Upfront cash for future credits | Project finance; capex funding |
| **Carbon-Linked Loan** | Repayment in credits/cash | Project finance; no debt capacity |
| **Tokenized Credit** | ERC-20/1155 on-chain | DeFi, fractional, programmable |

### 14.1.3.3 Product Structuring — Matching Buyer Mandate

**Product Selection Matrix:**
| Buyer Mandate | Best Product | Why |
|-------------|--------------|-----|
| **Compliance (CORSIA)** | Spot + Forward (CORSIA-eligible vintages) | Certainty of eligibility |
| **Net Zero (SBTi)** | Spot + Forward (CCP-eligible) | Claim defensibility |
| **Corporate Hedging** | Collar / Swap | Budget certainty |
| **Trading/Arbitrage** | Futures / Options | Liquidity, leverage |
| **Project Finance** | Pre-pay / Streaming / Royalty | Capex funding |
| **DeFi/Innovation** | Tokenized Credits | Fractional, programmable |

### 14.1.3.3 Professional Judgement Points
- **Match product to mandate:** Don't sell a swap to a buyer who needs spot for compliance
- **Liquidity first:** Only structure what you can hedge or exit
- **Regulatory perimeter:** Some products = securities (prospectus, licensing)
- **Counterparty risk:** Structure collateral/margin for OTC derivatives
- **Tax/Accounting:** Carbon credit treatment varies (inventory vs financial asset)

### 14.1.3.3 Practical Exercise: Product Design Workshop
*Scenario:* Structure a product for: **(A)** Indian airline needing CORSIA compliance (50k tCO2e/yr × 3 yrs), **(B)** European corporate with Net Zero 2030 target (200k tCO2e over 5 yrs), **(C)** Project finance for 100 MW solar + storage (pre-pay carbon stream).
*Tasks:*
1. Select optimal product for each
2. Draft key term sheet (price, volume, tenor, delivery, risk allocation)
3. Identify regulatory/accounting/tax considerations per product
*Time:* 45 min
*Deliverable:* Product selection matrix + 3 term sheets + risk matrix
*Time:* 45 min
*Rubric:* Product-fit (40%), term sheet completeness (30%), regulatory awareness (30%)

**Knowledge Check:**
1. Why use a collar instead of a straight forward for compliance hedging?
2. What makes a carbon swap "basis risk" different from interest rate swap basis risk?
3. When does a pre-pay agreement become a security (regulatory perimeter)?
4. How does tokenization change the regulatory perimeter for carbon credits?

**Sources:**
1. ICROA — Code of Best Practice (Product Structuring)
2. ISDA — Emission Reduction Transaction Documentation
3. Verra/GS — Product Templates
4. ISDA — Emission Reduction Transaction Documentation
4. MNRE/SECI — Model ERPA for Indian Projects
5. RBI — FEMA Guidelines for Carbon Transactions
5. CBDT — TCS/WHT Notifications for Carbon

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC (Product innovation rapid) | Regulatory Review: Quarterly*