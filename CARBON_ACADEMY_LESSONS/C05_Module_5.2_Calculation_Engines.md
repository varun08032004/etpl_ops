# C05: Emissions Calculation & Data
## Module 5.2: Calculation Engines & Workflows

### Lesson 5.2.1: Calculation Engines — Scope 1, 2, 3 Engines
**Lesson Code:** C05.2.1
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** professional

**Learning Objectives:**
1. Design calculation workflows for Scope 1, 2, and 3 that are auditable, reproducible, and maintainable (Bloom: Apply)
2. Select and implement appropriate calculation methods for each scope with proper lineage tracking (Bloom: Apply)
3. Evaluate calculation engine architectures for accuracy, performance, and auditability (Bloom: Evaluate)

**Prerequisites:** C05.1.1 (Emission Factors), C04.2.1 (Scope 1 & 2 Accounting), C04.3.1 (Scope 3 Mapping)

**Why This Matters:**
Every tonne of CO2e reported, every credit issued, every net-zero claim — all trace back to a calculation engine. A flawed engine produces systemic errors that compound across thousands of credits. A robust engine enables auditable, defensible carbon accounting at scale. This lesson teaches you to build engines that survive audit scrutiny and regulatory scrutiny.

**Core Concept: The Calculation Engine as Audit Infrastructure**

### 5.2.1.1 Architecture of a Modern Carbon Calculation Engine

**Core Requirements:**
| Requirement | Description | Audit Implication |
|-------------|-------------|-------------------|
| **Lineage** | Every output traces to source data, EF, method, version | Full audit trail |
| **Reproducibility** | Same inputs → same outputs, always | Verification |
| **Versioning** | Every calculation carries EF version, method version, code version | Regulatory compliance |
| **Uncertainty Propagation** | Quantified uncertainty per parameter → project level | Conservativeness |
| **Audit Trail** | Immutable log of every calculation event | Evidence |
| **Idempotency** | Re-running with same inputs produces identical results | Reproducibility |

**Architecture Layers:**
```
┌─────────────────────────────────────────────────────────────┐
│  PRESENTATION LAYER (API, UI, Reports)                      │
├─────────────────────────────────────────────────────────────┤
│  ORCHESTRATION LAYER (Workflow Engine, Dependency Graph)    │
├─────────────────────────────────────────────────────────────┤
│  CALCULATION ENGINE (Scope 1 / 2 / 3 Modules)               │
├─────────────────────────────────────────────────────────────┤
│  DATA LAYER (Activity Data, EF Library, Parameters)         │
├─────────────────────────────────────────────────────────────┤
│  STORAGE LAYER (Immutable Event Store, Versioned Snapshots) │
└─────────────────────────────────────────────────────────────┘
```

### 5.2.1.2 Scope 1 Calculation Engine

**5.2.1.2.1 Stationary Combustion Module**

**Core Formula:**
```
Emissions_CO2e = Σ [Fuel_i × NCV_i × EF_CO2_i × OF_i × GWP_CO2 
                  + Fuel_i × NCV_i × EF_CH4_i × OF_i × GWP_CH4
                  + Fuel_i × NCV_i × EF_N2O_i × OF_i × GWP_N2O]
```
Where:
- Fuel_i = mass (tonnes) or volume (m³, L) of fuel i
- NCV_i = Net Calorific Value (TJ/Gg or MJ/kg)
- EF_x_i = Emission Factor for gas x (tCO2/TJ, kg/TJ)
- OF_i = Oxidation Factor (default 1.0)
- GWP_x = Global Warming Potential (AR6: CO2=1, CH4=27.9, N2O=273)

**Engine Design Patterns:**

| Pattern | Implementation | Audit Value |
|---------|----------------|-------------|
| **Fuel Registry** | Central fuel master (code, NCV, density, default EFs, oxidation factor) | Single source of truth |
| **EF Versioning** | EF library with versioning, vintage, source, uncertainty | Reproducibility |
| **Unit Normalization** | Automatic conversion (mass↔volume via density, NCV) | Error prevention |
| **Oxidation Factor Library** | Default 1.0, overridable per fuel/technology | Conservativeness |
| **GWP Library** | AR6 (default), AR4 (legacy), SAR (CDM) selectable | Regulatory compliance |

**Calculation Workflow:**
```
1. Input: Fuel receipts (mass/volume), fuel type, period
2. Lookup: Fuel master → NCV, density, default EFs, oxidation factor
3. Unit Normalization: Volume → Mass (via density), Energy (NCV)
4. EF Resolution: Fuel + GHG → EF_CO2, EF_CH4, EF_N2O (with version)
5. Calculation: Apply formula with unit checks
6. GWP Application: Apply AR6 GWP (configurable: AR6/AR4/SAR)
7. Uncertainty: Propagate EF uncertainty + measurement uncertainty
7. Output: Emissions per gas + CO2e, with uncertainty bounds
8. Lineage: Store all inputs, EF versions, calculation parameters
```

**5.2.1.2.2 Mobile Combustion Module**

**Approaches (Priority Order):**
1. **Fuel-Based:** Fuel consumed × EF (preferred when fuel records exist)
2. **Distance-Based:** Distance × Fuel Economy × EF (when fuel records incomplete)
3. **Default/Activity-Based:** Activity × Default EF (last resort)

**Fleet Calculation Patterns:**
| Fleet Type | Preferred Method | Key Parameters |
|------------|------------------|----------------|
| **Owned Fleet** | Fuel-based (fuel cards, pump records) | Fuel receipts, tank dips |
| **Leased/Contracted** | Distance-based (telematics, logs) | Distance, load factor, vehicle class |
| **Employee Vehicles** | Distance-based (expense claims, surveys) | Distance, vehicle type, fuel type |
| **Maritime/Aviation** | Fuel-based (bunker receipts) | Bunker receipts, voyage logs |

**Emission Factors (AR6 GWP):**
| Vehicle/Fuel | CO2 (kg/L or kg/kg) | CH4 (g/km or g/kg) | N2O (g/km or g/kg) |
|--------------|---------------------|--------------------|--------------------|
| Diesel Car | 2.68 kg/L | 0.005 g/km | 0.015 g/km |
| Petrol Car | 2.31 kg/L | 0.02 g/km | 0.005 g/km |
| Heavy Diesel Truck | 2.68 kg/L | 0.02 g/km | 0.03 g/km |
| CNG Vehicle | 1.55 kg/m³ | 0.5 g/km | 0.01 g/km |
| Electric | 0 (Scope 1) | 0 | 0 |

**5.2.1.3 Process Emissions Module**

**Industry-Specific Calculation Patterns:**

| Industry | Key Process | Calculation Approach |
|----------|-------------|----------------------|
| **Cement** | Calcination: CaCO₃ → CaO + CO₂ | 0.52 tCO2/t clinker × clinker production |
| **Iron & Steel** | BF/BOF vs DRI/EAF | Plant-specific mass balance / Worldsteel methodology |
| **Aluminum** | Electrolysis + anode effect | IAI methodology / IPCC Tier 2 |
| **Chemicals** | Ammonia (Haber-Bosch), Nitric Acid (N₂O) | Process-specific stoichiometry |
| **Ammonia** | CH₄ + H₂O → CO + 3H₂ → NH₃ | Feedstock carbon + process emissions |
| **Cement (Clinker)** | CaCO₃ → CaO + CO₂ | 0.52 tCO2/t clinker × clinker × CKD correction |
| **Lime** | CaCO₃ → CaO + CO₂ | 0.785 tCO2/t CaO × lime × purity |
| **Glass** | Soda ash decomposition | Na2CO3 → Na2O + CO2 |

**Fugitive Emissions Engine:**
| Source | Gas | Detection | Quantification Method |
|--------|-----|-----------|----------------------|
| **Refrigerants** | HFCs (R-410A, R-134a, R-404A) | Leak detection | Charge × Leak Rate % |
| **SF6** | SF6 (GWP 25,200) | GIS equipment | Mass balance / leak rate |
| **Natural Gas** | CH4 (GWP 27.9) | LDAR (OGI) | EPA Method 21 / OGI correlation |
| **Coal Mining** | CH4 | Ventilation measurement | Ventilation air methane |
| **Oil & Gas** | CH4, CO2 | LDAR (OGI), component counts | EPA Method 21 / OGI factors |

**Leak Rate Estimation:**
```
Mass_Leak = Σ (Screening_Value × Correlation_Factor × Component_Count)
```
Using EPA Method 21 / OGI correlation factors.

### 5.2.1.3 Scope 2 Calculation Engine

**5.2.1.3.1 Dual-Reporting Engine Architecture**

**Location-Based Engine:**
```
Scope2_Location = Σ (Electricity_MWh_i × Grid_EF_Location_i)
```
- **Grid EF Source:** CEA (India), eGRID (US), IEA, national authority
- **Temporal Resolution:** Annual (default) or monthly (where available)
- **Geographic Resolution:** National, state, or grid-zone level

**Market-Based Engine:**
```
Scope2_Market = Σ (MWh_i × EF_Contract_i) + (Unmatched_MWh × Residual_Mix_EF)
```
**Contractual Instrument Hierarchy:**
1. **Physical PPA** → Generator-specific EF (zero for renewables)
2. **Virtual PPA** → Contractual allocation (financial settlement)
3. **Unbundled RECs/GOs** → Zero EF (if valid, retired, vintage-matched)
4. **Green Tariff** → Utility-specific product EF
5. **Residual Mix** → Grid average minus all claimed renewables

**Contractual Evidence Validation Engine:**
```
For each market-based claim:
  1. Validate instrument type (PPA, REC, GO, Green Tariff)
  2. Verify vintage matches reporting period
  3. Verify exclusive claim (registry cancellation/retirement)
  3. Validate contractual chain (PPA → generator → registry)
  4. Confirm no double counting (retirement registry check)
  5. Apply zero EF for matched volume; residual mix for remainder
```

**Residual Mix Engine:**
```
Residual_Mix_EF = (Grid_Total_Emissions - Claimed_Renewable_Emissions) / (Grid_Total_MWh - Claimed_Renewable_MWh)
```
- **Sources:** RE-DISS (EU), Green-e (US), emerging for India (CEA + REC retirement data)
- **Fallback:** If unavailable → location-based EF (with disclosure)

**5.2.1.3.2 Scope 2 Dual-Reporting Output**
```
Output:
{
  "location_based": {
    "emissions_tCO2e": 7100,
    "consumption_MWh": 10000,
    "ef_tCO2_per_MWh": 0.71,
    "method": "location_based"
  },
  "market_based": {
    "emissions_tCO2e": 3200,
    "consumption_MWh": 10000,
    "ef_tCO2_per_MWh": 0.32,
    "instruments": [
      {"type": "PPA", "volume_MWh": 4000, "ef": 0},
      {"type": "REC", "volume_MWh": 2000, "ef": 0},
      {"type": "residual_mix", "volume_MWh": 4000, "ef": 0.80}
    ],
    "method": "market_based"
  }
}
```

### 5.2.1.4 Scope 3 Calculation Engine

**5.2.1.4.1 Category-Specific Calculation Modules**

| Category | Primary Method | Engine Module |
|----------|----------------|---------------|
| **Cat 1: Purchased Goods** | Hybrid (supplier-specific + spend) | Supplier portal + EEIO fallback |
| **Cat 2: Capital Goods** | Spend-based + amortization | Capex engine + amortization schedule |
| **Cat 3: Fuel/Energy** | Activity × EF | Fuel/energy engine |
| **Cat 4: Upstream Transport** | Distance × weight × mode EF | Logistics engine (distance × weight × mode EF) |
| **Cat 5: Waste** | Tonnage × disposal EF | Waste engine (method × disposal type) |
| **Cat 6: Business Travel** | Distance × mode EF | Travel engine (booking data + distance calc) |
| **Cat 7: Employee Commuting** | Survey × distance × mode EF | Survey engine + HR data |
| **Cat 11: Use of Sold Products** | Units × lifetime energy × EF | Product engine (sales × lifetime × EF) |
| **Cat 15: Investments** | Proportional consolidation | Portfolio engine (equity share × investee Scope 1+2) |

**5.2.1.4.2 Hybrid Calculation Architecture**

```
For each Scope 3 Category:
1. Identify top suppliers by spend (80/20 rule)
2. Request primary data from top suppliers (survey, CDP, API)
3. For respondents: Use supplier-specific EF (Tier 1)
4. For non-respondents: Apply category-average EF (Tier 2/3)
5. For long-tail: Spend-based EEIO (Tier 4)

Engine Output per Category:
{
  "category": "cat_1",
  "total_emissions_tCO2e": 125000,
  "methodology": "hybrid",
  "data_quality": {
    "tier1_pct": 0.45,
    "tier2_pct": 0.30,
    "tier3_pct": 0.15,
    "tier4_pct": 0.10
  },
  "uncertainty_pct": 18.5,
  "lineage": {...}
}
```

**5.2.1.4.3 Spend-Based Engine (EEIO)**

**EEIO Formula:**
```
Emissions = Σ (Spend_i × EF_i)
Where EF_i = EEIO emission factor (kgCO2e/$) for sector i
```

**EEIO Databases (Current):**
| Database | Coverage | Sectors | Access | Best For |
|----------|----------|---------|--------|----------|
| **EXIOBASE 3.8.2** | Global | 163×44 | Subscription | Detailed MRIO |
| **Eora MRIO** | Global | 26-500 | Free/Academic | Quick screening |
| **US EPA USEEIO** | US | 389 | Free | US-centric |
| **GLORIA** | Global | 189 | Free | Multi-region |

**Spend-Based Engine Implementation:**
```
1. Map procurement spend to EEIO sectors (NACE/NAICS/ISIC mapping)
2. Apply inflation adjustment (spend year → EF year)
3. Apply EF: Emissions = Spend × EF_sector
3. Apply uncertainty: EEIO uncertainty typically 30-50%
4. Flag: "spend-based estimate — high uncertainty"
```

**Hybrid Engine Decision Logic:**
```
IF supplier_response_rate > 80%:
    USE supplier-specific for respondents + category avg for rest
ELSE IF supplier_response_rate > 20%:
    USE hybrid (supplier + category avg)
ELSE:
    USE spend-based with high uncertainty flag
```

### 5.2.1.5 Calculation Engine Integration — EtherTrack Implementation

**5.2.1.5.1 EtherTrack Calculation Engine Architecture**

```
┌─────────────────────────────────────────────────────────────────┐
│  API LAYER (REST + GraphQL)                                     │
├─────────────────────────────────────────────────────────────────┤
│  ORCHESTRATION (Temporal.io / Custom DAG)                       │
├─────────────────────────────────────────────────────────────────┤
│  SCOPE ENGINES (Stateless, Versioned, Containerized)            │
│  ├─ Scope1Engine (Stationary, Mobile, Process, Fugitive)       │
│  ├─ Scope2Engine (Location, Market, Dual)                       │
│  ├─ Scope3Engine (15 Category Modules + Hybrid Orchestrator)    │
│  └─ CapstoneEngine (Integrated Simulation)                      │
├─────────────────────────────────────────────────────────────────┤
│  DATA SERVICES                                                   │
│  ├─ EF Registry (Versioned, Versioned, Auditable)              │
│  ├─ Activity Data Ingestion (API, MQTT, CSV, SCADA, Manual)    │
│  ├─ Parameter Store (Versioned, Validated)                     │
│  └─ Uncertainty Engine (IPCC Approach 1/2, Monte Carlo)        │
├─────────────────────────────────────────────────────────────────┤
│  STORAGE (PostgreSQL + Event Store + Object Storage)           │
│  ├─ Immutable Event Store (Kafka + PostgreSQL)                 │
│  ├─ Versioned Snapshots (Calculation Snapshots)                │
│  └─ Audit Trail (Immutable Event Store)                        │
└─────────────────────────────────────────────────────────────────┘
```

**5.2.1.5.2 Key Implementation Decisions**

| Decision | Rationale |
|----------|-----------|
| **Stateless Engines** | Horizontal scaling, reproducibility, testability |
| **Versioned EF Registry** | EF version pinned at calculation time; immutable snapshots |
| **Immutable Event Store** | Every calculation = event; full replay capability |
| **Uncertainty Engine** | IPCC Approach 1 (analytic) + Approach 2 (Monte Carlo option) |
| **Idempotent Calculations** | Same inputs → same outputs; safe retries |
| **Async Orchestration** | Temporal.io for long-running Scope 3 hybrid workflows |
| **Versioned Snapshots** | Calculation snapshots at verification, issuance, retirement |

**5.2.1.5.3 India-Specific Engine Features**

| Feature | Implementation |
|---------|----------------|
| **CEA Grid EF** | Auto-fetch latest CEA annual EF; monthly option for high-res |
| **REC/GDAM Integration** | IEX/PXIL API → REC vintage, retirement status → market-based EF |
| **GDAM/G-TAM** | IEX Green Market integration → hourly marginal EF option |
| **CCTS Compliance** | CCC issuance workflow, CCC serial format, BEE reporting templates |
| **BEE PAT** | Sector-specific monitoring forms, gate-to-gate boundaries |
| **State Grid EFs** | Where published (e.g., Gujarat, Maharashtra state grids) |

### 5.2.1.6 Calculation Engine Testing & Validation

**Test Categories:**
| Test Type | Scope | Frequency |
|-----------|-------|-----------|
| **Unit Tests** | Each formula, unit conversion, EF lookup | CI/CD every commit |
| **Property Tests** | Commutativity, associativity, idempotency | CI/CD |
| **Reference Cases** | IPCC worked examples, Verra/GS examples | Per release |
| **Round-Trip** | Input → Calculate → Serialize → Parse → Recalculate | CI/CD |
| **Uncertainty Propagation** | Monte Carlo vs Analytic comparison | Per release |
| **Regression** | Historical project recalculation | Nightly |
| **Audit Replay** | Full replay of historical calculations | Weekly |

**Validation Test Cases (Minimum):**
| Test Case | Expected Result |
|-----------|-----------------|
| 500 t sub-bituminous coal → CO2, CH4, N2O | 1,021 tCO2e (per worked example) |
| 10,000 MWh × 0.71 tCO2/MWh | 7,100 tCO2 (location-based) |
| 10,000 MWh × (4,000 MWh PPA @ 0 + 2,000 REC @ 0 + 4,000 residual @ 0.80) | 3,200 tCO2e |
| 50 MW wind, 0.72 grid EF, 25% capacity factor | ~79,000 tCO2e/yr avoided |
| 100 MW gas plant, 500 t coal/day equivalent | Cross-check with CEMS |

### 5.2.1.7 Practical Exercise: Calculation Engine Design

**Scenario:** Design the calculation engine architecture for a new carbon accounting SaaS targeting Indian corporates (BRSR compliance) and voluntary market participants.

**Tasks:**
1. Draw the engine architecture diagram (layers, data flows, versioning)
2. Define the Scope 1 stationary combustion module interface (inputs, outputs, versioning)
3. Design the Scope 2 dual-reporting engine interface (location + market)
3. Design the Scope 3 hybrid orchestrator (supplier data → category calculation)
4. Define the versioning strategy for EFs, methods, engine code
4. Define the audit trail requirements per calculation

**Time:** 45 min
**Deliverable:** Architecture diagram + interface specifications (OpenAPI-style)
**Rubric:** Architectural completeness (40%), versioning strategy (30%), auditability (30%)

### 5.2.1.8 Knowledge Check

1. What is the oxidation factor default for most fuels, and when would you override it?
2. Why must Scope 2 be calculated both location-based and market-based?
3. What is the residual mix, and how is it calculated?
4. What is the difference between a minor and major methodology deviation?
4. Why must Scope 3 Category 1 use a hybrid approach rather than pure spend-based?

**Sources:**
1. GHG Protocol Corporate Standard (2015) / Scope 2 Guidance (2015) / Scope 3 Standard (2011)
2. IPCC 2006 Guidelines / 2019 Refinement — Vol 2 (Energy), Vol 3 (IPPU), Vol 5 (Waste)
3. IPCC AR6 WG1 — GWP values (AR6)
3. CEA CO2 Baseline Database (Annual)
4. GHG Protocol Scope 2 Guidance (2015) — Market-based method
3. VCS Standard v4.4 / Gold Standard v1.2 — Calculation requirements
4. BEE CCTS Guidelines (2023) — Calculation requirements
5. ICVCM Core Carbon Principles (2023) — Calculation quality criteria
5. EtherTrack Internal Architecture Docs (Internal)
6. CEA CO2 Baseline Database (Annual) — Grid EF source

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC (Calculation methods evolving) | Regulatory Review: Semi-annual*