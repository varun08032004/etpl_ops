# C03: Carbon Credit Lifecycle
## Module 3.2: Monitoring → Verification → Issuance (3 lessons × 40min = 2h)

### Lesson 3.2.1: Monitoring Plan Design & Implementation
**Lesson Code:** C03.2.1
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** foundation

**Learning Objectives:**
1. Design a monitoring plan that meets standard requirements and survives verification (Bloom: Apply)
2. Select appropriate monitoring parameters, methods, and frequencies per methodology (Bloom: Apply)
3. Build QA/QC into the monitoring process from day one (Bloom: Create)

**Prerequisites:** C03.1.3, C05.1.1, C05.1.2, C05.2.1

**Why This Matters:**
The monitoring plan is the operational blueprint for credit generation. A poorly designed plan leads to missed measurements, unverifiable data, verification findings, and delayed issuance. A robust plan turns monitoring from a compliance burden into a management tool that optimizes project performance.

**Core Concept: The Monitoring Plan is the Project's Operating Manual**

### 3.2.1.1 Monitoring Plan — Purpose & Position

**Position in Project Cycle:**
```
PDD Registered → Monitoring Plan Implemented → Data Collected → Verification → Issuance
     ↑                                                                    │
     └──────────────────────── Feedback Loop ────────────────────────────┘
```

**Monitoring Plan Functions:**
1. **Defines WHAT to measure** — Parameters, methods, frequency
2. **Defines HOW to measure** — Instruments, methods, QA/QC
3. **Defines WHO measures** — Roles, responsibilities, training
4. **Defines WHEN** — Frequency, timing, vintage alignment
5. **Defines QUALITY** — QA/QC, uncertainty, data management

### 3.2.1.1 Monitoring Plan Structure (Per Methodology/Standard)

| Section | Content | Verification Focus |
|---------|---------|-------------------|
| **1. Monitored Parameters** | Parameter ID, description, unit, source | Completeness vs methodology |
| **2. Measurement Methods** | Instruments, methods, calibration, frequency | Methodology compliance |
| **3. QA/QC Procedures** | Calibration, cross-checks, uncertainty, data management | ISO 14064-3 alignment |
| **4. Data Management** | Collection, storage, backup, access, retention | Traceability, audit trail |
| **5. Roles & Responsibilities** | Who measures, who checks, who approves | Competence, segregation |
| **6. Training & Capacity** | Training plan, competency records | Competence evidence |
| **7. Emergency Procedures** | Equipment failure, data gaps, force majeure | Continuity planning |

### 3.2.1.2 Parameter Selection — Methodology-Driven

**Parameter Categories:**
| Category | Examples | Typical Frequency |
|----------|----------|-------------------|
| **Activity Data** | Fuel consumption, electricity gen, tonnes produced, area | Continuous/Daily |
| **Emission Factors** | Fuel GCV/NCV, carbon content, oxidation factor | Per batch/Monthly |
| **Process Parameters** | Temperature, pressure, flow rates, operating hours | Continuous/Hourly |
| **Environmental** | Temperature, humidity, rainfall (for AFOLU) | Daily/Event-based |
| **Leakage** | Displacement surveys, market data | Per verification |
| **Safeguards** | Stakeholder feedback, grievance logs, biodiversity | Periodic |

**Parameter Documentation Template:**
```json
{
  "parameter_id": "P-001",
  "description": "Coal consumption at Boiler #1",
  "unit": "tonnes",
  "source": "Weighbridge (WB-01)",
  "frequency": "Continuous (15-min intervals)",
  "method": "Weighbridge (WB-01), calibrated quarterly",
  "qa_qc": "Calibration cert QB-2024-001; daily zero-check; monthly cross-check with belt scale",
  "uncertainty": "±1.5% (weighbridge class 0.5)",
  "data_management": "PI System → Historian → SQL; retention 10 yr",
  "responsible": "Shift Engineer → Plant Manager",
  "backup": "Manual logbook (daily total)"
}
```

### 3.2.1.3 Monitoring Methods — Selection & QA/QC

| Parameter Type | Preferred Method | Fallback | QA/QC Requirements |
|----------------|------------------|----------|-------------------|
| **Fuel Mass** | Weighbridge (custody transfer) | Belt scale + density | Quarterly calibration; daily zero-check; mass balance closure |
| **Fuel Energy (GCV/NCV)** | Lab analysis (daily composite) | Supplier certificate | Lab accreditation; duplicate analysis; QC samples |
| **Electricity** | Revenue meter (0.2S/0.5S class) | Check meter | Monthly cross-check; annual calibration |
| **Gas Flow** | Ultrasonic/orifice (custody transfer) | Thermal mass flow | Calibration per AGA-3/8; pressure/temp correction |
| **Gas Composition** | Gas chromatograph (daily) | Manual sampling | Calibration gas; duplicate analysis |
| **Area/Forest** | GIS + ground truthing | Satellite only | Ground truthing 10% plots; topology checks |
| **Biomass/Soil** | Plot sampling (nested plots) | Remote sensing only | QA/QC per IPCC GPG; lab accreditation |

### 3.2.1.3 QA/QC — Building Quality In

**QC (Self-Checking) vs QA (Independent Review):**
| Aspect | QC (Internal) | QA (Independent) |
|------|---------------|------------------|
| **Who** | Data collectors, plant staff | Independent reviewer (internal/external) |
| **When** | Real-time, daily, per batch | Pre-verification, periodic |
| **Scope** | 100% of data | Sampling + system review |
| **Output** | Corrected data, QC log | QA report, improvement plan |

**Automated QC Rules (Examples):**
```python
# Range check
if value < min_plausible or value > max_plausible: flag()

# Rate of change
if abs(value - rolling_avg) > 3 * rolling_std: flag()

# Gap detection
if time_since_last_reading > expected_interval * 2: flag()

# Mass balance
if abs(input - output - stock_change) / input > 0.02: flag()

# Cross-category
if abs(cat3_upstream - scope1_fuel * wtt_factor) / scope1_fuel > 0.05: flag()
```

### 3.2.1.4 Data Management — Traceability & Retention

**Data Flow Architecture:**
```
Source (Meter/Log/ERP) 
    → Ingestion (API/ETL/Manual) 
    → Validation (Automated QC rules) 
    → Time-Series Database (Historian/InfluxDB/TimescaleDB) 
    → Calculation Engine (Versioned, auditable) 
    → Reporting/Verification Package
         ↑
    Immutable Audit Trail (Append-only log + SHA256 hashes)
```

**Retention Requirements:**
| Document Type | Retention | Verification Need |
|---------------|-----------|-------------------|
| Source documents (bills, logs, lab reports) | 10+ years / crediting period + 5 yr | Verifier access |
| Calibration certificates | Equipment life + 5 yr | Verifier review |
| QC/QA logs | 10+ years | Verifier review |
| Calculation workbooks | Permanent (versioned) | Verifier re-run |
| Verification reports | Permanent | Public registry |

### 3.2.1.4 Professional Judgement Points
- **Metering investment priority:** >5% of scope → meter it; <1% → estimate acceptable
- **Data frequency:** Monthly minimum for Scope 1/2; Quarterly for Scope 3 suppliers
- **Gap filling:** Document method (interpolation, extrapolation, proxy) + uncertainty
- **Retention:** Keep source documents 7+ years (tax/audit/verification)
- **Single source of truth:** One activity data lake → all calculations downstream

### 3.2.1.4 Practical Exercise: Monitoring Plan Design
*Scenario:* Design monitoring plan for a 3-plant cement company (BF-BOF, 3 Mt/yr). Key sources: coke ovens, sinter, blast furnace, BOF, rolling mills, captive power (300 MW), 500 km rail transport.
*Tasks:*
1. Design monitoring parameters table (parameter, method, frequency, QA/QC)
2. Define automated validation rules for coke oven coal feed, blast furnace gas flow, grid electricity
3. Design cross-category reconciliation (coal input vs coke + BF gas + emissions)
4. Draft QC log template for verifier handover
*Time:* 45 min
*Deliverable:* Monitoring parameters table + validation rules + QC log template
*Rubric:* Parameter completeness (30%), validation logic (40%), QA/QC design (30%)

**Knowledge Check:**
1. What is the minimum frequency for Scope 1/2 activity data collection? (Monthly)
2. What quality flag would you assign to a weighbridge reading? (`weighed` ±0.5-2%)
3. How do you handle a 3-day gap in hourly meter data? (Interpolate + flag `interpolated`)
4. What is the minimum required field for activity data traceability? (source_id, timestamp, quantity, unit)

**Sources:**
1. GHG Protocol Corporate Standard — Chapter 6 (Data Collection)
2. ISO 14064-1:2018 — Section 7 (Data Management)
3. ISO 14064-3:2019 — Verification of Data
3. BEE PAT Guidelines — Data Requirements
3. CEA Grid Code — Metering Standards
4. CPCB Guidelines — Continuous Emission Monitoring

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC (IoT, meter tech evolving) | Regulatory Review: Quarterly*

---

### Lesson 3.2.2: Verification Process — From Site Visit to Opinion
**Lesson Code:** C03.2.2
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** professional

**Learning Objectives:**
1. Explain the verification cycle: planning, site visit, findings, closure, opinion (Bloom: Understand)
2. Prepare a project for verification: documentation, site access, personnel (Bloom: Apply)
3. Manage verification findings: response, root cause, closure, opinion (Bloom: Apply)

**Prerequisites:** C03.2.1, C04.3.2

**Why This Matters:**
Verification is the gatekeeper of credit integrity. A failed or delayed verification means no issuance, delayed revenue, and reputational damage. Understanding the verification process from the verifier's perspective lets you prepare proactively, reduce findings, and accelerate issuance.

**Core Concept: Verification is a Structured Audit, Not a Surprise Inspection**

### 3.2.2.1 Verification Cycle — End-to-End

| Phase | Timeline | Activities | Deliverables |
|-------|----------|------------|--------------|
| **1. Planning** | -8 to -4 weeks | Scoping, team selection, risk assessment, materiality | Verification plan, sampling plan |
| **2. Strategic Analysis** | -4 to -2 weeks | Understand business, boundary, methods, risks | Risk assessment, materiality map |
| **3. Fieldwork** | -2 to +2 weeks | Site visits, data testing, recalculation, interviews | Working papers, findings log |
| **4. Reporting** | +2 to +4 weeks | Draft opinion, management letter, closure | Verification opinion, findings report |
| **5. Closure** | +4 to +6 weeks | Findings closure, final opinion | Final opinion, verification statement |

**Materiality Thresholds (Typical):**
| Level | Threshold |
|-------|-----------|
| **Quantitative** | 5% of total emissions (Scope 1+2); 10% (Scope 3) |
| **Qualitative** | Any misstatement affecting user decisions |

### 3.2.2.2 Verification Standards & Frameworks

| Standard | Scope | Key Requirements |
|----------|-------|------------------|
| **ISO 14064-3** | GHG verification | Competence, independence, risk-based approach |
| **ISAE 3000 (Revised)** | Assurance engagements | Ethical, quality control, evidence |
| **ISO 14064-1** | Inventory spec | Verification alignment |
| **GHG Protocol** | Corporate standard | Verification guidance |
| **ISAE 3410** | GHG specific | GHG-specific assertions |

**Indian Verifiers (NABET Accredited):**
- DNV, Bureau Veritas, SGS, TÜV, Intertek, LRQA
- Indian: TÜV India, IRCLASS, DNV India, Bureau Veritas India

### 3.2.2.2 Verification Sampling — Risk-Based

**Sampling Approach:**
| Population | Sampling Method | Typical Coverage |
|-----------|-----------------|------------------|
| **Facilities** | Risk-based (size, complexity, risk) | 30-50% of sites, 100% of >10% emitters |
| **Emission Sources** | Stratified by magnitude | 100% of >5% sources |
| **Data Points** | Random + judgmental | 25-50 per category |
| **Calculations** | 100% recalculation of sample | 100% of sampled calcs |
| **EFs** | Source verification | 100% of primary EFs |

**Sample Documentation:** Verifier must document rationale, not just results.

### 3.2.2.3 Common Verification Findings — Top 10

| # | Finding | Root Cause | Prevention |
|-----|----------|------------|------------|
| 1 | **Incomplete boundary** | Excluded facilities/categories without rationale | Screening matrix + exclusion register |
| 2 | **EF version mismatch** | Used AR4 EF in AR6 inventory | EF version control |
| 3 | **Missing uncertainty** | No uncertainty quantification | Uncertainty budget template |
| 4 | **Allocation errors** | Arbitrary allocation for shared services | Allocation method register |
| 5 | **Double counting** | Same source in Scope 1 & 3 | Cross-category reconciliation |
| 6 | **Base year not recalculated** | Acquisition not reflected | Recalculation trigger checklist |
| 7 | **Scope 3 category gaps** | Categories excluded without rationale | Screening matrix |
| 8 | **Data trail gaps** | Source docs not linked | Document management system |
| 8 | **EF version drift** | Different EF versions across years | EF version control |
| 10 | **Target-inventory mismatch** | Target boundary ≠ inventory boundary | Target-inventory mapping |

### 3.2.2.3 Verification Readiness Package — Checklist

**Pre-Verification (Organization):**
- [ ] Inventory report (GHG Protocol format)
- [ ] Methodology sheets per category
- [ ] Source document repository (linked to calcs)
- [ ] Calculation workbooks (versioned, reproducible)
- [ ] EF library (versioned, sourced, dated)
- [ ] Uncertainty budget + DQI table
- [ ] Exclusion register with rationale
- [ ] Recalculation log
- [ ] Target-inventory mapping
- [ ] Prior verification opinion (if any)

**Verifier Selection:**
- [ ] NABET/ANSI accredited for ISO 14064-3
- [ ] Sector experience (your industry)
- [ ] No conflict of interest (no consulting in last 2 years)
- [ ] Team competence (lead verifier: GHG lead verifier cert)
- [ ] Timeline compatibility

### 3.2.2.3 Managing Findings — Closure Process

| Finding Severity | Response Time | Closure Required |
|------------------|---------------|------------------|
| **Critical** (material misstatement) | Immediate | Before opinion |
| **Major** (systemic issue) | 2 weeks | Before opinion |
| **Minor** (isolated, immaterial) | 4 weeks | Before final report |
| **Observation** (improvement) | 8 weeks | Next cycle |

**Finding Response Template:**
1. **Root Cause Analysis** (5 Whys)
2. **Corrective Action** (specific, measurable, owner, deadline)
3. **Preventive Action** (systemic fix)
4. **Verification of Fix** (evidence)
5. **Closure Confirmation** (verifier sign-off)

### 3.2.2.3 India Context — Verification Landscape

| Regulation | Verification Requirement | Verifier |
|-----------|-------------------------|----------|
| **SEBI BRSR** | Reasonable assurance (Top 1000) | NABET accredited |
| **CCTS** | Accredited verifier (BEE empaneled) | BEE-approved |
| **CORSIA** | ICAO-approved verifier | ICAO list |
| **CDP** | Third-party verification (Leadership) | ISAE 3000/ISO 14064-3 |
| **SBTi** | Reasonable assurance for target | ISO 14064-3 |

**BEE Empaneled Verifiers (2024):** DNV, BV, SGS, TÜV, IRCLASS, Intertek, LRQA, EY, KPMG, PwC (subject to NABET)

**EtherTrack Context:** Platform generates verification-ready package: inventory report, methodology sheets, source doc links, calculation traceability, uncertainty budget, DQI table.

### 3.2.2.3 Common Verification Failures
1. **Scope 3 sampling too small** → verifier expands scope → cost/time overrun
2. **No uncertainty budget** → limited assurance only
3. **Source documents not in English** → translation delays
4. **Key personnel unavailable** → timeline slippage
5. **Prior year findings unclosed** → escalation to major

### 3.2.2.3 Professional Judgement Points
- **Limited vs Reasonable:** If budget allows, always choose Reasonable — credibility premium
- **Verifier rotation:** Rotate every 3-5 years (independence)
- **Pre-assessment:** Internal mock verification 4 weeks before — catches 80% of findings
- **Multi-year contract:** Locks verifier, reduces ramp-up, but monitor independence

### 3.2.2.3 Practical Exercise: Verification Prep Workshop
*Scenario:* Your org is preparing for first reasonable assurance verification (Scope 1+2+3). Inventory: S1=20kt, S2=30kt, S3=500kt (Cat 1: 60%, Cat 11: 15%).
*Tasks:*
1. Build verification readiness checklist
2. Design sampling plan for verifier (sites, sources, calcs)
3. Prepare management representation letter
4. Draft findings response template
*Time:* 40 min
*Deliverable:* Verification prep package
*Rubric:* Completeness (40%), sampling logic (30%), response quality (30%)

**Knowledge Check:**
1. What's the difference between limited and reasonable assurance? (Conclusion type, work depth, confidence)
2. What is the typical materiality threshold for Scope 1+2? (5%)
3. Can the same firm do consulting and verification? (No — independence conflict, 2-year cooling off)
5. What is a "management representation letter"? (Formal letter asserting completeness, accuracy)

**Sources:**
1. ISO 14064-3:2019 — GHG Verification
2. ISAE 3000 (Revised) — Assurance Engagements
3. ISAE 3410 — GHG Assurance Engagements
4. GHG Protocol — Verification Guidance
4. SEBI BRSR — Assurance Requirements
5. SBTi Verification Requirements
5. NABET Accreditation Criteria for GHG Verifiers

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC (Assurance standards evolving) | Regulatory Review: Annual*

---

### Lesson 3.2.3: Issuance, Registries & Post-Issuance Management
**Lesson Code:** C03.2.3
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** professional

**Learning Objectives:**
1. Navigate the issuance process: verification → registry → issuance → activation (Bloom: Understand)
2. Manage post-issuance: transfers, retirement, cancellation, cancellation reversals (Bloom: Apply)
3. Handle issuance risks: reversals, buffer pools, compliance vs voluntary (Bloom: Analyze)

**Prerequisites:** C03.2.2, C10.1.1, C10.2.1

**Why This Matters:**
Issuance is the moment emissions reductions become tradeable assets. But issuance is not the end — it's the beginning of a credit's lifecycle. Mismanaging post-issuance processes (transfers, retirements, reversals) leads to compliance failures, stranded assets, and legal liability.

**Core Concept: Issuance is the Beginning, Not the End**

### 3.2.3.1 Issuance Process — From Verification to Active Credits

**Issuance Workflow:**
```
Verification Opinion (Positive)
       ↓
Project Requests Issuance (Registry)
       ↓
Registry Checks:
  ✓ Verification opinion valid & positive
  ✓ Project registered & active
  ✓ Crediting period valid
  ✓ No overlapping issuance
  ✓ Buffer/contribution met (if applicable)
       ↓
Registry Issues Credits (Serial Numbers Assigned)
       ↓
Credits Deposited in Project Account (Pending/Active)
       ↓
Project Account Holder Manages Credits
```

**Key Registry Checks (VCS/GS/CDM/ART/CCTS):**
| Check | Failure Consequence |
|-------|---------------------|
| Verification opinion valid & positive | Issuance blocked |
| Project registered & active | Issuance blocked |
| Crediting period valid (vintage within) | Issuance blocked / vintage split |
| No overlapping issuance (same vintage) | Duplicate issuance rejected |
| Buffer/contribution met (AFOLU) | Issuance quantity reduced |
| Double counting check (other registries) | Issuance blocked / flagged |

### 3.2.3.1 Credit Lifecycle — From Issuance to Retirement

```
ISSUANCE → ACTIVE (in project account)
    ↓
TRANSFER (to buyer/broker account) → ACTIVE (in buyer account)
    ↓
RETIREMENT (for compliance/voluntary claim) → RETIRED (immutable)
    ↓
CANCELLATION (compliance use, e.g., CORSIA, Art 6) → CANCELLED (immutable)
```

**Credit States:**
| State | Description | Transferable? | Usable for Claims? |
|-------|-------------|---------------|-------------------|
| **Pending** | Issued, not yet activated | No | No |
| **Active** | In account, available | Yes | No (until retired) |
| **Retired** | Voluntary claim made | No | Yes (with retirement proof) |
| **Cancelled** | Compliance surrender (CORSIA, Art 6, ETS) | No | Yes (compliance) |
| **Cancelled (Reversal)** | Buffer draw, compliance reversal | No | No |

### 3.2.3.2 Registry Operations — Key Functions

| Operation | Description | Typical Timing |
|-----------|-------------|----------------|
| **Issuance Request** | Project submits verification report + request | Post-verification |
| **Transfer** | Move credits between accounts | T+0 to T+2 (registry-dependent) |
| **Retirement** | Permanent removal for voluntary claim | Immediate |
| **Cancellation** | Permanent removal for compliance | Immediate |
| **Reversal/Buffer Draw** | Registry draws from buffer for reversal | Per reversal event |
| **Cancellation Reversal** | Rare — error correction | Requires registry admin |

**Serial Number Structure (Examples):**
| Registry | Format | Example |
|----------|--------|---------|
| **Verra** | VCU-XXXX-YYYY-NNNNNNN | VCU-1234-2024-0000001 |
| **Gold Standard** | GS-XXX-YYYY-NNNNNNN | GS-123-2024-0000001 |
| **CDM** | CER-XXXX-YYYY-NNNNNNN | CER-1234-2024-0000001 |
| **ART/TREES** | TREES-XXXX-YYYY-NNNNNNN | TREES-123-2024-0000001 |
| **CCTS (India)** | CCC-YYYY-NNNNNNNN | CCC-2024-00000001 |

### 3.2.3.2 Buffer Pools & Reversals — Risk Management

**Buffer Pool Purpose:** Insures against non-permanence (reversals) for AFOLU projects.

| Standard | Buffer % | Trigger | Mechanism |
|----------|----------|---------|-----------|
| **VCS (AFOLU)** | 10-30% (risk-based) | Reversal (fire, disease, harvest) | Registry auto-draws from buffer |
| **Gold Standard** | 20% | Reversal | Buffer draw |
| **ART/TREES** | Jurisdictional risk-based | Reversal | Reversal risk pool |
| **CCTS** | TBD (draft) | Reversal | Buffer draw |

**Reversal Types & Handling:**
| Reversal Type | Cause | Registry Action |
|---------------|-------|-----------------|
| **Intentional** | Land use change, harvest | Buffer draw = reversed amount |
| **Unintentional** | Fire, disease, pest, storm | Buffer draw = reversed amount |
| **Regulatory** | Government action | Buffer draw = reversed amount |
| **Error** | Over-issuance, double counting | Registry correction + buffer draw |

**Buffer Replenishment:**
- Subsequent verifications → additional credits → buffer replenishment
- If buffer depleted → issuance suspended until replenished

### 3.2.3.2 Post-Issuance Risks & Management

| Risk | Mitigation |
|------|------------|
| **Reversal (AFOLU)** | Buffer pool; insurance; diversification |
| **Regulatory Change** | Credit eligibility loss (e.g., CORSIA vintage expiry) | Diversify standards/vintages |
| **Double Counting** | Registry interoperability; retirement proof |
| **Price Volatility** | Forward contracts; hedging; portfolio diversification |
| **Regulatory Invalidation** | Standard withdrawal (e.g., CDM post-2020) | Standard diversification |
| **Counterparty Default** | Escrow; payment terms; credit checks |

### 3.2.3.3 Credit Transfers & Settlement

**Transfer Types:**
| Type | Description | Settlement |
|-------|-------------|------------|
| **Primary** | Project → First buyer | T+0 to T+2 (registry) |
| **Secondary** | Broker/Exchange → End buyer | T+0 to T+2 |
| **OTC Bilateral** | Direct account-to-account | T+0 (registry) |
| **Exchange** | IEX, PXIL, Xpansiv, CTX, AirCarbon | T+1 (exchange) |

**Settlement Risks & Mitigations:**
| Risk | Mitigation |
|------|------------|
| **Counterparty Default** | Escrow; payment vs delivery (DvP); credit limits |
| **Settlement Failure** | Registry DvP; escrow agents |
| **Double Transfer** | Registry-level duplicate prevention; serial tracking |
| **Regulatory Block** | Sanctions screening; KYC/AML on accounts |

### 3.2.3.3 India Context — CCTS Registry & Settlement

**CCTS Registry:**
- **Operator:** BEE (Bureau of Energy Efficiency)
- **Trading Platforms:** IEX, PXIL (authorized exchanges)
- **CCC Serial Format:** `CCC-YYYY-NNNNNNNN` (year + sequential)
- **Settlement:** T+1 on IEX/PXIL; T+0 bilateral
- **CCTS-CDM/Art6 Bridge:** BEE developing bridge for CDM transition, Art 6.2 LoA integration

**EtherTrack Context:**
- Registry bridge microservice: `registry-bridge` (Go, gRPC + REST)
- Data model: `Credit` (internal) ↔ `ExternalCredit` (source-specific)
- Sync frequency: Verra/GS — hourly poll; CDM/Art6 — webhook + daily reconciliation
- Settlement engine: `settlement-engine` (Rust) handles ERC-1155 mint/burn/transfer
- Audit: Immutable event store (append-only) for all registry operations

### 3.2.3.3 Professional Judgement Points
- **Retirement vs Cancellation:** Retirement = voluntary claim; Cancellation = compliance. Never confuse.
- **Vintage integrity:** Never mix vintages in single retirement claim.
- **Buffer monitoring:** Monitor buffer levels quarterly; alert at <50% remaining.
- **Reversal preparedness:** Pre-negotiate buffer insurance; have reversal response plan.
- **Audit trail:** Every credit must have complete chain-of-custody from issuance to current holder.

### 3.2.3.3 Practical Exercise: Issuance & Post-Issuance Workshop
*Scenario:* A 100 MW wind project in Tamil Nadu receives verification. 150,000 VCUs issued (vintage 2024). Client wants to: (a) sell 100k to corporate buyer for SBTi claim, (b) retire 30k for own carbon neutral claim, (c) hold 20k for future CORSIA compliance.
*Tasks:*
1. Design issuance request & registry workflow
2. Structure transfer/retirement for each use case (vintage, standard, claim type)
3. Identify regulatory risks (CORSIA vintage eligibility, SBTi claim validity)
4. Design buffer monitoring dashboard
*Time:* 45 min
*Deliverable:* Issuance & portfolio management plan
*Rubric:* Workflow accuracy (40%), claim validity (30%), risk identification (30%)

**Knowledge Check:**
1. What is the difference between "retired" and "cancelled" credit status? (Voluntary vs compliance use)
2. What triggers a buffer pool draw? (Reversal — intentional, unintentional, regulatory)
3. Can a credit be "un-retired"? (No — retirement is immutable)
4. What is the typical settlement cycle on IEX for CCCs? (T+1)

**Sources:**
1. Verra Registry System Specification (2024)
3. Gold Standard Registry Requirements (2023)
4. CDM Registry & Transaction Log (2023)
5. Article 6.4 Registry Technical Spec (2023)
5. CORSIA Registry Requirements (ICAO 2024)
6. BEE CCTS Guidelines (2023) — Registry & Settlement
6. EtherTrack Registry Bridge Architecture (Internal)

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC (Registry APIs, Art 6.4 operationalizing) | Regulatory Review: Quarterly*