# C04: GHG Accounting (Scopes 1/2/3)
## Module 4.3: Inventory Design & Reporting (3 lessons × 40min = 2h)

### Lesson 4.3.1: Base Year, Recalculation & Structural Changes
**Lesson Code:** C04.3.1
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** foundation

**Learning Objectives:**
1. Select and justify a base year per GHG Protocol criteria (Bloom: Evaluate)
2. Apply mandatory recalculation policy for structural/methodological changes (Bloom: Apply)
3. Implement a base year management system with audit trail (Bloom: Create)

**Prerequisites:** C04.1.1, C04.1.3

**Why This Matters:**
The base year is the anchor for all emissions targets, progress tracking, and stakeholder claims. A poorly chosen base year, or failure to recalculate when required, invalidates targets, fails audits, and exposes the organization to greenwashing allegations. This lesson teaches you to manage the base year as a governed asset.

**Core Concept: The Base Year is a Contract with Stakeholders**

### 4.3.1.1 Base Year Selection Criteria (GHG Protocol)

**Mandatory Criteria:**
| Criterion | Test | Failure Consequence |
|-----------|------|---------------------|
| **Representativeness** | Typical operations, no major anomalies | Non-representative → misleading trends |
| **Data Availability** | Complete, verifiable data for all scopes | Gaps → estimation uncertainty |
| **Fixed Reference** | Locked for target period | Changes require restatement |
| **Verifiability** | Auditable evidence exists | Unverifiable → assurance failure |

**Selection Process:**
```
1. Identify candidate years (min 3 years history)
2. Score each on: data completeness, operational stability, relevance
3. Select highest score
4. Document rationale (required for audit)
5. Lock in target-setting framework (SBTi, net-zero)
```

**Base Year Types:**
| Type | Definition | Use Case |
|------|------------|----------|
| **Fixed Base Year** | Single historical year (e.g., 2019) | Most common; SBTi default |
| **Multi-Year Average** | 2-3 year average | High variability (weather-dependent) |
| **Rolling Base Year** | Fixed target year, base year rolls | Not SBTi-compliant for targets |
| **Dynamic Base Year** | Recalculated annually | Internal management only |

### 4.3.1.2 Mandatory Recalculation Triggers (GHG Protocol)

**Threshold:** >5% of base year emissions (any scope) or any structural change

| Trigger Category | Specific Events | Action Required |
|------------------|-----------------|-----------------|
| **Structural Changes** | Merger, acquisition, divestiture >5% base year emissions | Recalculate base year + all subsequent years |
| | Outsourcing/insourcing >5% | Recalculate |
| | Facility closure/opening >5% | Recalculate |
| **Methodology Changes** | New EF source (e.g., AR5 → AR6 GWP) | Recalculate |
| | Improved calculation method (higher tier) | Recalculate |
| | New measurement technology | Recalculate |
| **Boundary Changes** | New facility added/removed | Recalculate |
| | Leased asset reclassification | Recalculate |
| | Organizational boundary approach change | Recalculate |
| **Error Corrections** | Material error >5% of category | Recalculate |

**Non-Recalculation Events (No Recalc Required):**
- Organic growth/decline (production volume changes)
- Efficiency improvements (intentional reductions)
- Market changes (fuel price, grid EF updates)
- New data availability for previously estimated sources

### 4.3.1.3 Recalculation Procedure

**Step-by-Step:**
```
1. IDENTIFY TRIGGER
   → Document: what changed, when, estimated impact

2. DEFINE RECALCULATION SCOPE
   → Base year + all subsequent years to present
   → All affected scopes/categories

3. APPLY NEW METHOD/BOUNDARY
   → Use current methodology for all years
   → Apply new boundary consistently

4. CALCULATE DELTA
   → Old base year emissions vs new base year emissions
   → % change by scope, category, gas

6. DOCUMENT
   → Recalculation log: trigger, scope, old vs new values, rationale
   → Update all prior public reports (restatement)

7. TARGET ADJUSTMENT
   → If base year emissions change → adjust absolute target
   → SBTi: targets must be rebaselined if base year changes
   → Intensity targets: denominator may need adjustment

7. COMMUNICATE
   → Internal: management, board
   → External: stakeholders, CDP, SBTi, regulators
   → Transparency: old vs new, rationale, impact
```

### 4.3.1.4 Recalculation Documentation Template

| Field | Required |
|---------|----------|
| **Trigger Date** | Date change occurred |
| **Trigger Type** | Structural / Methodology / Boundary / Error |
| **Description** | Narrative of change |
| **Affected Scopes** | 1, 2, 3 (categories) |
| **Old Base Year Emissions** | tCO2e by scope |
| **New Base Year Emissions** | tCO2e by scope |
| **% Change** | % by scope, total |
| **Methodology Change** | Old vs new method/EF/GWP |
| **Boundary Change** | Entities added/removed |
| **Recalculation Date** | When performed |
| **Performed By** | Name, role |
| **Approved By** | Name, role |
| **Target Impact** | Target adjustment needed? |
| **Stakeholder Communication** | Date, channel, audience |

### 4.3.1.5 SBTi Base Year Requirements

| Requirement | SBTi Rule |
|-------------|-----------|
| **Base Year** | Single year (not average) |
| **Recency** | Most recent year with reliable data (max 2-3 years old at submission) |
| **Recalculation** | Mandatory per GHG Protocol triggers |
| **Target Rebaselining** | Required if base year emissions change >5% |
| **Target Validity** | 5 years max; must update if base year changes |
| **Transparency** | Disclose base year, recalculation history in submission |

**SBTi Rebaselining Example:**
- Original: Base 2019 = 100 ktCO2e; Target 2030 = 50 ktCO2e (50% reduction)
- Acquisition 2022 adds 20 ktCO2e to 2019 base
- New Base 2019 = 120 ktCO2e
- New Target 2030 = 60 ktCO2e (maintains 50% reduction)
- **Must resubmit to SBTi for validation**

### 4.3.1.6 Base Year Management System

**Governance Structure:**
| Role | Responsibility |
|---------|---------------|
| **Base Year Owner** | Sustainability/ESG lead — accountable for integrity |
| **Data Custodians** | Scope owners — data quality, completeness |
| **Methodology Keeper** | Methodology versions, EF library, GWP versions |
| **Audit Coordinator** | Verification liaison, recalculation coordination |

**System Components:**
| Component | Tool/Process |
|-----------|--------------|
| **Base Year Registry** | Locked record: year, emissions, methodology version, GWP version |
| **Change Log** | Immutable append-only log of all changes |
| **Methodology Versioning** | Git repo with tags per inventory year |
| **EF Library Versioning** | Timestamped EF library per inventory year |
| **Recalculation Engine** | Automated re-run of prior years with new params |
| **Audit Trail** | Immutable evidence package per inventory year |

### 4.3.1.6 Common Base Year Mistakes
1. **Changing base year without recalculation** → targets invalid
2. **Using multi-year average as base year** → not SBTi-compliant
3. **Ignoring acquisition impact** → >5% threshold missed
4. **Updating GWP without recalculation** → methodology change trigger
5. **No recalculation log** → audit finding
5. **Not communicating restatement** → stakeholder trust loss

### 4.3.1.7 Professional Judgement Points
- **Borderline structural change (4.9%):** Recalculate anyway — conservatism builds credibility
- **Multiple triggers in one year:** Single comprehensive recalculation, not sequential
- **Historical data gaps for new acquisition:** Use estimation with clear uncertainty; flag for improvement
- **Divestiture:** Remove from base year; document as structural change
- **Merger of equals:** New entity = new base year (both recalculate)

### 4.3.1.7 Practical Exercise: Recalculation Workshop
*Scenario:* Base year 2019 = 100 ktCO2e (S1: 20, S2: 30, S3: 50). In 2023:
1. Acquired competitor (adds 15 ktCO2e to 2019 base)
2. Updated GWP from AR5 to AR6 (CH4 GWP 28→27.9, N2O 265→273)
3. Outsourced logistics (removes 5 ktCO2e from 2019 base)
*Tasks:*
1. Determine which triggers require recalculation
2. Calculate new 2019 base year emissions
3. Determine if SBTi target needs rebaselining
4. Draft stakeholder communication
*Time:* 40 min
*Deliverable:* Recalculation log + stakeholder memo
*Rubric:* Trigger identification (30%), calculation accuracy (40%), communication (30%)

**Knowledge Check:**
1. What is the GHG Protocol threshold for mandatory recalculation? (>5% of base year emissions)
2. Does organic growth trigger recalculation? (No)
3. Does updating GWP from AR5 to AR6 trigger recalculation? (Yes — methodology change)
4. What must happen to SBTi targets if base year changes? (Rebaselining + resubmission)

**Sources:**
1. GHG Protocol Corporate Standard — Chapter 5 (Base Year), Chapter 9 (Recalculation)
2. SBTi Corporate Manual v2.0 — Base Year & Recalculation
3. ISO 14064-1:2018 — Section 8 (Base Year)
4. SBTi Corporate Manual v2.0 — Rebaselining
5. CDP Technical Note — Base Year Changes

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC (SBTi evolving) | Regulatory Review: Annual*

---

### Lesson 4.3.2: Verification, Assurance & Audit Readiness
**Lesson Code:** C04.3.2
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** foundation

**Learning Objectives:**
1. Distinguish verification, validation, assurance levels and select appropriate level (Bloom: Understand)
2. Design a verification-ready inventory package (Bloom: Create)
3. Manage the verification process: scope, timeline, findings, closure (Bloom: Apply)

**Prerequisites:** C04.1.3, C04.2.3

**Why This Matters:**
Verification transforms an internal calculation into a credible, defensible statement. Regulators (SEBI BRSR, CSRD), investors (CDP, SBTi), and counterparties (CORSIA, CCTS) require verified data. A failed verification delays reporting, damages credibility, and can trigger regulatory penalties.

**Core Concept: Verification is a Process, Not an Event**

### 4.3.2.1 Assurance Levels — Definitions & Selection

| Level | Definition | Standard | Typical Use |
|-------|------------|----------|-------------|
| **No Assurance** | Internal only | — | Internal mgmt |
| **Limited Assurance** | "Nothing has come to our attention..." | ISAE 3000 / ISO 14064-3 | Entry-level, some regulations |
| **Reasonable Assurance** | "In our opinion, the inventory is fairly stated..." | ISAE 3000 / ISO 14064-3 | SBTi, CDP Leadership, CSRD, CCTS, CORSIA |

**Key Differences:**
| Aspect | Limited | Reasonable |
|--------|---------|------------|
| **Work Performed** | Analytical procedures, inquiry | Detailed testing, sampling, recalculation |
| **Conclusion** | Negative ("nothing came to attention") | Positive ("in our opinion, fairly stated") |
| **Risk** | Higher (lower confidence) | Lower (high confidence) |
| **Cost/Time** | Lower | 2-3× higher |

**Selection Criteria:**
| Driver | Required Level |
|--------|----------------|
| SBTi Target Validation | Reasonable |
| CDP Leadership (A/A-) | Reasonable |
| SEBI BRSR (Top 1000) | Reasonable |
| CSRD (EU) | Reasonable |
| CCTS Compliance | Reasonable |
| CORSIA Compliance | Reasonable |
| Internal Management | Limited/None |
| Voluntary Reporting (entry) | Limited |

### 4.3.2.2 Verification Standards & Frameworks

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

### 4.3.2.3 Verification Process — End-to-End

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

### 4.3.2.4 Verification Sampling — Risk-Based

**Sampling Approach:**
| Population | Sampling Method | Typical Coverage |
|-----------|-----------------|------------------|
| **Facilities** | Risk-based (size, complexity, risk) | 30-50% of sites, 100% of >10% emitters |
| **Emission Sources** | Stratified by magnitude | 100% of >5% sources |
| **Data Points** | Random + judgmental | 25-50 per category |
| **Calculations** | 100% recalculation of sample | 100% of sampled calcs |
| **EFs** | Source verification | 100% of primary EFs |

**Sample Documentation:** Verifier must document rationale, not just results.

### 4.3.2.5 Common Verification Findings — Top 10

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

### 4.3.2.6 Verification Readiness Package — Checklist

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

### 4.3.2.6 Managing Findings — Closure Process

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

### 4.3.2.6 India Context — Verification Landscape

| Regulation | Verification Requirement | Verifier |
|-----------|-------------------------|----------|
| **SEBI BRSR** | Reasonable assurance (Top 1000) | NABET accredited |
| **CCTS** | Accredited verifier (BEE empaneled) | BEE-approved |
| **CORSIA** | ICAO-approved verifier | ICAO list |
| **CDP** | Third-party verification (Leadership) | ISAE 3000/ISO 14064-3 |
| **SBTi** | Reasonable assurance for target | ISO 14064-3 |

**BEE Empaneled Verifiers (2024):** DNV, BV, SGS, TÜV, IRCLASS, Intertek, LRQA, EY, KPMG, PwC (subject to NABET)

**EtherTrack Context:** Platform generates verification-ready package: inventory report, methodology sheets, source doc links, calculation traceability, uncertainty budget, DQI table.

### 4.3.2.7 Common Verification Failures
1. **Scope 3 sampling too small** → verifier expands scope → cost/time overrun
2. **No uncertainty budget** → limited assurance only
3. **Source documents not in English** → translation delays
4. **Key personnel unavailable** → timeline slippage
5. **Prior year findings unclosed** → escalation to major

### 4.3.2.7 Professional Judgement Points
- **Limited vs Reasonable:** If budget allows, always choose Reasonable — credibility premium
- **Verifier rotation:** Rotate every 3-5 years (independence)
- **Pre-assessment:** Internal mock verification 4 weeks before — catches 80% of findings
- **Multi-year contract:** Locks verifier, reduces ramp-up, but monitor independence

### 4.3.2.7 Practical Exercise: Verification Prep Workshop
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

### Lesson 4.3.3: Reporting Frameworks — BRSR, CDP, TCFD, CSRD, CCTS
**Lesson Code:** C04.3.3
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** foundation

**Learning Objectives:**
1. Map GHG inventory outputs to major reporting frameworks (BRSR, CDP, TCFD, CSRD, CCTS) (Bloom: Apply)
2. Identify overlapping and unique requirements across frameworks (Bloom: Analyze)
3. Design a unified reporting workflow that satisfies multiple frameworks (Bloom: Create)

**Prerequisites:** C04.1.3, C04.3.1, C04.3.2

**Why This Matters:**
Organizations face a "reporting alphabet soup" — BRSR (India), CDP (global), TCFD (governance/strategy), CSRD/ESRS (EU), CCTS (India compliance). Each framework has unique metrics, boundaries, and timelines. A unified reporting workflow avoids duplication, ensures consistency, and reduces compliance cost.

**Core Concept: One Inventory, Many Reports**

### 4.3.3.1 Framework Landscape — Scope & Focus

| Framework | Jurisdiction | Mandatory For | Focus | Frequency |
|-----------|--------------|---------------|-------|-----------|
| **BRSR** | India (SEBI) | Top 1000 listed | ESG + GHG (Principles 6, 7) | Annual (FY) |
| **CDP** | Global (voluntary→expected) | 23,000+ companies | GHG + Governance + Targets | Annual (CY) |
| **TCFD** | Global (voluntary→mandatory in many) | Financial sector + large corps | Governance, Strategy, Risk, Metrics | Annual |
| **CSRD/ESRS** | EU (+ value chain) | EU large + non-EU >€150M EU rev | ESRS E1 (Climate) + cross-cutting | Annual |
| **CCTS** | India (BEE) | Obligated entities (aluminum, cement, steel, etc.) | Compliance tracking, CCC management | Quarterly + Annual |
| **ISSB/IFRS S2** | Global (voluntary→adopted) | IFRS adopters | Climate-related disclosures | Annual |

### 4.3.3.2 GHG-Specific Requirements Mapping

| Data Point | BRSR (P6) | CDP (C4-C11) | TCFD (Metrics) | CSRD ESRS E1 | CCTS |
|------------|-----------|--------------|----------------|--------------|------|
| **Scope 1** | ✅ tCO2e | ✅ tCO2e | ✅ tCO2e | ✅ tCO2e (E1-6) | ✅ tCO2e |
| **Scope 2 (Loc)** | ✅ tCO2e | ✅ tCO2e | ✅ tCO2e | ✅ tCO2e | ✅ tCO2e |
| **Scope 2 (Mkt)** | ❌ | ✅ tCO2e | ✅ tCO2e | ✅ tCO2e | ❌ |
| **Scope 3** | ✅ (categories) | ✅ (15 cats) | ✅ (material) | ✅ (E1-7) | ❌ (draft) |
| **Biogenic CO2** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Intensity** | ✅ (per ₹Cr) | ✅ (multiple) | ✅ (multiple) | ✅ (E1-6) | ❌ |
| **Base Year** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Targets** | ✅ (P6 Q8) | ✅ | ✅ | ✅ (E1-4) | ✅ |
| **Verification** | ✅ (Top 1000) | ✅ (Leadership) | ❌ | ✅ (Reasonable) | ✅ |
| **GWP Version** | Not specified | AR5/AR6 | Not specified | AR5/AR6 | AR6 (draft) |
| **Scope 3 Categories** | Disclose assessed | 15 categories | Material only | ESRS E1-7 | Draft |

### 4.3.3.3 Reporting Timelines — The Compliance Calendar

| Month | BRSR | CDP | TCFD | CSRD | CCTS |
|-------|------|-----|------|------|------|
| **Jan** | | Questionnaire opens | | | Q3 submission |
| **Feb** | | | | | |
| **Mar** | FY ends | | | FY ends | Q4 submission |
| **Apr** | Data collection | | | Data collection | |
| **May** | | | | | |
| **Jun** | | Submission deadline | | | |
| **Jul** | | Scoring | | | |
| **Aug** | | | | | |
| **Sep** | BRSR filing (w/ AR) | | | | Q1 submission |
| **Oct** | | | | | |
| **Nov** | | | | | |
| **Dec** | | | | | Q2 submission |

**Key Deadlines:**
- **BRSR:** With Annual Report (typically Sep-Nov)
- **CDP:** Mid-June submission; scoring by Dec
- **CSRD:** FY ending 2024 first report in 2025
- **CCTS:** Quarterly (15th of month after quarter-end)

### 4.3.3.3 Unified Reporting Workflow — Single Source, Multiple Outputs

**Architecture:**
```
UNIFIED GHG DATA LAYER
  • Single inventory database (Scopes 1,2,3)
  • Versioned methodology, EFs, GWP
  • Versioned calculations, audit trail
        │
        ▼
┌─────────┐  ┌─────────┐  ┌─────────┐
│  BRSR   │  │  CDP    │  │  TCFD   │
│ Report  │  │Response │  │ Report  │
└────┬────┘  └────┬────┘  └────┬────┘
     │             │             │
     ▼             ▼             ▼
┌─────────┐   ┌─────────┐   ┌─────────┐
│  CSRD   │   │  CCTS   │   │  ISSB   │
│ ESRS E1 │   │Quarterly│   │  S2     │
└─────────┘   └─────────┘   └─────────┘
```

**Unified Data Model:**
```json
{
  "inventory": {
    "period": "FY2024",
    "boundary": {"approach": "operational_control", "entities": [...]},
    "methodology": {"standard": "GHGP", "gwp": "AR6", "gwp_horizon": 100},
    "scopes": {
      "1": {"total": 20000, "categories": {...}},
      "2": {"location_based": 30000, "market_based": 25000},
      "3": {"categories": {"1": 150000, "11": 50000, ...}}
    },
    "uncertainty": {"scope1": 5, "scope2": 3, "scope3": 25},
    "verification": {"level": "reasonable", "verifier": "DNV", "date": "2024-07-15"}
  },
  "targets": [
    {"scope": "1+2", "type": "absolute", "base_year": 2019, "target_year": 2030, "reduction_pct": 50},
    {"scope": "3", "type": "absolute", "base_year": 2019, "target_year": 2030, "reduction_pct": 30}
  ]
}
```

**Report Generators:** Each framework = template + transformation rules.

### 4.3.3.4 Framework-Specific Nuances

| Framework | Unique Requirement | Implementation Tip |
|-----------|-------------------|-------------------|
| **BRSR** | Intensity per ₹Cr turnover | Auto-calculate from financials |
| **CDP** | 15 Scope 3 categories + sector module | Auto-map categories; sector questionnaire |
| **TCFD** | Scenario analysis (2°C, 1.5°C) | Link to strategy/governance sections |
| **CSRD** | Double materiality (impact + financial) | Separate impact vs financial assessment |
| **CCTS** | Quarterly CCC tracking | Bridge registry data to quarterly return |
| **ISSB S2** | Climate resilience (scenario analysis) | Link to TCFD strategy section |

### 4.3.3.5 Unified Reporting Workflow

```
ANNUAL REPORTING CYCLE

Q1 (Apr-Jun): DATA COLLECTION & CALCULATION
• Issue data requests (internal + suppliers)
• Collect meter reads, fuel receipts, activity data
• Run calculations → draft inventory
• Internal QC → uncertainty budget → DQI

Q2 (Jul-Sep): VERIFICATION & FINALIZATION
• Verifier engagement → fieldwork → opinion
• Incorporate findings → lock inventory v1.0
• Generate verification package

Q3 (Oct-Dec): REPORT GENERATION
• BRSR: Map inventory → Principle 6 template
• CDP: Map inventory → C4-C11 questionnaire
• TCFD: Extract metrics → governance/strategy sections
• CSRD: ESRS E1 mapping → double materiality
• CCTS: Quarterly return (quarterly)

Q4 (Jan-Mar): FILING & ARCHIVING
• BRSR: File with Annual Report (Sep-Nov)
• CDP: Submit (Jun) → score (Dec)
• CSRD: File with management report (2025+)
• CCTS: Quarterly returns (15th post-quarter)
• Archive: Lock v1.0, store evidence package
```

### 4.3.3.5 Automation & Tooling

| Layer | Tools | EtherTrack Role |
|-------|-------|-----------------|
| **Data Collection** | API integrations (meters, ERPs, utility APIs) | Activity data ingestion |
| **Calculation** | Versioned engine (this course!) | Core calculation engine |
| **Quality Control** | Automated checks (mass balance, trends) | Built-in QC rules |
| **Verification** | Evidence packaging, sampling support | Verification package generator |
| **Reporting** | Template engine (Jinja2, Mustache) | Multi-framework report generator |
| **Archival** | Immutable storage (S3 + hash) | Evidence package + hash |

### 4.3.3.5 Common Reporting Failures
1. **Inconsistent boundaries** across frameworks (BRSR vs CDP)
2. **Different GWP versions** used in different reports
3. **Scope 3 category mismatch** (BRSR: "assessed"; CDP: 15 categories)
4. **Verification level mismatch** (BRSR reasonable; CDP limited)
5. **Timeline conflicts** (CCTS quarterly vs annual frameworks)
5. **Data version drift** (report uses v1.1 calc; archive has v1.0)

### 4.3.3.6 Professional Judgement Points
- **Single source of truth:** One inventory database → all reports derived
- **Version control:** Every report references exact inventory version
- **Automation first:** Manual mapping = errors; invest in transformers
- **Framework updates:** Monitor SEBI, CDP, EFRAG, BEE calendars
- **Cross-framework reconciliation:** Quarterly reconciliation of key metrics

### 4.3.3.6 Professional Judgement Points
- **Single source of truth:** One inventory database → all reports derived
- **Version control:** Every report references exact inventory version
- **Automation first:** Manual mapping = errors; invest in transformers
- **Framework updates:** Monitor SEBI, CDP, EFRAG, BEE calendars
- **Cross-framework reconciliation:** Quarterly reconciliation of key metrics

### 4.3.3.6 Practical Exercise: Unified Reporting Design
*Scenario:* An Indian steel company (Top 500 listed) must comply with BRSR, CDP, TCFD, and CCTS. Inventory: S1=2Mt, S2=1Mt, S3=10Mt.
*Tasks:*
1. Design unified data model covering all frameworks
2. Map each framework's unique GHG requirements to data model
3. Design quarterly/annual reporting calendar with owners
4. Identify automation opportunities (API, templates, scripts)
*Time:* 45 min
*Deliverable:* Unified reporting architecture document
*Rubric:* Data model completeness (40%), framework mapping (30%), automation design (30%)

**Knowledge Check:**
1. Which framework requires quarterly reporting? (CCTS)
2. Which framework requires double materiality? (CSRD/ESRS)
3. What is the key difference between BRSR and CDP Scope 3 reporting? (BRSR: "assessed"; CDP: 15 categories)
5. What verification level does BRSR Top 1000 require? (Reasonable assurance)

**Sources:**
1. SEBI BRSR Framework (2021) — Principle 6, 7
2. CDP Climate Change Questionnaire (2024) — C4-C11
3. TCFD Recommendations (2017) — Metrics & Targets
4. CSRD/ESRS E1 (2023) — Climate Change
5. ISSB IFRS S2 (2023) — Climate-related Disclosures
6. BEE CCTS Guidelines (2023) — Reporting Formats
7. ISSB IFRS S2 (2023) — Climate-related Disclosures

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC (Reporting frameworks evolving) | Regulatory Review: Quarterly*