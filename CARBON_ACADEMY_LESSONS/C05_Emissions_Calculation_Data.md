# C05: Emissions Calculation & Data
## Module 5.1: Emission Factors & Activity Data

### Lesson 5.1.1: Emission Factors — Sources, Hierarchy, Application
**Lesson Code:** C05.1.1
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** foundation

**Learning Objectives:**
1. Navigate the emission factor hierarchy and select the appropriate factor for any calculation context (Bloom: Apply)
2. Apply emission factors correctly across Scope 1, 2, and 3 calculations with proper units and conversions (Bloom: Apply)
3. Evaluate emission factor quality, vintage, and applicability for audit-ready calculations (Bloom: Evaluate)

**Prerequisites:** C04.2.1 (Scope 1 & 2 Accounting), C04.3.1 (Scope 3 Mapping & Calculation)

**Why This Matters:**
Emission factors are the DNA of carbon accounting. Every tonne of CO2e reported, every credit issued, every net-zero claim — all trace back to an emission factor choice. Using the wrong factor, wrong vintage, wrong unit, or wrong boundary turns a credible inventory into a liability. This lesson teaches you to select, apply, and defend emission factors with professional rigor.

**Core Concept: Emission Factors as the Atomic Unit of Carbon Accounting**

**5.1.1.1 Emission Factor Fundamentals**

**Definition:** An emission factor (EF) is a coefficient that relates activity data (fuel consumed, electricity consumed, distance traveled, etc.) to GHG emissions.
```
Emissions = Activity Data × Emission Factor
```
**Units:** Typically kgCO2e/unit, tCO2e/unit, kgCO2/MWh, kgCO2/kg, kgCO2/km, etc.

**EF Components:**
| Component | Description |
|-----------|-------------|
| **Gas Coverage** | CO2, CH4, N2O, HFCs, PFCs, SF6, NF3 (individually or CO2e) |
| **Boundary** | Direct combustion / lifecycle / cradle-to-gate / well-to-wheel |
| **Vintage** | Year of data / publication year |
| **Geography** | Country, region, grid, facility-specific |
| **Technology** | Boiler type, engine type, process type, vehicle class |
| **Conditions** | Load factor, efficiency, temperature, pressure |

**5.1.1.2 Emission Factor Hierarchy — Source Authority Ranking**

| Tier | Source Type | Examples | Authority | Use Case |
|------|-------------|----------|-----------|----------|
| **Tier 1** | **Primary Regulatory / Government** | CEA Grid EF (India), EPA eGRID (US), DEFRA (UK), NGA Factors (Aus) | Highest — Regulatory mandate | Compliance reporting, regulated markets |
| **Tier 2** | **International Authoritative Bodies** | IPCC 2006 Guidelines, IEA EF Database, EU ETS defaults | High — International consensus | Cross-border, methodology defaults |
| **Tier 3** | **Standard-Setting Bodies** | GHG Protocol, ISO 14064, ISO 14067, ICVCM, SBTi, VCMI | High — Standard-setting | Voluntary standards, net-zero claims |
| **Tier 4** | **Industry Associations / LCA Databases** | Ecoinvent, GaBi, Agri-footprint, Worldsteel, World Cement Assoc | High — Industry consensus | Product LCA, sector-specific |
| **Tier 5** | **Peer-Reviewed Literature / Academic** | Published LCA studies, journal articles | Medium — Peer-reviewed | Gap-filling, novel technologies |
| **Tier 6** | **Commercial / Proprietary Databases** | Ecoinvent, GaBi, Sphera, SimaPro databases | Medium — Commercial | Detailed LCA, product footprints |
| **Tier 7** | **Company-Specific / Primary Data** | Direct measurement, supplier data, meter readings | Highest — Primary | Facility-level, project-level (highest accuracy) |
| **Tier 8** | **Default / Fallback** | IPCC 2006 defaults, methodology defaults | Lowest — Last resort | Only when no other source exists |

**Hierarchy Rule:** Always use the highest-tier available EF that is applicable to your specific context. Document why lower tiers were used if higher tiers unavailable.

**5.1.1.3 Critical EF Selection Criteria**

| Criterion | Question to Ask | Red Flag |
|-----------|-----------------|----------|
| **Geographic Match** | Does EF match facility/grid location? | Using US EF for Indian plant |
| **Temporal Match** | Does EF vintage match reporting year? | Using 2015 EF for 2024 reporting |
| **Technology Match** | Does EF match technology/process? | Using coal EF for gas plant |
| **Boundary Match** | Does EF boundary match calculation boundary? | Cradle-to-gate EF used for gate-to-gate |
| **Gas Coverage** | Does EF include all relevant gases (CO2, CH4, N2O)? | CO2-only EF for process emitting N2O |
| **Unit Consistency** | Units match activity data? | kgCO2/kg used with MJ input |

**5.1.1.4 Emission Factor Types by Scope**

| Scope | EF Category | Typical Sources |
|-------|-------------|-----------------|
| **Scope 1** | Fuel combustion EFs (CO2, CH4, N2O) | IPCC 2006, CEA, EPA, national inventories |
| | Process EFs (cement, steel, chemicals) | IPCC 2006 Vol 3, industry associations |
| | Fugitive EFs (refrigerants, SF6, CH4) | EPA, IPCC, manufacturer specs |
| **Scope 2** | Grid average EF (location-based) | CEA (India), eGRID (US), IEA, AIB |
| | Residual mix / supplier-specific (market-based) | RECs, PPAs, GOs, supplier disclosures |
| **Scope 3** | Purchased goods & services (Cat 1) | EEIO (EXIOBASE, Eora), LCA databases |
| | Capital goods (Cat 2) | Industry averages, LCA databases |
| | Transport (Cat 4, 9) | Distance × load × mode-specific EF |
| | Waste (Cat 5), Travel (Cat 6), Commuting (Cat 7) | DEFRA, EPA, GHG Protocol tools |
| | Investments (Cat 15) | Proportional consolidation |

**5.1.1.5 Key EF Databases & Sources — Authoritative References**

| Database / Source | Scope | Geography | Access | Best For |
|-------------------|--------|-----------|--------|----------|
| **CEA CO2 Baseline Database** | Grid EF | India | Free (CEA) | Scope 2 Location-based (India) |
| **CEA Monthly/Annual Reports** | Grid EF, T&D losses | India | Free (CEA) | Scope 2 Location-based |
| **IPCC 2006 Guidelines** | Combustion, process, fugitive | Global | Free (IPCC) | Tier 1/2 defaults |
| **IPCC 2019 Refinement** | Updated EFs | Global | Free | Updated defaults |
| **IEA Emission Factors** | Fuel combustion, electricity | Global | Subscription | International, benchmarks |
| **EPA eGRID** | US Grid EF, plant-level | US | Free (EPA) | US Scope 2 |
| **DEFRA/DESNZ Conversion Factors** | UK & Intl | UK + Global | Free (UK Gov) | UK & Intl corporate reporting |
| **EPA eGRID** | US Plant/Grid EFs | US | Free (EPA) | US Scope 2 |
| **IEA Emission Factors** | Global fuel/energy | Global | Subscription | International benchmarking |
| **Ecoinvent / GaBi / Sphera** | LCI/Process EFs | Global | Subscription | LCA, product footprints |
| **EXIOBASE / Eora** | EEIO / MRIO | Global | Subscription/Free | Scope 3 spend-based |
| **IPCC 2006 / 2019 Refinement** | Default EFs | Global | Free | Tier 1 defaults |
| **GREET Model** | Transport fuels | US/Global | Free (ANL) | Transport fuels |
| **GHG Protocol Tools** | Cross-sector tools | Global | Free (GHGP) | Calculation support |
| **ICVCM / VCMI** | Quality thresholds | Global | Free | Quality screening |

**India-Specific EF Sources:**
| Source | Scope | Access | Use Case |
|--------|-------|--------|----------|
| **CEA CO2 Baseline Database** | Grid EF (Location-based) | Free (CEA) | Scope 2 Location-based |
| **CEA Monthly/Annual Reports** | Grid EF, T&D losses | Free (CEA) | Scope 2 Location-based |
| **BEE PAT** | Sectoral EFs, SEC | Free (BEE) | PAT Compliance |
| **ICFRE / FSI** | Forest biomass, soil C | India | Free/Paid | AFOLU projects |
| **ICFRE / ICAR** | Agriculture EFs | India | Free/Paid | Agriculture projects |
| **CPCB / MoEFCC** | Waste, industrial EFs | India | Free | Waste/Industrial |

**5.1.1.6 EF Vintage & Version Control — Critical Discipline**

| Rule | Practice |
|------|----------|
| **Vintage Match** | EF vintage ≤ Reporting Year (ideally same year) |
| **Version Control** | Track EF version in calculation workbook |
| **Update Protocol** | Annual EF refresh cycle (align with reporting cycle) |
| **Archive** | Keep superseded EFs for audit trail |
| **Change Log** | Document: old EF → new EF, reason, impact |

**Vintage Mismatch Protocol:**
```
IF EF Vintage < Reporting Year - 2 years:
  → Flag for review
  → Seek updated EF
  → If unavailable: Document conservatism, quantify impact
```

**5.1.1.7 Unit Conversions — The Silent Killer**

| From | To | Conversion |
|--------|------|------------|
| kgCO2 | tCO2 | ÷ 1,000 |
| kgCO2e | tCO2e | ÷ 1,000 |
| MJ | kWh | ÷ 3.6 |
| GJ | MWh | ÷ 3.6 |
| kg | tonne | ÷ 1,000 |
| m³ (gas) | kWh | × Calorific Value (MJ/m³) ÷ 3.6 |
| L (liquid) | kg | × Density |
| km | miles | × 1.60934 |
| Short ton | tonne | × 0.907185 |
| lb | kg | × 0.453592 |

**Common Unit Errors (Audit Findings):**
1. MJ vs kWh confusion (×3.6 factor)
2. kg vs tonne (×1000)
3. Volume vs mass for fuels (density missing)
4. Higher vs Lower Heating Value confusion (NCV vs GCV)
5. CO2 vs CO2e (forgot CH4/N2O × GWP)

**5.1.1.8 GWP — Global Warming Potential Application**

| Gas | AR5 GWP100 | AR6 GWP100 | SAR (CDM) | Use AR6 For |
|-------|------------|------------|-----------|-------------|
| CO2 | 1 | 1 | 1 | All new calculations |
| CH4 (fossil) | 28 | 27.9 (29.8 w/ feedback) | 21 | New inventories |
| CH4 (biogenic) | 28 | 27.0 (27.8 w/ feedback) | 21 | Biogenic sources |
| N2O | 265 | 273 | 310 | All new inventories |
| SF6 | 23,500 | 25,200 | 23,900 | Electrical equipment |
| HFC-134a | 1,300 | 1,530 | 1,430 | Refrigeration |
| PFC-14 (CF4) | 6,630 | 7,350 | 6,500 | Semiconductors |

**GWP Application Rules:**
1. Use AR6 GWP100 for all new inventories (GHG Protocol 2023+)
2. Disclose GWP version in methodology statement
3. For CDM/CERs: Use SAR GWP (legacy)
4. For CORSIA: Use AR6 GWP100
5. For CCTS: Follow BEE notification (currently AR6)

**5.1.1.9 EF Uncertainty & Conservativeness**

| EF Tier | Typical Uncertainty | Conservativeness Approach |
|---------|---------------------|---------------------------|
| Tier 1 (Measured) | ±2-5% | Use mean |
| Tier 2 (National Avg) | ±10-20% | Upper bound (95% CI) |
| Tier 3 (IPCC Default) | ±20-50% | Upper bound + conservativeness factor |
| Default / EEIO | ±30-100% | 1.5-2× upper bound |

**Conservativeness Rule:** If EF uncertainty >20%, apply conservativeness factor (e.g., use 95th percentile or 1.5× mean).

**5.1.1.10 EF Documentation — Audit-Ready Package**

**Required EF Documentation Package:**
```
For each EF used:
☐ Source (full citation + URL)
☐ Publication date / vintage
☐ Version / edition
☐ Geographic scope
☐ Technology / process coverage
☐ Gas coverage (CO2, CH4, N2O, etc.)
☐ Units (exact)
☐ Uncertainty range / confidence interval
☐ Conservativeness assessment
☐ Date accessed / downloaded
☐ Stored in: EF Library (version-controlled)
```

**India EF Selection Decision Tree:**
```
START: Need EF for [Activity] in [Location]
  │
  ├─ Is it Scope 2 Electricity?
  │   ├─ Location-based → CEA Grid EF (latest annual)
  │   └─ Market-based → REC/PPA/GDAM → Supplier EF / Residual Mix
  │
  ├─ Is it Fuel Combustion?
  │   ├─ Indian fuel → CEA / IPCC 2019 Refinement (India-specific)
  │   └─ Imported fuel → Supplier cert / IPCC 2019 Refinement
  │
  ├─ Is it Process Emission?
  │   ├─ Cement → 0.52 tCO2/t clinker (plant-specific if avail)
  │   ├─ Steel → Plant-specific / Worldsteel / IPCC
  │   └─ Chemicals → IPCC 2019 Refinement / Industry avg
  │
  └─ Is it Fugitive?
      ├─ Refrigerant → Manufacturer specs + leak rate
      ├─ SF6 → Nameplate capacity × leak rate
      └─ NG Pipeline → EPA Method 21 / OGI + emission factors
```

**Common EF Errors — Audit Hall of Shame:**
1. **CO2 vs CO2e confusion** — Forgot CH4/N2O × GWP
2. **AR4 vs AR6 GWP mix** — Used AR4 for CH4, AR6 for N2O
3. **GCV vs NCV** — Used GCV EF with NCV activity data (or vice versa)
4. **Volume vs Mass** — Used m³ gas without density conversion
5. **Vintage mismatch** — 2015 EF used for 2024 reporting
6. **Geographic mismatch** — US eGRID EF used for Indian plant
6. **Boundary error** — Cradle-to-gate EF used for gate-to-gate calc
7. **Unit mismatch** — kgCO2/kWh used with MWh data (missing ÷1000)

**Practical Exercise: EF Selection Workshop**
*Scenario:* Calculate Scope 1 & 2 for a 100 MW gas-fired power plant in Gujarat.
*Tasks:*
1. Select appropriate EFs for: Natural gas combustion, Grid electricity import, SF6 switchgear
2. Document source, vintage, uncertainty for each EF
3. Calculate total Scope 1 + 2 with uncertainty propagation
*Time:* 40 min
*Deliverable:* EF Selection Matrix + Sample Calculation
*Rubric:* Source appropriateness (40%), unit consistency (30%), uncertainty handling (30%)

**Knowledge Check:**
1. When must you use AR6 GWP vs AR4? (AR6 for all new inventories per GHGP 2023+)
2. What is the CEA grid EF for 2022-23? (0.71 tCO2/MWh)
3. Can you use DEFRA EF for an Indian plant? (Only if no India-specific EF exists; document why)

**Sources:**
1. IPCC 2006 Guidelines / 2019 Refinement — Vol 2 (Energy), Vol 3 (IPPU), Vol 5 (Waste)
2. CEA CO2 Baseline Database (Annual) — ceainc.in
3. GHG Protocol Corporate Standard (2015 rev) / Scope 2 Guidance (2015)
3. IPCC 2019 Refinement to 2006 Guidelines
4. CEA Regulations — Metering, Grid Code
5. IPCC 2019 Refinement — Updated EFs for fossil fuels
6. BEE PAT Guidelines (2023) — Sectoral EFs
6. ICVCM Core Carbon Principles (2023) — EF quality criteria
7. GHG Protocol Scope 2 Guidance (2015) — Market-based method
8. IPCC AR6 WG1 Chapter 7 — GWP values

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC (EF updates annual) | Regulatory Review: Semi-annual*