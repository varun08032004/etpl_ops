# C12: Carbon Project Economics
## Module 12.2: Sensitivity & Scenario Analysis (3 lessons x 40min = 2h)

### Lesson 12.2.1: Key Drivers: Carbon Price, Generation, Cost
**Lesson Code:** C12.2.1
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** professional

**Learning Objectives:**
1. Identify and quantify the key value drivers for carbon project economics (Bloom: Analyze)
2. Build single-variable sensitivity tables and tornado charts (Bloom: Apply)
3. Interpret sensitivity results for investment decision-making (Bloom: Evaluate)

**Prerequisites:** C12.1.3

**Why This Matters:**
A base-case NPV is a single point in a multidimensional risk space. Sensitivity analysis reveals which assumptions matter most — and which don't. Carbon price, generation, and capex typically dominate. Knowing the sensitivity hierarchy focuses DD, negotiation, and risk mitigation on the right levers.

**Core Concept: Sensitivity as Risk Prioritization — Not All Assumptions Are Equal**

### 12.2.1.1 Key Driver Identification — The Sensitivity Hierarchy

**Typical Sensitivity Ranking (Carbon Projects):**
```
1. CARBON PRICE (Very High) — Often #1 for projects with >30% carbon revenue
2. GENERATION / CUF (Very High) — Drives both energy AND carbon revenue
3. CAPEX (High) — Upfront, sunk; affects IRR more than NPV
4. OPEX ESCALATION (Medium-High) — Compounds over 20-25 years
5. PPA TARIFF (High if contracted) — Fixed but volume risk remains
6. DEGRADATION (Medium) — Compounds; affects tail value
5. DISCOUNT RATE / WACC (High) — Affects NPV more than IRR
8. CARBON VOLUME (ERs) (High) — Baseline, leakage, buffer
9. DEBT TERMS (Medium) — Interest, tenor, sculpting
10. TAX / INCENTIVES (Medium) — MAT, 80-IA, depreciation
```

**Project-Type Sensitivity Profiles:**
| Project Type | #1 Driver | #2 Driver | #3 Driver | Unique Driver |
|--------------|-----------|-----------|-----------|---------------|
| **Solar/Wind (Contracted PPA)** | Generation/CUF | Capex | Opex Escalation | Curtailment |
| **Solar/Wind (Merchant)** | Power Price | Generation | Carbon Price | Price correlation |
| **Cookstoves** | Usage Rate | Carbon Price | Distribution Cost | Stove Lifetime |
| **REDD+/Forestry** | Carbon Price | Baseline Deforestation | Buffer/Permanence | Leakage |
| **Industrial Gas** | Carbon Price | Plant Utilization | Byproduct Ratio | Regulatory Surplus |
| **Blue Carbon** | Carbon Price | Soil Carbon Stock | Sea Level Rise | Hydrology |

### 12.2.1.2 Single-Variable Sensitivity — Methodology

**Sensitivity Table Construction:**
```
FOR EACH KEY DRIVER:
1. Define Range: Base ± X% (typically ±10-20% or scenario-based)
2. Step Size: 5-10% increments (5-9 points)
3. Recalculate: NPV, IRR, Payback, DSCR_min for each point
4. Hold ALL other assumptions at Base Case
5. Plot: X-axis = Driver Value, Y-axis = Metric (NPV/IRR)
```

**Sensitivity Table Template:**
```
SENSITIVITY: NPV @ WACC (INR Cr) — 50 MW Solar

| Carbon Price ($/t) | $8 (Bear) | $12 | $15 (Base) | $18 | $22 | $25 (Bull) |
|---------------------|-----------|-----|------------|-----|-----|------------|
| NPV (INR Cr)        | -45       | 12  | 58         | 104 | 150 | 196        |
| Equity IRR          | 8%        | 12% | 16%        | 20% | 23% | 26%        |
| Min DSCR            | 1.05x     | 1.18x| 1.32x     | 1.45x| 1.58x| 1.70x     |

| Generation (GWh/yr) | 155 (-10%) | 165 | 175 (Base) | 185 | 195 (+10%) |
|---------------------|------------|-----|------------|-----|------------|
| NPV (INR Cr)        | 28         | 43  | 58         | 73  | 88         |
| Equity IRR          | 13%        | 15% | 16%        | 18% | 19%        |
```

### 12.2.1.3 Tornado Charts — Visualizing Sensitivity

**Tornado Chart Construction:**
1. Run single-variable sensitivity for ALL key drivers (±10% or scenario range)
2. Calculate NPV/IRR swing = Max - Min for each driver
3. Sort drivers by swing magnitude (largest at top)
4. Plot horizontal bars: Base at center, Low/High extending left/right

**Tornado Interpretation:**
```
TORNADO CHART — NPV SWING (INR Cr)

Carbon Price ($8-$25)     ████████████████████████████ 241
Generation (±10%)         ████████████████████        60
Capex (±10%)              ████████████████            45
Opex Escalation (±2%)     ████████████                32
Degradation (±0.2%)       ████████                    18
WACC (±1%)                ████████                    17
Debt Interest (±0.5%)     █████                       10
Tax Rate (±2%)            ████                        8

INSIGHT: Carbon price dominates. Focus DD on carbon revenue certainty.
```

**Two-Variable Sensitivity (Heatmap):**
```
NPV (INR Cr) — Carbon Price × Generation

                    Generation (GWh/yr)
Carbon Price    155      165      175      185      195
$8              -45      -30      -15      0        15
$12              12       27       43       58       73
$15 (Base)       58       73       88       104      119
$18              104      119      135      150      165
$25 (Bull)       196      211      227      242      257

INSIGHT: Low generation + low carbon price = value destruction.
         High generation cannot fully offset low carbon price.
```

### 12.2.1.4 Sensitivity in Investment Decision-Making

**Decision Rules from Sensitivity:**
| Sensitivity Pattern | Implication | Action |
|---------------------|-------------|--------|
| **NPV negative in Bear, positive in Base/Bull** | Binary outcome risk | Require contracted carbon revenue; reduce equity |
| **IRR highly sensitive to Carbon Price** | Revenue risk | Hedge carbon; shorten ERPA tenor |
| **DSCR breaches in Bear** | Debt service risk | Sculpt debt; increase DSRA; reduce leverage |
| **NPV insensitive to Capex** | Capex not value driver | Don't over-negotiate EPC; focus on revenue |
| **Two variables jointly critical** | Correlation risk | Model correlation; stress test combinations |

**Sensitivity Reporting for Investment Committee:**
```
SENSITIVITY SUMMARY MEMO:
• Top 3 Drivers: Carbon Price (40% of NPV swing), Generation (25%), Capex (15%)
• Downside Protection: At Bear carbon ($8), NPV = -45 Cr (requires $12 for breakeven)
• Upside Potential: At Bull carbon ($25), NPV = 196 Cr (3.4x Base)
• Debt Capacity: Min DSCR 1.32x at Base; 1.05x at Bear → Max leverage at Base
• Key Risk Mitigants: 5-yr ERPA at $15/t covers 60% of carbon volume
```

---

### Practical Exercise: Sensitivity Analysis Workshop

**Scenario:** Run sensitivity for a 50 MW Solar project (from Lesson 12.1.1/12.1.2).

**Base Case Assumptions:**
- Capacity: 50 MW | CUF: 19.7% | Degradation: 0.7%/yr
- PPA: ₹2.75/kWh fixed, 25 yr (SECI)
- Carbon: 120,000 tCO2e/yr, Base $15/t, Buffer 0%
- Capex: INR 250 Cr | Opex Year 1: INR 3.0 Cr | Opex Esc: 5%
- Debt: 70% | 10.5% fixed | 15 yr tenor | Sculpted
- WACC: 10.5% | Tax: 25.17% (115BAA) | 80-IA: 10 yr holiday

**Task:** Using the model logic (conceptually):
1. Rank top 5 drivers by NPV swing (±10% for technical/cost, scenario for carbon)
2. Build tornado chart data (NPV swing for each)
3. Identify: At what carbon price does NPV = 0?
4. Identify: What generation drop makes Min DSCR < 1.15x?
5. Recommend: Should equity investor require carbon price floor?

**Deliverable:** Sensitivity Ranking + Tornado Data + Breakeven Analysis + Recommendation
**Time:** 35 min
**Rubric:** Driver identification (30%), tornado logic (30%), breakeven accuracy (20%), recommendation quality (20%)

**Knowledge Check:**
1. Why is carbon price sensitivity typically higher for NPV than for IRR?
2. What does a "flat" tornado bar mean for that driver?
3. Why test two-variable sensitivity (carbon price × generation)?
4. How does sensitivity analysis inform ERPA negotiation strategy?

**Sources:**
1. Project Finance — Sensitivity Analysis Best Practices
2. FAST Standard — Sensitivity & Scenario Modeling
3. ICVCM / Calyx — Carbon Price Scenario Methodology
4. MNRE/SECI — Solar/Wind Project Sensitivity Guidelines
5. IPFA — Sensitivity Analysis in Project Finance

---

### Lesson 12.2.3: Breakeven & Investment Thresholds
**Lesson Code:** C12.2.3
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** professional

**Learning Objectives:**
1. Calculate carbon price breakeven and generation breakeven for project viability (Bloom: Apply)
2. Determine investment thresholds using NPV, IRR, and DSCR hurdles (Bloom: Evaluate)
3. Structure project finance terms to meet hurdle requirements (Bloom: Create)

**Prerequisites:** C12.2.1, C12.1.3

**Why This Matters:**
Breakeven analysis translates sensitivity results into concrete investment decisions. "At what carbon price does this project break even?" and "What generation shortfall triggers default?" are the questions that determine whether capital is committed, whether debt is structured, and whether a project proceeds to financial close. These thresholds anchor term sheets, ERPA negotiations, and IC memos.

**Core Concept: Breakeven as Decision Boundary — Where Economics Meet Risk Appetite**

### 12.2.3.1 Breakeven Definitions — What Are We Solving For?

| Breakeven Type | Definition | Formula Concept | Use Case |
|----------------|------------|-----------------|----------|
| **Carbon Price Breakeven** | Carbon price where NPV = 0 (all else base) | Solve NPV(CP) = 0 for CP | ERPA floor price; investment go/no-go |
| **Generation Breakeven** | Annual generation where NPV = 0 | Solve NPV(Gen) = 0 for Gen | PPA capacity factor targets; curtailment limits |
| **Capex Breakeven** | Max capex where NPV = 0 | Solve NPV(Capex) = 0 for Capex | EPC negotiation ceiling; contingency buffer |
| **Opex Breakeven** | Max Opex escalation where NPV = 0 | Solve NPV(OpexEsc) = 0 for OpexEsc | O&M contract structuring |
| **Debt Capacity Breakeven** | Max leverage where Min DSCR ≥ 1.2x | Solve DSCR_min(Leverage) = 1.2 | Debt sizing; structuring memoranda |

**Key Principle:** Breakeven is not a single number — it's a function of all other assumptions. Always state: "Carbon price breakeven = $12.50/t *assuming* base case generation, capex, opex, and WACC."

### 12.2.3.2 Carbon Price Breakeven — The Core Metric

**Calculation Approach (Goal Seek / Solver):**
```
FUNCTION carbon_price_breakeven(base_model):
    target = 0  # NPV = 0
    variable = carbon_price
    constraints = all other inputs at base case
    
    # In Excel: Data → What-If Analysis → Goal Seek
    # Set cell: NPV_cell | To value: 0 | By changing: Carbon_Price_cell
    
    RETURN carbon_price_where_NPV_zero
```

**50 MW Solar Example (from Lesson 12.2.1):**
| Metric | Base Case | Breakeven Value | Interpretation |
|--------|-----------|-----------------|----------------|
| **Carbon Price Breakeven (NPV=0)** | $15/t | **$12.30/t** | Below $12.30 → value destruction |
| **Carbon Price for IRR = 14% (Hurdle)** | 16% | **$13.80/t** | Equity return threshold |
| **Carbon Price for Min DSCR = 1.2x** | 1.32x | **$11.50/t** | Debt service threshold |
| **Carbon Price for Payback ≤ 10 yr** | 7.8 yr | **$13.20/t** | Liquidity threshold |

**Interpretation for Investment Committee:**
```
CARBON PRICE BREAKEVEN MEMO:
Project: 50 MW Solar (VCS-1234)
Base NPV @ $15/t: INR 58 Cr

Thresholds:
• NPV = 0:              $12.30/t  (27% below base)
• Equity IRR = 14%:     $13.80/t  (8% below base)  
• Min DSCR = 1.2x:      $11.50/t  (23% below base)
• Payback = 10 yr:      $13.20/t  (12% below base)

Current Forward Curve (2025-2030): $14-18/t
CONCLUSION: Adequate margin to NPV=0. IRR hurdle is binding constraint.
RECOMMENDATION: Proceed with ERPA floor ≥ $13.50/t for 5-year tenor.
```

### 12.2.3.3 Generation Breakeven — Technical Risk Boundary

**Calculation:**
```
Generation Breakeven = Base Generation × (1 - NPV/Base_Carbon_Revenue)
```
*Simplified for linear approximation; exact via Goal Seek.*

**50 MW Solar Example:**
| Metric | Base Case | Breakeven Value | Interpretation |
|--------|-----------|-----------------|----------------|
| **Generation Breakeven (NPV=0)** | 175 GWh/yr | **158 GWh/yr** | 9.7% drop from base |
| **Generation for Min DSCR = 1.2x** | 175 GWh/yr | **165 GWh/yr** | 5.7% drop from base |
| **P50 vs P90 Risk** | P50: 175 | P90: 155 | P90 < NPV breakeven → risk |

**Curtailment Impact:**
| Curtailment Level | Effective Generation | NPV Impact | DSCR Impact |
|-------------------|---------------------|------------|-------------|
| 0% (Base) | 175 GWh | 58 Cr | 1.32x |
| 5% | 166 GWh | 38 Cr | 1.22x |
| 10% | 158 GWh | 18 Cr | 1.12x |
| 15% | 149 GWh | -2 Cr | 1.03x |

**Key Insight:** At 10% curtailment, NPV is near zero. At 15%, project destroys value. Curtailment risk must be in ERPA/insurance.

### 12.2.3.4 Investment Thresholds — Hurdle Framework

**Standard Hurdle Set (Indian Renewable + Carbon Projects):**

| Metric | Threshold | Source | Consequence of Breach |
|--------|-----------|--------|----------------------|
| **Equity IRR** | ≥ 14-16% (post-tax) | Investor mandate | No equity commitment |
| **Project IRR** | ≥ 10-12% | Benchmark | Uncompetitive vs alternatives |
| **NPV @ WACC** | > 0 (strictly positive) | Value creation | Value destruction |
| **Min DSCR** | ≥ 1.20x (senior debt) | Lender requirement | Debt reduction; DSRA increase |
| **Average DSCR** | ≥ 1.40x | Portfolio health | Tighter covenants |
| **Payback (Equity)** | ≤ 8-10 years | Liquidity | Longer hold; lower IRR |
| **LLCR** | ≥ 1.30x | Project finance standard | Debt sculpting required |
| **PLCR** | ≥ 1.50x | Refinancing risk | Shorter tenor; higher pricing |

**Hurdle Hierarchy (Which Binds First?):**
```
TYPICAL BINDING ORDER (Solar/Wind + Carbon):
1. Min DSCR ≥ 1.20x        → Binds FIRST (debt constraint)
2. Equity IRR ≥ 14%        → Binds SECOND (equity constraint)  
3. NPV > 0                 → Binds THIRD (usually satisfied if above met)
4. Payback ≤ 10 yr         → Binds FOURTH (liquidity)
```

### 12.2.3.5 Debt Sizing from Breakeven — Reverse Engineering

**Process: Start from hurdles, derive max debt:**
```
1. SET: Min DSCR = 1.20x (hard constraint)
2. CALCULATE: Max annual debt service = CFADS_min / 1.20
   Where CFADS_min = minimum annual cash flow available for debt service
3. DERIVE: Max debt principal = PV(Max debt service, debt rate, tenor)
4. CHECK: Equity IRR at this leverage ≥ hurdle?
   - If yes: Leverage = derived amount
   - If no: Reduce leverage until Equity IRR = hurdle
5. RESULT: Optimal debt/equity split
```

**50 MW Solar Example:**
| Scenario | Debt % | Debt (Cr) | Min DSCR | Equity IRR | NPV (Cr) |
|----------|--------|-----------|----------|------------|----------|
| **Max Leverage (DSCR binding)** | 78% | 195 | 1.20x | 15.2% | 52 |
| **Equity IRR Binding (14%)** | 74% | 185 | 1.26x | 14.0% | 56 |
| **Base Case (70%)** | 70% | 175 | 1.32x | 16.0% | 58 |
| **Conservative (65%)** | 65% | 162 | 1.42x | 16.8% | 60 |

**Decision Rule:** Use 70% as base; 74% as max if equity investor accepts; 65% if conservative.

### 12.2.3.6 ERPA Structuring from Breakeven — Carbon Revenue Certainty

**Carbon Price Floor Calculation:**
```
Required Floor = MAX(
    Carbon Price for NPV=0 + Buffer,
    Carbon Price for Min DSCR=1.2x + Buffer,  
    Carbon Price for Equity IRR=Hurdle + Buffer
)
Buffer = 10-20% (negotiated; covers volume risk, basis risk)
```

**ERPA Term Sheet from Breakeven:**
| Term | Derived From | Example Value |
|------|--------------|---------------|
| **Floor Price** | Max(Breakevens) + 15% buffer | $13.80 × 1.15 = **$15.90/t** |
| **Ceiling Price** | Bull case - buyer margin | $25 × 0.8 = **$20.00/t** |
| **Tenor** | Debt tenor (match cash flows) | **5-7 years** |
| **Volume** | Min(P90 generation × EF, contracted) | **90,000 tCO2e/yr** |
| **Delivery** | Ex-post (verified) vs ex-ante | **Ex-post (safer)** |
| **Force Majeure** | Generation breakeven sensitivity | Curtailed volume = buyer risk |

### 12.2.3.7 Breakeven in Multi-Scenario Context

**Scenario-Weighted Breakeven (Expected Value Approach):**
```
E[Breakeven] = Σ (Scenario_Probability × Scenario_Breakeven)

Example:
| Scenario    | Probability | Carbon Breakeven | Weighted |
|-------------|-------------|------------------|----------|
| Policy Stress | 10%       | $18.00/t         | $1.80    |
| Bear        | 25%        | $14.50/t         | $3.63    |
| Base        | 40%        | $12.30/t         | $4.92    |
| Optimized   | 15%        | $10.50/t         | $1.58    |
| Bull        | 10%        | $8.20/t          | $0.82    |
| **E[Breakeven]** | **100%** |                  | **$12.75/t** |

INSIGHT: Scenario-weighted breakeven ($12.75) > Base breakeven ($12.30) 
→ Downside scenarios pull expectation up. Use for conservative IC memo.
```

---

### Practical Exercise: Breakeven & Threshold Workshop

**Scenario:** 50 MW Solar project. Determine investment thresholds and ERPA terms.

**Base Case (from Lesson 12.1/12.2):**
- 50 MW, 19.7% CUF, 0.7% degradation
- PPA: ₹2.75/kWh, 25 yr (SECI)
- Carbon: 120,000 tCO2e/yr, Base $15/t
- Capex: INR 250 Cr | Opex Y1: 3.0 Cr | Esc: 5%
- Debt: 70%, 10.5%, 15 yr | WACC: 10.5% | Tax: 25.17%

**Task:**
1. Calculate: Carbon price breakeven (NPV=0, IRR=14%, DSCR=1.2x)
2. Calculate: Generation breakeven (NPV=0, DSCR=1.2x)
3. Determine: Max debt % where Min DSCR ≥ 1.20x AND Equity IRR ≥ 14%
4. Design: ERPA floor price with 15% buffer
5. Assess: If curtailment risk is 10% (P90), does project still meet hurdles?

**Deliverable:** Breakeven Table + Debt Sizing Table + ERPA Term Sheet + Go/No-Go Recommendation
**Time:** 35 min
**Rubric:** Calculation accuracy (30%), threshold logic (30%), ERPA design (20%), recommendation quality (20%)

**Knowledge Check:**
1. Why is Min DSCR typically the first binding constraint in Indian solar+carbon projects?
2. What does "carbon price breakeven = $12.30/t assuming base generation" mean practically?
3. How does generation breakeven inform PPA negotiation?
4. Why use scenario-weighted breakeven instead of base case only?

**Sources:**
1. Project Finance — Breakeven Analysis & Debt Sizing
2. FAST Standard — Sensitivity & Breakeven Modeling
3. MNRE/SECI — Solar Project Financial Closure Guidelines
4. IPFA — Debt Sizing & DSCR Methodology
5. ICVCM / Calyx — Carbon Price Scenario Methodology
6. IFC — Renewable Energy Project Finance Guidelines

---

*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC | Regulatory Review: Quarterly*

---
### Lesson 12.2.2: Tornado Analysis & Monte Carlo (FA01 Only)
**Lesson Code:** C12.2.2
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** professional

**Learning Objectives:**
1. Distinguish between deterministic (tornado/scenario) and probabilistic (Monte Carlo) analysis (Bloom: Understand)
2. Design Monte Carlo input distributions for key drivers (Bloom: Apply) — **FA01 Specialist Track**
3. Interpret probabilistic outputs: percentiles, probability of success, risk-adjusted metrics (Bloom: Evaluate) — **FA01 Specialist Track**

**Prerequisites:** C12.2.1

**Why This Matters:**
Tornado and scenario analysis are deterministic — they show "what if" for discrete points. Monte Carlo simulation is probabilistic — it shows the full distribution of outcomes by sampling from input distributions. **Monte Carlo is required only in Finance Advanced (FA01) and Finance-track Capstone.** Common Core (C12, C16) uses deterministic scenario analysis only. This lesson clarifies the boundary and teaches Monte Carlo for those who need it.

**Core Concept: Deterministic vs Probabilistic — Right Tool for Right Mandate**

### 12.2.2.1 Deterministic vs Probabilistic — The Boundary

| Aspect | Deterministic (C12, C16 Common) | Probabilistic (FA01, Finance Capstone) |
|--------|----------------------------------|----------------------------------------|
| **Method** | Scenario (Base/Bear/Bull), Tornado | Monte Carlo Simulation |
| **Output** | Discrete points (NPV at $8, $15, $25) | Full distribution (NPV percentiles) |
| **Input** | Single values per scenario | Probability distributions |
| **Correlation** | Manual (2-var heatmap) | Built-in (correlation matrix) |
| **Interpretation** | "If X, then Y" | "P(NPV>0) = 78%; P10 = -50, P90 = 200" |
| **Use Case** | Investment committee, standard DD | Structuring, pricing, risk limits, portfolio optimization |
| **Complexity** | Low (Excel-native) | High (add-ins: @RISK, Crystal Ball, Python) |
| **Mandate** | All roles | Finance Advanced only |

**Blueprint Rule (V1.2 §L):**
> **Monte Carlo NOT required in C12 Common Core or C16 Common Capstone.**
> **Monte Carlo ONLY in FA01 (Finance Advanced) and Finance-track C16 Capstone.**
> **Monte Carlo errors only critical where explicitly part of specialist competency.**

### 12.2.2.2 Scenario Analysis — Common Core Standard

**Standard Scenario Set (C12 / C16 Common):**
| Scenario | Carbon Price | Generation | Capex | Opex | Policy | Use |
|----------|--------------|------------|-------|------|--------|-----|
| **BASE** | "Current Trajectory" | Voluntary CCP adoption; CORSIA Phase 1; Art 6 pilot | $15/t (2025) → $28 (2030) → $40 (2035) | 80% PPA, 20% merchant; moderate curtailment | Solar -5%/yr; Battery -10%/yr | Rates normalize; INR stable |
| **BEAR** | "Oversupply & Policy Drift" | CCP stalls; CORSIA delayed; Art 6 deadlocked; export bans | $8/t (2025) → $12 (2030) → $15 (2035) | PPA honored; merchant weak; curtailment ↑ | Solar flat; supply chain constraints | High rates; INR depreciation |
| **BULL** | "Regulation-Driven Scarcity" | CCP mandatory for corps; CORSIA full; Art 6.2 scaling; CBAM | $20/t (2025) → $50 (2030) → $100 (2035) | PPA + merchant premium; green power premium | Solar -8%/yr; battery -15%/yr | Greenium; low carbon cost of capital |
| **POLICY STRESS** | "Carbon Market Collapse" | Voluntary market discredited; only compliance (CCTS, EU ETS) | $5/t (voluntary) → $0 (if no compliance) | PPA only; no carbon revenue | Irrelevant (carbon = 0) | High rates; policy uncertainty |
| **TECHNOLOGY DISRUPTION** | "Cheap Storage + DAC" | CCP + removal mandate | $30/t (avoidance) → $150/t (removal) | 24/7 firm renewables; baseload replacement | Battery -15%/yr; DAC $100/t by 2030 | High capex; new asset class |

**Scenario Reporting (Common Core):**
```
SCENARIO COMPARISON — 50 MW Solar

| Metric              | Policy Stress | Bear    | Base    | Optimized | Bull    |
|---------------------|---------------|---------|---------|-----------|---------|
| Project NPV (Cr)    | 42            | -45     | 58      | 112       | 196     |
| Equity IRR          | 11%           | 8%      | 16%     | 21%       | 26%     |
| Min DSCR            | 1.25x         | 1.05x   | 1.32x   | 1.50x     | 1.70x   |
| Payback (yr)        | 9.5           | >15     | 7.8     | 6.5       | 5.8     |
| LCOE (₹/kWh)        | 3.1           | 3.3     | 2.9     | 2.7       | 2.5     |
| LCOC ($/tCO2e)      | 18            | 22      | 14      | 11        | 8       |
| CARBON REV % OF TOTAL | 5%            | 15%     | 21%     | 28%       | 35%     |
| DEBT CAPACITY (MAX) | 75%           | 65%     | 75%     | 80%       | 80%     |

COLOR CODING:  GREEN = Meets all hurdles  |  AMBER = Marginal  |  RED = Fails hurdles
```

**Decision Rules by Scenario:**
| Scenario | Decision Rule |
|----------|---------------|
| **Base** | Primary: NPV > 0, Equity IRR > Hurdle, Min DSCR > 1.2x |
| **Bear** | Downside: NPV > -20% Capex, Min DSCR > 1.0x (no default) |
| **Policy Stress** | Floor: Project survives on PPA alone (NPV > 0 without carbon) |
| **Bull** | Upside: Confirms optionality; no additional capital needed |
| **Optimized** | Execution target: What "good" looks like with active management |

### 12.2.2.3 Monte Carlo — FA01 Specialist Track

**When Monte Carlo Adds Value:**
- Complex correlation structures (carbon price ↔ power price ↔ FX)
- Non-linear payoffs (options, floors, caps in ERPAs)
- Portfolio-level risk (VaR, CVaR across 50+ projects)
- Pricing exotic structures (carbon-linked bonds, swaps)
- Regulatory capital models (Basel-style)

**Monte Carlo Workflow (FA01):**
```
1. DEFINE INPUT DISTRIBUTIONS
   • Carbon Price: Log-normal (μ=$15, σ=0.4) — calibrated to forward curve + vol
   • Generation: Normal (μ=P50, σ=P50-P90) — from PVsyst uncertainty
   • Capex: Triangular (Min, Mode, Max) — from EPC quotes
   • Opex Escalation: Normal (μ=5%, σ=1.5%)
   • WACC: Normal (μ=10.5%, σ=0.5%)
   • Correlation Matrix: Carbon↔Power (0.3), Carbon↔FX (-0.2), etc.

2. SET SIMULATION PARAMETERS
   • Iterations: 10,000-50,000 (convergence test)
   • Sampling: Latin Hypercube (faster convergence)
   • Seed: Fixed for reproducibility

3. RUN SIMULATION
   • For each iteration: Sample all inputs → Run model → Store outputs
   • Track: NPV, IRR, DSCR_min, Payback, LCOC, Equity CFs

4. ANALYZE OUTPUTS
   • Percentiles: P1, P5, P10, P25, P50, P75, P90, P95, P99
   • Probability of Success: P(NPV>0), P(IRR>Hurdle), P(DSCR>1.2x)
   • Risk Metrics: VaR (P5), CVaR (Expected Shortfall)
   • Sensitivity: Regression coefficients / Rank correlation

5. REPORT
   • Distribution charts (histogram, CDF)
   • Tornado of regression coefficients (probabilistic sensitivity)
   • Key percentiles table
   • Scenario overlay (Base/Bear/Bull on distribution)
```

### 12.2.2.4 Input Distribution Design — FA01

| Driver | Distribution | Parameterization | Source |
|--------|--------------|------------------|--------|
| **Carbon Price** | Log-normal / GBM | Calibrated to forward curve + implied vol | Market data, ICVCM scenarios |
| **Generation (Solar)** | Normal / Beta | P50 from PVsyst; P90/P10 from uncertainty report | PVsyst, historical |
| **Generation (Wind)** | Weibull (wind speed) → Power curve | Site wind data + turbine curve | Wind resource assessment |
| **Capex** | Triangular | Min (contract), Mode (budget), Max (contingency) | EPC contracts |
| **Opex Escalation** | Normal | μ = CPI+1%, σ = 1% | Macro forecasts |
| **Degradation** | Triangular | Min (warranty), Mode (industry), Max (conservative) | NREL, warranties |
| **Discount Rate** | Normal | μ = WACC, σ = 0.5-1% | CAPM uncertainty |
| **Correlation** | Matrix | Specified by modeler | Historical analysis, judgment |

**Correlation Matrix Example:**
```
                 Carbon  Gen(Solar)  Gen(Wind)  Capex  Opex  FX    Power
Carbon           1.0     0.1         0.2        0.0    0.0   -0.2  0.3
Gen(Solar)       0.1     1.0         0.3        0.0    0.0   0.0   0.0
Gen(Wind)        0.2     0.3         1.0        0.0    0.0   0.0   0.0
Capex            0.0     0.0         0.0        1.0    0.2   0.0   0.0
Opex             0.0     0.0         0.0        0.2    1.0   0.0   0.0
FX               -0.2    0.0         0.0        0.0    0.0   1.0   -0.3
Power            0.3     0.0         0.0        0.0    0.0   -0.3  1.0
```

### 12.2.2.5 Monte Carlo Output Interpretation — FA01

**Key Output Metrics:**
| Metric | Interpretation | Decision Use |
|--------|----------------|--------------|
| **P(NPV > 0)** | Probability project creates value | Go/No-Go threshold (e.g., >80%) |
| **P10 / P90 NPV** | 10% chance worse/better than this | Risk appetite; capital allocation |
| **Expected Shortfall (CVaR)** | Avg loss in worst 5% cases | Tail risk; capital reserve |
| **P(IRR > Hurdle)** | Probability meets return target | Equity sizing; promote structure |
| **P(DSCR_min > 1.2x)** | Debt service reliability | Leverage sizing; DSRA sizing |
| **Regression Sensitivity** | Which inputs drive output variance | Focus DD/hedging |

**Probabilistic vs Deterministic Decision:**
```
DETERMINISTIC (Base Case): NPV = 58 Cr → APPROVE
PROBABILISTIC: P(NPV>0) = 72%, P10 = -42 Cr, P90 = 185 Cr
                → CONDITIONAL APPROVE (requires carbon hedge / lower leverage)
```

---

### Practical Exercise: Scenario vs Monte Carlo (FA01)

**Scenario:** 50 MW Solar project. Compare deterministic and probabilistic analysis.

**Deterministic (Common Core):**
- Base: Carbon $15, Gen 175 GWh → NPV 58 Cr
- Bear: Carbon $8, Gen 155 GWh → NPV -45 Cr
- Bull: Carbon $25, Gen 195 GWh → NPV 196 Cr

**Probabilistic (FA01) — Input Distributions:**
- Carbon Price: Log-normal, median $15, 90% CI [$8, $35]
- Generation: Normal, μ=175 GWh, σ=15 GWh
- Correlation (Carbon, Gen): 0.1
- 10,000 iterations

**Monte Carlo Output (Simulated):**
- P50 NPV: 62 Cr
- P10 NPV: -28 Cr
- P90 NPV: 175 Cr
- P(NPV>0): 78%
- P(DSCR_min>1.2x): 85%
- Regression Sensitivity: Carbon Price 55%, Generation 30%, Capex 10%

**Task:** 
1. Compare deterministic Bear (-45 Cr) vs probabilistic P10 (-28 Cr). Why different?
2. Investment committee requires P(NPV>0) > 80%. Does this project pass?
3. If not, what structural changes could raise P(NPV>0) to >80%?
4. How would you explain the difference between "Bear case" and "P10" to a non-technical IC member?

**Deliverable:** Comparison Memo + Structural Recommendations
**Time:** 35 min
**Rubric:** Technical accuracy (30%), interpretation (30%), structural insight (20%), communication (20%)

**Knowledge Check:**
1. Why is Monte Carlo NOT required in C12 Common Core?
2. What does "Latin Hypercube sampling" achieve vs simple random sampling?
3. How do you calibrate a log-normal distribution for carbon price?
4. What is the difference between VaR (P5) and CVaR (Expected Shortfall)?

**Sources:**
1. Blueprint V1.2 §L — Monte Carlo Placement
2. FAO/World Bank — Monte Carlo in Project Finance
3. @RISK / Crystal Ball — User Guides
4. ICVCM — Carbon Price Uncertainty Guidance
5. NREL — Probabilistic Generation Modeling
6. Basel Committee — Credit Risk Modeling (Reference)

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC | Regulatory Review: Quarterly*

---