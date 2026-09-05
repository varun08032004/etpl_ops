# C07: Additionality & Baselines
## Module 7.2: Baseline Methodologies (3 lessons × 40min = 2h)

### Lesson 7.2.1: Baseline Methodologies — Deep Dive
**Lesson Code:** C07.2.1
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

### 7.2.1.1 Baseline Scenario — Definition & Role

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

### 7.2.1.2 Baseline by Project Type — Methodology Guide

| Project Type | Baseline Approach | Key Applicability Criteria |
|--------------|-------------------|----------------------------|
| **Grid RE** | Grid EF (OM/BM/CM) | Grid-connected, additionality via barrier/investment |
| **Off-grid RE** | Diesel generator baseline | Off-grid, energy access |
| **Energy Efficiency** | SEC baseline | Measurable baseline, no fuel switch |
| **Waste Handling** | Methane avoidance | Methane GWP, measurement |
| **Forestry (ARR)** | Baseline = 0 (degraded land) | Land eligibility, permanence |
| **REDD+** | Historical deforestation rate × carbon stock | Jurisdictional vs project; leakage |
| **IFM** | Harvest regime baseline | Harvest reduction, leakage |
| **Blue Carbon** | Tidal wetland baseline | Tidal wetlands, soil carbon |
| **Soil Carbon** | Soil sampling baseline | Soil sampling, permanence |
| **Cookstoves** | Baseline stove efficiency × fuel | Usage monitoring, leakage |

### 7.2.1.3 Baseline Selection Criteria — Methodology Guide

| Criterion | Test | Failure Consequence |
|-----------|------|---------------------|
| **Plausibility** | Most likely scenario without project | Implausible → misleading trends |
| **Conservativeness** | Does not overestimate reductions | Non-conservative → over-crediting |
| **Data Availability** | Reliable, verifiable data sources | Unverifiable → unquantifiable |
| **Consistency** | Aligns with national/sectoral policies | Inconsistent → policy risk |

### 7.2.1.4 Baseline Construction — Step-by-Step

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

### 7.2.1.5 Baseline by Project Type — Quick Reference

| Project Type | Baseline Approach | Key Parameters |
|--------------|-------------------|----------------|
| **Grid RE** | Grid EF (OM/BM/CM) | EF_grid, generation |
| **Off-grid RE** | Diesel generator | Fuel consumption, EF_diesel |
| **Energy Efficiency** | SEC baseline | Production, SEC_baseline |
| **Fuel Switch** | Pre-project fuel EF | Fuel consumption, EF_old |
| **Cement/Lime** | Clinker factor × calcination EF | Clinker production, CaO% |
| **REDD+** | Historical deforestation × carbon stock | Deforestation rate, carbon stock maps |
| **ARR** | Baseline = 0 (degraded land) | Land eligibility proof |
| **IFM** | Harvest regime baseline | Harvest volume, growth models |
| **Cookstoves** | Baseline stove efficiency × fuel | Stove efficiency, fuel consumption |

### 7.2.1.6 Professional Judgement Points
- **Multiple baseline options:** Choose most conservative (lowest ERs)
- **Dynamic baselines:** Update annually for grid RE per methodology
- **Historical data gaps:** Use conservative estimates with clear uncertainty
- **For India RE:** Use CEA CM EF; update annually; document version
- **For India Industry:** BEE PAT baselines = starting point; verify currency

### 7.2.1.6 Practical Exercise: Baseline Construction Workshop
*Scenario:* 100 MW solar plant in Gujarat. 2,100 kWh/kWp/yr. Grid import backup. CEA CM EF: 0.71 kgCO2/kWh. State T&D loss: 18%. Plant availability: 99%. Degradation: 0.7%/yr.
*Tasks:*
1. Calculate baseline EF (location-based + market-based)
2. Apply T&D losses, availability, degradation
3. Calculate 25-year ER projection with degradation
4. Document assumptions and sources for each parameter
*Time:* 40 min
*Deliverable:* Baseline calculation workbook + assumption log
*Rubric:* Baseline logic (40%), EF selection (30%), assumption rigor (30%)

**Knowledge Check:**
1. What is the Combined Margin formula? (w_OM × EF_OM + w_BM × EF_BM)
2. What is the typical weight for OM vs BM in CM? (0.75/0.25 or 0.5/0.5)
3. Why use NCV not GCV for EF calculations? (IPCC standard; excludes latent heat not recovered)
4. What triggers baseline recalculation? (Methodology change, structural change, error >5%)

**Sources:**
1. CDM Tool 07: "Tool to calculate the emission factor for an electricity system"
2. VCS Standard v4.4 — Section 3.4 (Baseline)
3. CEA CO2 Baseline Database — User Guide
4. BEE CCTS Guidelines (2023) — Baseline requirements
5. IPCC 2006 Guidelines Volume 2, Chapter 2 (Stationary Combustion)

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC (Methodologies evolving) | Regulatory Review: Semi-annual*

---

### Lesson 7.2.2: Grid Emission Factors — Advanced Applications
**Lesson Code:** C07.2.2
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** professional

**Learning Objectives:**
1. Calculate and apply grid emission factors using OM, BM, and CM methods (Bloom: Apply)
2. Handle vintage-specific EFs, imports/exports, and marginal vs average distinctions (Bloom: Analyze)
3. Build an EF management system with version control and audit trail (Bloom: Create)

**Prerequisites:** C07.2.1, C05.1.1

**Why This Matters:**
Grid emission factors are the single most used — and most often misapplied — parameters in carbon accounting. Errors in EF selection, vintage, or methodology propagate to every credit issued. This lesson teaches you to master the EF lifecycle from selection to retirement.

**Core Concept: EF = Data + Methodology + Version + Context**

### 7.2.2.1 Grid EF Methods — OM, BM, CM Deep Dive

| Method | Formula | Best For | Limitations |
|--------|---------|----------|-------------|
| **Operating Margin (OM)** | Σ(Gen_i × EF_i) / Σ Gen_i | Existing grid mix | Ignores future build |
| **Build Margin (BM)** | Σ(New_Cap_i × EF_i) / Σ New_Cap_i | New capacity | Ignores existing fleet |
| **Combined Margin (CM)** | w_OM × EF_OM + w_BM × EF_BM | Most RE projects | Weight choice subjective |

**Weight Selection (CDM Tool 07 / VCS):**
| Approach | w_OM | w_BM | When to Use |
|----------|------|------|-------------|
| **Default** | 0.75 | 0.25 | General |
| **Conservative** | 0.5 | 0.5 | High RE penetration |
| **Regulatory** | Per regulation | Per regulation | CCTS, specific ETS |

### 7.2.2.2 India Grid EF — CEA Database Deep Dive

**CEA CO2 Baseline Database (Annual):**
| EF Type | 2022-23 | 2023-24 | Unit | Source |
|---------|---------|---------|------|--------|
| **OM (Simple)** | 0.91 | 0.89 | kgCO2/kWh | CEA |
| **OM (Simple Adjusted)** | 0.85 | 0.83 | kgCO2/kWh | CEA |
| **BM** | 0.73 | 0.71 | kgCO2/kWh | CEA |
| **CM (0.75/0.25)** | 0.86 | 0.84 | kgCO2/kWh | CEA |
| **CM (0.5/0.5)** | 0.82 | 0.80 | kgCO2/kWh | CEA |

**State-Level EFs (CEA):**
| State | CM (kgCO2/kWh) | Notes |
|-------|----------------|-------|
| **Gujarat** | ~0.70 | High RE share |
| **Maharashtra** | ~0.75 | Mixed |
| **Tamil Nadu** | ~0.65 | High wind |
| **Rajasthan** | ~0.60 | High solar |
| **Karnataka** | ~0.68 | High RE |

### 7.2.2.3 Location-Based vs Market-Based — Scope 2 Implications

| Aspect | Location-Based | Market-Based |
|--------|----------------|--------------|
| **EF Source** | Grid average (CEA CM) | Contractual (PPA, REC, GEC) |
| **Additionality** | None (grid avg) | Claims require proof |
| **Reporting** | Mandatory (GHG Protocol) | Mandatory if claims made |
| **India Status** | CEA CM default | RECs on IEX/PXIL; no residual mix yet |

**Market-Based in India:**
- **REC Retirement:** 1 REC = 1 MWh renewable → zero EF for that MWh
- **PPA:** Direct renewable contract → supplier EF (often zero)
- **Residual Mix:** Not yet published for India → use location-based with disclosure

### 7.2.2.4 EF Version Control & Audit Trail

**EF Lifecycle Management:**
| Stage | Action | Tool |
|-------|--------|------|
| **Acquisition** | Download from CEA/Verra/GS | Automated API / Manual |
| **Validation** | Cross-check vs prior year; flag >5% change | Automated QC |
| **Versioning** | Semantic (v1.0, v1.1) + timestamp | Git / DB |
| **Deployment** | Tagged to methodology version | CI/CD |
| **Retirement** | Archive; never delete | Immutable store |

**Audit Trail Requirements:**
- EF value + source + version + retrieval date + retriever
- Methodology reference (CDM Tool 07, VCS, GS, CEA)
- Vintage applicability (which vintages this EF covers)
- Change log: what changed, why, who approved

### 7.2.2.4 Professional Judgement Points
- **Always use latest CEA CM** for India location-based — never OM-only or outdated BM
- **Market-based in India:** Only valid with REC/GEC retirement proof on IEX/PXIL
- **Vintage matching:** EF vintage must match generation vintage (not retirement vintage)
- **Grid imports/exports:** For cross-border, use exporting country's EF (per GHG Protocol)

### 7.2.2.4 Practical Exercise: EF Management Workshop
*Scenario:* A portfolio has 5 solar projects across 3 Indian states. Each has different commissioning dates (2020-2024).
*Tasks:*
1. Determine applicable EF for each project vintage
2. Build EF version control log (source, version, date, project mapping)
3. Calculate portfolio-weighted average EF
4. Design automated EF update workflow (CEA annual release → project update)
*Time:* 40 min
*Deliverable:* EF registry schema + update workflow
*Rubric:* Version control design (40%), vintage mapping (30%), automation design (30%)

**Knowledge Check:**
1. What is the difference between OM and BM? (OM = existing fleet marginal; BM = new build marginal)
2. Why does CEA publish both Simple OM and Simple Adjusted OM? (Adjusted removes must-run plants like nuclear/hydro)
3. What EF vintage applies to a 2024 solar project's 2025 generation? (2023-24 CEA CM)
4. Can you use location-based EF for market-based claim in India? (No — market-based requires contractual instruments)

**Sources:**
1. CDM Tool 07: "Tool to calculate the emission factor for an electricity system"
2. CEA CO2 Baseline Database — Annual Reports (2020-2024)
3. GHG Protocol Scope 2 Guidance — Chapter 6 (Market-Based)
4. VCS Standard v4.4 — Section 3.5.2 (Grid EF)
5. CEA CO2 Baseline Database — Methodology Document
6. BEE CCTS Guidelines (2023) — EF requirements

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC (EF databases updating) | Regulatory Review: Quarterly*

---

### Lesson 7.2.3: Baseline Recalculation & Version Management
**Lesson Code:** C07.2.3
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** professional

**Learning Objectives:**
1. Apply mandatory recalculation triggers per GHG Protocol and standards (Bloom: Apply)
2. Implement baseline version control with immutable audit trail (Bloom: Create)
3. Manage baseline changes across vintage boundaries and portfolio (Bloom: Analyze)

**Prerequisites:** C07.2.1, C07.2.2

**Why This Matters:**
Baselines aren't static. Structural changes, methodology updates, and error corrections all trigger mandatory recalculations. Without version control, you can't prove what baseline was used for which vintage — a fatal audit finding. This lesson teaches you to build a baseline version control system that survives audit scrutiny.

**Core Concept: Baseline Version = Immutable Contract for Each Vintage**

### 7.2.3.1 Mandatory Recalculation Triggers (GHG Protocol / ISO 14064-2)

**Threshold:** >5% of base year emissions OR any structural change

| Trigger Category | Specific Events | Action Required |
|------------------|-----------------|-----------------|
| **Structural Changes** | Merger/acquisition/divestiture >5% base yr | Recalculate base year + all subsequent years |
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

### 7.2.3.2 Recalculation Procedure

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

### 7.2.3.3 Baseline Version Control System

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
| **Baseline Registry** | Locked record: year, emissions, methodology version, GWP version |
| **Change Log** | Immutable append-only log of all changes |
| **Methodology Versioning** | Git tags (baseline_v1.0) |
| **EF Library Versioning** | Timestamped EF library per inventory year |
| **Recalculation Engine** | Automated re-run of prior years with new params |
| **Audit Trail** | Immutable evidence package per inventory year |

### 7.2.3.3 Baseline Change Management — Portfolio Level

**Portfolio Baseline Dashboard:**
| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| **Pending Recalculations** | 0 | > 0 = Alert |
| **Version Drift** | 0 (all projects current) | > 0 = Alert |
| **Recalculation Impact** | < 5% portfolio ER change | > 10% = Escalate |
| **Vintage Coverage** | 100% vintages have locked baseline | < 100% = Alert |

### 7.2.3.3 Professional Judgement Points
- **Borderline structural change (4.9%):** Recalculate anyway — conservatism builds credibility
- **Multiple triggers in one year:** Single comprehensive recalculation, not sequential
- **Historical data gaps for new acquisition:** Use estimation with clear uncertainty; flag for improvement
- **Divestiture:** Remove from base year; document as structural change
- **Merger of equals:** New entity = new base year (both recalculate)

### 7.2.3.3 Practical Exercise: Recalculation Workshop
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