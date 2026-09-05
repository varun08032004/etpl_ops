# C07: Additionality & Baselines
## Module 7.3: Baseline Integrity & Conservativeness (3 lessons × 40min = 2h)

### Lesson 7.3.1: Baseline Integrity & Conservativeness
**Lesson Code:** C07.3.1
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

### 7.3.1.1 Conservativeness Principles — The Golden Rules

**Core Principle (GHG Protocol / ISO 14064-2 / IPCC):**
> When faced with uncertainty, choose the option that does NOT overestimate emission reductions or removals.

**Conservativeness Hierarchy (Priority Order):**
1. **Methodology Compliance** — Follow methodology default conservative assumptions
2. **Parameter Selection** — Choose lower-bound estimates for ER drivers
3. **Uncertainty Treatment** — Propagate uncertainty; don't ignore it
4. **Scenario Selection** — Choose scenario yielding lowest ERs (when options exist)

### 7.3.1.1 Conservativeness in Practice — Parameter by Parameter

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

### 7.3.1.2 Conservativeness in Calculations — Step-by-Step

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

### 7.3.1.2 Conservativeness vs Accuracy — The Balance

**Principle:** Be conservative, not punitive. Overly conservative baselines waste project value and discourage investment.

**Test:** "Would a reasonable, informed third party agree this is conservative but not absurd?"

**Documentation Requirement:** For each conservative choice, document:
1. What was chosen
2. Why it's conservative (vs alternative)
3. Source of the conservative value
4. Magnitude of conservatism (% impact on ERs)

### 7.3.1.3 Uncertainty Management in Baselines

**Uncertainty Propagation (Tier 1 — Analytical):**
```
For E = A × B:
u_rel(E)² = u_rel(A)² + u_rel(B)²

For E = A + B:
u_abs(E)² = u_abs(A)² + u_abs(B)²
```

**Example — Emission = Activity × EF:**
```
u_rel(E)² = u_rel(Activity)² + u_rel(EF)²
```
If Activity uncertainty = 3%, EF uncertainty = 10% → u_rel(E) = √(0.03² + 0.10²) = 10.4%

**Correlated Variables (Covariance):**
```
u²(z) = Σ u²(x_i) + 2 Σ Σ ρ_ij u(x_i) u(x_j)
```
Where ρ_ij = correlation coefficient (-1 to 1)

### 7.3.1.4 Tier 2 — Monte Carlo Simulation

**When Required:**
- Non-linear models
- Correlated inputs
- Asymmetric distributions
- Regulatory requirement (complex categories)

**Monte Carlo Steps:**
1. Define probability distributions for all inputs
2. Define correlation matrix
3. Generate N samples (N=10,000-100,000) using Cholesky decomposition
4. Run calculation for each sample
5. Analyze output distribution (mean, median, percentiles, CI)

**Input Distribution Types:**
| Parameter | Typical Distribution | Parameters |
|-----------|---------------------|------------|
| **Activity Data (metered)** | Normal | Mean=reading, σ=meter accuracy |
| **Activity Data (estimated)** | Triangular | Min, Mode, Max |
| **EF (measured)** | Normal | Mean=EF, σ=measurement uncertainty |
| **EF (default)** | Lognormal | Geometric mean, geometric σ |
| **Oxidation Factor** | Beta | α, β from range [0.95, 1.0] |
| **Leak Rate** | Triangular | Min, Mode, Max from literature |

**Monte Carlo Output:**
- Mean, Median, Standard Deviation
- 95% Confidence Interval (2.5th, 97.5th percentiles)
- Percentiles (5th, 25th, 50th, 75th, 95th)
- Sensitivity Analysis (variance decomposition)

### 7.3.1.5 Uncertainty Budget — Per Category

**Uncertainty Budget Template:**
| Input | Value | Distribution | u_rel or u_abs | Sensitivity (∂E/∂x) | Contribution to u(E)² | % of Total |
|------|-------|--------------|----------------|---------------------|----------------------|------------|
| Activity (metered) | 1000 t | Normal | 1% | EF | (EF × 0.01)² | 4% |
| EF (national) | 2.5 tCO2/t | Lognormal | 10% | Activity | (Act × 0.10)² | 85% |
| Oxidation Factor | 0.98 | Beta(α,β) | 1% | Act×EF | (Act×EF×0.01)² | 1% |
| **Combined** | | | | | **u_rel = 10.2%** | 100% |

**Uncertainty Budget per Scope:**
| Scope | Typical u_rel | Dominant Source |
|-------|---------------|-----------------|
| **Scope 1 (metered)** | 3-8% | EF uncertainty |
| **Scope 2 (metered)** | 2-5% | Grid EF uncertainty |
| **Scope 3 (Cat 1)** | 20-40% | EF + allocation |
| **Scope 3 (Cat 11)** | 20-50% | Lifetime + usage + EF |
| **Scope 3 (Cat 15)** | 30-60% | Investee data quality |

### 7.3.1.6 Uncertainty in Verification & Targets

**Verification Level vs Uncertainty:**
| Scope | Typical u_rel | Verification Level Supported |
|-------|---------------|------------------------------|
| Scope 1 | 3-8% | Reasonable |
| Scope 2 | 2-5% | Reasonable |
| Scope 3 | 20-50% | Limited (unless key categories <15%) |

**SBTi Target Setting with Uncertainty:**
- Targets must be set on **best estimate** (not upper bound)
- Uncertainty reported alongside target
- Progress tracking uses best estimate
- Uncertainty reduction = data quality improvement target

### 7.3.1.6 Using Uncertainty to Prioritize Improvements

**Variance Decomposition (Sobol Indices / Regression):**
```
Total Variance = Σ Contribution_i + Interaction Terms
Priority = Contribution_i / Total Variance
```

**Improvement Prioritization Matrix:**
| Category | Current u_rel | Variance Contribution | Improvement Cost | Priority |
|----------|---------------|----------------------|------------------|----------|
| Scope 1 EF | 10% | 75% | Medium (primary EF) | HIGH |
| Scope 3 Cat 1 | 35% | 60% | High (supplier engagement) | HIGH |
| Scope 2 Grid EF | 3% | 5% | Low (CEA publishes) | LOW |
| Scope 3 Cat 11 | 40% | 55% | High (engineering) | MEDIUM |

**Investment Rule:** Target highest variance contribution per rupee invested.

### 7.3.1.6 Professional Judgement Points
- **Don't over-precision:** Report uncertainty to 1-2 significant figures (e.g., 12%, not 12.34%)
- **Correlations matter:** Fuel price & consumption often negatively correlated
- **Scope 3 uncertainty:** Don't hide it — disclose, explain, prioritize reduction
- **Verification level:** High Scope 3 uncertainty → Limited assurance for Scope 3
- **Target tracking:** Use best estimate for progress; report uncertainty band

### 7.3.1.6 Professional Judgement Points
- **Don't hide uncertainty:** Transparency > false precision
- **Correlations:** Fuel consumption & price often negatively correlated
- **Scope 3 uncertainty:** Disclose, explain, prioritize reduction
- **Verification level:** High Scope 3 uncertainty → Limited assurance acceptable
- **Target tracking:** Use best estimate for progress; report uncertainty band

### 7.3.1.6 Practical Exercise: Uncertainty Budget Workshop
*Scenario:* Cement plant: 2 Mt/yr clinker. Scope 1: Coal 500 kt (GCV 4200±100 kcal/kg, C=45%±2%), EF uncertainty 10%. Scope 2: Grid 50 GWh (EF 0.71±0.035 kgCO2/kWh). Scope 3 Cat 1: ₹300 Cr purchases (EEIO ±40%).
*Tasks:*
1. Build uncertainty budget for Scope 1, 2, Cat 1
2. Calculate combined uncertainty for total emissions
3. Identify top 3 variance contributors
4. Recommend 2 data quality investments with ROI
*Time:* 45 min
*Deliverable:* Uncertainty budget + investment memo
*Rubric:* Budget accuracy (40%), variance decomposition (30%), investment logic (30%)

**Knowledge Check:**
1. How do you combine uncertainties for E = A × EF? (Quadrature: u_rel² = u_A² + u_EF²)
2. When is Monte Carlo required over analytical? (Non-linear, correlated, asymmetric)
3. What is the typical uncertainty for Scope 3 Cat 1 using EEIO? (±40-50%)
4. How does uncertainty affect SBTi target setting? (Targets set on best estimate; uncertainty reported alongside)

**Sources:**
1. IPCC 2006 Guidelines — Volume 1, Chapter 3 (Uncertainties)
2. ISO 14064-1:2018 — Annex B (Uncertainty)
3. GHG Protocol — Uncertainty Guidance
4. IPCC 2006 Guidelines — Volume 1, Chapter 3 (Uncertainties)
4. ISO 14064-1:2018 — Annex B
5. SBTi Corporate Manual — Uncertainty in Target Setting

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC (Monte Carlo tools evolving) | Regulatory Review: Quarterly*

---

### Lesson 7.3.2: Baseline Recalculation & Version Management
**Lesson Code:** C07.3.2
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** professional

**Learning Objectives:**
1. Apply mandatory recalculation triggers per GHG Protocol and standards (Bloom: Apply)
2. Implement baseline version control with immutable audit trail (Bloom: Create)
3. Manage baseline changes across vintage boundaries and portfolio (Bloom: Analyze)

**Prerequisites:** C07.1.1, C07.1.2

**Why This Matters:**
Baselines aren't static. Structural changes, methodology updates, and error corrections all trigger mandatory recalculations. Without version control, you can't prove what baseline was used for which vintage — a fatal audit finding. This lesson teaches you to build a baseline version control system that survives audit scrutiny.

**Core Concept: Baseline Version = Immutable Contract for Each Vintage**

### 7.3.2.1 Mandatory Recalculation Triggers (GHG Protocol / ISO 14064-2)

**Threshold:** >5% of base year emissions (any scope) or any structural change

| Trigger Category | Specific Events | Action Required |
|------------------|-----------------|-----------------|
| **Structural Changes** | Merger, acquisition, divestiture >5% base yr emissions | Recalculate base year + all subsequent years |
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

### 7.3.2.2 Recalculation Procedure

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

5. DOCUMENT
   → Recalculation log: trigger, scope, old vs new values, rationale
   → Update all prior public reports (restatement)

6. TARGET ADJUSTMENT
   → If base year emissions change → adjust absolute target
   → SBTi: targets must be rebaselined if base year changes
   → Intensity targets: denominator may need adjustment

7. COMMUNICATE
   → Internal: management, board
   → External: stakeholders, CDP, SBTi, regulators
   → Transparency: old vs new, rationale, impact
```

### 7.3.2.3 Baseline Version Control System

**Governance Structure:**
| Role | Responsibility |
|---------|---------------|
| **Baseline Owner** | Sustainability/ESG lead — accountable for integrity |
| **Data Custodians** | Scope owners — data quality, completeness |
| **Methodology Keeper** | Methodology versions, EF library, GWP versions |
| **Audit Coordinator** | Verification liaison, recalculation coordination |

**System Components:**
| Component | Tool/Process |
|-----------|--------------|
| **Base Year Registry** | Locked record: year, emissions, methodology version, GWP version |
| **Change Log** | Immutable append-only log of all changes |
| **Methodology Versioning** | Git tags (baseline_v1.0) |
| **EF Library Versioning** | Timestamped EF library per inventory year |
| **Recalculation Engine** | Automated re-run of prior years with new params |
| **Audit Trail** | Immutable evidence package per inventory year |

### 7.3.2.4 Baseline Change Management — Portfolio Level

**Portfolio Baseline Dashboard:**
| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| **Pending Recalculations** | 0 | > 0 = Alert |
| **Version Drift** | 0 (all projects current) | > 0 = Alert |
| **Recalculation Impact** | < 5% portfolio ER change | > 10% = Escalate |
| **Vintage Coverage** | 100% vintages have locked baseline | < 100% = Alert |

### 7.3.2.4 Professional Judgement Points
- **Borderline structural change (4.9%):** Recalculate anyway — conservatism builds credibility
- **Multiple triggers in one year:** Single comprehensive recalculation, not sequential
- **Historical data gaps for new acquisition:** Use estimation with clear uncertainty; flag for improvement
- **Divestiture:** Remove from base year; document as structural change
- **Merger of equals:** New entity = new base year (both recalculate)

### 7.3.2.4 Practical Exercise: Recalculation Workshop
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
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC (EF updates, methodology revisions) | Regulatory Review: Annual*

---

### Lesson 7.3.3: Advanced Baseline Topics — Dynamic, Nested & Sectoral
**Lesson Code:** C07.3.3
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** professional

**Learning Objectives:**
1. Design dynamic baselines for grid-connected and policy-responsive projects (Bloom: Create)
2. Navigate nested baselines: project-level within jurisdictional/regional (Bloom: Analyze)
3. Apply sector-specific baseline approaches: industrial, AFOLU, waste, transport (Bloom: Apply)

**Prerequisites:** C07.1.1, C07.1.2, C07.2.1

**Why This Matters:**
Advanced projects — grid-responsive RE, nested jurisdictional programs, sectoral crediting — require baseline architectures that go beyond static project-level counterfactuals. This lesson equips you to design and validate these complex baseline architectures.

**Core Concept: Advanced Baselines = Dynamic + Nested + Sectoral**

### 7.3.3.1 Dynamic Baselines — Grid-Responsive & Policy-Responsive

**When Required:**
- Grid-connected RE with evolving grid EF
- Projects in jurisdictions with evolving policies (CCTS, Article 6)
- Long-crediting-period projects (>15 years) where baseline drift matters

**Dynamic Baseline Architecture:**
```
Static Component (Fixed at Validation)
  ├── Project boundary (geographic, temporal, GHG, pools)
  ├── Methodology version (locked)
  └── Initial parameter values (documented)

Dynamic Component (Updated per Monitoring Period)
  ├── Grid EF (annual CEA CM update)
  ├── Policy parameters (CCTS baselines, Art 6.4 rules)
  ├── Market parameters (fuel prices, carbon price for additionality)
  └── Technology parameters (degradation curves, efficiency curves)
```

**Dynamic Baseline Governance:**
| Component | Update Frequency | Authority | Validation |
|-----------|------------------|-----------|------------|
| **Grid EF** | Annual (CEA release) | CEA | Verifier checks version |
| **Policy Parameters** | Per regulation change | BEE/Ministry | Legal review |
| **Market Parameters** | Quarterly | Market data provider | Internal QC |
| **Technology Curves** | Annual | OEM/Industry | Engineering review |

**Dynamic Baseline in PDD:**
```
Baseline = f(Static_Params, Dynamic_Params(t))
Where Dynamic_Params(t) are referenced by version/date, not hardcoded
```

### 7.3.3.2 Nested Baselines — Project within Jurisdictional

**Nested Architecture (e.g., Jurisdictional REDD+ + Project-level):**
```
Level 1: Jurisdictional Baseline (National/State)
  ├── Historical deforestation rate (10-20 yr)
  ├── Reference level (submitted to UNFCCC/Art 6.4)
  └── Allocation method to projects

Level 2: Project Baseline (Nested within Jurisdictional)
  ├── Project boundary ⊆ Jurisdiction
  ├── Project-specific drivers (local leakage, specific threats)
  └── Allocation: Project ER = Jurisdictional ER × Project Share
```

**Allocation Methods:**
| Method | Formula | When Used |
|--------|---------|-----------|
| **Area-Based** | Project Area / Jurisdiction Area | Uniform threat |
| **Historical Deforestation** | Project Hist Defor / Juris Hist Defor | Historical data available |
| **Threat-Based** | Project Threat Index / Juris Threat Index | Driver data available |
| **Carbon Stock** | Project Carbon Stock / Juris Carbon Stock | Homogeneous forests |

**Double Counting Prevention:**
- Jurisdictional ERs = Σ Project ERs + Unallocated
- Registry tracks: Jurisdictional credits issued - Project credits issued = Unallocated
- Corresponding adjustments at both levels

### 7.3.3.3 Sector-Specific Baseline Architectures

#### Industrial Sector (Cement, Steel, Chemicals)
| Element | Approach |
|---------|----------|
| **Baseline Type** | Benchmark / Performance Standard |
| **Key Metric** | tCO2/t product (e.g., tCO2/t cement) |
| **Benchmark Source** | Industry avg (BEE PAT), BAT, Top 10% |
| **Dynamic Element** | Benchmark tightening per methodology schedule |
| **Allocation** | Production × (Baseline SEC - Project SEC) |

#### AFOLU (Forestry, Agriculture, Blue Carbon)
| Element | Approach |
|---------|----------|
| **Baseline Type** | Historical / Projected / Benchmark |
| **Key Parameters** | Deforestation rate, Carbon stock, Growth curves |
| **Dynamic Elements** | Forest cover maps (annual), Carbon price (additionality) |
| **Leakage** | Leakage belt monitoring (satellite + ground) |

#### Waste Sector (Landfill Gas, Wastewater, Composting)
| Element | Approach |
|---------|----------|
| **Baseline** | First-order decay model (FOD) / IPCC defaults |
| **Key Parameters** | Waste quantity, DOC, MCF, k-value, oxidation factor |
| **Dynamic** | Waste composition surveys (annual); gas capture efficiency |

#### Transport Sector
| Element | Approach |
|---------|----------|
| **Baseline** | Vehicle-km × EF_vehicle_type (baseline fleet) |
| **Project** | Project fleet × EF_project_fleet |
| **Dynamic** | Fleet turnover; fuel standards; EV adoption curves |

### 7.3.3.3 Professional Judgement Points
- **Dynamic baselines:** Update annually for grid EF; document version per vintage
- **Nested baselines:** Ensure jurisdictional reference level is registered and immutable
- **Sector benchmarks:** Use most recent BAT/BPT; document source and vintage
- **For India:** BEE PAT baselines = starting point; CCTS methodology = regulatory baseline

### 7.3.3.3 Practical Exercise: Advanced Baseline Design
*Scenario:* Design baseline for a 50 MW wind-solar hybrid project in Gujarat with 50 MWh battery storage. Grid EF evolving (CEA CM declining 2%/yr). Project participates in CCTS.
*Tasks:*
1. Design static vs dynamic baseline components
2. Define update triggers and governance for dynamic parameters
3. Model 25-year ER trajectory with declining grid EF
4. Draft baseline governance clause for PDD
*Time:* 45 min
*Deliverable:* Baseline architecture document + dynamic parameter register
*Rubric:* Architecture completeness (40%), dynamic logic (30%), governance (30%)

**Knowledge Check:**
1. What is the difference between static and dynamic baseline components? (Static = locked at validation; Dynamic = updated per monitoring period)
2. In nested baselines, how is double counting prevented? (Jurisdictional ERs = Σ Project ERs + Unallocated; registry tracks both)
3. For industrial benchmarks, what is the typical update cycle? (Methodology-defined, typically 3-5 years or per IPCC cycle)

**Sources:**
1. VCS Standard v4.4 — Section 3.4 (Baselines), Section 3.5 (Dynamic Baselines)
2. CDM Methodological Tool 07 — Grid EF
3. BEE PAT Guidelines (2023) — Sectoral Baselines
3. IPCC 2006 Guidelines — Volume 2 (Energy), Volume 4 (AFOLU)
4. ICVCM Core Carbon Principles (2023) — Principle 4 (Baseline)
5. Decision 2/CMA.3 — Article 6.4 Baseline Requirements

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC (Methodologies, policies evolving) | Regulatory Review: Quarterly*