# C03: Carbon Credit Lifecycle
## Module 3.3: Trading → Retirement → Claims (3 lessons × 40min = 2h)

### Lesson 3.3.1: Market Participants, Pricing & Trade Mechanics
**Lesson Code:** C03.3.1
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** professional

**Learning Objectives:**
1. Map the carbon market ecosystem: developers, validators, verifiers, registries, brokers, exchanges, buyers (Bloom: Understand)
2. Analyze price formation drivers: compliance vs voluntary, vintage, standard, geography, co-benefits (Bloom: Analyze)
3. Execute trade workflows: OTC, exchange, forward, spot, retirement (Bloom: Apply)

**Prerequisites:** C02.1.2, C03.2.3, C10.1.1, C14.1.1

**Why This Matters:**
Trading is where carbon credits become financial assets. Understanding market structure, pricing drivers, and trade mechanics lets you advise clients, structure portfolios, and avoid costly mistakes — from vintage mismatches to claim invalidation.

**Core Concept: Price = Scarcity × Quality × Policy Certainty**

### 3.3.1.1 Market Ecosystem — Participants & Roles

| Participant | Role | Revenue Model | Key Risks |
|-------------|------|---------------|-----------|
| **Project Developer** | Originates credits | Primary sale margin | Development risk, regulatory |
| **Validator (VVB/DOE)** | Validates PDD pre-registration | Fee per project | Liability, accreditation |
| **Verifier (VVB/DOE)** | Verifies monitoring reports | Fee per verification | Liability, reputation |
| **Registry** | Issues, tracks, retires credits | Transaction fees | System integrity, regulatory |
| **Broker/Intermediary** | Matches buyers/sellers | Commission/spread | Counterparty, regulatory |
| **Exchange** | Centralized trading, clearing | Transaction fees, listing | Liquidity, regulatory |
| **End Buyer (Compliance)** | Surrenders for obligation | Cost avoidance | Policy change, price |
| **End Buyer (Voluntary)** | Retires for claims | Brand value, ESG | Greenwashing, quality |
| **Standard Body** | Sets rules, methodologies | Methodology fees, volume fees | Credibility, governance |

### 3.3.1.2 Trade Venues & Mechanics

| Venue | Structure | Settlement | Typical Users |
|-------|-----------|------------|---------------|
| **OTC Bilateral** | Direct negotiation | T+0 to T+2 (registry) | Large volumes, customized |
| **Brokered OTC** | Broker-matched | T+0 to T+2 | Mid-size, advisory needed |
| **Exchange (Spot)** | Central limit order book | T+0 to T+1 | Standardized, transparent |
| **Exchange (Futures)** | Standardized contracts | T+1 to T+30 | Hedging, speculation |
| **Auction** | Sealed bid / ascending | Per auction rules | Primary issuance, govt |
| **Primary Market** | Direct from developer | Negotiated | Early access, pipeline |

**Major Exchanges/Platforms:**
| Platform | Type | Standards | Key Features |
|----------|------|-----------|--------------|
| **Xpansiv (CBL)** | Spot + Futures | VCS, GS, ACR, ART | Digital registry integration |
| **CTX (Carbon Trade Exchange)** | Spot | VCS, GS, CDM | Retail + institutional |
| **AirCarbon Exchange (ACX)** | Spot + Tokenized | VCS, GS, CDM | Blockchain settlement |
| **IEX / PXIL (India)** | Spot (CCC) | CCTS | T+1 settlement |
| **Toucan / KlimaDAO** | Tokenized (BCT, NCT) | VCS, GS | DeFi integration |
| **Carbonplace** | Bank-grade settlement | VCS, GS | Bank network |

### 3.3.1.2 Price Formation — Drivers & Dynamics

**Primary Price Drivers:**
| Driver | Mechanism | Impact |
|--------|-----------|--------|
| **Policy/Regulation** | Caps, targets, eligibility | Step changes (e.g., CORSIA eligibility +$2-3) |
| **Supply Pipeline** | Issuance vs retirement rates | Inventory overhang → price pressure |
| **Quality/Standard** | VCS vs GS vs ART vs CCP-approved | GS premium 20-50% over VCS |
| **Vintage** | Newer = higher (usually) | Pre-2015: -50-80% discount |
| **Project Type** | Removal > Avoidance; Tech > Nature | Tech removals: 2-5× nature-based |
| **Co-benefits/SDGs** | SDG claims, biodiversity, community | Premium for high SDG impact |
| **Geography** | Host country risk, Article 6 readiness | Host country LoA = premium |
| **Vintage** | Newer = higher demand | Pre-2016 often ineligible for CORSIA/Art 6 |

**Price Tiers (Indicative 2024, $/tCO2e):**
| Category | Range | Notes |
|----------|-------|-------|
| **Compliance (EUA)** | €70-90 | EU ETS, liquid |
| **Compliance (CCA)** | $30-40 | CA-QC linked |
| **CORSIA-eligible** | $3-8 | Vintage 2021+ |
| **GS (RE/cookstoves)** | $15-30 | SDG premium |
| **VCS (RE)** | $5-15 | Volume driver |
| **VCS (REDD+/IFM)** | $8-25 | Quality spread |
| **ART/TREES** | $15-35 | Jurisdictional premium |
| **Tech Removals (DACCS, BECCS)** | $200-600 | Early stage |
| **Biochar/Enhanced Weathering** | $100-300 | Emerging |

### 3.3.1.3 Trade Workflows — From Agreement to Settlement

**OTC Bilateral Workflow:**
```
1. Term Sheet → 2. SPA (Sale Purchase Agreement) → 3. KYC/AML 
→ 4. Registry Transfer Instruction → 5. Registry Transfer (T+0 to T+2) 
→ 6. Payment (Escrow/DvP) → 7. Confirmation → 8. Invoice/Retirement Cert
```

**Key SPA Clauses:**
| Clause | Purpose | Typical Terms |
|----------|---------|---------------|
| **Representations** | Seller owns credits, no encumbrances | Standard |
| **Vintage/Standard** | Specific vintage, standard, serial range | Exact match required |
| **Transfer Mechanics** | Registry transfer instruction + DvP | Registry DvP or escrow |
| **Retirement Obligation** | Buyer must retire by date | For compliance claims |
| **Force Majeure** | Registry failure, regulatory change | Standard |
| **Indemnification** | Double counting, invalidity | Survival 12-24 months |

**Exchange/Spot Workflow:**
```
1. Order Entry (Limit/Market) → 2. Matching Engine → 3. Clearing 
→ 4. Registry DvP (Delivery vs Payment) → 4. Settlement (T+0/T+1)
→ 5. Position Update → 6. Reporting
```

### 3.3.1.3 Forward Contracts & Hedging

**Forward Contract Structure:**
| Element | Typical Terms |
|---------|---------------|
| **Underlying** | Specific vintage/standard or "any CORSIA-eligible" |
| **Volume** | Fixed tonnes (e.g., 10,000 tCO2e) |
| **Delivery Window** | Month/Quarter (e.g., Q3 2025) |
| **Price** | Fixed $/tCO2e or index-linked (e.g., EUA + spread) |
| **Settlement** | Physical (registry transfer) or Cash (index) |
| **Credit Support** | Margin, letter of credit, parent guarantee |

**Hedging Strategies:**
| Strategy | Use Case | Instrument |
|----------|----------|------------|
| **Producer Hedge** | Lock in revenue for pipeline | Forward sale |
| **Buyer Hedge** | Lock in compliance cost | Forward purchase |
| **Spread Trade** | Vintage/standard arbitrage | Calendar spread |
| **Collar** | Cap floor on price | Options (emerging) |

### 3.3.1.3 Professional Judgement Points
- **Vintage integrity:** Never mix vintages in single trade/retirement
- **Standard eligibility:** Verify CORSIA/Art 6 eligibility BEFORE trade
- **Registry DvP:** Always use Delivery vs Payment — never free transfer + separate payment
- **Vintage integrity:** Never mix vintages in single retirement claim
- **KYC/AML:** Screen counterparties — sanctions, PEPs, adverse media

### 3.3.1.4 Practical Exercise: Trade Structuring Workshop
*Scenario:* Buyer needs 50,000 tCO2e for CORSIA Phase 1 (2024-2026). Seller has: 20k VCS 2021 RE, 20k GS 2022 cookstove, 10k CDM 2018 hydro.
*Tasks:*
1. Identify CORSIA-eligible units (vintage, standard, host country LoA)
2. Structure trade: volumes, pricing, delivery schedule
3. Draft key SPA clauses (vintage, standard, retirement obligation)
4. Identify regulatory risks (vintage expiry, host country authorization)
*Time:* 40 min
*Deliverable:* Trade structure memo + SPA clause sheet
*Rubric:* Eligibility accuracy (40%), structure clarity (30%), risk identification (30%)

**Knowledge Check:**
1. What is the typical settlement cycle for registry transfers? (T+0 to T+2)
2. What is a "vintage" in carbon markets? (Year of emission reduction occurrence)
3. Why do GS credits trade at premium to VCS? (Stricter safeguards, mandatory SDG co-benefits)
4. What is DvP? (Delivery vs Payment — atomic transfer + payment)

**Sources:**
1. Verra Registry System Specification (2024)
3. Gold Standard Registry Requirements (2023)
4. CDM Registry & Transaction Log (2023)
5. Article 6.4 Registry Technical Spec (2023)
5. CORSIA Registry Requirements (ICAO 2024)
6. IETA Market Reports (2023-2024)
6. ICVCM Assessment Reports (2024)

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC (Market structure evolving) | Regulatory Review: Quarterly*

---

### Lesson 3.3.2: Retirement, Claims & Claim Integrity
**Lesson Code:** C03.3.2
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** professional

**Learning Objectives:**
1. Execute retirement correctly: vintage, standard, claim type, proof (Bloom: Apply)
2. Apply VCMI Claims Code: Platinum/Gold/Silver tiers and eligibility (Bloom: Analyze)
3. Detect and prevent greenwashing: double counting, expired vintages, invalid claims (Bloom: Evaluate)

**Prerequisites:** C03.3.1, C02.3.2, C03.2.3

**Why This Matters:**
Retirement is the moment a credit fulfills its purpose. But a botched retirement — wrong vintage, wrong claim, double counting — creates greenwashing liability, regulatory penalties, and reputational destruction. This lesson teaches you to execute retirements that withstand scrutiny.

**Core Concept: Retirement is a Legal Act, Not a Button Click**

### 3.3.2.1 Retirement Mechanics — Doing It Right

**Retirement Request (Registry):**
```json
{
  "serial_numbers": ["VCU-1234-2024-0000001 to VCU-1234-2024-0010000"],
  "retirement_reason": "Voluntary carbon neutrality claim FY2024",
  "retirement_details": {
    "claim_type": "VCMI Platinum",
    "entity_name": "Acme Corp",
    "reporting_period": "FY2024",
    "beneficiary": "Acme Corp"
  },
  "retired_by": "account_holder_id",
  "authorized_by": "authorized_signatory"
}
```

**Critical Retirement Fields:**
| Field | Requirement | Common Error |
|-------|-------------|--------------|
| **Serial Range** | Exact, contiguous, valid | Gaps, overlaps, invalid serials |
| **Vintage** | Must match claim period | Using wrong vintage |
| **Standard** | Must match claim eligibility | Non-eligible standard |
| **Retirement Reason** | Specific claim type | Generic "voluntary" |
| **Beneficiary** | Legal entity name | Mismatched entity |
| **Retirement Date** | Timestamp of action | Backdating |

**Retirement Proof Package (Audit-Ready):**
1. **Retirement Confirmation** (Registry PDF with serials, timestamp, hash)
2. **Retirement Reason Statement** (Claim type, period, entity)
3. **Credit Provenance** (Project ID, vintage, standard, verification report)
3. **Chain of Custody** (Issuance → transfers → retirement)
4. **Claim Mapping** (How credits map to reported emissions)

### 3.3.2.2 VCMI Claims Code — The Claim Integrity Standard

**VCMI Claims Code (2023) — Three Tiers:**
| Tier | Claim Label | Credit Quality | Neutralization Limit | Use Case |
|------|-------------|----------------|---------------------|----------|
| **Platinum** | "Carbon Neutral" / "Net Zero" | 100% CCP-approved | 100% of residual | Leadership |
| **Gold** | "Carbon Neutral" / "Net Zero" | ≥90% CCP-approved | 100% of residual | Strong |
| **Silver** | "Carbon Neutral" / "Net Zero" | ≥50% CCP-approved | 100% of residual | Entry |

**Key Rules:**
- **Abatement First:** Must demonstrate ≥90% (Platinum/Gold) or ≥50% (Silver) gross emissions reduction vs base year before using credits
- **Neutralization Limit:** Credits can only neutralize *residual* emissions (post-abatement)
- **Credit Quality:** Only CCP-approved credits count toward the % thresholds
- **Vintage:** ≤5 years (Platinum/Gold), ≤10 years (Silver)
- **Vintage Flexibility:** Older credits allowed if methodology still valid and permanence verified
- **Retirement:** Must be in claimant's name; serialized; publicly disclosed

### 3.3.2.2 Claim Eligibility Matrix

| Credit Characteristic | Platinum | Gold | Silver |
|----------------------|----------|------|--------|
| **CCP-Approved** | 100% required | ≥90% | ≥50% |
| **Vintage** | ≤5 years | ≤5 years | ≤10 years |
| **Standard** | CCP-approved only | CCP-approved | CCP-approved |
| **Vintage Exception** | Methodology valid + permanence verified | Same | Same |
| **Retirement** | Must be retired in claimant's name | Same | Same |
| **Co-benefits** | Not required | Not required | Not required |

### 3.3.2.3 Claim Validation — Common Failures

| Failure | Root Cause | Consequence |
|---------|------------|-------------|
| **Vintage Mismatch** | 2018 credits for 2024 claim | Invalid claim (Platinum/Gold) |
| **Non-CCP Credits** | Pre-ICVCM vintage, non-assessed standard | Claim downgrade |
| **Insufficient Abatement** | <90% reduction before credits | Claim invalid |
| **Double Counting** | Same credits for Scope 1 + Scope 3 claim | Greenwashing liability |
| **Vintage >5yr (Platinum)** | No methodology validity proof | Downgrade to Silver |
| **No Retirement Proof** | Screenshot only, no registry cert | Claim rejected |

### 3.3.2.3 Claim Integrity — Detection & Prevention

**Greenwashing Red Flags:**
| Flag | Detection | Mitigation |
|------|-----------|------------|
| **"Carbon Neutral" without SBTi target** | Policy review | Require SBTi alignment |
| **100% offset, 0% reduction** | Abatement ratio check | Enforce abatement first |
| **Vintage >10 years** | Vintage audit | Vintage policy |
| **Non-CCP credits for Platinum** | CCP registry check | Standard policy |
| **Same credits, multiple claims** | Retirement serial cross-check | Centralized registry |

**Corporate Claim Governance Framework:**
```
1. Commit: Public commitment to VCMI Claims Code
2. Measure: GHG inventory (GHG Protocol) — Scopes 1, 2, 3
3. Reduce: Demonstrate abatement progress (SBTi-aligned pathway)
4. Neutralize: Purchase eligible credits for residual emissions
5. Report: Annual public disclosure (VCMI template)
6. Verify: Third-party assurance (optional but recommended)
```

### 3.3.2.3 India Context — BRSR & Greenwashing Regulations

**SEBI BRSR (Principle 6, Q8):** Disclose carbon neutrality/net-zero claims with:
- Target type (absolute/intensity), base year, target year
- % reduction achieved vs base year
- Credits used: standard, vintage, volume, retirement proof
- Third-party assurance status

**ASCI/CCPA Greenwashing Guidelines (2022-24):**
- "Carbon neutral" claims require: Scope 1+2+3 inventory, reduction pathway, credit quality disclosure
- Prohibited: "Carbon negative" without removal credits; "Climate positive" without additionality proof

**CCTS Claims:** CCC retirement for voluntary claims allowed; must disclose on BEE portal

**EtherTrack Context:** Platform auto-generates retirement certificates with VCMI-compliant metadata; flags vintage/standard mismatches for claim type.

### 3.3.2.4 Professional Judgement Points
- **Never mix vintages** in single retirement claim
- **Never retire** credits not yet in your account (pending transfers)
- **Document abatement first** — credits only for residual
- **Archive retirement proof** — registry cert + claim mapping = legal defense
- **Align claim period** with reporting period (FY vs CY)

### 3.3.2.4 Practical Exercise: Retirement & Claim Validation
*Scenario:* Client claims "Carbon Neutral (Platinum)" for FY2024 with 50,000 tCO2e retired:
- 30,000 VCS 2022 RE (CCP-approved)
- 15,000 GS 2021 cookstove (CCP-approved)
- 5,000 VCS 2018 REDD+ (legacy, non-CCP)
*Tasks:*
1. Determine if claim is valid
2. Calculate CCP-approved %
3. If invalid, minimum additional CCP credits needed
4. Draft corrective action memo
*Time:* 30 min
*Deliverable:* Compliance verdict + remediation plan
*Rubric:* Correct assessment (40%), remediation math (30%), communication clarity (30%)

**Knowledge Check:**
1. What is the minimum CCP-approved % for a Gold claim? (90%)
2. Can a Silver claim use 10-year-old credits? (Yes, if methodology valid + permanence verified)
3. What is the "abatement first" rule? (Must reduce ≥90%/50% before using credits)

**Sources:**
1. VCMI Claims Code (2023) v1.0
2. VCMI Provisional Claims Code (2022) — Pilot learnings
3. SBTi Corporate Net-Zero Standard (2021) v1.2
4. ISO 14068-1:2023 — Carbon neutrality
5. ICVCM Core Carbon Principles (2023) — CCP linkage

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC (VCMI evolving) | Regulatory Review: Quarterly*

---

### Lesson 3.3.3: Claims Verification, Disputes & Future-Proofing
**Lesson Code:** C03.3.3
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** professional

**Learning Objectives:**
1. Design a claims verification process that withstands regulatory and reputational scrutiny (Bloom: Create)
2. Analyze dispute mechanisms: registry challenges, standard body complaints, legal (Bloom: Analyze)
3. Future-proof claims against evolving standards: ICVCM, VCMI, SBTi, ISO 14068 (Bloom: Evaluate)

**Prerequisites:** C03.3.2, C03.2.3, C02.3.3

**Why This Matters:**
Carbon claims are under unprecedented scrutiny — from regulators (SEBI, SEC, EU), standard bodies (ICVCM, VCMI), and courts. A claim valid today may be invalid tomorrow. This lesson teaches you to build claims that survive regulatory evolution and legal challenge.

**Core Concept: Future-Proofing = Conservative Today, Defensible Tomorrow**

### 3.3.3.1 Claims Verification — Building a Defensible Process

**Verification Layers (Defense in Depth):**
| Layer | Scope | Frequency | Owner |
|-------|-------|-----------|-------|
| **1. Automated** | Registry API: serial validity, retirement status, vintage | Real-time | Platform |
| **2. Policy Engine** | Claim rules: vintage limits, CCP %, abatement first | Per claim | Compliance |
| **3. Periodic Audit** | Full claim portfolio review | Quarterly | Internal Audit |
| **4. Third-Party Assurance** | Reasonable assurance on claims | Annual | External Verifier |

**Automated Claim Validation Rules:**
```yaml
rules:
  - id: vintage_limit
    condition: claim.tier == "platinum" && credit.vintage_age > 5
    action: reject
    message: "Platinum claims require vintage ≤5 years"
  - id: ccp_threshold
    condition: claim.tier == "gold" && ccp_pct < 90
    action: reject
    message: "Gold claims require ≥90% CCP-approved credits"
  - id: abatement_first
    condition: claim.abatement_pct < required_abatement[claim.tier]
    action: reject
    message: "Abatement first rule violated"
  - id: vintage_exception
    condition: credit.vintage_age > max_vintage && !credit.methodology_valid
    action: flag
    message: "Vintage exception requires methodology validity proof"
```

### 3.3.3.2 Dispute Mechanisms — When Claims Are Challenged

| Forum | Trigger | Process | Timeline | Remedies |
|-------|---------|---------|----------|----------|
| **Registry Challenge** | Double counting, invalid serial | Registry investigation | 30-90 days | Credit cancellation, account freeze |
| **Standard Body Complaint** | Methodology non-compliance, safeguards | Standard grievance process | 60-180 days | Credit cancellation, project suspension |
| **VCMI Complaint** | Invalid claim tier, false advertising | VCMI Secretariat review | 90 days | Public censure, claim withdrawal |
| **Regulatory (SEBI/SEC/ASA)** | Greenwashing, misleading claims | Investigation, enforcement | 6-24 months | Fines, injunction, criminal |
| **Civil Litigation** | Contract breach, misrepresentation | Court/arbitration | 1-3 years | Damages, injunction |
| **Consumer Protection** | Misleading "carbon neutral" label | Consumer court | 6-18 months | Refund, corrective advertising |

**Dispute Preparedness Checklist:**
- [ ] Retirement certificates archived (immutable, hash-verified)
- [ ] Chain of custody complete (issuance → transfer → retirement)
- [ ] Claim mapping documented (credit → emission → claim)
- [ ] Abatement evidence archived (SBTi target, reduction evidence)
- [ ] Legal review of claim language (marketing, contracts, reports)
- [ ] Insurance: D&O, E&O, environmental liability

### 3.3.3.3 Future-Proofing — Regulatory Evolution Radar

| Trend | Current State | 2025-2030 Trajectory | Action |
|-------|---------------|----------------------|--------|
| **ICVCM CCP** | Voluntary assessment | Mandatory for major standards | Align projects to CCP now |
| **VCMI Claims Code** | Tiered voluntary | De facto mandatory for corporates | Align claims to VCMI tiers |
| **SBTi Net-Zero** | Voluntary target | Regulatory baseline (EU, CA, SEBI) | Set SBTi target now |
| **ISO 14068** | New standard (2023) | Global carbon neutrality standard | Align claims process |
| **CSRD/ESRS** | EU mandatory (2025+) | Global convergence | Double materiality prep |
| **Article 6.4** | Operationalizing (2025+) | Global compliance market | Prepare for A6.4ERs |
| **CORSIA** | Phase 1 (2024-26) | Phase 2 (2027-35) | Monitor eligibility |
| **Digital MRV (dMRV)** | Emerging | Standard for high-quality | Invest in sensor/remote sensing |

### 3.3.3.3 Future-Proofing Strategies

**1. Conservative Design Principles:**
- Use only CCP-approved credits (even if not yet mandatory)
- Apply strictest vintage rules (≤5 years for all claims)
- Over-achieve abatement (≥95% vs 90% required)
- Build in vintage buffer (retire newer vintages first)

**2. Portfolio Diversification:**
| Dimension | Diversification Target |
|-----------|------------------------|
| **Standard** | No single standard >60% of portfolio |
| **Vintage** | No single vintage >40% |
| **Project Type** | Removal ≥30% by 2030 |
| **Geography** | No single country >50% |

**3. Contractual Protection:**
- **SPA Clauses:** Replacement credit obligation if credit invalidated
- **Warranties:** Seller warrants credit validity, no double counting
- **Indemnification:** Seller covers greenwashing liability
- **Audit Rights:** Buyer can audit project documents

### 3.3.3.3 India Context — Regulatory Horizon

| Regulation | Status | Impact on Claims |
|------------|--------|------------------|
| **SEBI BRSR** | Mandatory (Top 1000) | Principle 6: claims disclosure + assurance |
| **CCTS** | Operational (2024+) | CCC retirement for claims; BEE portal disclosure |
| **Green Claims Guidelines (MoEFCC/ASCI)** | Draft/Advisory | "Carbon neutral" = full disclosure |
| **RBI Climate Risk** | Guidelines (2024) | Financed emissions disclosure (Cat 15) |
| **BRSR Core** | Mandatory (2024+) | Assurance mandatory for Top 1000 |

**EtherTrack Context:** Platform claim engine auto-validates against VCMI/ICVCM rules; flags vintage/standard drift; generates audit-ready claim packages.

### 3.3.3.4 Professional Judgement Points
- **Assume stricter rules tomorrow:** Design claims to pass 2027 standards today
- **Legal privilege:** Claim governance docs under legal privilege where possible
- **Insurance:** D&O, E&O, environmental liability for claim exposure
- **Scenario planning:** Model claim validity under 3 regulatory scenarios (status quo, moderate tightening, aggressive)
- **Stakeholder alignment:** Legal, comms, sustainability, finance — unified claim governance

### 3.3.3.4 Practical Exercise: Future-Proof Claim Design
*Scenario:* A multinational commits to "Net Zero by 2035" with 2023 baseline. Current portfolio: 40% VCS 2021, 30% GS 2022, 30% CDM 2018. Emissions: 1 MtCO2e/yr, reducing 5%/yr.
*Tasks:*
1. Assess current claim validity under VCMI Platinum/Gold/Silver
2. Model claim validity under 3 scenarios: (a) ICVCM mandatory 2026, (b) CSRD scope 3 inclusion, (c) CORSIA Phase 2 vintage restrictions
3. Design portfolio rebalancing plan (2025-2028) to maintain Platinum claim
4. Design claim governance charter (roles, review cycle, escalation)
*Time:* 50 min
*Deliverable:* Future-proofing roadmap + governance charter
*Rubric:* Scenario analysis (40%), rebalancing logic (30%), governance design (30%)

**Knowledge Check:**
1. What happens to a Platinum claim if ICVCM makes CCP mandatory and 30% of credits lose CCP status? (Claim invalid unless rebalanced)
2. How does CSRD double materiality affect carbon claims? (Must disclose both financial impact of climate AND climate impact of business)
3. What is the "safe harbor" vintage for claims in 2025? (≤5 years for all tiers as conservative practice)

**Sources:**
1. VCMI Claims Code (2023) v1.0
2. ICVCM Core Carbon Principles (2023) v1.0
3. SBTi Corporate Net-Zero Standard (2021) v1.2
4. ISO 14068-1:2023 — Carbon neutrality
5. CSRD/ESRS E1 (2023) — Climate Change
5. SEBI BRSR Core (2023) — Assurance & Disclosure
6. Article 6.4 Rules (Decision 3/CMA.3) — Transition provisions

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC (Regulatory landscape evolving rapidly) | Regulatory Review: Quarterly*