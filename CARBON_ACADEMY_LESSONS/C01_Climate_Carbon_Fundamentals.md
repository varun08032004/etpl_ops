# C01: Climate & Carbon Fundamentals
## Module 1.1: Greenhouse Effect & Carbon Cycle (2h, 3 lessons × 40min)

### Lesson 1.1.1: The Physics of the Greenhouse Effect
**Lesson Code:** C01.1.1
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** foundation

**Learning Objectives:**
1. Calculate the radiative forcing contribution of CO2, CH4, and N2O given concentration changes (Bloom: Apply)
2. Explain the mechanism of greenhouse gas absorption in the infrared spectrum using the concept of molecular vibrational modes (Bloom: Understand)
3. Distinguish between radiative forcing, effective radiative forcing, and climate feedbacks (Bloom: Analyze)

**Prerequisites:** Basic physics (electromagnetic spectrum, molecular structure), high school chemistry

**Why This Matters:**
The greenhouse effect is the physical foundation of all carbon markets. Every carbon credit represents a claim about altering Earth's radiative balance. Without understanding the physics, you cannot evaluate whether a carbon credit represents a real atmospheric benefit or an accounting artifact.

**Core Concept: The Greenhouse Effect**
The greenhouse effect occurs because certain atmospheric gases absorb and re-emit infrared radiation. Solar radiation (shortwave, ~0.3-3 μm) passes through the atmosphere and warms Earth's surface. The surface emits longwave infrared radiation (4-100 μm). Greenhouse gases (GHGs) absorb this outgoing longwave radiation at specific wavelengths corresponding to their molecular vibrational transitions, re-emitting it in all directions—including back toward the surface. This raises the effective emission temperature and surface temperature.

**Detailed Explanation:**

**1.1.1 Radiative Transfer Fundamentals**
Earth's energy budget: Incoming solar radiation ≈ 340 W/m² (TOA). ~30% reflected (albedo), ~70% absorbed. To maintain equilibrium, Earth must emit ~240 W/m² as outgoing longwave radiation (OLR). Without greenhouse gases, surface temperature would be ~255 K (-18°C). Actual global mean surface temperature is ~288 K (+15°C). The ~33°C difference is the greenhouse effect.

**1.1.2 Molecular Absorption Physics**
GHGs absorb IR because their molecular vibrations create a changing dipole moment. Key vibrational modes:
- CO2: asymmetric stretch (~4.3 μm / 2350 cm⁻¹), bending mode (~15 μm / 667 cm⁻¹)
- CH4: C-H stretches (~3.3 μm / 3000 cm⁻¹), bending modes (~7.7 μm)
- N2O: asymmetric stretch (~4.5 μm), bending (~7.8 μm)
- H2O: rotational-vibrational bands (broad, 5-8 μm, >12 μm)

Absorption follows Beer-Lambert law: I = I₀e^(-αcl), where α = absorption coefficient, c = concentration, l = path length. At current concentrations, CO2 bands near saturation in band centers; additional forcing comes from band wings and pressure broadening.

**1.1.3 Radiative Forcing (RF)**
RF = change in net irradiance at tropopause after stratospheric adjustment (W/m²). 
IPCC AR6 (2021) best estimates (1750-2019):
- CO2: +2.16 W/m² (410 ppm vs 278 ppm)
- CH4: +0.54 W/m² (1876 ppb vs 722 ppb)
- N2O: +0.21 W/m² (332 ppb vs 270 ppb)
- Total anthropogenic RF: +2.72 W/m²

RF ≈ α × ln(C/C₀) for CO2, where α = 5.35 W/m² (Myhre et al. 1998). For CO2 doubling (278→556 ppm): RF ≈ 3.7 W/m².

**1.1.4 Carbon Cycle Reservoirs and Fluxes (IPCC AR6, GCP 2023)**
| Reservoir | Carbon (GtC) | Flux (GtC/yr) |
|-----------|--------------|---------------|
| Atmosphere | 880 | - |
| Ocean (surface) | 900 | 90 (air-sea) |
| Ocean (deep) | 37,000 | - |
| Land (vegetation) | 450 | 120 (GPP), 119 (Ra+Rh) |
| Land (soils) | 1,700 | - |
| Fossil fuels | ~10,000 | 9.6 (emissions) |
| Land-use change | - | 1.6 (emissions) |

Annual net: Atmosphere +5.2 GtC/yr (≈2.4 ppm/yr). Airborne fraction ~45%.

**1.1.5 CO2 Equivalent (CO2e) Calculations**
Global Warming Potential (GWP) integrates RF over time horizon relative to CO2. IPCC AR6 GWP100:
- CO2: 1 (reference)
- CH4: 27.9 (fossil), 27.0 (non-fossil) — includes climate-carbon feedbacks
- N2O: 273
- SF6: 25,200

CO2e = mass × GWP. Example: 1 tonne CH4 = 27.9 tCO2e (fossil). Note: GWP* metric (Allen et al. 2018) better for short-lived gases by relating emission rate to CO2-equivalent warming.

**Worked Example: Calculating CO2e from Gas Concentration Changes**
Scenario: Atmospheric CO2 rises from 410 ppm to 420 ppm. CH4 from 1,875 ppb to 1,900 ppb.
1. CO2: RF = 5.35 × ln(420/410) = 5.35 × 0.0241 = 0.129 W/m²
2. CH4: RF = 0.036 × (√1900 - √1875) - f(M,N) [Etminan et al. 2016]
   ≈ 0.036 × (43.59 - 43.30) = 0.010 W/m² (simplified)
3. CO2-eq of CH4 change = 0.010 / 5.35 × ln(2) × (CO2 mass) — requires integration
   
*Standard approach: Use GWP100. 25 ppb CH4 increase ≈ 0.0136 Gt CH4 ≈ 0.38 GtCO2e (using GWP100=27.9)*

**Industry Context:**
- Carbon credits represent 1 tCO2e of verified reduction/removal
- Methodologies must demonstrate RF reduction equivalence
- GWP100 is standard but contested for short-lived gases (CH4)
- IPCC AR7 (2027+) may update GWPs

**India Context:**
- India's GHG inventory (2019): 2.9 GtCO2e (excl. LULUCF), 3rd largest globally
- Energy sector: 75% of emissions (coal-dominated power)
- Per capita: ~1.9 tCO2e vs global ~4.7 tCO2e
- NDC target: 45% emissions intensity reduction by 2030 (from 2005)

**EtherTrack Context:**
- Platform records credits as 1 tCO2e = 1 ERC-1155 token
- Registry bridge validates GWP methodology per credit
- Platform enforces GWP100 per current IPCC guidelines

**Common Mistakes:**
1. Using outdated GWPs (e.g., SAR GWP: CH4=21, N2O=310)
2. Confusing radiative forcing with temperature change
3. Treating CO2e as physical mass rather than warming-equivalent
4. Ignoring GWP time horizon dependency (GWP20 vs GWP100)
5. Double-counting CH4 oxidation to CO2 in GWP

**Professional Judgement Points:**
- When evaluating a project, check which GWP version the methodology uses
- For CH4 projects, ask whether GWP* or GWP100 is more appropriate
- Verify emission factors match IPCC guidelines year
- Check whether biogenic CO2 is treated correctly

**Practical Exercise: Radiative Forcing Calculation**
*Scenario:* A project reduces CH4 emissions by 10,000 tonnes/year from a landfill gas capture system. Calculate the annual RF reduction in W/m² and CO2e using both GWP100 and GWP20.
*Time:* 30 min
*Deliverable:* Spreadsheet with RF calculation and CO2e under GWP100/GWP20
*Skills tested:* RF formulas, GWP application, unit conversion
*Rubric:* Correct formula application (40%), unit conversion (30%), GWP comparison (30%)

**Knowledge Check:**
1. What is the radiative forcing of CO2 increase from 400 to 420 ppm? (Answer: ~0.26 W/m²)
2. Why does CH4 have higher GWP20 than GWP100? (Answer: Short atmospheric lifetime ~12 yr)
3. What is the airborne fraction of CO2 emissions? (Answer: ~45%)

**Sources:**
1. IPCC AR6 WG1 (2021) - Chapter 7: Earth's energy budget, Chapter 5: Carbon cycle
2. Myhre et al. (1998) "New estimates of radiative forcing due to well mixed greenhouse gases" - GRL
3. Etminan et al. (2016) "Radiative forcing of carbon dioxide, methane, and nitrous oxide" - GRL
4. IPCC AR6 WG1 Chapter 7 Supplement - GWP values
5. Global Carbon Project 2023 - Carbon budget
6. IPCC AR6 WG3 Chapter 12 - Cross-sectoral perspectives

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-15 | Content Risk: STATIC | Regulatory Review: Biennial*

---

# C01.1.2: The Global Carbon Cycle and Anthropogenic Perturbation
**Lesson Code:** C01.1.2
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** foundation

**Learning Objectives:**
1. Quantify major carbon fluxes between atmosphere, ocean, and land reservoirs using IPCC AR6 flux values (Bloom: Apply)
2. Explain the difference between fast (biological) and slow (geological) carbon cycles and their relevance to carbon credit permanence (Bloom: Understand)
3. Evaluate the airborne fraction concept and its implications for carbon budget calculations (Bloom: Evaluate)

**Prerequisites:** C01.1.1 (Greenhouse Effect physics)

**Why This Matters:**
Carbon credits represent interventions in the carbon cycle. Whether a project avoids emissions, enhances sinks, or removes CO2, it operates within Earth's carbon cycle. Understanding reservoir sizes, flux magnitudes, and timescales is essential to judge whether a project's claimed carbon benefit is physically plausible and durable.

**Core Concept: The Carbon Cycle as a Coupled System**

**1.2.1 Reservoir Sizes and Residence Times (IPCC AR6)**
| Reservoir | Size (GtC) | Residence Time | Exchange Rate (GtC/yr) |
|-----------|------------|----------------|------------------------|
| Atmosphere | 880 | ~4 yr (CO2) | 180 (air-sea + air-land) |
| Surface Ocean | 900 | ~10 yr | 90 |
| Deep Ocean | 37,000 | ~1,000 yr | ~0.1 (overturning) |
| Terrestrial Vegetation | 450 | ~10-100 yr | 120 (GPP) |
| Soils | 1,700 | ~10-1,000 yr | 119 (Rh) |
| Permafrost | ~1,400 | - | - |
| Fossil Reserves | ~10,000 | Geological | ~10 (extraction) |

Key insight: Atmosphere is small but well-mixed; deep ocean is vast but slow; land fluxes are large but reversible.

**1.2.2 The Fast Carbon Cycle (Biological)**
Photosynthesis: CO2 + H2O + light → CH2O + O2 (GPP ≈ 120 GtC/yr)
Autotrophic respiration (Ra): ~60 GtC/yr
Heterotrophic respiration (Rh): ~60 GtC/yr
Net Primary Production (NPP) = GPP - Ra ≈ 60 GtC/yr
Net Ecosystem Exchange (NEE) = NPP - Rh ≈ 0 (pre-industrial steady state)
Net Biome Production (NBP) = NEE - disturbances (fire, harvest, land-use change)

Current: Land sink ≈ -3.0 GtC/yr (net uptake, IPCC AR6)

**1.2.3 The Slow Carbon Cycle (Geological)**
Weathering: CaSiO3 + CO2 → CaCO3 + SiO2 (timescale: 100,000-1,000,000 yr)
Volcanism: ~0.1-0.3 GtC/yr (long-term source)
Sedimentation: Organic carbon burial ~0.2 GtC/yr; CaCO3 burial ~0.3 GtC/yr
Subduction & metamorphism: returns carbon to atmosphere over millions of years

**1.2.4 Anthropogenic Perturbation (1750-2023)**
Fossil fuel emissions: ~475 GtC cumulative (1750-2023)
Land-use change: ~230 GtC cumulative
Total anthropogenic: ~705 GtC

Atmospheric increase: +280 GtC (40% of emissions)
Ocean sink: ~170 GtC (24%)
Land sink: ~220 GtC (31%)
Implied budget imbalance: ~35 GtC (uncertainty in land-use change)

**1.2.5 Airborne Fraction (Af)**
Af = (Atmospheric CO2 increase) / (Total anthropogenic CO2 emissions)
Historical mean (1850-2023): ~45%
Recent decade (2013-2022): ~48% (increasing trend, Friedlingstein et al. 2023)

Af depends on:
- Sink saturation (ocean carbonate chemistry, land nutrient limits)
- Emission rate (faster emissions → higher Af)
- Climate-carbon feedbacks (warming reduces sink efficiency)

**1.2.5 Carbon Budgets and Remaining Budgets**
Remaining carbon budget for 1.5°C (50% likelihood, from 2024): ~250 GtCO2 (~68 GtC)
At current emissions (~40 GtCO2/yr): ~6 years at current rate
For 2°C (66% likelihood): ~1,150 GtCO2 (~313 GtC)

**Worked Example: Project-Scale Carbon Cycle Impact**
A reforestation project claims to sequester 50,000 tCO2/yr over 30 years on 5,000 ha.
1. Total claim: 1.5 MtCO2 over 30 years
2. Land required: 5,000 ha × 30 yr = 150,000 ha-yr
3. Implied sequestration rate: 10 tCO2/ha/yr (2.7 tC/ha/yr)
3. Compare to NPP: Temperate forest NPP ~10 tC/ha/yr → 2.7 tC/ha/yr is plausible for young forest
4. Permanence risk: Carbon stored in biomass vulnerable to fire, disease, harvest
4. Additionality: Would this land have regenerated naturally?

*Carbon cycle context: 1.5 MtCO2 = 0.0015 GtCO2 = 0.0004 GtC. Global emissions ~40 GtCO2/yr. This project = 0.00375% of annual global emissions.*

**India Context:**
- India's forest cover: 713,789 km² (21.7% of land area, FSI 2021)
- Forest carbon stock: ~7,200 MtCO2 (2019)
- National Mission for Green India: Target 5 Mha afforestation
- Compensatory Afforestation Fund (CAF): ₹47,000+ crore available
- REDD+ readiness: India submitted FREL/FRL to UNFCCC (2018)

**EtherTrack Context:**
- Platform tracks biogenic vs fossil carbon separately
- Registry bridge validates permanence mechanisms (buffer pools, insurance)
- Platform distinguishes removal credits (ARR, REDD+) from avoidance

**Common Mistakes:**
1. Confusing GPP with NPP (difference = autotrophic respiration)
2. Assuming land sink is permanent (vulnerable to climate change, land-use reversal)
3. Ignoring saturation of ocean sink (Revelle factor limits uptake)
4. Double-counting land sink in national inventories and project claims

**Professional Judgement Points:**
- When reviewing a forest project, ask: Is the baseline deforestation rate credible?
- For soil carbon projects: What is the saturation timescale? (decades to centuries)
- For blue carbon: What is the methane offset? (wetlands emit CH4)
- Always check: Is the carbon pool measured or modeled?

**Practical Exercise: Carbon Budget Allocation**
*Scenario:* A country has a remaining 1.5°C budget of 500 MtCO2. It plans 50 MtCO2/yr emissions for 10 years. Can it stay within budget if it funds 5 MtCO2/yr of international credits?
*Time:* 30 min
*Deliverable:* Budget trajectory spreadsheet with/without credits
*Skills:* Carbon budget math, credit fungibility, policy interpretation

**Knowledge Check:**
1. What fraction of anthropogenic CO2 remains in atmosphere after 100 years? (~40%)
2. Why is the airborne fraction increasing? (Sink saturation + climate feedbacks)
3. What is the difference between NPP and NBP? (NBP = NPP - Rh - disturbances)

**Sources:**
1. IPCC AR6 WG1 Chapter 5: Carbon and other biogeochemical cycles
2. Friedlingstein et al. (2023) "Global Carbon Budget 2023" - ESSD
5. Ciais et al. (2013) "Carbon and other biogeochemical cycles" - IPCC AR5
6. Global Carbon Project 2023 - carbonbudget.org

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-15 | Content Risk: STATIC | Regulatory Review: Biennial*

---

# C01.1.3: International Climate Architecture — From UNFCCC to Paris
**Lesson Code:** C01.1.3
**Duration:** 30 minutes
**Lesson Type:** document
**Tier:** foundation

**Learning Objectives:**
1. Trace the evolution from UNFCCC (1992) → Kyoto Protocol → Paris Agreement and explain the legal distinction between targets and contributions (Bloom: Understand)
2. Explain the role of Article 6 in enabling international carbon markets under Paris Agreement (Bloom: Understand)
3. Distinguish between NDCs, LT-LEDS, and the Global Stocktake in the Paris architecture (Bloom: Analyze)

**Prerequisites:** C01.1.1, C01.1.2

**Why This Matters:**
Carbon markets do not exist in a legal vacuum. Every carbon credit's legal validity, transferability, and usability for compliance depends on the international legal framework. Understanding the treaty architecture tells you whether a credit can be used for NDC achievement, CORSIA compliance, or voluntary claims—and under what authorization.

**Core Concept: The Climate Regime Architecture**

**1.3.1 UNFCCC (1992) — The Framework Convention**
Objective: "Stabilization of greenhouse gas concentrations... at a level that would prevent dangerous anthropogenic interference"
Key principles:
- Common but differentiated responsibilities and respective capabilities (CBDR-RC)
- Precautionary principle
- Right to sustainable development
- No legal emission targets — framework only

**1.3.2 Kyoto Protocol (1997/2005) — First Commitment Period (2008-2012)**
Legally binding emission targets for Annex I countries (avg -5.2% vs 1990)
Market mechanisms created:
- Article 6: Joint Implementation (JI) — Annex I to Annex I
- Article 12: Clean Development Mechanism (CDM) — Annex I → non-Annex I
- Article 17: International Emissions Trading (IET) — Annex I ↔ Annex I
CERs (CDM) and ERUs (JI) = 1 tCO2e units
Second Commitment Period (2013-2020): Doha Amendment, limited participation

**1.3.3 Paris Agreement (2015/2016) — The New Architecture**
Objective: Hold warming "well below 2°C" and pursue 1.5°C
Key shifts from Kyoto:
- Universal participation (all Parties submit NDCs)
- Bottom-up NDCs (Nationally Determined Contributions) — self-determined
- No legal emission targets — but legal obligation to prepare, communicate, maintain NDCs
- Progression principle: Each successive NDC must represent progression
- Global Stocktake every 5 years (first: 2023)
- Transparency framework: Enhanced Transparency Framework (ETF)

**1.3.4 Article 6 — The Market Architecture**
Article 6.2: Cooperative approaches — bilateral/regional, ITMOs (Internationally Transferred Mitigation Outcomes)
- Requires: Corresponding adjustments (CAs) to avoid double counting
- Robust accounting, no double counting, environmental integrity
- Can involve private entities with Party authorization

Article 6.4: Mechanism — centralized UNFCCC mechanism (successor to CDM)
- Supervised by Article 6.4 Supervisory Body
- Activity cycle: Design → Validation → Registration → Monitoring → Verification → Issuance
- A6.4ERs (Article 6.4 Emission Reductions) units
- Mandatory share of proceeds (SoP) for adaptation: 5% of issued units
- 2% of units cancelled for OMGE (Overall Mitigation in Global Emissions)

Article 6.8: Non-market approaches (NMA) — holistic, non-market cooperation

**1.3.5 CORSIA — Aviation Sector Market**
Carbon Offsetting and Reduction Scheme for International Aviation (ICAO)
- Baseline: 2019 emissions (adjusted for COVID)
- Phases: Pilot (2021-2023), First (2024-2026), Second (2027-2035)
- Eligible units: CORSIA-eligible programs (currently: CDM, VCS, GS, ACR, ART)
- Only for international aviation growth above 2019 baseline

**1.3.6 Corresponding Adjustments (CA) — The Double Counting Solution**
Problem: If Country A sells ITMO to Country B, both might count it.
Solution (Decision 2/CMA.3, Glasgow):
- Selling Party: Deducts ITMO from its NDC achievement (subtracts from inventory)
- Buying Party: Adds ITMO to its NDC achievement (adds to inventory)
- Registry systems must track authorization, first transfer, and CAs
- Article 6.4: Automatic CA upon issuance

**India Context:**
- India's NDC (updated 2022): 45% emissions intensity reduction by 2030 (vs 2005), 50% non-fossil electricity capacity, net-zero by 2070
- India hosts CDM projects (2nd largest host historically)
- Article 6.2 bilateral agreements: Japan, Sweden, Switzerland, Singapore
- CCTS: Domestic compliance market operating under Energy Conservation Act
- India's position on Article 6: Supports robust accounting, opposes transition of CDM credits without CAs

**EtherTrack Context:**
- Platform supports Article 6.2 bilateral workflows (authorization, CA tracking)
- Registry bridge designed for CA tracking per Decision 2/CMA.3
- Platform supports 6.4ERs once Supervisory Body operationalizes

**Common Mistakes:**
1. Confusing CDM (Kyoto) with Article 6.4 (Paris) — different legal bases
2. Assuming voluntary credits = Article 6 units — only authorized ITMOs/6.4ERs count
3. Forgetting corresponding adjustments — the central accounting innovation
4. Thinking voluntary market credits can satisfy NDCs — they cannot without authorization

**Professional Judgement Points:**
- When a client asks "Can I use this credit for my NDC?", the first question is: Is it an authorized ITMO or 6.4ER with CA?
- For voluntary claims: VCMI Claims Code specifies which credits qualify for which claim tier
- Article 6.2 vs 6.4 choice: 6.2 = bilateral flexibility; 6.4 = standardized, multilateral

**Practical Exercise: Article 6 Transaction Analysis**
*Scenario:* Country A (host) authorizes a renewable energy project to generate ITMOs sold to Country B. Country A's NDC target is -30% by 2030. Country B's NDC is -40%. The project reduces 1 MtCO2/yr.
1. How does Country A's inventory change?
2. How does Country B's inventory change?
3. What registry entries are needed?
*Time:* 30 min
*Deliverable:* Inventory adjustment table with corresponding adjustments

**Knowledge Check:**
1. What is the legal difference between a CER (CDM) and an ITMO (Article 6.2)? (Different treaty base, CA requirement)
2. What is the OMGE? (Overall Mitigation in Global Emissions — 2% cancellation under Art 6.4)
3. Can a voluntary market credit (e.g., VCS) be used for NDC compliance? (No, unless authorized as ITMO)

**Sources:**
1. UNFCCC (1992) - Full convention text
2. Kyoto Protocol (1997) - Articles 6, 12, 17
3. Paris Agreement (2015) - Articles 4, 6, 13, 14
4. Decision 2/CMA.3 (Glasgow, 2021) - Article 6 rules
4. Decision 3/CMA.3 - Article 6.4 rules
5. ICAP ETS Map - Global ETS status
6. VCMI Claims Code (2023) - Voluntary claims integrity

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-15 | Content Risk: DYNAMIC (Article 6 rules evolving) | Regulatory Review: Quarterly*

---