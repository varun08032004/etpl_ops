# C11: Credit Quality & Due Diligence
## Module 11.2: Risk Frameworks & Red Flags (3 lessons × 40min = 2h)

### Lesson 11.2.1: Credit Risk Taxonomy & Scoring
**Lesson Code:** C11.2.1
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** professional

**Learning Objectives:**
1. Classify credit risks across technical, market, regulatory, and operational dimensions (Bloom: Understand)
2. Apply a structured scoring framework (e.g., 50-point quality score) to any credit (Bloom: Apply)
3. Calibrate risk weights for different buyer mandates (voluntary, compliance, Article 6) (Bloom: Create)

**Prerequisites:** C11.1.1, C11.1.2, C11.1.3

**Why This Matters:**
Credit quality isn't binary — it's a spectrum. A structured risk taxonomy and scoring system lets you compare credits across projects, vintages, and registries on a common basis. This is essential for portfolio construction, pricing, and meeting buyer mandates (e.g., "only credits scoring >40/50").

**Core Concept: Risk as Quantified Judgment — Not Gut Feel**

### 11.2.1.1 Credit Risk Taxonomy — Four Dimensions

| Dimension | Risk Categories | Key Questions |
|-----------|-----------------|---------------|
| **TECHNICAL** | Additionality, Permanence, Quantification, Leakage, Baseline | Is the carbon real, additional, permanent, correctly measured? |
| **MARKET** | Liquidity, Price Volatility, Buyer Demand, Registry Reputation, Vintage | Can I sell it? At what price? How stable is value? |
| **REGULATORY** | CCP-Eligibility, CORSIA, Article 6, Host Country Policy, Import Restrictions | Is it compliant? Will it stay compliant? |
| **OPERATIONAL** | Project Delivery, VVB Quality, Registry Performance, Bridge Risk, Settlement | Will issuance/transfer/retirement execute smoothly? |

**Risk Taxonomy Hierarchy:**
```
CREDIT RISK
├── TECHNICAL RISK
│   ├── Additionality Risk (Regulatory, Financial, Barrier, Common Practice)
│   ├── Permanence Risk (Reversal Probability, Buffer Adequacy, Monitoring)
│   ├── Quantification Risk (Conservativeness, Uncertainty, QA/QC, EFs)
│   ├── Leakage Risk (Identification, Quantification, Market Leakage)
│   └── Baseline Risk (Methodology Compliance, Conservativeness, Updates)
├── MARKET RISK
│   ├── Liquidity Risk (Registry, Project Type, Vintage, Volume)
│   ├── Price Risk (Volatility, Correlation, Policy Sensitivity)
│   ├── Demand Risk (Buyer Preferences, Mandates, Greenwashing Fear)
│   └── Reputation Risk (Standard Body, VVB, Project Developer)
├── REGULATORY RISK
│   ├── CCP Risk (Standard/Methodology Eligibility, Changes)
│   ├── CORSIA Risk (Eligibility Changes, Vintage Rules)
│   ├── Article 6 Risk (CA Rules, Host Country Authorization)
│   ├── Host Country Risk (Policy Reversal, NDC Changes, Export Bans)
│   └── Import Country Risk (Border Adjustments, Taxonomy)
└── OPERATIONAL RISK
    ├── Issuance Risk (VVB Quality, Standard Body Review, Timeline)
    ├── Transfer Risk (Registry Settlement, Bridge Integrity, Fees)
    ├── Retirement Risk (Label Accuracy, Claim Defensibility)
    └── Data Risk (Metadata Completeness, API Reliability)
```

### 11.2.1.2 50-Point Quality Scoring Framework

**Scoring Structure (Calyx/Sylvera-Aligned):**
```
TOTAL: 50 POINTS

TECHNICAL (20 pts)          MARKET (10 pts)           REGULATORY (10 pts)       OPERATIONAL (10 pts)
├── Additionality (6)       ├── Liquidity (3)         ├── CCP Status (4)          ├── VVB Quality (3)
├── Permanence (5)          ├── Price Stability (3)   ├── CORSIA/Art6 (3)         ├── Registry Ops (3)
├── Quantification (5)      ├── Demand Profile (2)    ├── Host Country (2)        ├── Bridge/Transfer (2)
├── Leakage (2)             ├── Reputation (2)        ├── Import Policy (1)       ├── Data Quality (2)
└── Baseline (2)                                                         
```

**Detailed Scoring Rubric:**

| Category | 0-1 (Poor) | 2-3 (Below Avg) | 4-5 (Avg) | 6-7 (Good) | 8-9 (Strong) | 10 (Exceptional) |
|----------|------------|-----------------|-----------|------------|--------------|------------------|
| **Additionality (6)** | Failed test | Weak barrier/test | Standard test pass | Strong investment test | Multiple tests pass; conservative | Gold standard; robust sensitivity |
| **Permanence (5)** | No buffer; high risk | Buffer < min; medium risk | Buffer = min; monitoring | Buffer > min; insurance | Buffer actuarial; long monitoring | Permanent removal; zero risk |
| **Quantification (5)** | No uncertainty; gaps | Partial uncertainty | Full uncertainty; conservative | Conservative + QA/QC | Conservative + audit + automation | Conservative + real-time monitoring |
| **Leakage (2)** | Ignored | Default only | Identified + quantified | Conservative quantification | Market leakage addressed | Zero leakage risk |
| **Baseline (2)** | Non-conservative | Standard | Conservative | Conservative + dynamic | Conservative + validated | Conservative + ex-post adjustment |

| Category | 0-1 (Poor) | 2 (Avg) | 3 (Good) |
|----------|------------|---------|----------|
| **Liquidity (3)** | Illiquid (no trades) | Some trades | Active market |
| **Price Stability (3)** | High volatility | Moderate | Stable |
| **Demand Profile (2)** | Niche buyers | Multiple segments | Broad demand |
| **Reputation (2)** | Unknown/poor VVB | Standard VVB | Top-tier VVB |

| Category | 0-1 (Poor) | 2-3 (Avg) | 4 (Strong) |
|----------|------------|-----------|------------|
| **CCP Status (4)** | Not eligible | Standard eligible, method pending | Fully CCP-approved |
| **CORSIA/Art6 (3)** | Ineligible | One eligible | Both eligible |
| **Host Country (2)** | High policy risk | Medium risk | Low risk |
| **Import Policy (1)** | Restrictions | Unclear | Open |

| Category | 0-1 (Poor) | 2 (Avg) | 3 (Strong) |
|----------|------------|---------|------------|
| **VVB Quality (3)** | Low-tier; findings issues | Standard | Top-tier; clean record |
| **Registry Ops (3)** | Frequent issues | Standard | Best-in-class |
| **Bridge/Transfer (2)** | Failed bridges | Standard | Automated; audited |
| **Data Quality (2)** | Incomplete metadata | Standard | Rich; API-accessible |

### 11.2.1.3 Scoring Calibration by Buyer Mandate

**Voluntary Corporate (Carbon Neutral/Net Zero):**
```
WEIGHTS: Technical 40%, Market 20%, Regulatory 20%, Operational 20%
THRESHOLD: ≥35/50 for "investment grade"; ≥40/50 for "premium"
PRIORITY: Additionality, Permanence, CCP, Claim Defensibility
```

**CORSIA Compliance (Airlines):**
```
WEIGHTS: Regulatory 50%, Technical 30%, Operational 15%, Market 5%
THRESHOLD: CORSIA-eligible = MANDATORY (binary gate)
PRIORITY: CORSIA eligibility, Vintage, CA, Registry
```

**Article 6.2 / ITMO (Government/Compliance):**
```
WEIGHTS: Regulatory 40%, Technical 30%, Operational 20%, Market 10%
THRESHOLD: CA-authorized = MANDATORY
PRIORITY: Host LoA, CA applied, Corresponding adjustment, Registry
```

**Financial/Structured Products:**
```
WEIGHTS: Technical 35%, Market 25%, Regulatory 20%, Operational 20%
THRESHOLD: ≥30/50 for "investment grade"; liquidity premium priced in
PRIORITY: Liquidity, Price stability, Technical floor, CCP
```

### 11.2.1.3 Score Application — Portfolio Construction

**Portfolio Quality Rules:**
| Rule | Implementation |
|------|----------------|
| **Floor Score** | No credit < 25/50 (junk threshold) |
| **Average Score** | Portfolio avg ≥ buyer mandate threshold |
| **Concentration Limit** | Max 20% in any single project/type/registry |
| **Vintage Diversification** | Max 40% in single vintage |
| **Registry Diversification** | Max 50% in single registry |
| **Risk Budget** | Allocate "risk points" across dimensions |

**Score Card Example:**
```
CREDIT: VCS-1234-2023 Solar Gujarat
DIMENSION          WEIGHT   SCORE   WEIGHTED
Technical          20       16/20   16.0
  Additionality    6        5/6     
  Permanence       5        4/5     
  Quantification   5        4/5     
  Leakage          2        2/2     
  Baseline         2        1/2     
Market             10       7/10    7.0
Regulatory         10       8/10    8.0
Operational        10       8/10    8.0
TOTAL                                      39/50 → INVESTMENT GRADE
```

### 11.2.1.3 Practical Exercise: Credit Scoring Workshop

**Scenario:** Score these three credits for a corporate buyer with "Net Zero by 2030" mandate (Threshold: ≥35/50, Technical ≥14/20, CCP mandatory).

**Credit 1: VCS Solar Gujarat 2023**
- Additionality: Strong investment test (IRR 11%→14%), benchmark justified
- Permanence: Renewable energy (low risk), no buffer needed
- Quantification: Full uncertainty analysis, conservative EFs, QA/QC documented
- Leakage: None (grid-connected)
- Baseline: Grid EF (conservative vintage)
- Liquidity: Active Verra solar market
- CCP: Verra eligible + AMS-I.D approved = CCP-eligible
- CORSIA: Eligible (vintage 2023)
- VVB: SGS (top-tier)
- Registry: Verra (standard)
- Bridge: EtherTrack available
- Data: Full metadata + API

**Credit 2: GS Cookstoves Odisha 2022**
- Additionality: Barrier test (access to finance), common practice <20%
- Permanence: Cookstove (medium risk), buffer 15% (GS requirement)
- Quantification: Usage monitoring (survey), default EFs, some uncertainty
- Leakage: Market leakage assessed (default)
- Baseline: Suppressed demand (conservative)
- Liquidity: Moderate (cookstove niche)
- CCP: GS eligible + TPDDTEC approved = CCP-eligible
- CORSIA: Not eligible (vintage 2022 pre-CORSIA)
- VVB: DNV (top-tier)
- Registry: GS (standard)
- Bridge: Limited
- Data: Good metadata

**Credit 3: VCS REDD+ Brazil 2023 (VM0033)**
- Additionality: Baseline deforestation rate; barrier (enforcement)
- Permanence: High risk; buffer 20% (minimum); monitoring annual satellite
- Quantification: Proxy area; default carbon stocks; uncertainty deducted
- Leakage: 10km belt; market leakage default
- Baseline: Historical reference region (conservative)
- Liquidity: Low (forestry niche, Brazil risk)
- CCP: Verra eligible BUT VM0033 NOT CCP-approved
- CORSIA: Not eligible (forestry excluded)
- VVB: Aster Global (mid-tier)
- Registry: Verra
- Bridge: None
- Data: Basic metadata

**Task:** Calculate 50-point score for each. Recommend: Buy / Conditional / Avoid.

**Deliverable:** Scorecards (3 credits) + Recommendation Memo
**Time:** 35 min
**Rubric:** Scoring accuracy (40%), mandate alignment (30%), recommendation logic (30%)

**Knowledge Check:**
1. Why does "CCP mandatory" act as a binary gate for some buyers?
2. How does liquidity risk differ between solar and cookstove credits?
3. What technical score would make a credit "uninvestable" regardless of market score?
4. How do you handle a credit that scores high technically but low on market liquidity?

**Sources:**
1. Calyx Global — Credit Quality Assessment Framework
2. Sylvera — Carbon Credit Ratings Methodology
3. ICVCM — Core Carbon Principles
4. ICROA — Code of Best Practice
5. VCMI — Claims Code of Practice

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC | Regulatory Review: Quarterly*

---

### Lesson 11.2.2: Red Flag Detection — Project Level
**Lesson Code:** C11.2.2
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** professional

**Learning Objectives:**
1. Identify project-level red flags across PDD, monitoring reports, and verification documents (Bloom: Apply)
2. Distinguish between fatal flaws (walk away) and manageable risks (conditional) (Bloom: Evaluate)
3. Build a project-level red flag checklist for systematic due diligence (Bloom: Create)

**Prerequisites:** C11.2.1, C07.1.1, C09.2.3

**Why This Matters:**
A single red flag can turn a profitable credit purchase into a stranded asset or reputational disaster. Systematic red flag detection at the project level is the first line of defense in due diligence. This lesson gives you a practical, document-by-document framework to catch issues before they cost you.

**Core Concept: Red Flags as Early Warning System — Document by Document**

### 11.2.2.1 Red Flag Classification — Severity & Action

| Severity | Definition | Action | Examples |
|----------|------------|--------|----------|
| **FATAL (Walk Away)** | Fundamental flaw; cannot be fixed; credit integrity compromised | Do not purchase; do not develop | Additionality failure; double counting; fraud evidence; methodology ineligibility |
| **CRITICAL (Conditional)** | Material risk; requires specific resolution before purchase | Purchase only if resolved with evidence | Open CARs; buffer < minimum; no FPIC; vintage mismatch |
| **MATERIAL (Discount/Negotiate)** | Quantifiable risk; affects value but not integrity | Negotiate price discount; monitor | Minor quantification uncertainty; liquidity discount; VVB mid-tier |
| **MINOR (Note/Monitor)** | Low risk; best practice gap; no material impact | Note in DD memo; track post-purchase | Missing SDG verification; suboptimal metadata; older VVB report |

### 11.2.2.1 PDD Red Flags — Project Design Document

| Section | Red Flag | Fatal/Critical/Material/Minor | Detection Method |
|---------|----------|-------------------------------|------------------|
| **1. Project Description** | Vague boundaries; no GIS/KML | Critical | Request spatial data; verify in GIS |
| | Technology not matching methodology | Fatal | Cross-check methodology applicability |
| | Project location in sanctioned region | Fatal | Sanctions screening |
| **2. Baseline** | Baseline scenario not methodology-compliant | Fatal | Methodology checklist |
| | Historical data cherry-picked | Critical | Demand full dataset; statistical test |
| | "Business as usual" = current practice (not counterfactual) | Fatal | Additionality tool application |
| | Baseline emissions > project emissions (no leakage) | Material | Recalculate |
| **3. Additionality** | Investment analysis: carbon price > 2x spot | Critical | Check assumptions vs market |
| | Benchmark not sourced/justified | Critical | Demand source document |
| | Barrier evidence = generic statements | Critical | Demand project-specific evidence |
| | Common practice data > 3 years old | Material | Check data vintage |
| | Regulatory surplus not addressed | Fatal | Legal opinion required |
| **4. Project Emissions** | Sources omitted (transport, upstream) | Critical | Methodology source checklist |
| | Default EFs when project-specific available | Material | Compare to monitoring plan |
| | Non-conservative assumptions | Critical | Parameter-by-parameter review |
| **5. Leakage** | Leakage belt not defined | Critical | GIS verification |
| | Market leakage ignored for commodity projects | Critical | Demand market leakage analysis |
| | Leakage = 0 without justification | Material | Demand justification |
| **6. Monitoring Plan** | Parameters missing vs methodology | Critical | Methodology parameter checklist |
| | Frequency below methodology minimum | Critical | Compare PDD to methodology |
| | No QA/QC procedures defined | Critical | Demand QA/QC section |
| | Responsible party not identified | Material | Demand org chart |
| **7. Stakeholder/Safeguards** | No FPIC for indigenous lands | Fatal | FPIC records demand |
| | Single consultation meeting | Critical | Demand multiple meetings |
| | Grievance mechanism = contact info only | Material | Test mechanism |
| | No gender-disaggregated monitoring | Material | Demand monitoring plan update |

### 11.2.2.3 Monitoring Report Red Flags — Performance Data

| Red Flag | Detection | Severity |
|----------|-----------|----------|
| **Generation/Activity Data Gaps > Methodology Allowance** | Compare timestamps; gap % | Critical |
| **Gap-Filling Method Not Documented / Non-Conservative** | Check MR gap-filling section | Critical |
| **Meter Calibration Expired / Missing** | Check calibration certs vs dates | Critical |
| **Check Meter Divergence > Accuracy Class** | Compare primary vs check meter | Material |
| **Parameter Values Outside Plausible Range** | Statistical outlier detection (3σ) | Material |
| **Calculation Workbook ≠ MR Values** | Recalculate; trace each parameter | Fatal |
| **Emission Factors Outdated (Not Latest Available)** | Cross-check EF vintage vs publication | Critical |
| **Leakage Monitoring Not Performed** | Check leakage parameters in MR | Critical |
| **Safeguards Monitoring Absent** | Check safeguards section in MR | Material |
| **Vintage Assignment Error** | Check verification period vs vintage | Critical |

### 11.2.2.4 Verification Report Red Flags — VVB Quality

| Red Flag | Detection | Severity |
|----------|-----------|----------|
| **VVB Not Accredited for Methodology/Sector** | Check accreditation scope | Fatal |
| **CARs Closed Without Evidence** | Demand closure evidence per CAR | Critical |
| **FARs from Prior Verification Not Addressed** | Check prior verification report | Critical |
| **Site Visit Duration Inadequate** | Check site visit report (days vs project size) | Material |
| **Sampling Not Documented / Not Risk-Based** | Demand sampling plan | Material |
| **Materiality Assessment Missing / Inconsistent** | Check each finding materiality calc | Critical |
| **Verification Opinion "Positive" But CARs Open** | Contradiction | Fatal |
| **Team Independence Not Declared** | Check declarations | Fatal |
| **Calculation Audit Not Performed / Summary Only** | Demand full recalculation workbook | Critical |
| **Verification Report Template Non-Compliant** | Compare to standard body template | Material |

### 11.2.2.4 Registry & Transaction Red Flags

| Red Flag | Detection | Severity |
|----------|-----------|----------|
| **Project Suspended / Under Investigation** | Registry project status | Fatal |
| **Credits Frozen / Restricted** | Credit batch state | Critical |
| **Serial Number Gaps / Duplicates** | Registry serial continuity check | Fatal |
| **Metadata Mismatch (Registry vs PDD vs MR)** | Cross-reference key fields | Critical |
| **Unusual Transfer Patterns (Wash Trading)** | Transaction network analysis | Material |
| **Retirement Without Claim Details** | Check retirement metadata | Material |
| **Bridge Incomplete (Frozen ≠ Minted)** | Bridge reconciliation | Critical |

### 11.2.2.5 Practical Exercise: Red Flag Hunt

**Scenario:** You have 30 minutes to review a project data room for a potential 50,000 tCO2e purchase. Identify red flags.

**Data Room Contents (Summary):**

**PDD (v2.3):**
- Project: 30 MW Wind, Tamil Nadu
- Methodology: ACM0002 v19.0
- Baseline: Grid EF 0.72 (CEA 2021-22) — CEA 2023-24 = 0.69
- Additionality: Investment analysis (IRR 10.5% without carbon, 13.2% with Rs 1,800/tCO2e); Benchmark 12% ("industry standard")
- Leakage: "Not applicable for wind" (no leakage section)
- Monitoring Plan: Generation from SCADA; annual meter calibration; QA/QC: "annual internal audit"
- Stakeholder: 1 meeting, 20 attendees; no FPIC (no indigenous)

**Monitoring Report Year 2 (2024):**
- Generation: 85,000 MWh (SCADA)
- Grid EF used: 0.72 (same as PDD)
- SCADA gaps: 5 days in July (monsoon) — "filled with monthly average"
- Meter calibration: Primary done Jan 2024; Check meter last calibrated Jan 2022
- Leakage: Not monitored
- Internal audit: Q1 2024 done; Q2-Q4 not done

**Verification Report Year 2 (SGS):**
- Opinion: Positive
- CARs: 2 closed (EF vintage, check meter calibration)
- CLs: 3 resolved
- FARs: 1 open (QA/QC procedure implementation)
- Site visit: 1 day (2 auditors)
- Sampling: "Judgmental selection of meters"
- Calculation audit: "Verified totals match MR" (no workbook provided)

**Registry (Verra):**
- Project status: Active
- Credits: 82,000 VCUs issued (2023 vintage)
- Labels: None (CORSIA-eligible not applied)
- Recent transfers: 3 large transfers to same counterparty in last 30 days

**Task:** List ALL red flags found, classify severity, and recommend: Buy / Conditional / Walk Away.

**Deliverable:** Red Flag Register (Table) + Recommendation
**Time:** 35 min
**Rubric:** Completeness (40%), severity classification (30%), recommendation logic (30%)

**Knowledge Check:**
1. What makes a baseline EF vintage issue "Critical" vs "Material"?
2. Why is a 1-day site visit for a 30 MW wind project a red flag?
3. What does "judgmental sampling" without documentation indicate?
3. Why are 3 large transfers to the same counterparty a potential red flag?

**Sources:**
1. ICVCM Assessment Framework — Red Flags
2. Calyx Global — Due Diligence Red Flags
3. Sylvera — Risk Framework
4. Verra/GS — Verification Report Templates
4. ICROA — Code of Best Practice (Due Diligence)

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC | Regulatory Review: Quarterly*

---

### Lesson 11.2.3: Portfolio-Level Risk Management & Ongoing DD
**Lesson Code:** C11.2.3
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** professional

**Learning Objectives:**
1. Build a portfolio-level risk management framework for carbon credits (Bloom: Create)
2. Implement ongoing due diligence: triggers, re-scoring, early warning (Bloom: Apply)
3. Design risk limits, concentration limits, and portfolio stress tests (Bloom: Create)

**Prerequisites:** C11.2.1, C11.2.2, C11.2.2

**Why This Matters:**
A single credit purchase is a transaction; a portfolio is a strategy. Managing risk at the portfolio level requires continuous monitoring, re-scoring, and proactive risk management — not just one-time due diligence. This lesson teaches you to build a living risk management system for your credit portfolio.

**Core Concept: Portfolio Risk = Continuous Function of Credit Risks + Correlations + Market Dynamics**

### 11.2.3.1 Portfolio Risk Architecture

**Portfolio Risk Dimensions:**
| Dimension | Risk Metric | Monitoring Frequency | Alert Threshold |
|-----------|-------------|---------------------|-----------------|
| **Technical Concentration** | % in single project type / methodology | Monthly | > 40% in one type |
| **Vintage Concentration** | % in single vintage | Monthly | > 40% in one vintage |
| **Registry Concentration** | % in single registry | Monthly | > 50% in one registry |
| **Standard Concentration** | % in single standard (VCS/GS/etc.) | Monthly | > 60% in one standard |
| **Vintage Age** | Weighted avg vintage age | Quarterly | > 5 years weighted avg |
| **Quality Distribution** | % < 30/50 score | Quarterly | > 10% below floor |
| **Removal %** | % removal credits | Quarterly | < 20% by 2026 |
| **CCP Coverage** | % CCP-approved credits | Quarterly | < 80% by 2026 |

**Portfolio Risk Dashboard:**
| Panel | Metrics | Visualization | Alert Threshold |
|---------|---------|---------------|-----------------|
| **Concentration** | HHI by type/vintage/registry/standard | Herfindahl Index | HHI > 0.25 |
| **Quality Distribution** | Score histogram (50-pt scale) | Histogram | < 10% < 30 pts |
| **Vintage Profile** | Volume by vintage year | Stacked bar | > 40% in one vintage |
| **Quality Drift** | Avg score trend (12-mo) | Line chart | Slope < -2 pts/yr |
| **Liquidity Risk** | Days-to-sell by vintage/type | Heatmap | > 90 days = warning |
| **Regulatory Exposure** | CCP % / CORSIA-eligible % / Art6 % | Stacked bar | CCP < 80% = warning |

### 11.2.3.1 Portfolio Risk Limits — Governance

**Portfolio Limits (Example Policy):**
| Limit | Rationale |
|-------|-----------|
| **Single Project** | ≤ 10% of portfolio |
| **Single Developer** | ≤ 15% |
| **Single Methodology** | ≤ 30% |
| **Single Registry** | ≤ 50% |
| **Single Standard** | ≤ 60% |
| **Single Vintage** | ≤ 40% |
| **Single Country** | ≤ 50% (geographic) |
| **Removal Credits** | ≥ 20% by 2026 |
| **CCP-Approved** | ≥ 80% by 2026 |
| **Removal Credits** | ≥ 20% by 2026 |
| **Vintage Age** | Weighted avg ≤ 3 years |

**Governance:**
- **Risk Committee:** Monthly review; approves limit breaches
- **Portfolio Manager:** Daily monitoring; escalation to Risk Committee
- **Investment Committee:** Quarterly rebalancing approval
- **Risk Team:** Real-time monitoring; alert generation

### 9.3.3.2 Ongoing Due Diligence — Triggers & Re-Scoring

**Re-Scoring Triggers:**
| Trigger | Action | Timeline |
|---------|--------|----------|
| **New Verification Report** | Re-score technical dimensions | Within 5 business days |
| **Methodology Update** | Re-assess baseline/additionality | Before next issuance |
| **Regulatory Change** | Re-assess regulatory score | Within 5 business days |
| **VVB Change** | Re-assess VVB quality score | Immediate |
| **New Verification Report** | Full technical re-score | Within 10 business days |
| **Market Event** | Re-assess liquidity/price score | Same day |
| **Buffer Draw (AFOLU)** | Re-assess permanence/reversal risk | Immediate |
| **Annual** | Full portfolio re-score | Annual (Q1) |

**Re-Scoring Workflow:**
```
1. TRIGGER DETECTED
    ↓
2. FETCH LATEST DATA (MR, VR, Registry, Market)
    ↓
3. RE-RUN SCORING ENGINE (Module 11.2.1)
    ↓
3. COMPARE: Old Score vs New Score
    ↓
4. IF DELTA > THRESHOLD (e.g., >5 pts):
      → ALERT → REVIEW → ADJUST PORTFOLIO
    ↓
5. LOG: Score history, trigger, delta, action taken
```

### 9.3.3.2 Early Warning System — Leading Indicators

**Leading Indicator Dashboard:**
| Indicator | Source | Frequency | Alert Threshold | Action |
|-----------|--------|-----------|-----------------|--------|
| **EF Vintage Age** | EF Library | Monthly | > 2 years old | Flag for update |
| **Vintage Age** | Portfolio | Monthly | > 5 yrs avg age | Plan vintage rotation |
| **Buffer Draw (AFOLU)** | Registry notifications | Real-time | Any draw | Immediate review |
| **VVB Findings** | Verification reports | Per verification | New CAR/CL | Re-score |
| **Regulatory Alerts** | BEE/UNFCCC/ICAO feeds | Daily | New rule/amendment | Immediate re-score |
| **Registry Alerts** | Registry webhooks | Real-time | Freeze/suspend | Immediate freeze |
| **Market Volume** | Exchange data | Weekly | Volume < 10% avg | Liquidity review |
| **Price Deviation** | Exchange/OTC | Daily | > 2σ from 30-day MA | Position review |

**Alert Escalation:**
| Alert Level | Criteria | Escalation To | Response Time |
|--------------|----------|---------------|---------------|
| **INFO** | Single metric breach | Portfolio Manager | 24 hrs |
| **WARNING** | 2+ metrics or portfolio impact > 1% | Risk Manager | 4 hrs |
| **CRITICAL** | Portfolio risk limit breach | CRO / Investment Committee | 1 hr |
| **EMERGENCY** | Systemic risk (registry freeze, regulatory ban) | CEO / Board | Immediate |

### 9.3.3.2 Portfolio Stress Testing

**Stress Scenarios (Run Quarterly):**
| Scenario | Shock | Portfolio Impact | Mitigation |
|------------|-------|------------------|------------|
| **Carbon Price Crash** | -50% spot price | Revenue impact; margin calls | Hedging; diversification |
| **CORSIA Phase 2 Restrictions** | 50% credits ineligible | Compliance shortfall | Diversify standards |
| **ICVCM CCP Failure** | Standard fails CCP | Credit devaluation | CCP pre-assessment |
| **Registry Freeze** | 30-day suspension | Settlement delays | Multi-registry strategy |
| **Buffer Depletion** | AFOLU reversal | Permanent loss | Buffer insurance |
| **Policy Reversal** | Host country bans export | Stranded assets | Geographic diversification |
| **Quality Scandal** | VVB fraud finding | Portfolio devaluation | VVB diversification |

**Stress Test Output:**
| Metric | Pre-Stress | Post-Stress | Delta | Pass/Fail |
|----------|------------|-------------|-------|-----------|
| **Portfolio Value** | $100M | $72M | -28% | Fail (< -20%) |
| **Liquidity (30-day)** | $15M | $3M | -80% | Fail |
| **Compliance Coverage** | 100% | 65% | -35% | Fail |
| **Avg Quality Score** | 42/50 | 34/50 | -8 pts | Fail |

### 9.3.3.3 Professional Judgement Points
- **Re-score proactively:** Don't wait for verification cycle; trigger on signals
- **Correlation matters:** Solar credits across regions may correlate (weather, policy)
- **Liquidity ≠ Quality:** Illiquid high-quality > liquid low-quality
- **Vintage rotation:** Actively rotate vintages; don't let portfolio age
- **Buffer management:** Monitor AFOLU buffer health quarterly

### 9.3.3.2 Practical Exercise: Portfolio Risk Design
*Scenario:* You manage a 1.5 MtCO2e/yr portfolio: 40% VCS RE (solar/wind), 25% GS Cookstoves, 20% VCS REDD+, 15% GS Mangroves. Current avg score: 38/50.
*Tasks:*
1. Calculate current portfolio concentrations (type, vintage, registry, standard)
2. Identify top 3 limit breaches
3. Design rebalancing trades to meet policy limits
4. Design monthly risk dashboard (5 panels)
*Time:* 45 min
*Deliverable:* Portfolio risk report + rebalancing plan + dashboard spec
*Rubric:* Concentration analysis (30%), rebalancing logic (40%), dashboard utility (30%)

**Knowledge Check:**
1. Why is vintage concentration risk often overlooked? (Credits age passively; no active management)
2. What is the HHI and why use it for concentration? (Herfindahl-Hirschman Index; measures diversification)
3. Why target ≥20% removals by 2026? (SBTi net-zero requires 5-10% neutralization; compliance demand)
4. How do you stress-test a carbon portfolio? (Scenario shocks: price, policy, quality, liquidity)

**Sources:**
1. ICVCM Core Carbon Principles (2023) — Portfolio implications
2. VCMI Claims Code (2023) — Credit quality thresholds
3. SBTi Corporate Net-Zero Standard (2021) — Neutralization limits
4. ICVCM Core Carbon Principles (2023) — Principles 4, 5, 6, 7
5. IETA Market Reports (2023-2024) — Liquidity, pricing
6. Ecosystem Marketplace "State of the VCM" (2024) — Portfolio trends

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC (Market structure, policy evolving) | Regulatory Review: Quarterly*