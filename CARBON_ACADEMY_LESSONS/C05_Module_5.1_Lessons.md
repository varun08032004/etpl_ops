# C05: Emissions Calculation & Data
## Module 5.1: Emission Factor Hierarchy (3 lessons × 40min = 2h)

### Lesson 5.1.1: Emission Factor Sources — Primary to Default
**Lesson Code:** C05.1.1
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** foundation

**Learning Objectives:**
1. Classify emission factor sources by hierarchy (IPCC, national, sectoral, default) (Bloom: Understand)
2. Select appropriate EF for a given source category and geography (Bloom: Apply)
3. Document EF selection rationale for audit trail (Bloom: Create)

**Prerequisites:** C04.1.1, C04.1.2

**Why This Matters:**
Emission factors are the multiplication constants that turn activity data into emissions. Using the wrong EF — wrong vintage, wrong geography, wrong technology — can cause errors of 2-10×. The EF hierarchy ensures you use the most representative, defensible factor available.

**Core Concept: The EF Hieracy — Primary > Secondary > Default**

### 5.1.1.1 The Emission Factor Hierarchy (IPCC 2006 / GHG Protocol)

| Tier | Source Type | Examples | When to Use | Uncertainty |
|------|-------------|----------|-------------|-------------|
| **1 — Primary** | Direct measurement / facility-specific | CEMS, stack testing, supplier LCA | Mandatory for key sources (>5% of scope) | ±5-15% |
| **2 — Secondary (Specific)** | National/sectoral verified | National GHG inventory, sector association, BEE, CPCB | Default for most calculations | ±15-30% |
| **3 — Secondary (Generic)** | International databases | IPCC 2006 defaults, IEA, DEFRA, EPA | When no national/sectoral available | ±30-50% |
| **4 — Default/Proxy** | Literature, engineering estimates | Academic papers, equipment specs, expert judgment | Last resort only | ±50-100%+ |

**Selection Rule:** Always use highest available tier. Document why lower tier used.

### 5.1.1.2 Primary Emission Factors — Measurement-Based
| Method | Applicability | Typical Uncertainty | Cost |
|--------|---------------|---------------------|------|
| **CEMS (Continuous Emissions Monitoring)** | Stack CO2, NOx, SO2 | ±2-5% | High (capex + opex) |
| **Stack Testing (Periodic)** | CO2, CH4, N2O, pollutants | ±5-10% | Medium |
| **Fuel Analysis + Mass Balance** | Carbon content × oxidation | ±3-8% | Low-Medium |
| **Supplier LCA (Cradle-to-Gate)** | Purchased goods/services | ±10-20% | Supplier-dependent |

**When Primary is Mandatory:**
- Key source category (>5% of Scope 1/2)
- Regulatory requirement (e.g., CCTS, EU ETS)
- High uncertainty in secondary EFs
- Verification requirement (SBTi, CORSIA)

### 5.1.1.3 Secondary Specific — National & Sectoral
| Source | Scope | Geography | Typical Vintage | Access |
|--------|-------|-----------|-----------------|--------|
| **India GHG Inventory (NATCOM/BUR)** | All sectors | India | 2-4 yr lag | MoEFCC/UNFCCC |
| **BEE Sectoral Baselines** | PAT sectors (cement, steel, aluminum, etc.) | India | Annual | BEE |
| **CPCB/SPCB** | Industrial emissions | India (state) | Annual | CPCB portal |
| **CEA (Power Sector)** | Grid EF, plant-level | India | Annual | CEA |
| **Indian Railways** | Traction energy | India | Annual | Railway Board |
| **Petroleum Planning & Analysis Cell** | Fuel EFs (WTT) | India | Quarterly | PPAC |
| **ICAR/IIS** | Agriculture, livestock | India | Periodic | ICAR |

**India Grid EF (CEA) — Location-Based:**
| Year | EF (kgCO2/kWh) | Source |
|------|----------------|--------|
| 2022-23 | 0.71 | CEA CO2 Baseline Database |
| 2021-22 | 0.72 | CEA |
| 2020-21 | 0.73 | CEA |

**Market-Based (India):** REC/GEC retirement on IEX/PXIL; residual mix EF not yet published — use location-based with disclosure.

### 5.1.1.4 Secondary Generic — International Defaults
| Database | Scope | Access | Key Strength |
|----------|-------|--------|--------------|
| **IPCC 2006 Guidelines** | All sectors (Vol 2 Energy, Vol 3 IPPU, Vol 4 AFOLU) | Free | Global baseline |
| **IEA Emission Factors** | Energy (detailed by country/fuel) | Paid | Comprehensive energy |
| **DEFRA (UK)** | All sectors (detailed) | Free | High granularity, WTW |
| **EPA (US)** | All sectors (US-focused) | Free | US regulatory alignment |
| **Ecoinvent/GaBi/SimaPro** | All (LCA databases) | Paid | LCA integration |
| **GREET (Argonne)** | Transport fuels (WTW) | Free | Advanced transport |

### 5.1.1.5 EF Selection Decision Tree
```
For each emission source:
1. Is primary measurement available/feasible? → Use Tier 1
   ↓ No
2. Is national/sectoral EF available (BEE, CEA, CPCB, NATCOM)? → Use Tier 2
   ↓ No
3. Is international database EF available (IEA, DEFRA, IPCC)? → Use Tier 3
   ↓ No
4. Use Tier 4 (proxy/engineering estimate) + flag for improvement
```

**Documentation Required per EF:**
- Source (organization, publication, version, date)
- Geography applicability
- Technology/process coverage
- Vintage (data year)
- Uncertainty (quantitative if available)
- Justification for tier selection

### 5.1.1.6 Common EF Mistakes
1. **Using IPCC defaults when national EF exists** (e.g., using IPCC coal EF instead of Indian coal GCV-based)
2. **Wrong vintage** (using 2010 EF for 2024 inventory)
3. **Geography mismatch** (using US grid EF for India operations)
4. **Technology mismatch** (using subcritical coal EF for supercritical plant)
5. **Ignoring GWP version** (AR4 vs AR5 vs AR6 changes CH4/N2O CO2e by 10-15%)
6. **Using combustion EF for process emissions** (different mechanisms)

### 5.1.1.7 Professional Judgement Points
- For Indian coal: Use GCV-based EF (Indian coal GCV 3000-5000 kcal/kg vs IPCC default 6000+)
- For grid electricity: Location-based = CEA; Market-based = REC/GEC retirement on IEX
- For transport: Use Indian-specific EFs (ARAI vehicle certification, Indian Railways traction)
- For refrigerants: Use actual refrigerant type + charge × leakage rate (not default)
- For biomass: Biogenic CO2 separate; CH4/N2O from biomass combustion use EFs

### 5.1.1.7 Practical Exercise: EF Selection Workshop
*Scenario:* An Indian cement plant: 2 Mt/yr clinker, 50 MW captive power (coal), 10 MW WHR, 500 kVA DG sets, 500 kVA grid import, 500 tons R-22 refrigerant.
*Tasks:*
1. List all emission sources
2. Select EF tier for each (with source citation)
3. Calculate Scope 1 & 2 emissions (sample data provided)
4. Identify 3 sources needing primary measurement
*Time:* 40 min
*Deliverable:* EF selection matrix + emission calculation
*Rubric:* Tier selection logic (40%), source citation (30%), calculation (30%)

**Knowledge Check:**
1. What is the hierarchy priority: BEE sectoral baseline vs IPCC 2006 default? (BEE > IPCC)
2. When is primary measurement mandatory? (>5% of scope, regulatory, high uncertainty)
3. What GWP version should new inventories use? (AR6)
4. Can you use IPCC default for Indian coal? (Only if no Indian data — but Indian data exists)

**Sources:**
1. IPCC 2006 Guidelines — Volume 2 (Energy), Volume 3 (IPPU)
2. CEA CO2 Baseline Database (annual)
3. BEE PAT Sectoral Baselines (2023)
4. CPCB Emission Inventory Guidelines
5. IPCC 2006 Guidelines Volume 2, Chapter 1 (Introduction), Chapter 2 (Stationary Combustion)
6. India NATCOM/BUR (UNFCCC)

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC (EF databases updating) | Regulatory Review: Quarterly*

---

### Lesson 5.1.2: Fuel & Energy Emission Factors — Deep Dive
**Lesson Code:** C05.1.2
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** foundation

**Learning Objectives:**
1. Calculate fuel combustion EFs from first principles (carbon content, oxidation factor, NCV/GCV) (Bloom: Apply)
2. Distinguish between NCV and GCV bases and convert between them (Bloom: Apply)
3. Apply well-to-tank (WTT) and tank-to-wheel (TTW) factors for transport fuels (Bloom: Apply)

**Prerequisites:** C05.1.1

**Why This Matters:**
Fuel combustion is the largest emission source for most organizations. Getting the fuel EF right requires understanding the difference between Gross and Net Calorific Values, oxidation factors, and the distinction between combustion-only (TTW) and full lifecycle (WTW) emissions. Errors here propagate to every downstream calculation.

**Core Concept: Fuel EF = Carbon Content × Oxidation × (44/12) / Energy Content**

### 5.1.2.1 Fuel Combustion EF — First Principles

**Fundamental Formula:**
```
EF (kg CO2 / unit energy) = Carbon Content (kg C / unit mass) × Oxidation Factor × (44/12) / NCV (energy/unit mass)
```

**Where:**
- **Carbon Content:** kg C per kg fuel (from ultimate analysis)
- **Oxidation Factor:** Fraction of carbon oxidized (typically 0.98-1.0)
- **44/12:** Molecular weight ratio CO2/C
- **NCV:** Net Calorific Value (MJ/kg or kcal/kg) — excludes latent heat of vaporization

**GCV vs NCV — Critical Distinction:**
| Basis | Definition | Typical Difference | Where Used |
|-------|------------|-------------------|------------|
| **GCV (HHV)** | Total heat including latent heat of water vapor | Coal: +5-10%; Gas: +10-11% | Coal trade, boiler design |
| **NCV (LHV)** | Heat excluding latent heat of vaporization | Lower than GCV | IPCC, GHG Protocol, most EF databases |

**Conversion:**
```
NCV ≈ GCV - (2.447 × H% × 9)  [MJ/kg]
Where H% = hydrogen % by mass
```
For typical coal (H=4%): NCV ≈ GCV - 0.88 MJ/kg
For natural gas (H=25%): NCV ≈ GCV - 5.5 MJ/kg

**IPCC Default Oxidation Factors:**
| Fuel Type | Oxidation Factor | Range |
|-----------|------------------|-------|
| Coal (bituminous) | 0.98 | 0.95-1.0 |
| Coal (sub-bituminous) | 0.98 | 0.95-1.0 |
| Coal (lignite) | 0.98 | 0.95-1.0 |
| Petroleum Coke | 0.98 | 0.95-1.0 |
| Natural Gas | 0.995 | 0.99-1.0 |
| Oil Products | 0.99 | 0.99-1.0 |
| Biomass | 0.98 | 0.95-1.0 |

### 5.1.2.2 Worked Example — Coal EF Calculation

**Given (Typical Indian Coal):**
- GCV = 4,200 kcal/kg = 17.6 MJ/kg
- Carbon Content = 45% (by mass)
- Hydrogen = 3.5%
- Oxidation Factor = 0.98

**Step 1: NCV**
```
NCV = GCV - 2.447 × 3.5% × 9 = 17.6 - 0.77 = 16.83 MJ/kg
```

**Step 2: Carbon per MJ**
```
Carbon per kg = 0.45 kg C/kg coal
Carbon per MJ = 0.45 / 16.83 = 0.0267 kg C/MJ
```

**Step 3: CO2 per MJ (with oxidation)**
```
CO2 per MJ = 0.0267 × 0.98 × (44/12) = 0.0957 kg CO2/MJ
```

**Step 4: Per kg coal**
```
CO2 per kg = 0.0957 × 16.83 = 1.61 kg CO2/kg coal
```

**Compare to IPCC Default:** 0.0946 kg CO2/MJ (bituminous) → Our calc: 0.0957 kg CO2/MJ (Indian coal lower GCV → higher EF per MJ)

### 5.1.2.3 Natural Gas EF
**Typical Composition:** 90% CH4, 5% C2H6, 3% C3H8, 2% CO2/N2
- **GCV:** ~54 MJ/kg ≈ 39 MJ/m³ (at STP)
- **NCV:** ~48 MJ/kg ≈ 35 MJ/m³
- **Carbon Content:** ~75% by mass
- **EF (NCV basis):** ~0.0561 kg CO2/MJ (IPCC default)
- **EF (volume):** ~1.96 kg CO2/m³ (at STP, NCV)

### 5.1.2.4 Transport Fuels — WTW vs TTW
**Tank-to-Wheel (TTW):** Combustion only (tailpipe)
**Well-to-Tank (WTT):** Extraction, refining, transport, distribution
**Well-to-Wheel (WTW) = TTW + WTT**

**India Transport EFs (WTW, kgCO2e/MJ):**
| Fuel | TTW (combustion) | WTT (upstream) | WTW (total) | Source |
|------|------------------|----------------|-------------|--------|
| Diesel | 0.0741 | 0.015-0.02 | 0.089-0.094 | DEFRA/PPAC |
| Petrol | 0.0693 | 0.015-0.02 | 0.084-0.089 | DEFRA/PPAC |
| CNG | 0.0561 | 0.010-0.015 | 0.066-0.071 | DEFRA/GAIL |
| LPG | 0.0631 | 0.010-0.015 | 0.073-0.078 | DEFRA |
| Electricity (grid) | 0 | 0.71 kgCO2/kWh | 0.71 | CEA (location) |
| Electricity (solar) | 0 | 0.02-0.04 | 0.02-0.04 | LCA |

**Key Insight:** For EVs in India, WTW = grid EF (0.71 kgCO2/kWh) — still high but improving with grid decarbonization.

### 5.1.2.5 Electricity Emission Factors — Location vs Market

**Location-Based (Grid Average):**
- India (CEA 2023): 0.71 kgCO2/kWh
- State-level variation: 0.5-1.0 kgCO2/kWh
- Updates annually (CEA CO2 Baseline Database)

**Market-Based (Contractual):**
- **REC/GEC:** 1 REC = 1 MWh renewable → zero EF for that MWh
- **PPA:** Direct renewable contract → supplier EF (often zero)
- **Residual Mix:** Grid EF minus renewable claims — not yet published for India

**Reporting Requirement (GHG Protocol Scope 2):** MUST report both location-based AND market-based.

### 5.1.2.6 Fugitive Emissions — Refrigerants & SF6
**Refrigerants (HFCs):**
| Refrigerant | GWP100 (AR6) | Typical Leak Rate | EF (kgCO2e/kg) |
|-------------|--------------|-------------------|----------------|
| R-22 (HCFC-22) | 1,760 | 10-20%/yr | 1,760 |
| R-410A | 2,088 | 5-10%/yr | 2,088 |
| R-134a | 1,430 | 5-10%/yr | 1,430 |
| R-32 | 675 | 5-10%/yr | 675 |
| R-290 (Propane) | 3 | 5-10%/yr | 3 |

**Calculation:**
```
Fugitive Emissions = Charge (kg) × Leak Rate (%) × GWP
```
**Leak Rate Sources:** Equipment specs, maintenance logs, IPCC defaults (commercial AC: 10-35%/yr)

**SF6 (Electrical Switchgear):**
- GWP100 (AR6): 25,200
- Leak Rate: 0.1-1%/yr (modern), 1-5%/yr (older)
- EF = Charge (kg) × Leak Rate × 25,200

### 5.1.2.6 India-Specific Fuel EFs
| Fuel | NCV (MJ/kg) | Carbon % | EF (kgCO2/kg) | EF (kgCO2/MJ) | Source |
|------|-------------|----------|---------------|---------------|--------|
| Coal (Indian, avg) | 16-18 | 40-50% | 1.5-1.8 | 0.09-0.10 | IPCC/Indian coal |
| Lignite | 8-12 | 25-35% | 1.0-1.3 | 0.10-0.11 | Indian lignite |
| Diesel (HSD) | 42.7 | 86% | 3.14 | 0.074 | BIS/IOCL |
| Petrol (MS) | 44.0 | 86% | 3.05 | 0.069 | BIS/IOCL |
| Furnace Oil (FO) | 40.0 | 85% | 3.06 | 0.077 | BIS/IOCL |
| LPG | 46.0 | 82% | 2.99 | 0.065 | BIS/IOCL |
| CNG | 48.0 | 75% | 2.70 | 0.056 | GAIL |

### 5.1.2.7 Professional Judgement Points
- For Indian coal: Always use GCV-based EF with Indian coal GCV (not IPCC default)
- For grid electricity: Location-based = CEA; Market-based = REC retirement proof
- For transport: Use Indian-specific EFs (PPAC for WTT, ARAI for vehicles)
- For refrigerants: Track by refrigerant type, charge, leak rate (not default)
- For biomass: Biogenic CO2 separate; CH4/N2O from combustion use EFs

### 5.1.2.7 Practical Exercise: Fuel EF Workshop
*Scenario:* A textile mill: 10,000 t/yr coal (GCV 4200 kcal/kg, C=45%), 500 kl/yr diesel, 100,000 m³ CNG, 500 kVA DG (500 hrs/yr), 2 MW solar rooftop, 500 kVA grid import, 500 kg R-22 (15% leak), 500 kg SF6 (0.5% leak).
*Tasks:*
1. Calculate Scope 1 emissions (all sources)
2. Calculate Scope 2 (location-based + market-based)
3. Identify which sources need primary measurement
*Time:* 45 min
*Deliverable:* Emission calculation spreadsheet + EF selection rationale
*Rubric:* EF selection (40%), calculation accuracy (40%), tier justification (20%)

**Knowledge Check:**
1. Why use NCV not GCV for EF calculations? (IPCC/GHGP standard; excludes latent heat not recovered)
2. What is the oxidation factor for natural gas? (0.995)
3. What is the difference between TTW and WTW? (TTW=combustion only; WTW=full lifecycle)
4. For market-based Scope 2 in India, what constitutes valid proof? (REC/GEC retirement on IEX/PXIL)

**Sources:**
1. IPCC 2006 Guidelines — Volume 2, Chapter 1 (Introduction), Chapter 2 (Stationary Combustion), Chapter 3 (Mobile Combustion)
2. CEA CO2 Baseline Database (annual)
3. PPAC (Petroleum Planning & Analysis Cell) — Fuel properties
4. DEFRA Conversion Factors 2023 — WTT/TTW factors
5. IPCC 2006 Guidelines Volume 2, Chapter 3 (Mobile Combustion)
6. CEA CO2 Baseline Database (annual)
7. BEE PAT Guidelines (2023)

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC (Fuel specs, grid EF updating) | Regulatory Review: Quarterly*

---

### Lesson 5.1.3: Process & Fugitive Emission Factors
**Lesson Code:** C05.1.3
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** foundation

**Learning Objectives:**
1. Calculate process emissions from stoichiometry (cement, lime, chemicals, metals) (Bloom: Apply)
2. Apply fugitive emission factors for refrigerants, SF6, and methane systems (Bloom: Apply)
3. Evaluate measurement vs estimation approaches for fugitive sources (Bloom: Evaluate)

**Prerequisites:** C05.1.1, C05.1.2

**Why This Matters:**
Process emissions (non-combustion) and fugitive emissions often escape proper accounting because they don't involve fuel combustion. Cement calcination, chemical reactions, refrigerant leaks, and SF6 from switchgear can represent 10-50% of Scope 1 for industrial facilities. These sources require fundamentally different calculation approaches than combustion.

**Core Concept: Process = Stoichiometry; Fugitive = Inventory × Leak Rate × GWP**

### 5.1.3.1 Process Emissions — Stoichiometric Calculations

**Core Principle:** Emissions from chemical/physical transformation, not combustion.
```
Process EF = Stoichiometric Ratio × (Molecular Weight Product / Molecular Weight Reactant) × (44/12 for CO2)
```

### 5.1.3.1 Cement — Calcination (Largest Industrial Process Source)
**Reaction:** CaCO3 → CaO + CO2
- Molar Mass: CaCO3 = 100.09; CaO = 56.08; CO2 = 44.01
- **Stoichiometric EF:** 44.01/100.09 = 0.4397 t CO2 / t CaCO3
- **Per Tonne Clinker:** Typical CaO content 65-67% → EF = 0.4397 × 0.66 = 0.29 t CO2/t clinker
- **IPCC Default:** 0.52 t CO2/t clinker (includes CKD, non-carbonate CO2)

**India Context:** Indian cement avg ~0.55-0.60 tCO2/t clinker (includes fuel + calcination + CKD)
- Pure calcination: ~0.52 tCO2/t clinker
- Fuel: ~0.3-0.4 tCO2/t clinker
- Total: 0.8-0.9 tCO2/t cement (Indian avg)

### 5.1.3.2 Lime — Calcination
**Reaction:** CaCO3 → CaO + CO2 (same as cement)
- **High-Calcium Lime:** 0.75 tCO2/t quicklime
- **Dolomitic Lime:** CaCO3·MgCO3 → CaO·MgO + 2CO2 → 0.91 tCO2/t lime

### 5.1.3.3 Chemicals — Key Process Emissions

| Process | Reaction | CO2 EF (t/t product) | Other Gases |
|---------|----------|---------------------|-------------|
| **Ammonia (Steam Reforming)** | CH4 + H2O → CO + 3H2; CO + H2O → CO2 + H2 | 1.6-2.0 tCO2/t NH3 | — |
| **Nitric Acid** | NH3 oxidation | — | N2O: 2-9 kg/t HNO3 |
| **Adipic Acid** | Cyclohexane oxidation | — | N2O: 30-100 kg/t |
| **Silicon/ Ferroalloys** | SiO2 + C → Si + CO | 1.5-2.0 tCO2/t Si | CO |
| **Aluminum (Hall-Héroult)** | 2Al2O3 + 3C → 4Al + 3CO2 | 1.5-1.7 tCO2/t Al | PFCs (CF4, C2F6) |
| **Ethylene (Steam Cracking)** | C2H6 → C2H4 + H2 | 1.0-1.5 tCO2/t C2H4 | — |
| **Methanol** | Syngas → CH3OH | 0.5-0.8 tCO2/t MeOH | — |
| **Soda Ash (Solvay)** | NaCl + CaCO3 → Na2CO3 + CaCl2 | 0.9-1.1 tCO2/t Na2CO3 | — |

### 5.1.3.2 Metals — Process Emissions

| Metal | Process | CO2 EF (t/t metal) | Key Gases |
|-------|---------|-------------------|-----------|
| **Iron & Steel (BF-BOF)** | Coke + Fe2O3 → Fe + CO2 | 1.8-2.2 tCO2/t steel | CO, CH4 |
| **Iron & Steel (DRI-EAF)** | NG/H2 + Fe2O3 → Fe + H2O/CO2 | 0.8-1.5 tCO2/t steel | — |
| **Aluminum (Primary)** | Hall-Héroult | 1.5-1.7 tCO2/t Al + PFCs | PFCs (CF4, C2F6) |
| **Copper (Primary)** | Smelting/converting | 0.5-1.0 tCO2/t Cu | SO2 |
| **Zinc/Lead** | Roasting/sintering | 0.5-1.5 tCO2/t | SO2 |

### 5.1.3.3 Fugitive Emissions — Inventory × Leak Rate × GWP

**General Formula:**
```
Fugitive Emissions (tCO2e) = Inventory (kg) × Leak Rate (fraction/yr) × GWP100
```

### 5.1.3.3 Refrigerants (HFCs/HCFCs)

**Common Refrigerants & GWP100 (AR6):**
| Refrigerant | Type | GWP100 (AR6) | Common Use | Typical Leak Rate |
|-------------|------|--------------|----------------|-------------------|
| R-22 (HCFC-22) | HCFC | 1,760 | AC, chillers (phasing out) | 10-35%/yr |
| R-410A | HFC | 2,088 | AC, heat pumps | 5-15%/yr |
| R-134a | HFC | 1,430 | Chillers, commercial refrig | 5-15%/yr |
| R-404A | HFC | 3,922 | Commercial freezers | 10-25%/yr |
| R-32 | HFC | 675 | New AC systems | 5-15%/yr |
| R-290 (Propane) | HC | 3 | New commercial refrig | 5-15%/yr |
| R-717 (Ammonia) | Natural | 0 | Industrial refrig | 5-10%/yr |
| R-744 (CO2) | Natural | 1 | Transcritical systems | 5-10%/yr |

**Calculation:**
```
Annual Fugitive (tCO2e) = Total Charge (kg) × Leak Rate (%/yr) × GWP100 / 1000
```

**Leak Rate Sources (Hierarchy):**
1. **Measured:** Leak detection surveys, mass balance
2. **Equipment-Specific:** Manufacturer data, maintenance logs
3. **IPCC Defaults:** Commercial AC 10-35%, Industrial 5-20%, Domestic 1-5%
4. **Regulatory Defaults:** EPA/Kigali defaults

**Kigali Amendment Impact:** HFC phase-down schedule — India: freeze 2028, 85% reduction by 2047.

### 5.1.3.3 SF6 (Sulfur Hexafluoride) — Electrical Equipment

**Properties:** GWP100 (AR6) = 25,200; Atmospheric lifetime: 3,200 years
**Applications:** GIS (Gas Insulated Switchgear), circuit breakers, transformers

**Leak Rates (IPCC 2006 / IEC 60480):**
| Equipment Type | Leak Rate (%/yr) | Typical Charge |
|----------------|------------------|----------------|
| Sealed GIS (modern) | 0.1-0.5% | 50-2,000 kg |
| Sealed GIS (pre-2000) | 0.5-1.0% | 100-5,000 kg |
| Circuit Breakers | 0.5-2.0% | 10-200 kg |
| Transformers | 0.1-0.5% | 10-100 kg |

**Calculation:**
```
SF6 Emissions (tCO2e/yr) = Total Inventory (kg) × Leak Rate (%) × 25,200 / 100
```

**Mass Balance Approach (More Accurate):**
```
Emissions = Opening Inventory + Purchases - Closing Inventory - Retirements
```

### 5.1.3.4 Methane Fugitives — Oil & Gas, Coal, Waste

**Oil & Gas (IPCC 2006 Tier 1):**
| Segment | CH4 EF (kg/PJ) | CO2 EF (kg/PJ) |
|---------|----------------|----------------|
| Production | 250,000 | 10,000 |
| Processing | 50,000 | 5,000 |
| Transmission | 100,000 | 5,000 |
| Distribution | 200,000 | 5,000 |

**Coal Mining (IPCC 2006):**
| Mining Type | CH4 EF (m3/tonne coal) |
|-------------|------------------------|
| Underground | 10-25 |
| Surface | 0.5-2.0 |
| Post-Mining (UG) | 2-5 |
| Post-Mining (Surface) | 0.1-0.5 |

**Waste Sector (IPCC 2006):**
| Waste Type | CH4 EF (kg/tonne waste) |
|------------|-------------------------|
| MSW (unmanaged landfill) | 100-200 |
| MSW (managed, gas capture) | 20-50 |
| Industrial Wastewater | 0.1-1.0 kg/m³ |
| Domestic Wastewater | 0.05-0.2 kg/capita/yr |

### 5.1.3.4 Measurement vs Estimation — Decision Framework

| Approach | When to Use | Uncertainty | Cost |
|----------|-------------|-------------|------|
| **Direct Measurement** | Regulatory requirement, >5% of Scope 1, high GWP | ±5-15% | High |
| **Mass Balance** | Refrigerant/SF6 inventory tracking | ±10-20% | Medium |
| **Leak Detection + Repair (LDAR)** | Regulatory (EPA Method 21), large facilities | ±20-30% | High |
| **Emission Factors (IPCC/API)** | No measurement capability | ±50-100% | Low |
| **Engineering Estimates** | No data, screening only | ±100%+ | Low |

**Measurement Technologies:**
| Technology | Target Gas | Detection Limit | Application |
|------------|------------|-----------------|-------------|
| **Optical Gas Imaging (OGI)** | CH4, VOCs, SF6 | ~1 g/hr | LDAR surveys |
| **Tunable Diode Laser (TDLAS)** | CH4, CO2, H2S | ~1 ppm | Continuous monitoring |
| **Cavity Ring-Down (CRDS)** | CH4, CO2, N2O | <1 ppb | Ambient monitoring |
| **Mass Balance (Refrigerant)** | HFCs, SF6 | ±1% | Inventory tracking |

### 5.1.3.4 India Context — Fugitive Emissions

**Regulatory:**
- **Kigali Amendment:** India ratified 2021; freeze 2028, 85% reduction by 2047
- **Ozone Rules (MoEFCC):** HCFC phase-out schedule
- **CPCB Guidelines:** LDAR for refineries, petrochemicals
- **CCTS:** Fugitive methodologies under development

**Key Sectors in India:**
- **Refineries/Petchem:** LDAR mandatory (CPCB); major CH4/VOC source
- **Power (SF6):** Growing GIS fleet; PGCIL, state utilities tracking
- **Refrigeration:** Commercial AC growth 15%/yr; HFC phase-down per Kigali
- **Oil & Gas:** ONGC, OIL, GAAP — LDAR programs expanding
- **Coal Mining:** CIL, SCCL — methane capture projects emerging (CMM)

**EtherTrack Context:** Platform tracks refrigerant/SF6 inventory by asset; schedules LDAR; calculates fugitive emissions automatically from inventory + leak rates.

### 5.1.3.5 Professional Judgement Points
- **Refrigerant inventory:** Track by asset, not facility — charge, type, location, age
- **SF6:** Mass balance > leak rate defaults (inventory tracking more accurate)
- **LDAR frequency:** Quarterly for high-risk (refineries); annual for medium; risk-based
- **Refrigerant transition:** Plan R-22→R-410A→R-32/R-290 per Kigali schedule
- **Methane:** Prioritize measurement for high-GWP sources (coal, oil/gas, waste)

### 5.1.3.5 Practical Exercise: Fugitive Emissions Workshop
*Scenario:* A chemical plant: 500 kg R-410A (10% leak), 200 kg R-134a (8% leak), 500 kg SF6 in GIS (0.3% leak), 10 km gas pipeline (0.5% leak), 500 tons coal mining (UG, 15 m3/t CH4).
*Tasks:*
1. Calculate annual fugitive emissions (tCO2e) by source
2. Prioritize LDAR investment by cost/tonne CO2e reduced
3. Design LDAR program (frequency, technology, coverage)
*Time:* 40 min
*Deliverable:* Fugitive emissions register + LDAR investment memo
*Rubric:* Calculation accuracy (40%), prioritization logic (30%), program design (30%)

**Knowledge Check:**
1. What is the GWP100 of SF6 (AR6)? (25,200)
2. Which approach is more accurate for SF6: leak rate default or mass balance? (Mass balance)
3. What is the Kigali Amendment phase-down for India? (Freeze 2028, 85% reduction by 2047)
4. What is the typical leak rate for modern sealed GIS? (0.1-0.5%/yr)

**Sources:**
1. IPCC 2006 Guidelines — Volume 2 (Energy), Volume 3 (IPPU), Volume 4 (AFOLU)
2. IPCC 2006 Guidelines Volume 3, Chapter 7 (Fluorinated Compounds)
3. IPCC 2006 Guidelines Volume 2, Chapter 4 (Fugitive Emissions)
4. EPA Method 21 / EPA OOOOa — LDAR
4. IEC 60480 — SF6 Handling
5. Kigali Amendment (2016) — HFC Phase-down
6. CPCB LDAR Guidelines (2018)
6. MoEFCC Ozone Rules — HCFC Phase-out

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC (Refrigerant transition, SF6 alternatives) | Regulatory Review: Quarterly*