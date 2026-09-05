# C13: Indian Carbon Market & CCTS
## Module 13.2: Market Infrastructure & Compliance (3 lessons × 40min = 2h)

### Lesson 13.2.1: CCTS Market Infrastructure & Compliance
**Lesson Code:** C13.2.1
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** india_ether_track

**Learning Objectives:**
1. Navigate the CCTS trading infrastructure: exchanges, settlement, position limits (Bloom: Understand)
2. Operate the ICMS registry: accounts, transfers, CCC lifecycle (Bloom: Apply)
3. Design bridging strategies: international credits → CCC, Escert → CCC, PAT → CCTS (Bloom: Apply)

**Prerequisites:** C13.1.1, C13.1.2

**Why This Matters:**
The CCTS market infrastructure is being built in real-time. Understanding how CCCs trade, how the ICMS registry works, and how to bridge international credits or PAT Escerts into CCCs is essential for both compliance entities and voluntary market participants operating in India.

**Core Concept: CCTS Market = Regulated Exchange + Central Registry + Bridging Layer**

### 13.2.1.1 CCTS Trading Infrastructure — Exchanges & Settlement

**Recognized Exchanges (CERC-Recognized):**
| Exchange | Status | CCC Products | Settlement |
|----------|--------|--------------|------------|
| **IEX (Indian Energy Exchange)** | Recognized | Spot CCC; Future CCC (planned) | T+1 |
| **PXIL (Power Exchange India)** | Recognized | Spot CCC | T+1 |
| **NSE / BSE** | Pipeline | Spot CCC; Derivatives (planned) | T+1 |

**Trading Parameters (CERC Regulations):**
| Parameter | Rule |
|-----------|------|
| **Lot Size** | 1 CCC (1 tCO2e) minimum; standard lot = 1,000 CCCs |
| **Tick Size** | ₹1/tCO2e |
| **Price Bands** | Daily: ±10%; Annual: no circuit breaker |
| **Position Limits** | Client-level: 5% OI; Member: 15% OI; Client-level position limits per entity |
| **Trading Hours** | 9:15 AM – 3:30 PM (aligned with power market) |
| **Settlement** | T+1 (funds + CCCs); DvP via exchange clearing corp |
| **Margins** | SPAN-based + Extreme Loss Margin (ELM) |
| **Trading Hours** | Mon-Fri, 9:00-15:30 (aligned with power market) |

**Market Segments:**
| Segment | Participants | Use Case |
|---------|--------------|----------|
| **Compliance Segment** | Obligated Entities (surrender) | Surrender deadline: May 31 |
| **Voluntary Segment** | Any ICMS account holder | BRSR, voluntary claims, ESG |
| **Intermediary** | Brokers, traders, aggregators | Liquidity provision, arbitrage |
| **Article 6.2** | Authorized entities | ITMO export/import |

### 13.2.1.1 ICMS Registry — CCC Lifecycle Management

**Account Types in ICMS:**
| Account Type | Holder | Purpose | Key Features |
|--------------|--------|---------|--------------|
| **Obligated Entity Account** | Notified OEs | Compliance surrender; CCC holding | Mandatory for OEs; auto-linked to BEE ID |
| **Voluntary Account** | Any entity (corporate, individual) | Voluntary buying/retirement; BRSR claims | No compliance obligation |
| **Project Developer Account** | Registered projects | CCC issuance receipt; primary sale | Auto-credited upon issuance |
| **Exchange Clearing Account** | IEX/PXIL/NSE/BSE | Trade settlement; DvP | Segregated per member |
| **Bridge/International Account** | DNA-authorized entities | Article 6.2 ITMO import/export | CA tracking; corresponding adjustment |
| **Buffer/Buffer Pool** | BEE/ICMS | Reversal coverage | System-managed; auto-draw on reversal |

**CCC Lifecycle in ICMS:**
```
ISSUANCE → ACTIVE (Project Dev Account)
    ↓ TRANSFER
ACTIVE (Holding/Voluntary/OE Account)
    ↓ RETIREMENT (Voluntary claim / BRSR)
RETIRED (Immutable)
    ↓ SURRENDER (Compliance)
SURRENDERED (Immutable; compliance record)
    ↓ CANCELLATION (Regulatory)
CANCELLED (Immutable; quality control)
```

**Key Registry Functions:**
| Function | Description | API/Access |
|----------|-------------|------------|
| **Account Opening** | KYC + BEE verification; digital signature | Portal + API |
| **CCC Issuance** | Verified project → ICMS → Project Dev Account | Automated post-verification |
| **Transfer** | Account-to-account (DvP via exchange or bilateral) | API + Portal |
| **Retirement** | Claim specification (BRSR, voluntary, etc.) | Portal + API |
| **Surrender** | OE Compliance Account → BEE | Portal (OE only) |
| **Cancellation** | Quality control / regulatory | Admin only |
| **Reports** | Holdings, transactions, positions | Portal + API (real-time) |

### 13.2.1.2 Bridging Strategies — International ↔ CCTS

**Pathway 1: International Credits → CCC (Voluntary → Compliance)**
```
International Project (Verra/GS/CDM)
    │
    ├── Validation/Verification (VVB)
    │
    ├── ICC Registration (BEE) — Methodology mapping
    │
    ├── International Transfer (if cross-border):
    │   ├── Host Country LoA (DNA)
    │   ├── Corresponding Adjustment (CA)
    │   └── ITMO Authorization
    │
    └── ICMS Issuance → CCC (with metadata: origin, vintage, methodology, CA status)
```

**Pathway 2: Escert (PAT) → CCC (CCTS)**
```
Escert (PAT Registry)
    │
    ├── BEE Conversion Methodology (toe → tCO2e)
    │   ├── Energy activity mapping
    │   ├── Emission factor application
    │   └── Vintage mapping (PAT cycle → CCTS cycle)
    │
    └── ICMS Issuance → CCC (vintage mapped to CCTS cycle)
```

**Pathway 3: CCTS → International (Export)**
```
CCC (ICMS)
    │
    ├── DNA Authorization (LoA for ITMO export)
    │
    ├── Corresponding Adjustment (Host Country)
    │
    └── International Transfer → ITMO (Article 6.2 registry)
```

### 13.2.1.3 India-Specific Bridging Considerations

**CCTS-Voluntary Market Interplay:**
| Aspect | CCTS Compliance | Voluntary (BRSR/Voluntary) |
|----------|-----------------|----------------------------|
| **Credit Type** | CCC (compliance) | CCC (voluntary label) |
| **Registry** | ICMS (OE account) | ICMS (Voluntary account) |
| **Surrender** | Mandatory (May 31) | Voluntary (anytime) |
| **Claim** | Compliance only | BRSR, voluntary claims, ESG |

**CCTS-CORSIA Interface:**
- CORSIA-eligible CCCs (post-2020 vintage, eligible methodology) → CORSIA retirement
- CORSIA label in ICMS → auto-eligible for airline surrender
- Indian airlines subject to CORSIA → must use CORSIA-eligible CCCs

**EtherTrack Context:** Platform registry bridge handles CCTS ↔ IEX/PXIL sync; auto-generates issuance requests post-verification.

### 13.2.1.2 Professional Judgement Points
- **Exchange choice:** IEX = liquidity; PXIL = niche; NSE/BSE = future derivatives
- **Position limits:** Monitor daily; CERC penalizes breaches strictly
- **Settlement risk:** T+1 = overnight exposure; use exchange clearing corp
- **CCTS-CORSIA:** Only CORSIA-eligible CCCs for airline surrender
- **Voluntary vs Compliance:** Same CCC, different surrender account — track carefully

### 13.2.1.2 Practical Exercise: CCTS Trading & Bridging Strategy
*Scenario:* An Indian cement company (Obligated Entity) has a deficit of 50,000 tCO2e for FY2025. They hold 20,000 Escerts from PAT Cycle IV. They are evaluating: (a) Buy CCCs on IEX, (b) Convert Escerts to CCCs, (c) Buy international credits (Verra) and bridge.
*Tasks:*
1. Calculate CCC requirement (deficit = 30,000 tCO2e)
2. Evaluate Escert conversion: 20,000 Escerts × conversion ratio → CCCs
3. Compare costs: IEX CCC (₹1,200/t) vs Escert conversion (₹900/t incl. conversion cost) vs Verra VCU bridge (₹1,500/t incl. bridge + CA)
3. Assess regulatory risk: CCTS methodology changes, CERC position limits, DNA LoA timeline
4. Recommend optimal sourcing mix with timeline
*Time:* 40 min
*Deliverable:* Sourcing Strategy Memo + Cost Comparison Table
*Rubric:* Calculation accuracy (30%), regulatory understanding (30%), strategy logic (20%), timeline accuracy (20%)

**Knowledge Check:**
1. What is the settlement cycle for CCC trades on IEX? (T+1)
2. Can an Obligated Entity use a voluntary account CCC for compliance surrender? (No — must use OE compliance account)
3. What is the Escert-to-CCC conversion ratio? (Methodology-defined by BEE; toe → tCO2e)
4. Can a voluntary CCC be used for CCTS compliance surrender? (No — must be in OE compliance account)

**Sources:**
1. CCTS Notification 2023 — Trading & Registry Rules
2. CERC Draft Carbon Market Regulations (2024) — Trading, Settlement, Position Limits
3. BEE — Escert to CCC Conversion Methodology (2023)
4. CERC — Exchange Recognition & Trading Regulations
5. BEE — ICC Registration Process (International Credits → CCC)
6. DNA (BEE) — Article 6.2 LoA Process (2023)
7. EtherTrack — ICMS Bridge Architecture (Internal)

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC (CCTS market rules evolving) | Regulatory Review: Quarterly*

---

### Lesson 13.2.2: Compliance Management — Strategy, Cost Optimization & Risk
**Lesson Code:** C13.2.2
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** india_ether_track

**Learning Objectives:**
1. Build a CCTS compliance management system: targets, monitoring, surrender workflow (Bloom: Create)
2. Optimize compliance cost: internal reduction vs CCC purchase vs Escert conversion (Bloom: Analyze)
3. Manage compliance risk: penalties, banking, borrowing, regulatory changes (Bloom: Evaluate)

**Prerequisites:** C13.1.1, C13.1.2, C13.1.3

**Why This Matters:**
CCTS compliance is a recurring obligation with hard deadlines and financial consequences. A systematic approach to compliance management — from target tracking to surrender execution — transforms a regulatory burden into a managed, optimized process. This lesson teaches you to build the compliance management system that obligated entities need.

**Core Concept: Compliance = Target - Action - Surrender = Managed Risk**

### 13.2.2.1 Compliance Management System — End-to-End Workflow

**Annual Compliance Calendar:**
| Month | Activity | Owner | Key Deliverable |
|--------|----------|-------|-----------------|
| **Apr** | Target notification (BEE) | Compliance Team | Target acknowledgment |
| **Apr-Jun** | Monitoring plan submission | EHS/Operations | Approved monitoring plan |
| **Jul-Sep (Q1)** | Data collection setup | Ops/IT | Meter calibration; data systems ready |
| **Oct-Dec (Q2)** | Mid-year data review | Compliance | Mid-year progress report |
| **Jan-Mar (Q2)** | Data compilation; CCC procurement planning | Finance/Procurement | Procurement plan |
| **Apr (FY End)** | Final data compilation | Ops/Compliance | Draft Monitoring Report |
| **Apr 30** | **Monitoring Report + Verification Report due to BEE/ICMS** | Compliance + VVB | Submitted reports |
| **May 15** | Verification completion | VVB | Verification report |
| **May 31** | **SURRENDER DEADLINE** — CCCs to ICMS | Compliance/Finance | Surrender confirmation |
| **Jun 30** | BEE compliance status published | BEE | Compliance certificate |

### 13.2.2.1 Compliance Position Tracking — Real-Time Dashboard

**Key Metrics Dashboard (Monthly Update):**
| Metric | Formula | Target | Alert Threshold |
|--------|---------|--------|-----------------|
| **Cumulative Deficit/Surplus** | (Target - Actual) × Output YTD | ≥ 0 (surplus) | Deficit > 5% of annual target |
| **CCC Inventory** | Held CCCs (vintage-wise) | ≥ Deficit + 10% buffer | < 110% of projected deficit |
| **CCC Procurement Progress** | Purchased / Required Deficit | 100% by Apr 15 | < 50% by Mar 1 |
| **Banked CCCs** | Prior year surplus carried | ≥ 0 | < 20% of annual target |
| **Verification Status** | VVB schedule | Complete by Apr 15 | Not started by Mar 1 |
| **Surrender Readiness** | CCCs in compliance account | ≥ Deficit by May 15 | < Deficit by May 15 |

**Dashboard Visualization:**
```
COMPLIANCE DASHBOARD — ABC Cement (FY2025)
┌────────────────────────────────────────────────────────────┐
│ TARGET INTENSITY: 0.55 tCO2e/t │ ACTUAL YTD: 0.58 tCO2e/t  │
├────────────────────────────────────────────────────────────┤
│ DEFICIT: 96,000 tCO2e │ BANKED CCCs: 15,000                │
│ REQUIRED PURCHASE: 81,000 │ PROCURED: 45,000 (47%)         │
├────────────────────────────────────────────────────────────┤
│ ████████░░░░░░░░░░ 47% PROCURED                            │
├────────────────────────────────────────────────────────────┤
│ KEY DATES: Verification: Apr 15 │ Surrender: May 31         │
│ BUFFER: 15,000 CCCs banked │ DEFICIT AFTER BANKING: 81,000 │
└────────────────────────────────────────────────────────────┘
```

### 13.2.2.2 Compliance Cost Optimization — Decision Framework

**Compliance Options — Cost Stack (FY2025 Example):**
| Option | Cost (₹/tCO2e) | Volume Available | Lead Time | Risk |
|--------|----------------|------------------|------|------|
| **1. Internal Reduction** | Marginal Abatement Cost (MAC) curve | | | |
| - Low-cost (efficiency, WHR) | ₹500-800/t | 15,000 tCO2e | 6-12 mo | Low |
| - Medium (fuel switch, RE) | ₹800-1,500/t | 25,000 tCO2e | 12-24 mo | Medium |
| - High (CCS, electrification) | ₹2,500+/t | Large | 3-5 yr | High |
| **2. CCC Purchase (IEX)** | ₹1,100-1,300/t | Unlimited | T+1 | Market risk |
| **3. Escert → CCC Conversion** | ₹900-1,100/t (incl. conversion) | 20,000 Escerts avail | 30-60 days | Conversion risk |
| **4. International Bridge** | ₹1,400-2,000/t | Unlimited | 60-90 days | Regulatory (CA, DNA) |
| **4. Internal Reduction (new)** | MAC curve | Project-specific | Project timeline | Project risk |

**Optimization Model (Linear Programming):**
```
MINIMIZE: Total Compliance Cost = Σ (Option Cost_i × Volume_i)
SUBJECT TO:
  Σ Volume_i ≥ Total Deficit (after banking)
  Volume_Escert_Conversion ≤ Available Escerts
  Volume_Internal_Reduction_i ≤ Project_Capacity_i
  CCC_Purchase_t ≤ Registry_Availability_t
  Banking_Potential ≥ 0
  Borrowing ≤ 10% of Target
```

### 13.2.2.2 Compliance Cost Optimization — Decision Matrix

**Decision Matrix (Example — 50,000 tCO2e Deficit):**
| Strategy | Volume (tCO2e) | Avg Cost (₹/tCO2e) | Total Cost (₹ Cr) | Lead Time | Risk Score |
|----------|----------------|-------------------|-------------------|-----------|------------|
| **Banked CCCs** | 15,000 | 0 (sunk) | 0 | Immediate | 0 |
| **Internal Reduction (Low-cost)** | 20,000 | 650 | 1.30 | 6 mo | Low |
| **Escert Conversion** | 10,000 | 950 | 0.95 | 2 mo | Medium |
| **IEX Purchase (Spot)** | 15,000 | 1,250 | 1.88 | Immediate | Market |
| **Internal Reduction (Med)** | 5,000 | 1,200 | 0.60 | 12 mo | Medium |
| **TOTAL** | **50,000** | **~950** | **4.73 Cr** | — | — |

**Optimization Rule:** Always exhaust zero-cost options (banked CCCs, low-cost internal reduction) before market purchases. Sequence: Banked → Low-cost Internal → Escert Conversion → Spot Market → High-cost Internal → International Bridge.

### 13.2.2.3 Risk Management — Penalties, Banking, Borrowing

**Risk Register — Compliance Risks:**
| Risk | Likelihood | Impact (₹/t) | Mitigation |
|--------|------------|--------------|------------|
| **Target Miss (Policy Change)** | Medium | Penalty + CCC cost | Scenario planning; policy advocacy |
| **Verification Delay** | Low | Delayed surrender → penalty | Early VVB engagement; pre-verification |
| **CCC Price Spike** | Medium | Budget overrun | Forward contracts; budget buffer |
| **Registry/Exchange Outage** | Low | Surrender delay → penalty | Manual surrender; escalation protocol |
| **Vintage Mismatch** | Low | Credits unusable | Vintage tracking; vintage swap desk |
| **Penalty Escalation** | Low | ₹50k/t (3rd yr) | Zero-tolerance culture; early action |

**Penalty Avoidance Protocol:**
```
IF (Projected Deficit > 0) AND (Days to May 31 < 30):
    → ESCALATE to CFO/CEO
    → EXECUTE emergency procurement (pre-approved vendors)
    → ACTIVATE borrowing (if <10% target)
    → NOTIFY Board / Audit Committee
```

### 13.2.2.3 Professional Judgement Points
- **Bank early, buy late:** Bank surplus in good years; buy in last quarter (price often dips)
- **Escert conversion:** Only if conversion cost + Escert price < spot CCC price
- **Vintage management:** Rotate vintages; don't let banked CCCs age > 3 years without review
- **Verification scheduling:** Book VVB by Dec; avoid Mar-Apr crunch
- **Penalty vs Purchase:** Penalty (₹10k-50k/t) >> Market CCC price (₹1-1.5k/t) — never economical to pay penalty

### 13.2.2.3 Professional Judgement Points
- **Bank early, buy late:** Bank surplus in good years; buy in last quarter (price often dips)
- **Escert conversion:** Only if conversion cost + Escert price < spot CCC price
- **Vintage management:** Rotate vintages; don't let banked CCCs age > 3 years without review
- **Verification scheduling:** Book VVB by Dec; avoid Mar-Apr crunch
- **Penalty vs Purchase:** Penalty (₹10k-50k/t) >> Market CCC price (₹1-1.5k/t) — never economical to pay penalty

### 13.2.2.3 Practical Exercise: Compliance Cost Optimization
*Scenario:* **ABC Cement Ltd** — Obligated Entity under CCTS.
**Data:**
- Baseline Year (FY2020): Emissions = 1.8 MtCO2e; Production = 3.0 Mt cement
- Sectoral Reduction Rate: 2.5%/yr
- FY2025 (Compliance Year 5): Production = 3.2 Mt cement
- FY2025 Verified Emissions: 1.85 MtCO2e
- Banked CCCs from prior years: 15,000
- Current CCC Market Price: ₹1,200/tCO2e
- Penalty Rate (1st year): ₹10,000/tCO2e

**Task:**
1. Calculate Baseline Intensity (tCO2e/tonne cement)
2. Calculate FY2025 Target Intensity
3. Calculate FY2025 Actual Intensity
4. Determine Compliance Position (Surplus/Deficit in tCO2e)
4. Determine Surrender Quantity (after banking)
5. Calculate Cost of Compliance Options:
   a) Buy CCCs at market
   b) Internal reduction (marginal abatement cost: ₹800/tCO2e for 20,000 tCO2e; ₹1,500/tCO2e beyond)
   c) Penalty (if chosen)
5. Recommend optimal strategy

**Deliverable:** Compliance Calculation Table + Strategy Recommendation
**Time:** 35 min
**Rubric:** Calculation accuracy (40%), regulatory understanding (30%), economic optimization (30%)

**Knowledge Check:**
1. Why is emission intensity (tCO2e/unit) used instead of absolute emissions?
2. What happens if an OE exceeds target but has banked CCCs from prior years?
3. Can an OE borrow CCCs from next year's allocation? Under what conditions?
4. How does the penalty compare to expected CCC market prices?

**Sources:**
1. CCTS Notification 2023 — Compliance Cycle & Targets
2. BEE — Sectoral Target Methodologies
3. CERC — Draft Carbon Market Regulations (Penalties, Banking)
4. CEA — Grid Emission Factor (for Scope 2)
5. India NDC — 45% Emission Intensity Reduction by 2030

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC (CCTS rules evolving) | Regulatory Review: Quarterly*

---

### Lesson 13.2.3: CCTS-International Linkage — Article 6, CORSIA & Voluntary Markets
**Lesson Code:** C13.2.3
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** india_ether_track

**Learning Objectives:**
1. Design bridging strategies for international credits into CCTS compliance (Bloom: Create)
2. Navigate CORSIA eligibility for Indian CCCs (Bloom: Apply)
3. Assess Article 6.2/6.4 readiness for Indian entities (Bloom: Analyze)

**Prerequisites:** C13.1.1, C13.1.2, C13.1.3

**Why This Matters:**
The CCTS does not operate in isolation. International credits (Verra, GS, CDM) can be bridged into CCCs; Indian CCCs may serve CORSIA demand; Article 6.2/6.4 creates export/import pathways. Understanding these linkages lets you unlock additional supply, access premium markets, and future-proof compliance strategy.

**Core Concept: CCTS as Gateway — India's Carbon Market Connected to the World**

### 13.2.3.1 International Credits → CCC Bridging

**Bridging Pathway: International Credits → CCC (ICMS)**
```
International Project (Verra/GS/CDM)
    │
    ├── Validation/Verification (VVB)
    │
    ├── ICC Registration (BEE)
    │     ├── Methodology mapping (BEE-approved list)
    │     ├── Project eligibility check
    │     └── Additionality re-assessment (if needed)
    │
    ├── Corresponding Adjustment (if Article 6.2)
    │     ├── Host Country LoA (DNA — BEE)
    │     ├── Corresponding Adjustment application
    │     └── ITMO authorization
    │
    └── ICMS Issuance → CCC (with metadata: origin, vintage, methodology, CA status)
```

**ICC Registration (BEE) — Key Requirements:**
| Requirement | Detail |
|-----------|--------|
| **Methodology** | Mapped to BEE-approved methodology list |
| **Additionality** | Re-assessed per BEE guidelines (may differ from original) |
| **Baseline** | Re-validated per BEE-approved methodology |
| **Permanence** | Buffer pool requirements per BEE guidelines |
| **Safeguards** | FPIC, ESA, Grievance — BEE checklist |
| **Vintage Mapping** | Original vintage → CCTS compliance year mapping |

### 13.2.3.1 CORSIA Eligibility for Indian CCCs

**CORSIA Eligibility Criteria (ICAO Assembly A40):**
| Criterion | Indian CCC Status |
|------------|-------------------|
| **Standard** | Verra VCS, Gold Standard, ACR, ART — **ALL ELIGIBLE** |
| **Vintage** | Post-2015 (CDM); 2021+ (VCS/GS/ACR/ART) |
| **Methodology** | Must be CORSIA-eligible methodology |
| **No Double Counting** | Corresponding Adjustment (CA) if used for CORSIA |
| **Registry** | Must be ICAO-approved registry (Verra, GS, ACR, ART registries) |

**Current Status:** Indian CCCs from Verra/GS projects with CORSIA-eligible methodologies CAN be used for CORSIA compliance, provided:
1. Project methodology is CORSIA-eligible
2. Vintage is eligible (post-2015 for CDM; 2021+ for VCS/GS)
3. Corresponding Adjustment applied if used for CORSIA compliance
4. Retirement in CORSIA registry (ICAO)

**India Context:** Indian airlines (IndiGo, Air India, etc.) subject to CORSIA; DGCA implements; CCCs from ICMS can be used if CORSIA-eligible.

### 13.2.3.2 Article 6.2 & 6.4 — India's Readiness

**Article 6.2 — Cooperative Approaches:**
- **Status:** India has bilateral agreements with Japan, Sweden, Switzerland, Singapore
- **LoAs Issued:** BEE (DNA) issuing Host Country Letters of Authorization
- **ITMO Types:** Renewable energy, energy efficiency, forestry, waste management
- **Registry:** ICMS bridge to Article 6 registry under development

**Article 6.4 — Mechanism Status:**
| Milestone | Status |
|---------|--------|
| **Supervisory Body** | Operational (2023+) |
| **Methodologies** | First batch under review (2024) |
| **CDM Transition** | ~300 activities in pipeline |
| **First A6.4ER Issuance** | Expected 2025-26 |

**India's Article 6.2 Bilateral Agreements:**
| Partner | Status | Sectors |
|---------|--------|---------|
| **Japan** | JCM (Joint Crediting Mechanism) | Active | Renewable, efficiency, transport |
| **Switzerland** | Bilateral | Active | Renewable, waste, forestry |
| **Switzerland (KliK)** | Bilateral | Active | Foundation-based |
| **Singapore** | Bilateral | Active | Renewable, carbon capture |
| **Sweden** | Bilateral | Active | Industry, transport |

### 13.2.3.2 CCTS — Voluntary Market Interplay

**Dual-Use CCCs (Compliance + Voluntary):**
| Aspect | Compliance (OE Account) | Voluntary (Voluntary Account) |
|----------|-------------------------|-------------------------------|
| **Registry** | ICMS (OE account) | ICMS (Voluntary account) |
| **Surrender** | Mandatory (May 31) | Voluntary (anytime) |
| **Claim** | Compliance only | BRSR, voluntary claims, ESG |
| **Labeling** | CCTS_Compliance | BRSR, Voluntary, Net Zero |

**Convergence Trends:**
| Trend | Evidence |
|-------|----------|
| **CORSIA Eligibility** | Only standards with CORSIA approval supply compliance market |
| **Article 6.4** | May recognize VCUs/GS credits via transition |
| **ICVCM CCPs** | Becoming de facto quality floor for voluntary credits |
| **VCMI Claims Code** | Corporate buyers demanding ICVCM-approved credits |
| **SBTi** | Corporate buyers requiring SBTi-aligned credits |

**India Context:**
- Indian airlines: CORSIA compliance via DGCA
- CCTS design considers CORSIA/Article 6 alignment
- ICVCM assessment of Indian methodologies underway 2024-25

### 13.2.3.2 Professional Judgement Points
- **Bridging timing:** International credits → CCC takes 60-120 days; plan early
- **CORSIA eligibility:** Only post-2020 vintage, CORSIA-eligible methodology
- **Article 6.2:** Secure Host LoA early (DNA processing 60-90 days)
- **Voluntary CCCs:** Can be used for BRSR/Net Zero; separate from compliance account
- **Article 6.4:** Not yet operational for issuance; track CDM transition pipeline

### 13.2.3.2 Practical Exercise: International Linkage Strategy
*Scenario:* An Indian steel plant (Obligated Entity) has a 20,000 tCO2e deficit for FY2025. They have access to: (a) IEX CCCs at ₹1,200/t, (b) Verra VCUs (2022 vintage, VM0033 REDD+) at $12/t, (c) 10,000 Escerts from PAT Cycle IV. CORSIA price: $15/t.
*Tasks:*
1. Calculate cost per tCO2e for each option (incl. conversion, bridge, CA costs)
2. Assess CORSIA eligibility for each option
3. Evaluate Article 6.2 export potential for Verra credits
4. Recommend optimal sourcing mix with regulatory risk assessment
*Time:* 40 min
*Deliverable:* Sourcing Strategy Memo + Cost Comparison Table
*Rubric:* Cost accuracy (30%), regulatory understanding (30%), strategy logic (20%), timeline accuracy (20%)

**Knowledge Check:**
1. What is the Escert-to-CCC conversion ratio? (Methodology-defined by BEE; toe → tCO2e)
2. Can a voluntary CCC be used for CCTS compliance surrender? (No — must be in OE compliance account)
3. What is the key requirement for CORSIA eligibility of an Indian CCC? (Post-2020 vintage + CORSIA-eligible methodology + CA if international)
4. What is the DNA's role in Article 6.2 exports? (Issues Host Country LoA; authorizes ITMO transfer)

**Sources:**
1. CCTS Notification 2023 — Trading & Registry Rules
2. CERC Draft Carbon Market Regulations (2024) — Trading, Settlement, Position Limits
3. BEE — Escert to CCC Conversion Methodology (2023)
4. CERC — Exchange Recognition & Trading Regulations
5. ICVCM Cross-Registry Coordination Framework (2024)
6. Verra/GS — Registry APIs
7. ICAO Assembly A40 Resolution (2019) — CORSIA eligibility criteria
8. Decision 2/CMA.3 Annex — Article 6.2 Rules

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC (CCTS/Article 6 rules evolving) | Regulatory Review: Quarterly*