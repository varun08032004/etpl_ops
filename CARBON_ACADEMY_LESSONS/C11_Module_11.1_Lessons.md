# C11: Credit Quality & Due Diligence
## Module 11.1: Quality Dimensions (ICVCM CCP) (3 lessons x 40min = 2h)

### Lesson 11.1.1: ICVCM Core Carbon Principles Overview
**Lesson Code:** C11.1.1
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** professional

**Learning Objectives:**
1. Explain the ICVCM governance structure and the three-pillar CCP framework (Bloom: Understand)
2. Map CCP requirements to project-level quality assessment criteria (Bloom: Apply)
3. Evaluate a credit's CCP-eligibility using the assessment framework (Bloom: Evaluate)

**Prerequisites:** C08.1.1 (Methodology Architecture), C10.1.1 (Registry Types)

**Why This Matters:**
The ICVCM Core Carbon Principles (CCPs) have become the global benchmark for credit quality. Buyers, exchanges, and regulators increasingly require CCP-eligible credits. Understanding the CCPs lets you assess whether a project will meet this threshold — before you invest, develop, or purchase.

**Core Concept: CCPs as Quality Floor — Not Ceiling**

### 11.1.1.1 ICVCM — Governance & Purpose

**What Is ICVCM?**
- **Integrity Council for the Voluntary Carbon Market** — Independent governance body (launched 2021)
- **Mission:** Set and enforce global quality thresholds for voluntary carbon credits
- **Governance:** Multi-stakeholder board (buyers, sellers, civil society, indigenous peoples, standard bodies)
- **Funding:** Philanthropic + member fees (standard bodies, exchanges, registries)

**CCP Framework Structure:**
```
ICVCM CORE CARBON PRINCIPLES (10 Principles)
    │
    ├── GOVERNANCE (Principles 1-3)
    │     1. Effective Governance
    │     2. Tracking
    │     3. Transparency
    │
    ├── EMISSIONS IMPACT (Principles 4-7)
    │     4. Additionality
    │     5. Permanence
    │     6. Robust Quantification
    │     7. No Double Counting
    │
    └── SUSTAINABLE DEVELOPMENT (Principles 8-10)
          8. Sustainable Development Benefits
          9. No Net Harm
          10. Transition Support
```

**CCP Assessment Process:**
```
STANDARD BODY (Verra, GS, etc.) → Applies for CCP-eligibility
    │
    ├── ICVCM ASSESSMENT TEAM reviews:
    │     • Standard's rules & procedures
    │     • Methodology-level assessment
    │     • Project-level spot checks
    │
    ├── DECISION: CCP-Eligible / Conditional / Not Eligible
    │
    └── CCP-ELIGIBLE STANDARDS → Can label credits "CCP-Approved"
          │
          └── PROJECTS under eligible standards → CCP-eligible if methodology approved
```

### 11.1.1.2 The 10 Core Carbon Principles — Detailed

| Pillar | Principle | Key Requirement | Assessment Focus |
|--------|-----------|-----------------|------------------|
| **GOVERNANCE** | **1. Effective Governance** | Standard body: independent, transparent, accountable, stakeholder engagement | Board composition, conflict of interest, appeals, public consultation |
| | **2. Tracking** | Unique identification, registry, ownership chain from issuance to retirement | Registry integrity, serialisation, transfer records |
| | **3. Transparency** | Full project data public: PDD, monitoring, verification, validation reports | Document availability, data granularity, language accessibility |
| **EMISSIONS IMPACT** | **4. Additionality** | Would not occur without carbon finance; regulatory surplus; not common practice | Additionality test rigor, tool application, conservativeness |
| | **5. Permanence** | Risk of reversal assessed; mitigation (buffer pool, insurance); monitoring | Reversal risk classification, buffer %, monitoring duration |
| | **6. Robust Quantification** | Conservative, accurate, complete; uncertainty quantified; conservative defaults | Methodology conservativeness, uncertainty deduction, QA/QC |
| | **7. No Double Counting** | Unique issuance; corresponding adjustments; no double issuance/claiming | Registry controls, Article 6 alignment, claim labelling |
| **SUSTAINABLE DEVELOPMENT** | **8. Sustainable Development Benefits** | Net positive SDG contributions; verified; not overstated | SDG mapping, verification of co-benefits, no cherry-picking |
| | **9. No Net Harm** | Environmental/social safeguards; FPIC; grievance mechanism | ESA/ESMF, FPIC process, grievance mechanism effectiveness |
| | **10. Transition Support** | Aligned with host country NDC; supports net-zero transition | NDC alignment, technology transfer, capacity building |

### 11.1.1.3 CCP-Eligibility — Standard & Methodology Level

**Two-Level Assessment:**
```
LEVEL 1: STANDARD BODY ASSESSMENT
→ Is the standard body (Verra, GS, etc.) CCP-eligible?
→ Assessment: Governance, Tracking, Transparency (Principles 1-3)
→ Result: Standard body gets "CCP-Eligible" status

LEVEL 2: METHODOLOGY ASSESSMENT
→ Is the specific methodology (e.g., VCS AMS-I.D v18) CCP-eligible?
→ Assessment: Additionality, Permanence, Quantification, Double Counting (Principles 4-7)
→ Result: Methodology gets "CCP-Approved" tag

LEVEL 3: PROJECT LEVEL (Automatic if Levels 1+2 passed)
→ Project uses CCP-Approved methodology under CCP-Eligible standard
→ Project meets all methodology requirements
→ Project credits = CCP-Eligible (can carry CCP label)
```

**Current CCP-Eligible Standards (2024):**
| Standard | Status | Eligible Methodologies (Examples) |
|----------|--------|-----------------------------------|
| **Verra VCS** | CCP-Eligible | AMS-I.D, ACM0002, VM0007, VM0033, VM0042 (subset) |
| **Gold Standard** | CCP-Eligible | GS4GG: ACM0002, AMS-I.D, TPDDTEC (subset) |
| **ACR** | Under Assessment | — |
| **CAR** | Under Assessment | — |
| **Plan Vivo** | Under Assessment | — |

**Key Point:** Not all methodologies under a CCP-eligible standard are CCP-approved. Each methodology is assessed separately.

### 11.1.1.4 CCP Label on Credits — What It Means

**CCP Label Requirements:**
- Credit issued under CCP-Eligible standard
- Credit uses CCP-Approved methodology
- Project meets all methodology requirements
- No unresolved CARs/FARs affecting CCP criteria

**Label Display (Registry & Marketplace):**
```
Credit Metadata:
{
  "ccpEligible": true,
  "ccpApprovedMethodology": "VCS-AMS-I.D-v18",
  "ccpEligibleStandard": "Verra",
  "ccpAssessmentDate": "2024-03-15",
  "ccpPrinciplesMet": [1,2,3,4,5,6,7,8,9,10]
}
```

**Buyer Value of CCP Label:**
| Buyer Type | CCP Label Value |
|------------|-----------------|
| **Corporate (Voluntary)** | Risk mitigation; greenwashing defense; ESG reporting credibility |
| **Institutional/Financial** | Portfolio quality threshold; fiduciary compliance |
| **CORSIA/Aviation** | Supplementary quality signal (beyond ICAO eligibility) |
| **Article 6/Compliance** | Host country confidence; corresponding adjustment readiness |
| **Exchanges (CTX, AirCarbon, etc.)** | Listing requirement; price premium |

---

### Practical Exercise: CCP Eligibility Assessment

**Scenario:** Evaluate CCP-eligibility for these project credits:

**Project A:** 50 MW Solar, Rajasthan, India
- Standard: Verra VCS (CCP-Eligible)
- Methodology: VCS AMS-I.D v18 (CCP-Approved)
- Verification: SGS, 2024 vintage, all CARs closed
- Labels: CORSIA-eligible, SDG 7/13

**Project B:** Improved Cookstoves, Odisha, India
- Standard: Gold Standard (CCP-Eligible)
- Methodology: GS TPDDTEC v3.1 (CCP-Approved)
- Verification: DNV, 2023 vintage, 1 FAR open (QA/QC procedure)
- Labels: SDG 3/5/7/13

**Project C:** Avoided Deforestation, Brazilian Amazon
- Standard: Verra VCS (CCP-Eligible)
- Methodology: VM0033 v1.2 (NOT CCP-Approved — under assessment)
- Verification: Aster Global, 2024 vintage, all findings closed
- Labels: CCB Gold, SDG 13/15

**Project D:** Landfill Gas Capture, Mexico
- Standard: ACR (NOT CCP-Eligible — under assessment)
- Methodology: ACR Landfill Gas v2.0 (Not assessed)
- Verification: SCS Global, 2024 vintage, all findings closed
- Labels: None

**Task:** For each project, determine:
1. CCP-Eligible? (Yes/No/Conditional)
2. Which CCP principles are at risk?
3. What additional steps needed for CCP eligibility?
4. Buyer recommendation: Purchase / Conditional / Avoid

**Deliverable:** CCP Assessment Table (4 projects × 10 principles)
**Time:** 35 min
**Rubric:** Principle mapping accuracy (40%), risk identification (30%), recommendation logic (30%)

**Knowledge Check:**
1. What are the three pillars of the CCP framework?
2. Can a project be CCP-eligible if its methodology is not CCP-approved?
3. What does "Conditional" CCP-eligibility mean for a standard body?
4. How does CCP Principle 7 (No Double Counting) relate to Article 6?

**Sources:**
1. ICVCM Core Carbon Principles (2023)
2. ICVCM Assessment Framework (2024)
3. ICVCM Standard Assessment Procedure
4. Verra — CCP-Eligibility Status
5. Gold Standard — CCP-Eligibility Status
6. Calyx Global / Sylvera — CCP Alignment Ratings

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC (CCP assessments ongoing) | Regulatory Review: Quarterly*

---

### Lesson 11.1.2: Additionality, Permanence, Quantification
**Lesson Code:** C11.1.2
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** professional

**Learning Objectives:**
1. Apply ICVCM additionality criteria to assess project-level additionality risk (Bloom: Apply)
2. Evaluate permanence risk classification and buffer pool adequacy (Bloom: Evaluate)
3. Assess quantification robustness: conservativeness, uncertainty, QA/QC (Bloom: Analyze)

**Prerequisites:** C07.1.1 (Additionality Tests), C07.3.1 (Baseline Integrity), C11.1.1

**Why This Matters:**
Principles 4, 5, and 6 (Additionality, Permanence, Quantification) are the technical heart of credit quality. A credit that fails any of these is fundamentally flawed — no amount of co-benefits or governance can fix it. This lesson gives you the technical tools to stress-test these three pillars at the project level.

**Core Concept: Technical Integrity as Non-Negotiable — The Three Pillars**

### 11.1.2.1 Additionality — ICVCM Principle 4 Deep Dive

**ICVCM Additionality Requirements:**
| Requirement | ICVCM Expectation | Assessment Method |
|-------------|-------------------|-------------------|
| **Regulatory Surplus** | Not mandated by law/regulation | Legal review; host country NDC analysis |
| **Financial/Investment Additionality** | Carbon revenue material to investment decision | Investment analysis (IRR/NPV with/without carbon) |
| **Barrier Additionality** | Barriers prevent implementation without carbon finance | Barrier identification; evidence carbon finance overcomes |
| **Common Practice** | Not common practice in region/sector | Statistical analysis; penetration rates; technology maturity |
| **Positive List / Performance Benchmark** | Methodology-approved additionality criteria | Methodology compliance; benchmark comparison |

**Additionality Assessment Framework (ICVCM-Aligned):**
```
STEP 1: REGULATORY SURPLUS (Gate)
├── Is project required by law/regulation? → YES = NON-ADDITIONAL
├── Does host country NDC include this action unconditionally? → YES = RISK
└── PASS → Continue

STEP 2: INVESTMENT ANALYSIS (Primary)
├── Identify appropriate benchmark (WACC, hurdle rate, sector benchmark)
├── Calculate project IRR/NPV WITHOUT carbon revenue
├── Calculate project IRR/NPV WITH carbon revenue (conservative price)
├── IF without-carbon < benchmark AND with-carbon ≥ benchmark → ADDITIONAL
├── IF without-carbon ≥ benchmark → NON-ADDITIONAL (but check barriers)
└── SENSITIVITY: Test key variables (capex, opex, generation, carbon price)

STEP 3: BARRIER ANALYSIS (Supporting)
├── Identify barriers: Investment, Technological, Institutional, Social
├── Evidence: Financing denials, technical failure rates, regulatory hurdles
├── Demonstrate: Carbon finance specifically addresses barrier
└── IF barriers credible AND carbon finance overcomes → ADDITIONAL

STEP 4: COMMON PRACTICE (Context)
├── Define region/sector/technology peer group
├── Calculate penetration rate (% of similar facilities with same tech)
├── IF penetration < methodology threshold (typically 20-30%) → ADDITIONAL
├── IF penetration ≥ threshold → NON-ADDITIONAL (unless other tests pass)
└── Consider: Time lag, policy drivers, early mover status

STEP 5: CONSERVATIVENESS CHECK
├── Carbon price assumption: Conservative (not spot peak)
├── Benchmark: Justified, not arbitrary
├── Sensitivity: Downside scenarios still additional?
└── Documentation: Complete, traceable, verifiable
```

**Common Additionality Red Flags (ICVCM Focus):**
| Red Flag | Why It Matters | Detection |
|----------|----------------|-----------|
| **Carbon price > $20/tCO2e in base case** | Non-conservative; inflates additionality | Check financial model assumptions |
| **Benchmark not justified** | Arbitrary hurdle rate | Demand source: WACC study, sector report |
| **No sensitivity analysis** | Fragile conclusion | Require tornado/Monte Carlo |
| **Barrier evidence = generic statements** | Not project-specific | Demand: denial letters, technical studies |
| **Common practice data outdated** | Market changed | Check data vintage (<2 years) |
| **Regulatory surplus ignored** | Legal requirement missed | Check host country laws, NDC |

### 11.1.2.2 Permanence — ICVCM Principle 5 Deep Dive

**Permanence Risk Classification (ICVCM):**
| Risk Class | Project Types | Reversal Risk | Buffer Requirement |
|------------|---------------|---------------|-------------------|
| **Low** | Renewable energy, energy efficiency, industrial gas destruction | Negligible (technological) | 0-5% |
| **Medium** | Agricultural soil carbon, improved forest management | Moderate (management change) | 10-20% |
| **High** | Avoided deforestation (REDD+), afforestation/reforestation | High (fire, disease, logging, land use) | 20-30%+ |

**Permanence Mechanisms:**
| Mechanism | How It Works | ICVCM Requirements |
|-----------|--------------|-------------------|
| **Buffer Pool** | % of credits withheld; covers reversals across portfolio | Adequate sizing; actuarial basis; transparent drawdown |
| **Insurance** | Commercial reversal insurance | Rated insurer; full coverage; claims process |
| **Ton-Year Accounting** | Credits discounted by storage duration | Methodology-approved; conservative discount rate |
| **Monitoring Commitment** | Long-term monitoring beyond crediting period | Minimum 20-40 years post-crediting; funded |

**Buffer Pool Adequacy Assessment:**
```
BUFFER SIZING INPUTS:
1. Reversal probability (per risk class, region, project type)
2. Reversal magnitude (partial vs total)
3. Correlation across portfolio (geographic, climate)
4. Time horizon (crediting period + monitoring period)
5. Confidence level (typically 95%)

BUFFER CALCULATION (Simplified):
Required Buffer = Σ (Project_i Credits × Reversal_Probability_i × Reversal_Magnitude_i)
                 × Correlation_Adjustment
                 × Confidence_Multiplier

ICVCM CHECK:
- Is buffer % disclosed and methodology-compliant?
- Is buffer pool segregated and ring-fenced?
- Are drawdown rules transparent and automatic?
- Is buffer replenished if drawn?
```

**Permanence Red Flags:**
| Red Flag | Detection |
|----------|-----------|
| **No buffer pool for forestry/soil** | Check methodology requirement |
| **Buffer < 10% for REDD+** | Compare to VM0033/VM0007 requirements |
| **No long-term monitoring plan** | Check PDD Section 7 |
| **Reversal risk not quantified** | Demand actuarial analysis |
| **Buffer credits used for other purposes** | Registry audit |

### 11.1.2.3 Robust Quantification — ICVCM Principle 6 Deep Dive

**Quantification Quality Criteria:**
| Criterion | ICVCM Expectation | Verification Method |
|-----------|-------------------|---------------------|
| **Conservativeness** | All assumptions, defaults, methods err on side of understating ERs | Parameter-by-parameter review |
| **Accuracy** | Measurement methods appropriate; calibrated equipment; trained staff | Meter calibration audit; sampling review |
| **Completeness** | All sources/sinks included; no omitted pools/gases | Methodology completeness checklist |
| **Uncertainty Quantified** | Uncertainty calculated per parameter; propagated to ER level | Uncertainty analysis (ISO 14064-3) |
| **Conservative Uncertainty Handling** | High uncertainty → conservative deduction (not just reporting) | Uncertainty deduction applied |
| **QA/QC Documented** | Procedures exist, implemented, audited | Internal audit records; VVB review |

**Quantification Red Flags:**
| Red Flag | Detection Method |
|----------|------------------|
| **Default EFs used when project-specific available** | Check PDD vs monitoring plan |
| **No uncertainty analysis** | Request uncertainty workbook |
| **Uncertainty reported but not deducted** | Check final ER calculation |
| **Measurement frequency below methodology** | Compare MR to PDD monitoring plan |
| **Calibration gaps > methodology allowance** | Audit calibration certificates |
| **Gap-filling non-conservative** | Audit gap-filled periods |
| **Double counting within project** | Boundary audit (overlap check) |

**Conservativeness Test (Practical):**
```
FOR EACH PARAMETER:
1. What value is used? (Project-specific / Default / Conservative default)
2. What is the alternative? (Range of plausible values)
3. Does used value UNDERESTIMATE ERs? (i.e., lower baseline, higher project emissions)
4. If NOT conservative → QUANTIFICATION FAIL

EXAMPLES:
- Grid EF: Use LATEST available (not older, higher) → Conservative
- Biomass NCV: Use LOWER bound of lab range → Conservative  
- Leakage: Use DEFAULT (higher) vs project-specific (lower) → Conservative
- Additionality benchmark: Use HIGHER hurdle rate → Conservative
```

---

### Practical Exercise: Three-Pillar Stress Test

**Scenario:** Stress-test a 100 MW solar project (VCS AMS-I.D) and a REDD+ project (VM0033).

**Project A: 100 MW Solar, Gujarat**
- Additionality: Investment analysis (IRR 11% without carbon, 14% with Rs 1,500/tCO2e)
- Benchmark: 12% (industry average, source: "market practice")
- Carbon price assumption: Rs 1,500/tCO2e (current spot ~Rs 800)
- Grid EF: CEA 2022-23 (0.71) — CEA 2023-24 (0.69) available
- No uncertainty analysis in MR

**Project B: REDD+ Avoided Deforestation, Brazil**
- Additionality: Barrier analysis (illegal logging pressure) + common practice (deforestation rate 2.5%/yr)
- Permanence: Buffer pool 15% (methodology minimum 20%)
- Monitoring: Annual satellite; no ground plots
- Quantification: Proxy area reference region; default carbon stocks
- Leakage: 10 km belt; market leakage not assessed

**Task:** For each project, score each pillar (Pass / Conditional / Fail) with evidence:
1. **Additionality:** Regulatory surplus, investment test, barriers, common practice
2. **Permanence:** Risk class, buffer adequacy, monitoring, insurance
3. **Quantification:** Conservativeness, accuracy, completeness, uncertainty, QA/QC

**Deliverable:** Three-Pillar Scorecard (2 projects × 3 pillars × criteria)
**Time:** 35 min
**Rubric:** Criteria application (40%), evidence-based judgment (30%), ICVCM alignment (30%)

**Knowledge Check:**
1. Why is regulatory surplus a "gate" (fail = stop) while investment analysis is a "test"?
2. What buffer % would ICVCM expect for a high-risk REDD+ project?
3. How does uncertainty deduction work in practice?
4. What makes a carbon price assumption "conservative" for additionality?

**Sources:**
1. ICVCM Core Carbon Principles 4, 5, 6 (2023)
2. ICVCM Assessment Framework — Additionality, Permanence, Quantification
3. VCS/GS Methodologies — Additionality Tools, Buffer Requirements
3. ISO 14064-3 — Uncertainty Quantification
4. Calyx Global / Sylvera — Methodology Ratings

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC | Regulatory Review: Quarterly*

---
**Lesson Code:** C11.1.3
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** professional

**Learning Objectives:**
1. Assess double counting risk across registry, national, and claim levels (Bloom: Analyze)
2. Evaluate SDG contribution claims for credibility and verification (Bloom: Evaluate)
3. Verify safeguards implementation: FPIC, grievance mechanism, no net harm (Bloom: Apply)

**Prerequisites:** C10.1.3 (Cross-Registry Interoperability), C06.3.1 (Stakeholder & Safeguards), C11.1.1

**Why This Matters:**
Principles 7, 8, 9, and 10 address the "beyond carbon" integrity of credits. Double counting destroys market trust. Unverified SDG claims enable greenwashing. Missing safeguards harm communities and create liability. These principles are increasingly regulated (CSRD, BRSR, Article 6) — getting them right is compliance-critical.

**Core Concept: Integrity Beyond Carbon — Claims, Communities, and Transitions**

### 11.1.3.1 No Double Counting — ICVCM Principle 7

**Double Counting Types & Detection:**

| Type | Description | Detection | Prevention |
|------|-------------|-----------|------------|
| **Double Issuance** | Two registries issue credits for same ERs | Cross-registry project ID matching; CAD Trust | Unique project identifiers; VVB cross-check |
| **Double Claim** | Same credits retired for two claims | Retirement metadata audit; beneficiary verification | Unique retirement per claim; registry enforcement |
| **Double Counting (National)** | Host country counts ERs in NDC AND buyer claims | Corresponding adjustment verification; BTR review | Article 6.2 CA; Article 6.4 mechanism |
| **Double Use (Voluntary + Compliance)** | Same credits used for CORSIA AND corporate claim | Registry label audit; retirement purpose check | Mutually exclusive labels; retirement rules |
| **Double Counting (Internal)** | Same ERs in baseline AND project emissions | Boundary audit; project boundary vs leakage belt | Clear boundary definitions; GIS verification |

**Double Counting Risk Matrix:**
```
                    | VOLUNTARY CLAIM | CORSIA | ARTICLE 6.2 | NDC (HOST) |
--------------------------------------------------------------------
VOLUNTARY CLAIM     |      SELF       |  CA    |    CA       |   CA       |
CORSIA              |      CA         |  SELF  |    CA       |   CA       |
ARTICLE 6.2 (ITMO)  |      CA         |  CA    |    SELF     |   CA       |
NDC (HOST)          |      CA         |  CA    |    CA       |   SELF     |

CA = Corresponding Adjustment Required
SELF = Same claim type (prevented by registry rules)
```

**ICVCM Principle 7 Requirements:**
1. **Unique Issuance:** One credit per tonne ER; unique serialisation
2. **Registry Controls:** Prevent double issuance, double retirement
3. **Corresponding Adjustments:** Mandatory for international transfers (Article 6.2)
4. **Claim Labelling:** Retirement metadata specifies claim type (exclusive)
5. **Transparency:** Public retirement records; beneficiary disclosure

**Assessment Checklist:**
```
☐ Project registered in ONLY ONE primary registry
☐ No bridging without freeze-burn-mint integrity
☐ International transfers have CA (Article 6.2)
☐ CORSIA retirements labelled exclusively
☐ Voluntary retirements don't overlap compliance
☐ Host country NDC accounting aligns (BTR check)
```

### 11.1.3.2 Sustainable Development Benefits — ICVCM Principle 8

**SDG Claim Requirements (ICVCM):**
| Requirement | What It Means | Verification |
|-------------|---------------|--------------|
| **Net Positive** | SDG benefits > any negative impacts | Net benefit assessment |
| **Verified** | Third-party verified (not self-declared) | VVB or specialized SDG verifier |
| **Not Overstated** | Claims proportional to project scale/impact | Materiality threshold |
| **Additional** | Benefits wouldn't occur without project | Counterfactual analysis |
| **Locally Relevant** | Benefits align with host community priorities | Stakeholder validation |

**SDG Verification Frameworks:**
| Framework | Scope | Verification | Credibility |
|-----------|-------|--------------|-------------|
| **Gold Standard SDG Impact** | All 17 SDGs | GS VVB + SDG expert | High (integrated) |
| **Verra SD VISta** | Selected SDGs | Separate SD VISta audit | High (specialized) |
| **UN SDG Impact Standards** | Enterprise/project | Self-assessment + assurance | Medium |
| **Project-Level Claims** | Specific SDGs (e.g., SDG 7, 13) | VVB as part of verification | Variable |

**SDG Claim Red Flags:**
| Red Flag | Why Problematic | Detection |
|----------|----------------|-----------|
| **All 17 SDGs claimed** | Implausible; cherry-picking | Check SDG mapping matrix |
| **No third-party verification** | Self-declared | Demand SDG verification report |
| **Benefits = Project activities** | Not outcomes (e.g., "we built school" vs "education improved") | Demand outcome indicators |
| **No baseline for SDG** | Can't measure additionality | Demand counterfactual |
| **Community not consulted on SDG priorities** | Top-down, not participatory | Check stakeholder minutes |

### 11.1.3.3 No Net Harm & Safeguards — ICVCM Principle 9

**Safeguards Framework (ICVCM-Aligned):**
| Safeguard | Requirement | Verification Evidence |
|-----------|-------------|----------------------|
| **Environmental & Social Assessment (ESA/ESMF)** | Pre-project impact assessment | ESA report; mitigation plan |
| **Free, Prior, Informed Consent (FPIC)** | Affected indigenous peoples/communities | FPIC records; signed agreements; meeting minutes |
| **Grievance Mechanism** | Accessible, transparent, effective | Grievance log; resolution records; awareness proof |
| **Gender Equity** | Women's participation & benefit sharing | Gender action plan; monitoring data |
| **Labour Rights** | ILO core conventions compliance | Labour audit; worker interviews |
| **Biodiversity/ECosystem** | No net loss; enhancement where possible | Biodiversity assessment; monitoring |

**FPIC Quality Assessment:**
```
FPIC CHECKLIST (ICVCM Expectation):
☐ Conducted BEFORE project design finalized
☐ All affected communities identified (not just landowners)
☐ Information provided in local language, accessible format
☐ Sufficient time for deliberation (not rushed)
☐ Consent documented (signed agreements, recorded meetings)
☐ Consent is ONGOING (not one-time; withdrawal possible)
☐ Benefit-sharing agreement negotiated in good faith
☐ Grievance mechanism accessible to all community members
```

**Grievance Mechanism Effectiveness Test:**
| Indicator | Minimum Standard |
|-----------|------------------|
| **Accessibility** | Multiple channels (phone, in-person, digital, local language) |
| **Transparency** | Process published; timelines defined; status trackable |
| **Independence** | Not controlled by project proponent alone |
| **Remedy** | Actual remediation, not just acknowledgment |
| **No Retaliation** | Explicit protection for complainants |
| **Monitoring** | Regular reporting to stakeholders |

**Safeguards Red Flags:**
| Red Flag | Detection |
|----------|-----------|
| **No ESA for high-risk project (forestry, hydro, large ag)** | Check project type vs safeguards policy |
| **FPIC = "community meeting held"** | Demand consent records, not just attendance |
| **Grievance mechanism = "email address on website"** | Test it; check log; interview community |
| **No gender-disaggregated data** | Demand monitoring data |
| **Benefit sharing = "jobs created" (no quantification)** | Demand benefit-sharing agreement |

### 11.1.3.4 Transition Support — ICVCM Principle 10

**Transition Support Requirements:**
| Dimension | Expectation | Evidence |
|-----------|-------------|----------|
| **NDC Alignment** | Project supports host country NDC targets | NDC mapping; government endorsement |
| **Technology Transfer** | Builds local capacity, not just imports | Training programs; local employment; tech localization |
| **Capacity Building** | Skills development beyond project lifetime | Training records; certification programs |
| **Just Transition** | Addresses workforce/community transition | Transition plan; social protection |
| **Long-Term Viability** | Project sustainable beyond crediting period | O&M plan; financial sustainability |

---

### Practical Exercise: SDG & Safeguards Audit

**Scenario:** Audit SDG and safeguards claims for two projects:

**Project A: 50 MW Solar, Rajasthan (Verra + SD VISta)**
- **SDG Claims:** SDG 7 (Affordable Clean Energy), SDG 8 (Decent Work), SDG 13 (Climate Action)
- **Evidence:** 
  - SDG 7: 175 GWh/yr generation (verified)
  - SDG 8: "100 jobs created during construction" (contractor invoice)
  - SDG 13: ERs = 124,000 tCO2e/yr (verified)
- **Safeguards:** 
  - Land: 250 acres private purchase; 10% government (transfer pending)
  - Community: 2 consultation meetings (45 attendees); no FPIC (no indigenous)
  - Grievance: Email + phone on project signboard; 0 grievances logged

**Project B: Community Agroforestry, Odisha (Gold Standard)**
- **SDG Claims:** SDG 1 (No Poverty), SDG 2 (Zero Hunger), SDG 5 (Gender Equality), SDG 13, SDG 15
- **Evidence:**
  - SDG 1: "Income increased 30%" (household survey, n=50)
  - SDG 2: "Food security improved" (same survey)
  - SDG 5: "Women lead 40% of farmer groups" (group records)
  - SDG 13/15: Verified ERs + biodiversity monitoring
- **Safeguards:**
  - FPIC: 6 Gram Sabha meetings; signed resolutions; benefit-sharing agreement
  - Grievance: Village committee + NGO partner; 3 grievances (2 resolved, 1 pending)
  - Gender: Women's savings groups; land titles in women's names

**Task:** For each project, assess:
1. **SDG Claims:** Verified? Additional? Proportional? Not overstated? (Score each SDG)
2. **Safeguards:** FPIC quality? Grievance effectiveness? Gender equity? No net harm?
3. **ICVCM Principles 8 & 9:** Pass / Conditional / Fail with rationale

**Deliverable:** SDG-Safeguards Audit Scorecard (2 projects)
**Time:** 35 min
**Rubric:** SDG verification rigor (30%), safeguards depth (30%), ICVCM alignment (40%)

**Knowledge Check:**
1. What makes an SDG claim "verified" vs "self-declared"?
2. Why is FPIC required even for private land purchase?
3. How does a grievance mechanism demonstrate "effectiveness"?
4. What is the link between Principle 10 (Transition) and host country NDC?

**Sources:**
1. ICVCM Core Carbon Principles 7, 8, 9, 10 (2023)
2. ICVCM Assessment Framework — SDG & Safeguards
3. Gold Standard — SDG Impact & Safeguards
4. Verra — SD VISta & Safeguards
5. UNFCCC — NDC Registry & BTR Guidance
6. ILO — Indigenous Peoples Convention (C169)
7. UNDP — Social & Environmental Standards

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC | Regulatory Review: Quarterly*