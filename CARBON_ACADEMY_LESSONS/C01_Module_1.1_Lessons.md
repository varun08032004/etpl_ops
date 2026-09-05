# C01: Climate & Carbon Fundamentals
## Module 1.1: Greenhouse Effect & Carbon Cycle (3 lessons × 40min = 2h)

### Lesson 1.1.1: Radiative Forcing & The Greenhouse Effect
**Lesson Code:** C01.1.1
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** foundation

**Learning Objectives:**
1. Define radiative forcing and explain the physical mechanism of the greenhouse effect (Bloom: Understand)
2. Calculate simplified radiative forcing from CO2 concentration changes using IPCC formula (Bloom: Apply)
3. Distinguish between instantaneous, adjusted, and effective radiative forcing (Bloom: Analyze)

**Prerequisites:** None (first lesson)

**Why This Matters:**
Every carbon credit represents one tonne of CO2e prevented from entering the atmosphere. Understanding *why* CO2 traps heat — the quantum mechanical basis of radiative forcing — is the scientific foundation for why carbon markets exist. Without this mechanism, there would be no climate problem to solve.

**Core Concept: The Quantum Mechanics of Heat Trapping**

### 1.1.1.1 Solar Energy Balance
Earth receives ~340 W/m² average solar irradiance (TSI/4). Of this:
- ~100 W/m² reflected (albedo: clouds 60%, surface 40%)
- ~240 W/m² absorbed by Earth system
- Earth must emit 240 W/m² longwave radiation to space to maintain equilibrium

### 1.1.1.2 Greenhouse Gas Absorption Physics
GHG molecules (CO2, CH4, N2O, H2O) have vibrational/rotational transitions matching Earth's outgoing longwave spectrum (4-100 µm).

**CO2 absorption bands:**
- 15 µm (667 cm⁻¹) — primary bending mode, strongest
- 4.3 µm (2349 cm⁻¹) — asymmetric stretch, saturated at current concentrations
- 2.7 µm (3715 cm⁻¹) — combination band

**Key principle:** Adding more CO2 widens the absorption wings (pressure broadening) and raises the effective emission altitude — colder layers emit less energy → energy imbalance → warming.

### 1.1.1.3 Radiative Forcing Definition
**Instantaneous RF (IRF):** Change in net flux at tropopause after GHG change, *before* temperature adjusts
**Stratospherically Adjusted RF (SARF):** After stratosphere reaches radiative equilibrium (weeks)
**Effective RF (ERF):** Includes rapid adjustments (clouds, water vapor, lapse rate) — IPCC AR6 preferred metric

**IPCC AR6 Formula (CO2):**
```
RF = 5.35 × ln(C/C₀)  [W/m²]
```
Where C = current CO2 concentration (ppm), C₀ = pre-industrial (278 ppm)

**Worked Example:**
Current CO2 ≈ 422 ppm (2023)
```
RF = 5.35 × ln(422/278) = 5.35 × 0.417 = 2.23 W/m²
```
This matches IPCC AR6 assessed value of 2.16 W/m² (2019 vs 1750)

### 1.1.1.4 Forcing Efficacy
Not all forcings produce equal temperature response per W/m²:
| Forcing Agent | Efficacy (relative to CO2) |
|---------------|----------------------------|
| CO2 | 1.00 (reference) |
| CH4 | ~1.4 (indirect effects) |
| Black Carbon on Snow | ~3.0 |
| Volcanic Aerosols | ~0.6 |

### 1.1.1.5 Current Forcing Budget (IPCC AR6, 2019 vs 1750)
| Component | ERF (W/m²) | Confidence |
|-----------|------------|------------|
| CO2 | 2.16 | Very High |
| CH4 | 0.54 | High |
| N2O | 0.21 | High |
| Halocarbons | 0.41 | High |
| Tropospheric O3 | 0.47 | Medium |
| Stratospheric H2O | 0.05 | Low |
| Aerosols (total) | -1.1 | Medium |
| Land Use (albedo) | -0.15 | Medium |
| **Total Anthropogenic** | **2.72** | High |

**India Context:** India's CO2 emissions ~2.9 GtCO2/yr (2023) → contributes ~7% of global annual CO2 forcing increment. Per capita forcing contribution remains low (~1.9 tCO2 vs global avg 4.7).

**EtherTrack Context:** Platform calculates project-level forcing avoidance using IPCC AR6 formulas. Every credit retired = quantified forcing reduction.

**Common Mistakes:**
1. Confusing radiative forcing (W/m²) with temperature change (°C) — requires climate sensitivity
2. Using outdated RF formulas (SARF vs ERF differ by ~10% for CH4)
3. Ignoring rapid adjustments in ERF (clouds, water vapor)

**Professional Judgement Points:**
- When evaluating a project's climate benefit: Use ERF, not IRF or SARF
- For methane projects: Account for 1.4× efficacy vs CO2
- For forestry: Consider albedo forcing (boreal forests can have net warming)

**Practical Exercise: RF Calculation**
*Scenario:* A project avoids 1 MtCO2/yr for 20 years. Calculate cumulative forcing avoidance.
*Steps:*
1. Annual CO2 avoidance → concentration reduction (using airborne fraction ~0.45)
2. Apply RF formula for each year
2. Integrate over project lifetime
*Time:* 35 min
*Deliverable:* Spreadsheet with annual RF avoidance (W/m²) and cumulative
*Rubric:* Correct airborne fraction (20%), formula application (40%), integration (40%)

**Knowledge Check:**
1. Why does CO2 forcing follow logarithmic (not linear) relationship? (Saturation of central absorption band)
2. What is the difference between SARF and ERF? (ERF includes rapid adjustments like cloud changes)
3. Why is methane's efficacy >1? (Produces tropospheric O3 and stratospheric H2O)

**Sources:**
1. IPCC AR6 WG1 Chapter 7 (2021) — Earth's Energy Budget
2. IPCC AR6 WG1 Chapter 6 (2021) — Carbon Cycle
3. Myhre et al. (1998) — "New estimates of radiative forcing due to well mixed greenhouse gases" — GRL
4. Etminan et al. (2016) — "Radiative forcing of carbon dioxide, methane, and nitrous oxide" — GRL

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: STATIC (fundamental physics) | Regulatory Review: Annual*

---

### Lesson 1.1.2: Carbon Cycle — Reservoirs, Fluxes & Turnover Times
**Lesson Code:** C01.1.2
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** foundation

**Learning Objectives:**
1. Identify the five major carbon reservoirs and their relative sizes (Bloom: Remember)
2. Calculate carbon turnover times and explain the difference between residence time and adjustment time (Bloom: Apply)
3. Analyze how anthropogenic emissions perturb the natural carbon cycle (Bloom: Analyze)

**Prerequisites:** C01.1.1

**Why This Matters:**
Carbon credits trade *tonnes of carbon*. But carbon moves through reservoirs at vastly different speeds — atmosphere (years), ocean surface (decades), deep ocean (centuries), geological (millennia). Understanding reservoir dynamics explains why "permanence" is a core credit quality criterion and why 100-year accounting horizons exist.

**Core Concept: Carbon is Conserved — It Only Moves**

### 1.1.2.1 Global Carbon Reservoirs (IPCC AR6, pre-industrial estimates)
| Reservoir | Carbon Stock (GtC) | % of Total | Turnover Time |
|-----------|-------------------|------------|---------------|
| **Atmosphere** | 597 | 1.3% | ~4 years (residence) / ~100 yr (adjustment) |
| **Terrestrial Biosphere** | 2,500 | 5.4% | Decades-centuries |
|  Soil Organic Carbon | 1,700 | | Centuries-millennia |
|  Vegetation | 450-650 | | Decades |
|  Permafrost | ~1,400 | | Millennia (if frozen) |
| **Ocean** | 38,000 | 82% | Centuries-millennia |
|  Surface Ocean (<100m) | 900 | | ~10 years |
|  Intermediate/Deep Ocean | 37,100 | | ~1,000 years |
| **Geological (Fossil Fuels)** | ~10,000+ | 11% | Millennia (effectively permanent) |
| **Total Active Carbon** | ~46,000 | 100% | — |

*1 GtC = 1 billion tonnes carbon = 3.67 GtCO2*

### 1.1.2.2 Natural Fluxes (Pre-industrial, GtC/yr)
| Flux | Magnitude | Direction |
|------|-----------|-----------|
| Photosynthesis (GPP) | ~120 | Atmosphere → Land |
| Plant Respiration | ~60 | Land → Atmosphere |
| Soil Respiration | ~60 | Land → Atmosphere |
| Ocean-Atmosphere Exchange | ~90 | Bidirectional |
| Ocean Circulation (Solubility Pump) | ~10 | Surface → Deep |
| Biological Pump (Export Production) | ~10 | Surface → Deep |
| Weathering / Sedimentation | ~0.1 | Long-term sink |

**Key Insight:** Natural fluxes are ~20× larger than current anthropogenic emissions (~10 GtC/yr), but were in near-perfect balance pre-industrially.

### 1.1.2.3 Turnover Time vs Adjustment Time — Critical Distinction

| Metric | Definition | Atmosphere CO2 Value | Why It Matters |
|--------|------------|---------------------|----------------|
| **Residence (Turnover) Time** | Stock / Flux_out = 597 GtC / 150 GtC/yr | ~4 years | Time for *individual molecule* to leave |
| **Adjustment Time** | Time for *perturbation* to decay to 1/e | ~50-200 years | Time for *excess concentration* to decay |

**Why Adjustment Time >> Residence Time:**
When you add CO2, the atmosphere-ocean-land system re-equilibrates. The excess carbon distributes across all reservoirs. The slowest reservoir (deep ocean, ~1000 yr) controls final equilibration.

**Bern Carbon Cycle Model (IPCC) — Impulse Response:**
```
Fraction remaining after t years:
a0 + a1·exp(-t/τ1) + a2·exp(-t/τ2) + a3·exp(-t/τ3)
a0=0.217, a1=0.259, τ1=172.9 yr
a2=0.338, τ2=18.5 yr
a3=0.186, τ3=1.19 yr
```
~22% of emitted CO2 remains in atmosphere after 1000 years.

### 1.1.2.4 Anthropogenic Perturbation (2020s, GtC/yr)
| Source | Flux | Cumulative (1750-2023) |
|--------|------|------------------------|
| Fossil Fuel & Industry | 9.6 ± 0.5 | ~420 GtC |
| Land Use Change | 1.6 ± 0.7 | ~200 GtC |
| **Total Anthropogenic** | **11.2** | **~620 GtC** |
| **Atmospheric Growth** | 5.2 ± 0.02 | +240 GtC |
| **Ocean Sink** | 2.5 ± 0.6 | ~160 GtC |
| **Land Sink** | 3.1 ± 0.9 | ~200 GtC |
| **Budget Imbalance** | 0.4 | — |

**Airborne Fraction:** ~45% (fraction of emissions remaining in atmosphere)

### 1.1.2.5 Relevance to Carbon Markets

| Concept | Carbon Cycle Basis | Market Implication |
|---------|-------------------|-------------------|
| **Permanence** | Geological storage = millennia; Biological = decades-centuries | Buffer pools, risk discounts |
| **Additionality** | Natural fluxes dwarf anthropogenic; must prove project changes flux | Baseline setting |
| **Leakage** | Carbon displaced to another reservoir/location | Leakage belts, deduction factors |
| **100-year Horizon** | Matches adjustment time for significant decay | Standard GWP horizon |

**India Context:** India's land sector is a net sink (~300 MtCO2/yr removal). Forest cover ~24% land area. Soil carbon potential: 3-4 GtC additional sequestration possible (ICAR).

**EtherTrack Context:** Platform tracks carbon reservoir dynamics for permanence risk scoring. Forest projects monitored for reversal risk via satellite (biomass change detection).

**Common Mistakes:**
1. Confusing residence time (4 yr) with adjustment time (100+ yr) — leads to underestimating permanence needs
2. Assuming ocean sink will continue indefinitely — saturation risk (Revelle factor)
3. Ignoring permafrost feedback — ~1,400 GtC vulnerable to thaw

**Professional Judgement Points:**
- When evaluating a forest project's permanence: Use adjustment time, not residence time
- For soil carbon projects: Distinguish labile (decadal) vs stable (centennial) fractions
- For direct air capture: Geological storage = true permanence (geological reservoir)

**Practical Exercise: Carbon Cycle Accounting**
*Scenario:* A reforestation project sequesters 50,000 tCO2/yr for 30 years. 20% reversal risk at year 20.
*Tasks:*
1. Calculate cumulative sequestration
2. Apply Bern model to estimate atmospheric retention at year 100
3. Compare with geological storage permanence
*Time:* 30 min
*Deliverable:* Permanence risk memo with quantitative estimates
*Rubric:* Bern model application (40%), risk quantification (30%), comparison (30%)

**Knowledge Check:**
1. Why is adjustment time (~100 yr) used for GWP100, not residence time (4 yr)? (Perturbation decay vs molecule lifetime)
2. What fraction of emitted CO2 remains after 1000 years? (~22% — the a0 term)
3. What is the airborne fraction and why does it matter? (~45% — fraction staying in atmosphere)

**Sources:**
1. IPCC AR6 WG1 Chapter 5 (2021) — Global Carbon Cycle
2. Joos et al. (2013) — "Carbon cycle and climate model response" — ACP
3. Friedlingstein et al. (2023) — "Global Carbon Budget 2023" — ESSD
4. Archer et al. (2009) — "Atmospheric lifetime of fossil fuel CO2" — Annual Reviews

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: STATIC (fundamental biogeochemistry) | Regulatory Review: Annual*

---

### Lesson 1.1.3: CO2 Equivalence — GWP, GTP & Metric Choices
**Lesson Code:** C01.1.3
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** foundation

**Learning Objectives:**
1. Define Global Warming Potential (GWP) and calculate CO2e from multi-gas emissions (Bloom: Apply)
2. Compare GWP vs Global Temperature Potential (GTP) and explain when each is appropriate (Bloom: Analyze)
3. Evaluate metric choice implications for carbon credit fungibility and project evaluation (Bloom: Evaluate)

**Prerequisites:** C01.1.1, C01.1.2

**Why This Matters:**
Every carbon credit is denominated in **tCO2e** (tonnes CO2 equivalent). But "equivalence" depends on the metric (GWP100, GWP20, GTP100), time horizon, and climate model version. A methane credit priced at GWP100=28 vs GWP20=84 changes project economics by 3×. Understanding metric choice is essential for credit valuation and regulatory compliance.

**Core Concept: Equivalence is a Policy Choice, Not Pure Physics**

### 1.1.3.1 Global Warming Potential (GWP) — Definition
**GWP(H)** = Time-integrated radiative forcing of 1 kg gas / Time-integrated RF of 1 kg CO2, over horizon H

```
GWP(H) = ∫₀ᴴ RF_gas(t) dt / ∫₀ᴴ RF_CO2(t) dt
```

**Key Properties:**
- **CO2 reference:** GWP(CO2) ≡ 1 for all horizons
- **Time horizon matters:** Short-lived gases (CH4) have high GWP20, lower GWP100
- **Not symmetric:** GWP(CH4→CO2) ≠ 1/GWP(CO2→CH4)

### 1.1.3.2 IPCC GWP Values — Evolution Across Assessment Reports

| Gas | Lifetime (yr) | SAR (1995) | TAR (2001) | AR4 (2007) | AR5 (2013) | AR6 (2021) |
|-----|---------------|------------|------------|------------|------------|------------|
| **CO2** | Variable | 1 | 1 | 1 | 1 | **1** |
| **CH4** | 11.8 | 21 (100) | 23 | 25 | 28 (100) / 84 (20) | **27.9 (100) / 79.7 (20)** |
| **N2O** | 109 | 310 | 296 | 298 | 265 (100) | **273 (100)** |
| **HFC-134a** | 13.4 | 1,300 | 1,300 | 1,430 | 1,300 | **1,530** |
| **SF6** | 3,200 | 23,900 | 22,200 | 22,800 | 23,500 | **25,200** |

**AR6 Changes:** Updated lifetimes, climate-carbon feedbacks, ERF vs RF

### 1.1.3.3 GWP vs GTP — Two Metrics, Different Questions

| Aspect | **GWP (Global Warming Potential)** | **GTP (Global Temperature Potential)** |
|--------|-----------------------------------|----------------------------------------|
| **Definition** | Integrated RF over H years | Temperature change at year H per kg emission |
| **Question** | "How much heat trapped over H years?" | "How much warming at year H?" |
| **Time Horizon** | Integral 0→H | Endpoint at H |
| **Physical Basis** | Energy accumulation | Temperature response |
| **CH4 GWP100 / GTP100** | 27.9 | ~7-11 (model-dependent) |
| **Policy Use** | Kyoto, Paris, CORSIA, CCTS, VCM | IPCC reports, long-term targets |

**GTP Formula (simplified):**
```
GTP(H) = ∫₀ᴴ RF(t) · R(H-t) dt / ∫₀ᴴ RF_CO2(t) · R(H-t) dt
```
Where R(t) = climate response function (temperature impulse response)

**CH4 Metric Comparison (AR6):**
| Metric | H=20 | H=100 |
|--------|------|-------|
| GWP | 79.7 | 27.9 |
| GTP | ~50 | ~7-11 |

### 1.1.3.4 Metric Choice Implications

| Decision | GWP100 | GWP20 | GTP100 |
|----------|--------|-------|--------|
| **Methane Priority** | Moderate | Very High | Low |
| **Short-term Warming** | Underweights | Captures well | Better aligned |
| **Long-term Temperature** | Overweights short-lived | Overweights | Better aligned |
| **Policy Use** | Kyoto, CORSIA, CCTS, VCM (default) | Some voluntary standards | IPCC long-term scenarios |
| **Credit Fungibility** | Standard (tCO2e) | Not standard | Not used for credits |

### 1.1.3.5 Carbon Credit Implications

| Scenario | GWP100 (AR6) | GWP20 (AR6) | Impact |
|----------|--------------|-------------|--------|
| **Methane avoidance** (1 tCH4) | 27.9 tCO2e | 79.7 tCO2e | 2.9× more credits at GWP20 |
| **N2O avoidance** (1 tN2O) | 273 tCO2e | 273 tCO2e | Same (long-lived) |
| **HFC-134a avoidance** (1 t) | 1,530 tCO2e | 4,140 tCO2e | 2.7× difference |

**Market Practice:**
- **CCTS:** Uses GWP100 (AR5 or AR6 per notification)
- **CORSIA:** GWP100 (AR5)
- **VCM (Verra/GS):** GWP100 (AR5 for legacy, AR6 for new)
- **EU ETS:** GWP100 (AR4 for Phase 3, AR5 for Phase 4)

### 1.1.3.6 CO2e Calculation — Worked Example

**Project emits:** 100 tCO2 + 5 tCH4 + 0.2 tN2O/yr

**Using AR6 GWP100:**
```
CO2e = 100×1 + 5×27.9 + 0.2×273
     = 100 + 139.5 + 54.6
     = 294.1 tCO2e/yr
```

**Using AR6 GWP20:**
```
CO2e = 100×1 + 5×79.7 + 0.2×273
     = 100 + 398.5 + 54.6
     = 553.1 tCO2e/yr  (88% higher!)
```

**Using AR5 GWP100 (legacy):**
```
CO2e = 100×1 + 5×28 + 0.2×265
     = 100 + 140 + 53
     = 293 tCO2e/yr  (close to AR6 GWP100 for this mix)
```

### 1.1.3.7 India Context
- India's methane emissions: ~35 MtCH4/yr (2021) → 977 MtCO2e (GWP100) vs 2,790 MtCO2e (GWP20)
- Major sources: Agriculture (enteric fermentation ~60%), Waste (~20%), Energy (~20%)
- CCTS methodology will specify GWP version — likely AR6 GWP100
- National GHG inventory (BUR) uses AR5 GWP100 per UNFCCC guidelines

### 1.1.3.8 EtherTrack Context
- Platform stores emissions by gas (CO2, CH4, N2O, HFCs, PFCs, SF6)
- CO2e calculated on-the-fly using configurable GWP version
- Supports GWP100 (AR4/AR5/AR6), GWP20, GTP100
- Credit metadata includes: `gwp_version`, `gwp_horizon`, `metric_type`

### 1.1.3.9 Common Mistakes
1. Using AR4 GWP for new projects (outdated — AR6 is current science)
2. Mixing GWP100 and GWP20 in same portfolio without disclosure
3. Assuming GWP = GTP — they answer different questions
4. Applying GWP100 to methane when project lifetime < 20 years

### 1.1.3.9 Professional Judgement Points
- For short-lived projects (<20 yr): Consider GWP20 or GTP for methane
- For compliance markets: Use mandated metric (CCTS/CORSIA specify)
- For portfolio reporting: Disclose GWP version used; provide sensitivity
- For methane projects: GWP20 may better reflect climate impact but GWP100 is standard

### 1.1.3.10 Practical Exercise: Metric Sensitivity Analysis
*Scenario:* A landfill gas capture project avoids 10,000 tCH4/yr for 15 years. Credit price: $15/tCO2e.
*Tasks:*
1. Calculate annual credits at GWP100 (AR6) vs GWP20 (AR6)
2. Calculate revenue difference over project lifetime
3. Discuss which metric better represents climate benefit for 15-yr project
*Time:* 30 min
*Deliverable:* Sensitivity table + recommendation memo
*Rubric:* Calculation accuracy (40%), economic analysis (30%), climate rationale (30%)

**Knowledge Check:**
1. Why does CH4 GWP20 (79.7) >> GWP100 (27.9)? (Short lifetime ~12 yr → most forcing in first 20 yr)
2. When would you use GTP instead of GWP? (Long-term temperature targets, not credit markets)
3. Can a project use different GWP for different gases? (No — methodology mandates single version)

**Sources:**
1. IPCC AR6 WG1 Chapter 7 (2021) — Section 7.6: Emission Metrics
2. IPCC AR6 WG1 Chapter 7 — Supplementary Material 7.SM.1
3. Allen et al. (2016) — "Use of GWP* as a metric" — Climatic Change
4. UNFCCC Decision 18/CMA.1 — Common metrics for NDCs
5. CCTS Draft Methodology Guidelines (2024) — Metric specification

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC (IPCC AR7 may update GWPs) | Regulatory Review: Per IPCC cycle*