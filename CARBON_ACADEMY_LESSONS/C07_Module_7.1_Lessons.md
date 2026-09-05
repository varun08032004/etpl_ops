# C07: Additionality & Baselines
## Module 7.1: Additionality Tests (3 lessons × 40min = 2h)

### Lesson 7.1.1: Additionality Tests
**Lesson Code:** C07.1.1
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** professional

**Learning Objectives:**
1. Apply the regulatory surplus, investment, barrier, and common practice tests (Bloom: Apply)
2. Construct a robust additionality argument with evidence hierarchy (Bloom: Create)
3. Identify common additionality pitfalls and how to avoid them (Bloom: Analyze)

**Prerequisites:** C06.1.1, C06.1.2, C06.2.1

**Why This Matters:**
Additionality is the gatekeeper of credit integrity. If a project would have happened anyway, its credits are "hot air" — they don't represent real mitigation. Every standard (VCS, GS, CDM, CCTS) requires rigorous additionality demonstration. This lesson teaches you to build additionality arguments that survive validation and withstand scrutiny.

**Core Concept: Additionality = "But For Carbon Finance, This Would Not Have Happened"**

### 7.1.1.1 The Additionality Test Hierarchy

**Test Sequence (CDM Tool 01 / VCS VT0001 / GS Toolkit):**
```
Step 1: Regulatory Surplus Test (Mandatory first gate)
    ↓ PASS
Step 2: Investment Analysis OR Barrier Analysis (Choose one)
    ↓ PASS
Step 3: Common Practice Analysis (Supporting evidence)
    ↓ PASS
→ ADDITIONAL
```

**Test Overview:**
| Test | Purpose | When It Fails |
|------|---------|---------------|
| **Regulatory Surplus** | Is project mandated by law? | Project required by law/regulation |
| **Investment Analysis** | IRR without carbon < benchmark? | IRR ≥ benchmark without carbon |
| **Barrier Analysis** | Barriers overcome by carbon revenue? | No credible barriers; or carbon doesn't overcome |
| **Common Practice** | >50% similar projects without carbon? | >50% similar projects exist without carbon finance |

### 7.1.1.2 Regulatory Surplus Test — The First Gate

**Question:** Is the project mandated by existing law, regulation, or mandate?

**Test Logic:**
```
IF (project required by law/regulation/mandate) 
    → NOT ADDITIONAL (regulatory surplus)
ELSE 
    → Proceed to next test
```

**Evidence Required:**
- Legal review of applicable laws/regulations
- Permits and licenses showing voluntary nature
- Regulatory correspondence (if any)
- Expert legal opinion (for complex jurisdictions)

**Common Pitfalls:**
- Confusing "permitted" with "mandated" — permitted ≠ mandated
- Missing state/local regulations (e.g., state RE mandates in India)
- Ignoring upcoming regulations (known future mandates)
- Confusing incentives with mandates (tax credits ≠ mandates)

**India Context:**
- CCTS: Check Energy Conservation Act, state RE policies, PAT obligations
- State RE purchase obligations (RPO) = regulatory surplus for obligated entities
- CCTS: Regulatory surplus test against CCTS obligations, not just national laws

### 7.1.1.3 Investment Analysis — The Financial Test

**Core Question:** Is the project financially viable without carbon revenue?

**Method (CDM Tool 01 / VCS VT0001 / GS Toolkit):**
```
1. Define project boundary (all costs/revenues attributable to project)
2. Identify all costs (CAPEX, OPEX, replacement, decommissioning, tax)
3. Identify all revenues (energy, carbon, by-products, incentives, tax benefits)
4. Calculate IRR/NPV WITHOUT carbon revenue
5. Compare to benchmark (WACC + risk premium)
6. Sensitivity analysis (±10-20% key variables)
7. If IRR < benchmark → Additional (investment analysis passes)
```

**Benchmark Rates (Post-Tax Real IRR):**
| Region/Sector | Benchmark |
|---------------|-----------|
| India RE | 12-14% |
| India Industrial | 14-16% |
| Forestry | 8-12% |
| International | 10-12% (+ country risk) |

**Key Modeling Requirements:**
| Component | Requirement |
|-----------|-------------|
| **CAPEX** | All costs (EPC, land, permits, interconnection, contingency) |
| **OPEX** | Fixed + variable; escalation; major maintenance |
| **Revenue** | Energy sales (PPA/merchant), carbon, by-products, tax incentives |
| **Degradation** | Solar 0.5-1%/yr; Wind 0.2-0.5%/yr; Battery 2-3%/yr |
| **Financing** | Debt/equity split; interest rate; tenor; DSCR covenants |
| **Tax** | Depreciation (accelerated for RE); MAT; GST; carbon tax implications |

**Sensitivity Analysis (Mandatory):**
| Variable | Range |
|---------|-------|
| CAPEX | ±10-20% |
| OPEX | ±10-20% |
| Energy Price | ±10-30% |
| Capacity Factor/PLF | ±5-10% |
| Carbon Price | $0 to $20/tCO2e |
| Discount Rate | ±1-2% |

**Common Investment Analysis Failures:**
1. **Nominal vs Real IRR confusion** — Use real IRR with real discount rate
2. **Omitting major costs** — Land, transmission, decommissioning, insurance
3. **Overoptimistic PLF/CF** — Use P50/P90, not nameplate
4. **Ignoring degradation** — Solar 0.5-1%/yr; Battery 2-3%/yr
5. **Including carbon revenue in base case** — Must be excluded from "without carbon" case
6. **Wrong benchmark** — Use post-tax real WACC + risk premium

### 7.1.1.4 Barrier Analysis — When Investment Analysis Fails

**When to Use:** Investment analysis fails (IRR ≥ benchmark without carbon) OR project structure makes IRR meaningless (e.g., regulated tariff, non-profit).

**Barrier Types (CDM Tool 01 / VCS VT0001 / GS Toolkit):**
| Barrier Type | Description | Evidence Required |
|--------------|-------------|-------------------|
| **Investment** | No access to capital; high cost of capital; small scale | Financing rejections; cost of capital > benchmark |
| **Technological** | First-of-kind; unproven at scale; lack of local expertise | Tech risk studies; expert opinions; pilot data |
| **Institutional** | Regulatory uncertainty; permitting delays; policy risk | Permit timelines; regulatory track record |
| **Social/Cultural** | Community opposition; lack of skilled labor | Social assessments; stakeholder letters |
| **Ecological** | Land tenure; biodiversity constraints | Land titles; biodiversity assessments |

**Barrier + Carbon = Additionality Logic:**
```
1. Barrier exists that prevents project implementation
2. Carbon revenue specifically addresses/removes the barrier
3. Without carbon revenue, barrier remains → project doesn't proceed
4. ∴ Carbon finance is decisive (but-for test satisfied)
```

**Evidence Requirements per Barrier:**
| Barrier | Minimum Evidence |
|---------|------------------|
| Investment | Term sheets showing rejection; cost of capital studies |
| Technological | Feasibility studies; expert opinions; pilot results |
| Institutional | Permit timelines; regulatory correspondence; legal opinions |
| Social | Community meeting minutes; grievance logs; NGO letters |
| Ecological | Land title searches; biodiversity surveys; FRA claims |

### 7.1.1.5 Common Practice Analysis

**Method (CDM Tool 01 / VCS VT0001 / GS Toolkit):**
```
1. Define "similar project" (technology, scale ±30%, region, vintage ±5 yr)
2. Count total similar projects in region
3. Count similar projects WITHOUT carbon finance
4. If >50% without carbon → NOT additional
5. If <20% without carbon → Supports additionality
```

**Data Sources:**
- National registries (CDM, VCS, GS, CDM pipeline)
- Industry associations (IWT, IWEA, CII)
- Government dashboards (MNRE, CEA, BEE)
- Academic literature, consultant databases

**India Context:** 
- India RE: >80% projects have carbon finance historically → common practice test often fails for mature tech (wind/solar)
- Solution: Use barrier analysis for mature tech; investment analysis for emerging tech

### 7.1.1.6 Evidence Hierarchy — What Validators Actually Check

| Evidence Tier | Examples | Weight |
|---------------|----------|--------|
| **Tier 1 (Primary)** | Signed contracts, audited financials, permits, meters | Highest |
| **Tier 2 (Secondary)** | Independent expert reports, government data, industry studies | High |
| **Tier 3 (Supporting)** | Internal memos, management representations, vendor quotes | Medium |
| **Tier 4 (Weak)** | "Management believes," unsourced claims, generic statements | Low |

**Evidence Quality Checklist:**
- [ ] All quantitative claims traceable to source document
- [ ] All assumptions explicitly stated and sourced
- [ ] Counterfactual clearly defined (what happens without project)
- [ ] No circular reasoning (carbon revenue proves additionality → additionality justifies carbon revenue)

### 7.1.1.6 Common Additionality Pitfalls

| Pitfall | Why It Fails | Fix |
|---------|--------------|-----|
| **"We need carbon revenue to be profitable"** | Not a structured test; no benchmark | Run investment analysis with benchmark |
| **"First of its kind in India"** | Not a recognized barrier type | Map to technological/institutional barrier |
| **"Carbon price makes IRR positive"** | Circular — carbon revenue in base case | Exclude carbon from "without" case |
| **"First mover disadvantage"** | Not a recognized barrier | Map to technological/institutional barrier |
| **"We couldn't get debt without carbon"** | Investment barrier — needs evidence | Provide term sheets showing rejection |
| **Common practice = "some projects exist"** | Must be >50% without carbon | Rigorous survey with defined criteria |

### 7.1.1.7 Professional Judgement Points
- **Investment analysis preferred** when financial model is robust; barrier analysis when financials are weak or regulated
- **Multiple tests strengthen case** — run investment analysis even if doing barrier analysis
- **Sensitivity analysis is not optional** — validators will test it
- **Document the counterfactual explicitly** — "Without carbon, X happens; with carbon, Y happens"
- **For India RE:** Grid parity often fails investment analysis → use barrier analysis (policy uncertainty, grid evacuation, land)

### 7.1.1.7 Practical Exercise: Additionality Workshop
*Scenario:* 50 MW solar project in Rajasthan. CAPEX: ₹350 Cr. PLF: 28%. Tariff: ₹3.50/kWh. OPEX: 2% CAPEX/yr. Benchmark IRR: 13%.
*Tasks:*
1. Run investment analysis (IRR without carbon)
2. Test sensitivity: PLF ±5%, Tariff ±10%, CAPEX ±15%
3. Determine if barrier analysis needed
4. Draft additionality argument with evidence map
*Time:* 45 min
*Deliverable:* Additionality assessment memo
*Rubric:* Calculation accuracy (40%), test application (30%), argument quality (30%)

**Knowledge Check:**
1. What is the typical benchmark IRR for Indian wind? (12-14% post-tax real)
2. When is barrier analysis preferred over investment analysis? (When IRR > benchmark without carbon)
3. What is "regulatory surplus" test? (Is project mandated by law? If yes → not additional)
4. What must happen to SBTi targets if base year changes? (Rebaselining + resubmission)

**Sources:**
1. CDM Tool 01: "Tool for the demonstration and assessment of additionality" (v07.0.0)
2. VCS VT0001: "Additionality" (v4.0)
3. CDM Methodological Tool 07: "Tool to calculate the emission factor for an electricity system"
4. CEA CO2 Baseline Database — User Guide
5. VCS VT0001 "Additionality" v4.0
6. BEE CCTS Guidelines (2023) — Additionality requirements

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC (Methodologies evolving) | Regulatory Review: Semi-annual*

---

### Lesson 7.1.2: Baseline Methodologies — Deep Dive
**Lesson Code:** C07.1.2
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** professional

**Learning Objectives:**
1. Construct methodology-compliant baseline scenarios for major project types (Bloom: Apply)
2. Apply baseline selection criteria: plausibility, conservativeness, data availability (Bloom: Evaluate)
3. Diagnose and fix common baseline errors that cause validation failures (Bloom: Analyze)

**Prerequisites:** C07.1.1, C06.2.1

**Why This Matters:**
The baseline is the counterfactual — what would have happened without the project. A flawed baseline means every credit issued is either hot air (over-estimation) or leaves money on the table (under-estimation). This lesson teaches you to construct baselines that are methodologically sound, conservative, and validation-ready.

**Core Concept: Baseline = Counterfactual; Conservativeness = Credibility**

### 7.1.2.1 Baseline Scenario — Definition & Role

**Definition:** The most plausible scenario representing GHG emissions/removals in the absence of the project activity.

**Baseline Functions:**
1. **Reference Scenario** — What happens without the project
2. **Emission Benchmark** — Baseline emissions = reference for ER calculation
3. **Additionality Anchor** — Additionality tested against baseline
4. **Verification Anchor** — Monitoring compares actual vs baseline

**Baseline Types (Methodology-Driven):**
| Type | Description | Typical Use |
|--------|-------------|-------------|
| **Historical** | Past emissions/removals (3-5 yr avg) | IFM, some RE |
| **Projected** | Modeled future (BAU, policy, tech trends) | REDD+, IFM, RE |
| **Benchmark/Performance** | Industry/regional benchmark | Industrial EE, some RE |
| **Dynamic/Updated** | Periodically revised (e.g., grid EF) | Grid-connected RE |

### 7.1.2.2 Mandatory Baseline Criteria (GHG Protocol / ISO 14064-2)

| Criterion | Test | Failure Consequence |
|-----------|------|---------------------|
| **Plausibility** | Most likely scenario without project | Implausible → over/under estimation |
| **Conservativeness** | Does not overestimate reductions | Non-conservative → over-crediting |
| **Data Availability** | Reliable, verifiable data sources | Unverifiable → unquantifiable |
| **Consistency** | Aligns with national/sectoral policies | Inconsistent → policy risk |
| **Transparency** | Assumptions, data, methods documented | Opaque → unverifiable |

### 7.1.2.2 Baseline by Project Type — Methodology Guide

| Project Type | Baseline Approach | Key Parameters | Common Pitfalls |
|--------------|-------------------|----------------|-----------------|
| **Grid RE** | Grid EF (OM/BM/CM) | EF_grid, generation, losses | Wrong EF version; ignoring losses |
| **Off-grid RE** | Diesel generator baseline | Fuel consumption, EF_diesel | Overestimating diesel use |
| **Industrial EE** | SEC baseline | Production, SEC_baseline | Wrong product mix; boundary |
| **Fuel Switch** | Pre-project fuel EF | Fuel consumption, EF_old | Ignoring efficiency gains |
| **Cement/Lime** | Clinker factor × calcination EF | Clinker production, CaO% | Wrong clinker factor; CKD |
| **REDD+** | Historical deforestation × carbon stock | Deforestation rate, carbon stock | Baseline period; leakage belt |
| **ARR** | Baseline = 0 (degraded land) | Land eligibility proof | Non-degraded land claimed |
| **IFM** | Harvest regime baseline | Harvest volume, growth models | Over-harvest baseline |
| **Cookstoves** | Baseline stove efficiency × fuel | Stove efficiency, fuel use | Usage monitoring; leakage |

### 7.1.2.3 Grid Emission Factor — The RE Baseline Workhorse

**Three Methods (CDM Tool 07 / AMS-I.D):**
| Method | Formula | Data Needs | Use Case |
|----------|---------|------------|----------|
| **Operating Margin (OM)** | Σ (Gen_i × EF_i) / Σ Gen_i | Plant-level gen, EF | Marginal plants |
| **Build Margin (BM)** | Σ (New_Cap_i × EF_i) / Σ New_Cap_i | New capacity additions | New capacity |
| **Combined Margin (CM)** | w_OM × EF_OM + w_BM × EF_BM | Both | Default for most RE |

**Combined Margin (Default):**
```
EF_grid = w_OM × EF_OM + w_BM × EF_BM
Typical: w_OM = 0.75, w_BM = 0.25 (or 0.5/0.5)
```

**India Context (CEA CO2 Baseline Database):**
- Publishes annual OM, BM, CM for Indian grid
- State-level EFs available
- Updates annually (2-3 year lag)
- **2023-24 CM:** 0.71 kgCO2/kWh

### 7.1.2.4 Baseline Construction — Step-by-Step

**Step 1: Identify Candidate Baselines**
```
List all plausible alternatives:
1. Project not implemented (status quo)
2. Alternative technology (e.g., gas instead of coal)
3. Regulatory compliance (minimum legal requirement)
4. Common practice in region/sector
```

**Step 2: Apply Applicability Conditions**
```
For each candidate:
  ✓ Does methodology allow this baseline type?
  ✓ Is data available for quantification?
  ✓ Is it conservative (not overestimating ERs)?
```

**Step 3: Justify Selection**
```
Document:
- Why this baseline is most plausible
- Why alternatives are less plausible
- Data sources and assumptions
- Conservative assumptions used
```

### 7.1.2.5 Baseline by Project Type — Quick Reference

| Project Type | Baseline Approach | Key Parameters | Conservativeness Check |
|--------------|-------------------|----------------|------------------------|
| **Grid RE** | Grid EF (CM) | EF_grid, generation, losses | Use latest CEA CM; include T&D losses |
| **Off-grid RE** | Diesel generator | Fuel consumption, EF_diesel | Actual vs rated efficiency |
| **Industrial EE** | SEC baseline | Production, SEC_baseline | Pre-project data ≥ 3 yrs |
| **Fuel Switch** | Pre-project fuel EF | Fuel consumption, EF_old | Actual vs rated efficiency |
| **Cement/Lime** | Clinker factor × calcination EF | Clinker production, CaO% | Include CKD; conservative CaO% |
| **REDD+** | Hist. deforestation × carbon stock | Deforestation rate, carbon stock maps | Baseline period; leakage belt |
| **ARR** | Baseline = 0 (degraded land) | Land eligibility proof | Degradation proof required |
| **IFM** | Harvest regime baseline | Harvest volume, growth models | Conservative growth rates |
| **Cookstoves** | Baseline stove efficiency × fuel | Stove efficiency, fuel use | Usage monitoring; leakage |

### 7.1.2.5 Baseline Validation — Common Errors & Fixes

| Error | Detection | Fix |
|-------|-----------|-----|
| **Wrong EF version** | AR4 vs AR5 vs AR6 GWP mismatch | EF version control; methodology spec |
| **Non-conservative EF** | Using optimistic EF | Use lower bound of uncertainty range |
| **Missing Losses** | No T&D losses for RE | Include T&D, auxiliary, availability |
| **Baseline Drift** | Not updating dynamic baselines | Annual EF update per methodology |
| **Double Counting** | Baseline overlaps with project | Clear boundary definition |
| **Baseline = Project** | Circular logic | Independent baseline justification |

### 7.1.2.6 Professional Judgement Points
- **Multiple baseline options:** Choose most conservative (lowest ERs)
- **Dynamic baselines:** Update annually for grid RE per methodology
- **Historical data gaps:** Use conservative estimates + uncertainty
- **For India RE:** Use CEA CM EF; update annually; document version
- **For India Industry:** BEE PAT baselines = starting point; verify currency

### 7.1.2.6 Practical Exercise: Baseline Construction Workshop
*Scenario:* 100 MW solar plant in Gujarat. 2,100 kWh/kWp/yr. Grid import backup. CEA CM EF: 0.71 kgCO2/kWh. State T&D loss: 18%. Plant availability: 99%. Degradation: 0.7%/yr.
*Tasks:*
1. Calculate baseline EF (location-based + market-based)
2. Apply T&D losses, availability, degradation
3. Calculate 25-year ER projection with degradation
4. Document assumptions and sources for each parameter
*Time:* 40 min
*Deliverable:* Baseline calculation workbook + assumption log
*Rubric:* Calculation accuracy (40%), assumption documentation (30%), conservativeness (30%)

**Knowledge Check:**
1. What is the Combined Margin formula? (w_OM × EF_OM + w_BM × EF_BM)
2. What is the typical weight for OM vs BM in CM? (0.75/0.25 or 0.5/0.5)
3. Why use NCV not GCV for EF calculations? (IPCC standard; excludes latent heat not recovered)
4. What triggers baseline recalculation? (Methodology change, structural change, error >5%)

**Sources:**
1. CDM Tool 07: "Tool to calculate the emission factor for an electricity system"
2. VCS Standard v4.4 — Section 3.4 (Baseline)
3. CEA CO2 Baseline Database — User Guide
4. VCS Standard v4.4 — Section 3.4
4. BEE CCTS Guidelines (2023) — Baseline requirements
5. IPCC 2006 Guidelines Volume 2, Chapter 2 (Stationary Combustion)

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC (Methodologies evolving) | Regulatory Review: Semi-annual*

---

### Lesson 7.1.3: Baseline Integrity & Conservativeness
**Lesson Code:** C07.1.3
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** professional

**Learning Objectives:**
1. Apply conservativeness principles to baseline construction (Bloom: Apply)
2. Quantify and manage baseline uncertainty (Bloom: Analyze)
3. Implement baseline version control and recalculation triggers (Bloom: Create)

**Prerequisites:** C07.1.1, C07.1.2

**Why This Matters:**
A baseline that isn't conservative isn't just wrong — it creates hot air credits that undermine the entire market. Regulators, verifiers, and buyers all check for conservativeness. This lesson teaches you to build baselines that are defensibly conservative without being unnecessarily punitive.

**Core Concept: Conservativeness = Not Overestimating Reductions**

### 7.1.3.1 Conservativeness Principles — The Golden Rules

**Core Principle (GHG Protocol / ISO 14064-2 / IPCC):**
> When faced with uncertainty, choose the option that does NOT overestimate emission reductions or removals.

**Conservativeness Hierarchy (Priority Order):**
1. **Methodology Compliance** — Follow methodology default conservative assumptions
2. **Parameter Selection** — Choose lower-bound estimates for ER drivers
3. **Uncertainty Treatment** — Propagate uncertainty; don't ignore it
4. **Scenario Selection** — Choose scenario yielding lowest ERs (when options exist)

### 7.1.3.1 Conservativeness in Practice — Parameter by Parameter

| Parameter | Conservative Choice | Non-Conservative (Avoid) |
|-----------|---------------------|--------------------------|
| **Grid EF** | Latest CEA CM (highest recent) | Older EF; OM-only |
| **Fuel EF** | Lower-bound carbon content; higher oxidation | Default IPCC upper bound |
| **Oxidation Factor** | 0.98 (coal) / 0.995 (gas) | 1.0 (complete oxidation) |
| **Capacity Factor** | P90/P99 (not P50) | Nameplate × 8760h |
| **Degradation** | Higher rate (0.7% vs 0.5% for solar) | Zero degradation |
| **Availability** | Historical P90 | Nameplate 100% |
| **Losses** | Higher T&D loss %; higher auxiliary | Ignoring losses |
| **Leakage** | Higher leakage factor | Zero leakage assumption |
| **GWP** | Latest AR6 values | AR4/AR5 (lower for CH4/N2O) |
| **Lifetime** | Shorter credible lifetime | Extended without evidence |

### 7.1.3.2 Conservativeness in Calculations — Step-by-Step

**Rule:** Every multiplication/division step must be conservative.

**Example — Solar ER Calculation:**
```
Conservative ER = Capacity × P90_CF × 8760 × (1 - Degradation_High) 
                  × (1 - Availability_Low) × (1 - Losses_High) 
                  × Grid_EF_High
```

**Conservative Choices per Factor:**
| Factor | Conservative Value | Source |
|--------|-------------------|--------|
| Capacity Factor | P90 (not P50) | SolarGIS/PVsyst P90 |
| Degradation | 0.7%/yr (vs 0.5% typical) | Warranty + literature |
| Availability | 97% (vs 99% nameplate) | Historical fleet data |
| Losses | 15% (vs 12% typical) | AC/DC + wiring + soiling + temp |
| Grid EF | CEA CM (latest) | CEA annual report |

### 7.1.3.2 Conservativeness vs Accuracy — The Balance

**Principle:** Be conservative, not punitive. Overly conservative baselines waste project value and discourage investment.

**Test:** "Would a reasonable, informed third party agree this is conservative but not absurd?"

**Documentation Requirement:** For each conservative choice, document:
1. What was chosen
2. Why it's conservative (vs alternative)
3. Source of the conservative value
4. Magnitude of conservatism (% impact on ERs)

### 7.1.3.3 Uncertainty Management in Baselines

**Uncertainty Propagation (Tier 1 — Analytical):**
```
For E = A × B:
u_rel(E)² = u_rel(A)² + u_rel(B)²

For E = A + B:
u_abs(E)² = u_abs(A)² + u_abs(B)²
```

**Example — Solar ER Uncertainty:**
```
E = Capacity × CF × 8760 × (1-Degradation) × (1-Losses) × Grid_EF

u_rel(E)² = u(Cap)² + u(CF)² + u(Degrad)² + u(Losses)² + u(Grid_EF)²
```

**Typical Uncertainty Contributions (Solar):**
| Source | u_rel | Contribution |
|--------|-------|--------------|
| Grid EF | 5% | 25% |
| Capacity Factor (P90) | 4% | 16% |
| Degradation | 2% | 4% |
| Losses | 3% | 9% |
| Availability | 2% | 4% |
| **Combined** | **~7.5%** | **100%** |

### 7.1.3.3 Baseline Version Control & Recalculation Triggers

**Version Control System:**
| Component | Versioning | Trigger |
|-----------|------------|---------|
| **EF Library** | Semantic version (v1.0, v1.1) | New CEA report; IPCC AR update |
| **Baseline Methodology** | Git tags (baseline_v1.0) | Methodology update; structural change |
| **Parameter Values** | Timestamped snapshots | Annual EF update; policy change |
| **Calculation Engine** | Semantic version | Code change; formula fix |

**Recalculation Triggers (Mandatory per GHG Protocol):**
| Trigger | Threshold | Action |
|---------|-----------|--------|
| **Structural Change** | Merger/acquisition/divestiture >5% base yr | Full recalculation |
| **Methodology Change** | New EF source; GWP update; methodology rev | Recalculate affected years |
| **Boundary Change** | New facility; boundary expansion | Recalculate from change date |
| **Error Correction** | Material error >5% of category | Recalculate + restate |

### 7.1.3.3 Professional Judgement Points
- **Conservative ≠ Pessimistic:** Choose lower-bound of reasonable range, not worst-case
- **Document every conservative choice:** "Chose X because Y; impact = Z% lower ERs"
- **Don't double-count conservatism:** If EF is conservative, don't also reduce capacity factor conservatively for same risk
- **For India RE:** Use CEA CM EF (not OM); update annually; document version
- **For India Coal:** Use GCV-based EF with Indian coal GCV (not IPCC default)

### 7.1.3.3 Practical Exercise: Conservativeness Audit
*Scenario:* Review a 100 MW solar project baseline. Current assumptions: Capacity 100 MW, CF 22% (P50), Degradation 0.5%, Availability 99%, Losses 12%, Grid EF 0.71 (CEA 2022).
*Tasks:*
1. Identify non-conservative assumptions
2. Propose conservative alternatives with sources
3. Calculate ER impact of changes
4. Document conservatism log for verifier
*Time:* 35 min
*Deliverable:* Conservativeness audit report
*Rubric:* Identification accuracy (40%), alternative justification (30%), impact quantification (30%)

**Knowledge Check:**
1. What is the difference between conservative and pessimistic? (Conservative = lower bound of reasonable; Pessimistic = worst case)
2. Why use P90 capacity factor instead of P50? (P90 = 90% probability of exceedance = conservative)
3. Can you apply conservatism to both EF and capacity factor for same risk? (No — double counting)
4. What GWP version should new inventories use? (AR6 — latest IPCC)

**Sources:**
1. GHG Protocol — Conservativeness Principle
2. ISO 14064-2:2019 — Annex B (Conservativeness)
3. IPCC 2006 Guidelines — Volume 1, Chapter 3 (Uncertainties)
4. VCS Standard v4.4 — Conservativeness Requirements
5. CEA CO2 Baseline Database — Methodology
5. BEE CCTS Guidelines (2023) — Conservativeness

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC (EF updates, methodology revisions) | Regulatory Review: Annual*