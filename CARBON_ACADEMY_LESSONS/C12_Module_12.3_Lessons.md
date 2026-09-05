# C12: Carbon Project Economics
## Module 12.3: Breakeven & Investment Thresholds (3 lessons × 40min = 2h)

### Lesson 12.3.1: Carbon Price Breakeven & Payback
**Lesson Code:** C12.3.1
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** professional

**Learning Objectives:**
1. Calculate carbon price breakeven for NPV=0, IRR=Hurdle, DSCR=Minimum (Bloom: Apply)
2. Distinguish between simple payback, discounted payback, and carbon payback (Bloom: Understand)
3. Use breakeven analysis to set ERPA price floors and negotiation targets (Bloom: Create)

**Prerequisites:** C12.1.3, C12.2.1

**Why This Matters:**
Breakeven analysis answers the fundamental question: "At what carbon price does this project work?" It translates complex financial models into a single, negotiable number. Carbon price breakeven is the anchor for ERPA negotiations, the test for policy resilience, and the metric for portfolio prioritization.

**Core Concept: Breakeven as Negotiation Anchor — One Number, Multiple Dimensions**

### 12.3.1.1 Breakeven Types — Definitions & Uses

| Breakeven Type | Definition | Formula | Use Case |
|----------------|------------|---------|----------|
| **NPV Breakeven** | Carbon price where Project NPV = 0 | Solve: NPV(Carbon Price) = 0 | Go/No-Go; minimum viable price |
| **IRR Breakeven** | Carbon price where Equity IRR = Hurdle Rate | Solve: Equity_IRR(Carbon Price) = Hurdle | Equity investment decision |
| **DSCR Breakeven** | Carbon price where Min DSCR = Covenant (e.g., 1.2x) | Solve: Min_DSCR(Carbon Price) = 1.2x | Debt sizing; covenant compliance |
| **Simple Payback** | Years to recover Capex (undiscounted) | Capex / Annual Net Cash Flow | Liquidity; rule of thumb |
| **Discounted Payback** | Years to recover Capex (discounted @ WACC) | Cumulative DCF = 0 | Time value aware |
| **Carbon Payback** | Years for cumulative carbon revenue = Capex | Capex / Annual Carbon Revenue | Carbon-specific liquidity |

### 12.3.1.2 Carbon Price Breakeven — Calculation Methods

**Method 1: Goal Seek / Solver (Excel)**
```
SETUP:
- Cell B1: Carbon Price (input, e.g., $15)
- Cell B10: Project NPV (formula dependent on B1)
- Cell B11: Equity IRR (formula dependent on B1)
- Cell B12: Min DSCR (formula dependent on B1)

GOAL SEEK:
- NPV Breakeven: Set B10 = 0 by changing B1 → Result: $X/t
- IRR Breakeven: Set B11 = Hurdle (e.g., 16%) by changing B1 → Result: $Y/t
- DSCR Breakeven: Set B12 = 1.20 by changing B1 → Result: $Z/t
```

**Method 2: Analytical Approximation (Quick Estimate)**
```
NPV = -Capex + PV(PPA Revenue) + PV(Carbon Revenue) - PV(Opex) - PV(Debt Service) - PV(Tax)

Carbon Revenue = ERs × Carbon Price × (1 - Buffer) × Contract % × (1 - Carbon Costs%)

NPV Breakeven Carbon Price ≈ [Capex - PV(PPA) + PV(Opex) + PV(Debt Service) + PV(Tax)] / PV(ERs × (1-Buffer) × Contract%)

WHERE PV(ERs) = Σ [ERs_t / (1+WACC)^t] for t=1 to Project Life
```

**Breakeven Sensitivity (Multi-Dimensional):**
| Breakeven Type | Base Case | If Generation -10% | If Capex +10% | If Opex Esc +2% |
|----------------|-----------|-------------------|---------------|-----------------|
| **NPV=0** | $11.2/t | $14.5/t | $13.8/t | $12.1/t |
| **IRR=16%** | $13.5/t | $17.2/t | $16.0/t | $14.3/t |
| **DSCR=1.2x** | $10.8/t | $13.8/t | $12.5/t | $11.5/t |

**Key Insight:** IRR breakeven > NPV breakeven > DSCR breakeven (typically). The highest breakeven governs the equity decision.

### 12.3.1.3 Payback Analysis — Beyond Simple Metrics

| Payback Type | Calculation | Interpretation | Limitation |
|--------------|-------------|----------------|------------|
| **Simple** | Capex / Avg Annual Net Cash Flow | "Years to get money back" | Ignores time value, tail cash flows |
| **Discounted** | Year when Cumulative DCF ≥ 0 | "Years to recover PV of investment" | Better; still ignores post-payback |
| **Carbon Payback** | Capex / Annual Carbon Revenue | "Years for carbon to cover capex" | Carbon-specific; ignores energy revenue |
| **Project Payback** | Includes ALL revenue (PPA + Carbon + REC) | Holistic | Standard project finance metric |

**Payback in Carbon Context:**
```
CARBON PAYBACK EXAMPLE:
- Capex: INR 250 Cr
- Annual Carbon Revenue (Base): INR 15 Cr
- Carbon Payback: 250 / 15 = 16.7 years

BUT: If ERPA only 5 years → Carbon Payback = 5 years (contracted)
     Then project relies on PPA for remaining 20 years
     
INSIGHT: Carbon payback > ERPA tenor = revenue cliff risk
```

### 12.3.1.4 Breakeven in ERPA Negotiation

**ERPA Price Floor Setting:**
```
NEGOTIATION FRAMEWORK:
1. Calculate Project NPV Breakeven = $11.2/t
2. Add Risk Buffer = $2-3/t (for generation risk, verification risk)
3. Add Transaction Costs = $0.5-1/t (registry, verification, legal)
4. ERPA Floor = $11.2 + $2.5 + $0.8 = $14.5/t → Round to $15/t

BUT: Must also satisfy:
- Equity IRR ≥ Hurdle at ERPA price → May require higher floor
- DSCR ≥ 1.2x at ERPA price → May require higher floor
- Buyer's willingness to pay (market benchmark)

RESULT: ERPA Target = max(NPV Floor, IRR Floor, DSCR Floor, Market)
```

**Breakeven Matrix for Negotiation:**
```
ERPA STRUCTURE OPTIONS:

| Structure          | Price ($/t) | Volume (% ERs) | Tenor | NPV at $15 | IRR at $15 | Min DSCR |
|--------------------|-------------|----------------|-------|------------|------------|----------|
| Fixed/Fixed        | 15.00       | 60%            | 5 yr  | 58 Cr      | 16.2%      | 1.32x    |
| Fixed/Fixed        | 14.00       | 80%            | 7 yr  | 52 Cr      | 15.5%      | 1.28x    |
| Indexed (CPI+2%)   | 13.50       | 50%            | 10 yr | 61 Cr      | 16.8%      | 1.35x    |
| Tolling (80/20)    | Net 14.00   | 100%           | 3 yr  | 55 Cr      | 15.9%      | 1.30x    |

DECISION: Indexed 10-yr at $13.50/base optimizes NPV & IRR while managing volume risk
```

---

### Practical Exercise: Breakeven Calculation Workshop

**Scenario:** 50 MW Solar Rajasthan (from prior lessons). Calculate breakevens.

**Model Outputs (Base Case, Carbon $15/t):**
- Project NPV: INR 58 Cr
- Equity IRR: 16.2%
- Min DSCR: 1.32x
- Capex: INR 250 Cr
- Annual PPA Revenue: INR 48 Cr
- Annual Carbon Revenue: INR 15 Cr (120k tCO2e × $15 × 83)
- Annual Opex: INR 3.0 Cr (escalating 5%)
- Debt Service (Annual Avg): INR 22 Cr
- Project Life: 25 years
- WACC: 10.5%
- Equity Hurdle: 16%
- Debt Service (Annual Avg): INR 22 Cr
- Project Life: 25 years
- WACC: 10.5%
- Equity Hurdle: 16%
- Debt Service (Annual Avg): INR 22 Cr
- Project Life: 25 years
- WACC: 10.5%
- Equity Hurdle: 16%

**Task:**
1. Calculate NPV Breakeven Carbon Price (analytical approximation)
2. Calculate IRR Breakeven (conceptual: higher/lower than NPV?)
3. Calculate DSCR Breakeven (conceptual: higher/lower than NPV?)
4. Build Breakeven Sensitivity Table (±10% Generation, ±10% Capex)
5. Set ERPA Floor Price with 15% risk buffer
5. Recommend ERPA structure (Fixed/Indexed, Volume%, Tenor)

**Deliverable:** Breakeven Analysis Table + ERPA Recommendation
**Time:** 35 min
**Rubric:** Calculation accuracy (40%), conceptual understanding (30%), negotiation application (30%)

**Knowledge Check:**
1. Why is IRR breakeven typically higher than NPV breakeven?
2. What does "Carbon Payback > ERPA Tenor" imply for revenue risk?
3. Why add a "risk buffer" to the breakeven for ERPA floor?
4. How does an indexed ERPA (CPI+2%) affect breakeven analysis?

**Sources:**
1. Project Finance — Breakeven Analysis
2. ICVCM — Carbon Price Floor Guidance
3. FAST Standard — Breakeven Modeling
4. MNRE/SECI — ERPA Term Sheet Guidance
5. IPFA — Carbon Revenue in Project Finance

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC | Regulatory Review: Quarterly*

---

### Lesson 12.3.2: IRR/NPV Hurdles & Investment Committee
**Lesson Code:** C12.3.2
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** professional

**Learning Objectives:**
1. Set and justify project-level and equity-level return hurdles by project type and risk (Bloom: Evaluate)
2. Structure an Investment Committee (IC) memo with clear recommendation and conditions (Bloom: Create)
3. Navigate IC dynamics: common challenges, red flags, and follow-on commitments (Bloom: Apply)

**Prerequisites:** C12.3.1

**Why This Matters:**
A model produces numbers; the Investment Committee makes decisions. The gap between "NPV = 58 Cr" and "APPROVED" is bridged by clear hurdles, transparent assumptions, and a memo that anticipates IC questions. This lesson teaches you to translate financial output into investment decisions.

**Core Concept: Hurdles as Decision Gates — Not Aspirations**

### 12.3.2.1 Return Hurdles — Setting the Bar

**Project-Level Hurdles (FCFF / Unlevered):**
| Project Type | Risk Profile | Project IRR Hurdle (Post-Tax) | Rationale |
|--------------|--------------|-------------------------------|-----------|
| **Solar/Wind (Contracted PPA)** | Low | 10-12% | Stable cash flows; infrastructure-like |
| **Solar/Wind (Merchant)** | Medium-High | 14-18% | Price/volume risk; correlation with carbon |
| **Solar/Wind (Hybrid)** | Medium | 12-14% | Partial contracted; partial merchant |
| **Cookstoves/Household** | High | 18-22% | Usage risk, distribution, verification |
| **Forestry/REDD+** | High | 18-22% | Permanence, leakage, policy, community |
| **Industrial Gas/Waste** | Medium | 14-18% | Plant risk, regulatory surplus |
| **Blue Carbon** | Very High | 20-25% | Nascent; measurement; hydrology risk |

**Equity-Level Hurdles (Levered):**
| Capital Structure | Equity IRR Hurdle (Post-Tax) | Spread over Project IRR |
|-------------------|------------------------------|-------------------------|
| **Low Leverage (50-60% Debt)** | Project IRR + 2-3% | Low financial risk |
| **Standard (70-75% Debt)** | Project IRR + 4-6% | Standard project finance |
| **High Leverage (80%+ Debt)** | Project IRR + 6-8% | High financial risk; covenant pressure |
| **Mezz/Sub Debt** | Mezz IRR 14-18% | Between senior debt and equity |

**Hurdle Adjustment Factors:**
| Factor | Adjustment | Example |
|--------|------------|---------|
| **First-of-Kind Technology** | +2-3% | Floating solar, agrivoltaics |
| **New Geography/Market** | +1-2% | First project in new state/country |
| **Single Offtaker (PPA)** | +1-2% | Concentration risk |
| **Carbon Revenue >30% of Total** | +1-2% | Carbon price risk |
| **Policy/Regulatory Uncertainty** | +2-4% | Pending CCTS rules, export ban risk |
| **Strong Sponsor / EPC Wrap** | -1-2% | Credit enhancement |
| **CCP-Eligible + Contracted Carbon** | -1-2% | Revenue quality premium |

**India-Specific Hurdle Benchmarks (2024):**
| Investor Type | Typical Equity IRR Target | Notes |
|---------------|---------------------------|-------|
| **Renewable IPPs (ReNew, Greenko, etc.)** | 14-16% | Platform cost of capital |
| **PE/Infrastructure Funds** | 16-18% | Fund hurdle + carry |
| **DFIs (IFC, ADB, etc.)** | 12-14% | Concessional; additionality |
| **Corporate Buyers (Captive)** | 10-12% | WACC-based; strategic |
| **Family Offices / HNIs** | 18-22% | Illiquidity premium |

### 12.3.2.2 IC Memo — Structure for Decision

```
CONFIDENTIAL — INVESTMENT COMMITTEE MEMO
Project: [Name] | Date: [Date] | Version: [v1.0]
Prepared by: [Deal Team] | Classification: [Committee Only]

========================================
1. EXECUTIVE SUMMARY (1 page)
======================================
• Project: [Type, Location, Capacity, Registry, Vintage]
• Investment: [Equity INR Cr / $M] | Stake: [%] | Vehicle: [SPV/Holdco]
• Key Metrics: Project IRR [%] | Equity IRR [%] | NPV [Cr] | Min DSCR [x]
• Hurdles: Project IRR ≥ [%] | Equity IRR ≥ [%] | Min DSCR ≥ [x]
• Recommendation: [APPROVE / CONDITIONAL APPROVE / DEFER / REJECT]
• Conditions Precedent: [Max 3, specific, measurable]
• Total Capital at Risk: [INR Cr] | Expected Payback: [yrs]

========================================
2. PROJECT OVERVIEW (1 page)
======================================
2.1 Technical: [Capacity, Technology, CUF, Degradation, Land, Grid]
2.2 Commercial: [PPA (counterparty, tariff, tenor), ERPA (price, volume, tenor), REC]
2.3 Carbon: [Registry, Methodology, Vintage, ERs/yr, Labels (CCP, CORSIA), Buffer]
2.4 Regulatory: [Permits, Land, LoA/CA status, CCTS readiness]
2.5 ESG: [Safeguards, FPIC, Community, SDG claims]

========================================
3. FINANCIAL ANALYSIS (2 pages)
======================================
3.1 Capex & Funding: [Total, Phasing, Debt:Equity, Senior Terms, IDC]
3.2 Revenue Stack: [PPA %, Carbon %, REC %, Other %] + Contracted vs Merchant
3.3 Operating Metrics: [LCOE, LCOC, Capacity Factor, Availability]
3.4 Returns: [Project IRR, Equity IRR, NPV @ WACC, Payback]
3.5 Debt Metrics: [Min DSCR, Avg DSCR, LLCR, PLCR, Debt Capacity]
3.6 Sensitivity: [Top 3 drivers, Bear case NPV, Breakeven carbon price]
3.7 Scenario Summary: [Base, Bear, Bull, Policy Stress — table]

========================================
4. RISK ASSESSMENT & MITIGATION (1-2 pages)
======================================
4.1 Technical: [Construction, O&M, Generation, Degradation] → [Mitigation]
4.2 Commercial: [Offtaker, Counterparty, Carbon Price, Volume] → [Mitigation]
4.3 Regulatory: [Policy, CCTS, CCP, Export, Land] → [Mitigation]
4.4 Financial: [Interest Rate, FX, Refinancing, Tax] → [Mitigation]
4.5 ESG: [Safeguards, Community, Reputation] → [Mitigation]

Risk Register Format:
| Risk | Likelihood | Impact | Score | Mitigation | Owner | Status |
|------|------------|--------|-------|------------|-------|--------|

========================================
5. CONDITIONS PRECEDENT (CP) — Specific & Measurable
======================================
CP-1: [Description] → Evidence: [Doc] → Deadline: [Date] → Owner: [Name]
CP-2: [...]
CP-3: [...]

========================================
6. POST-INVESTMENT MONITORING
======================================
• Quarterly: Financial performance vs budget, generation vs P50
• Semi-Annual: Carbon issuance, verification, ERPA delivery
• Annual: Full re-score, scenario update, portfolio review
• Triggers for IC Re-review: [Specific thresholds]

========================================
APPENDICES
A. Full Financial Model (Link)
B. DD Memo (Link)
C. Term Sheets (ERPA, PPA, EPC, Debt)
D. Legal Opinions
E. ICV/CCP Assessment
F. Team Bios
```

---

### 12.3.2.3 Common IC Challenges & Responses

| IC Challenge | Typical Source | Prepared Response |
|--------------|----------------|-------------------|
| **"Carbon price assumption too aggressive"** | Conservative IC member | Show bear case at $8/t; ERPA floor at $12/t; sensitivity table |
| **"Equity IRR hurdle not met in Bear"** | Risk-focused member | Bear is stress test; Base meets hurdle; DSRA covers Bear DSCR |
| **"Single offtaker concentration risk"** | Credit committee | PPA with SECI (sovereign); DSRA 9 months; parent guarantee |
| **"Additionality risk on cookstoves/forestry"** | ESG/ICVCM lead | CCP-eligible methodology; VVB top-tier; FPIC documented |
| **"DSCR too tight in Year 1-2"** | Lender rep | Sculpted repayment; DSRA 9 months; standby LC |
| **"Policy risk: CCTS/Export ban"** | Legal/Compliance | ERPA includes force majeure; PPA-only survival (Policy Stress NPV>0) |
| **"Model not audited / hardcodes found"** | Model audit | External model audit completed; FAST compliant; error checks clean |

### 12.3.2.2 IC Decision Outcomes

| Outcome | Meaning | Typical Conditions |
|---------|---------|-------------------|
| **APPROVE** | Proceed to signing | Standard CPs (permits, financial close) |
| **CONDITIONAL APPROVE** | Proceed IF conditions met | Specific CPs with deadlines (e.g., "ERPA signed at ≥$12/t by [date]") |
| **DEFER** | Need more info / market change | Re-present in [30/60/90] days with [specific analysis] |
| **REJECT** | Does not meet criteria | Documented rationale; kill fees may apply |

---

### 12.3.2.3 Common IC Challenges & Responses

| IC Challenge | Typical Source | Prepared Response |
|--------------|----------------|-------------------|
| **"Carbon price assumption too aggressive"** | Conservative IC member | Show bear case at $8/t; ERPA floor at $12/t; sensitivity table |
| **"Equity IRR hurdle not met in Bear"** | Risk-focused member | Bear is stress test; Base meets hurdle; DSRA covers Bear DSCR |
| **"Single offtaker concentration risk"** | Credit committee | PPA with SECI (sovereign); DSRA 9 months; parent guarantee |
| **"Additionality risk on cookstoves/forestry"** | ESG/ICVCM lead | CCP-eligible methodology; VVB top-tier; FPIC documented |
| **"DSCR too tight in Year 1-2"** | Lender rep | Sculpted repayment; DSRA 9 months; standby LC |
| **"Policy risk: CCTS/Export ban"** | Legal/Compliance | ERPA includes force majeure; PPA-only survival (Policy Stress NPV>0) |
| **"Model not audited / hardcodes found"** | Model audit | External model audit completed; FAST compliant; error checks clean |

---

### 12.3.2.3 IC Decision Outcomes

| Outcome | Meaning | Typical Conditions |
|---------|---------|-------------------|
| **APPROVE** | Proceed to signing | Standard CPs (permits, financial close) |
| **CONDITIONAL APPROVE** | Proceed IF conditions met | Specific CPs with deadlines (e.g., "ERPA signed at ≥$12/t by [date]") |
| **DEFER** | Need more info / market change | Re-present in [30/60/90] days with [specific analysis] |
| **REJECT** | Does not meet criteria | Documented rationale; kill fees may apply |

---

### 12.3.2.3 IC Defense Script — Prepared Responses

**Scenario:** You are presenting the 50 MW Solar Rajasthan project to IC. The IC Chair asks these questions:

**IC Questions:**
1. "Your Base case Equity IRR is 16.2% vs our 16% hurdle — that's only 20 bps cushion. Why should we approve?"
2. "Bear case shows negative NPV (-45 Cr) and Min DSCR 1.05x. That's a default risk. Unacceptable."
3. "Carbon price at $15/t is the top of current range. What if ICVCM tightens CCP and prices drop to $8?"
4. "PPA is with SECI — good. But what if SECI delays payments (history of 60-90 days)?"
5. "Your model has no battery storage. Tech Disruption scenario shows storage + solar beats standalone. Are we investing in a stranded asset?"

**Task:** For each question, write a 2-sentence prepared response that:
- Acknowledges the concern
- Provides evidence/mitigation from the model/memo
- Keeps the recommendation intact (or explains condition)

**Deliverable:** IC Defense Script (5 responses)
**Time:** 35 min
**Rubric:** Evidence-based (40%), calm/confident tone (30%), recommendation alignment (30%)

**Knowledge Check:**
1. What is the difference between "Project IRR hurdle" and "Equity IRR hurdle"?
2. Why might a DFI accept 12% IRR when a PE fund requires 18%?
3. What makes a Condition Precedent "specific and measurable"?
4. How do you handle an IC member who wants to change the model assumptions live?

**Sources:**
1. IPFA — Investment Committee Best Practices
2. SECI/MNRE — IC Process for Renewable Projects
3. IFC/ADB — Investment Decision Frameworks
4. FAST Standard — Model Review for IC
5. ICVCM — CCP in Investment Decisions

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC | Regulatory Review: Quarterly*

---

### Lesson 12.3.3: ERPA Structuring & Deal Negotiation
**Lesson Code:** C12.3.3
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** professional

**Learning Objectives:**
1. Structure Emission Reduction Purchase Agreements (ERPAs) with appropriate risk allocation (Bloom: Create)
2. Design pre-payment, forward, and tolling structures for carbon revenue optimization (Bloom: Apply)
3. Identify key legal/commercial terms that protect project value (Bloom: Analyze)

**Prerequisites:** C12.3.1, C12.3.2, C14.2.1 (Market Participants)

**Why This Matters:**
The financial model assumes carbon revenue — the ERPA makes it real. A poorly structured ERPA can leave volume risk with the project, price risk unhedged, or delivery obligations unmeetable. Good deal structuring aligns incentives, allocates risk to the party best able to manage it, and makes the project financeable.

**Core Concept: ERPA as Risk Allocation Contract — Not Just a Sales Agreement**

### 12.3.3.1 ERPA — Core Structure & Risk Allocation

**ERPA Key Terms:**
| Term | Project-Friendly | Buyer-Friendly | Market Standard |
|------|------------------|----------------|-----------------|
| **Price** | Fixed, indexed to CPI + premium | Fixed, discounted to spot | Fixed (3-5yr), Indexed (5-10yr) |
| **Volume** | Best efforts; no penalty for shortfall | Firm commitment; liquidated damages | Firm with force majeure; make-up |
| **Tenor** | Short (3-5 yr) to capture upside | Long (7-15 yr) for visibility | 5-10 yr (aligned with debt) |
| **Delivery** | Ex-warehouse (registry) | Delivered to buyer account | Registry transfer (ex-warehouse) |
| **Title Transfer** | At issuance | At retirement | At issuance (registry transfer) |
| **Risk of Loss** | Buyer after transfer | Project until retirement | Buyer after registry transfer |
| **Force Majeure** | Broad (policy, registry, verification) | Narrow (physical only) | Standard list + policy/registry |
| **Representations** | Standard | Extensive (additionality, permanence) | Standard + methodology compliance |

**Risk Allocation Matrix:**
| Risk | Who Bears | Mitigation |
|------|-----------|------------|
| **Generation/ER Volume** | Project (typically) | Conservative ER estimate; make-up provisions |
| **Carbon Price** | Buyer (fixed price) / Shared (indexed) | Floor/ceiling; collar |
| **Issuance Failure** | Project | VVB quality; pre-verification; insurance |
| **Registry/Label Loss** | Shared | Force majeure; price adjustment |
| **Policy/Regulatory** | Shared / Buyer (if export ban) | Force majeure; termination rights |
| **Verification Delay** | Project | Pre-agreed timeline; liquidated damages cap |
| **Counterparty Credit** | Project | Parent guarantee; LC; credit support |

### 12.3.3.2 ERPA Structures — Beyond Simple Fixed/Forward

| Structure | Description | Project Pros | Project Cons | Best For |
|-----------|-------------|--------------|--------------|----------|
| **Fixed Volume, Fixed Price** | Buy X tCO2e/yr at $Y/t | Certainty; simple | No upside; volume risk | Contracted projects; debt sizing |
| **Fixed Volume, Indexed Price** | $Y/t + CPI + spread | Inflation protection | Complexity; basis risk | Long-tenor (5-10 yr) |
| **Tolling (Project Sells, Buyer Markets)** | Project delivers; buyer sells; revenue share | Upside participation | Market risk; accounting complexity | High-quality projects; strong buyer |
| **Pre-Payment / Forward** | Buyer pays upfront for future delivery | Cash for capex/construction | Discount to spot; delivery risk | Construction finance; capex funding |
| **Carbon-Linked Loan** | Loan repaid in credits | No cash interest; aligned | Credit risk; valuation | Early-stage; no debt access |
| **Streaming / Royalty** | Upfront payment for % of future credits | Non-dilutive; no repayment | Expensive; long tenor | Expansion capex; refinancing |
| **Put/Call Options** | Buyer has right (put) / Project has right (call) | Flexibility | Option premium; complexity | Uncertain policy/volume |

### 12.3.3.2 Pre-Payment & Forward Structures — Deep Dive

**Pre-Payment Agreement (PPA for Carbon):**
```
STRUCTURE:
• Buyer pays: $X million upfront (at financial close or COD)
• Project delivers: Y tCO2e/yr for Z years (or until $X recovered + return)
• Implied Price: $X / (Y × Z) = $/tCO2e (typically 10-20% discount to spot)
• Security: First lien on credits / SPV shares / carbon revenue account
• Return Mechanism: If credits not delivered → cash refund + penalty

PROJECT BENEFITS:
• Funds capex / construction (reduces equity)
• No debt service during construction
• Simpler than senior debt (no covenants, no DSCR)

BUYER BENEFITS:
• Discounted carbon price
• Secured long-term supply
• ESG mandate fulfillment

RISKS:
• If project fails → buyer becomes unsecured creditor (unless secured)
• Carbon price upside lost (locked at discount)
• Delivery risk (verification, registry, policy)
```

**Forward Sale (ERPA with Deferred Delivery):**
- Similar to pre-pay but payment at delivery, not upfront
- Price fixed today for delivery in Year 2-5
- Used for: Hedging carbon price; securing offtake for debt

### 12.3.3.3 Key Legal/Commercial Terms — Protection Checklist

| Clause | Project Protection | Standard Language |
|--------|-------------------|-------------------|
| **Force Majeure** | Includes: Policy change, registry suspension, verification delay, export ban, CCP loss | "Events beyond reasonable control including changes in Law, Registry Rules, Standard Body decisions..." |
| **Change of Law** | Price adjustment or termination if carbon regime changes materially | "If Change of Law materially affects economics, parties negotiate in good faith..." |
| **Make-Up / Carry-Forward** | Shortfall in Year N can be made up in Year N+1 to N+3 | "Deficiency Credits may be delivered in subsequent Delivery Years up to [3] years..." |
| **Liquidated Damages Cap** | Cap at 10-20% of annual contract value | "LD capped at [15%] of average annual Contract Value..." |
| **Step-In Rights** | Buyer can step in if project fails (protects buyer, but gives project time) | "Buyer may assume Project rights upon Event of Default, subject to Lender consent..." |
| **Assignment** | Project can assign to affiliate/lender; Buyer consent not unreasonably withheld | "Project may assign to Affiliate or Lender without consent; other assignments require consent (not unreasonably withheld)..." |
| **Governing Law / Dispute** | Neutral jurisdiction; arbitration | "Singapore Law / SIAC Arbitration / English Language" |
| **Confidentiality** | Protects pricing, project data | Standard mutual NDA provisions |
| **Data Room / Audit Rights** | Buyer can verify; Project controls scope | "Annual audit rights; 30-day notice; confidential; Project bears cost unless material breach..." |

### 12.3.3.4 India-Specific ERPA Considerations

| Issue | India Context | ERPA Provision |
|-------|---------------|----------------|
| **CCTS/CCC Bridging** | Credits may need to move Verra → ICMS | "Project shall cooperate in bridging; Buyer bears bridging costs; delivery at destination registry" |
| **GST on Carbon** | Exempt (Notification 12/2017) | "Parties confirm carbon credits exempt from GST; any change → price adjustment" |
| **TCS (Tax Collected at Source)** | 1% if seller turnover >₹10Cr | "Buyer to deduct TCS per Sec 206C(1H); Project to provide PAN/GSTIN" |
| **Withholding Tax (Foreign Buyer)** | 20% + surcharge or DTAA | "Gross-up clause: Buyer bears WHT; net price = contract price" |
| **FEMA / Repatriation** | Carbon credit sale = export of service | "RBI reporting; AD Bank certification; repatriation within 9 months" |
| **CCTS Compliance Buyer** | Obligated entity surrender deadline (Mar 31) | "Delivery by [Jan 31] for FY surrender; time is of essence" |
| **BRSR Claim** | Voluntary retirement labeling | "Retirement certificate to include BRSR fields; Project assists" |

---

### Practical Exercise: ERPA Structure Design

**Scenario:** Structure an ERPA for a **50 MW Solar Rajasthan** project (Verra, CCP-eligible).

**Project Parameters:**
- Annual ERs: 120,000 tCO2e (buffer 0%)
- PPA: SECI, ₹2.75/kWh, 25 yr
- Debt: 70%, 10.5%, 15 yr, sculpted, Min DSCR 1.2x
- Equity Hurdle: 16%
- Target Financial Close: Q3 2025
- Buyer: European utility (investment grade), needs CORSIA-eligible + CCP
- Delivery to their Verra account

**Buyer Requirements:**
- 10-year tenor (matches their planning)
- Firm volume commitment (for their compliance)
- CORSIA + CCP labels mandatory
- Delivery to their Verra account
- Price: "Competitive with market"

**Task:** Design the ERPA term sheet:
1. Price structure (Fixed/Indexed/Tolling) with rationale
2. Volume commitment (% of ERs, make-up provisions)
3. Tenor & delivery schedule
4. Key protective clauses (Force Majeure, Change of Law, LD Cap)
5. India-specific provisions (CCTS, GST, TCS, WHT)
6. Security package (for buyer comfort + project finance compatibility)

**Deliverable:** ERPA Term Sheet (1 page) + Rationale Memo (½ page)
**Time:** 35 min
**Rubric:** Commercial logic (30%), risk allocation (30%), India specifics (20%), financeability (20%)

**Knowledge Check:**
1. Why is "ex-warehouse" (registry transfer) preferred over "delivered" for title transfer?
2. What makes a pre-payment agreement financeable (vs just a loan)?
3. Why include "Change of Law" specifically for carbon policy?
4. How does TCS (1%) affect the net carbon price for the project?

**Sources:**
1. ICROA — ERPA Best Practice Guide
2. ISDA — Emission Reduction Transaction Documentation
3. Verra/GS — ERPA Templates
4. MNRE/SECI — Model ERPA for Indian Projects
5. RBI — FEMA Guidelines for Carbon Credit Transactions
5. CBDT — TCS/WHT Notifications for Carbon

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC | Regulatory Review: Quarterly*

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC | Regulatory Review: Quarterly*

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC | Regulatory Review: Quarterly*