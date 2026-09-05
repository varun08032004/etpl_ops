# C04: GHG Accounting (Scopes 1/2/3)
## Module 4.2: Scope 3 Mapping (3 lessons × 40min = 2h)

### Lesson 4.2.1: Category Deep-Dive — Upstream Categories (1-8)
**Lesson Code:** C04.2.1
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** foundation

**Learning Objectives:**
1. Apply calculation methods for Categories 1-8 with appropriate data tiers (Bloom: Apply)
2. Design supplier engagement strategies for primary data collection (Bloom: Create)
3. Evaluate allocation methods for shared services and multi-product facilities (Bloom: Evaluate)

**Prerequisites:** C04.1.2

**Why This Matters:**
Upstream categories (1-8) typically represent 60-80% of Scope 3 emissions for manufacturers and retailers. These categories are where organizations have the most influence through procurement decisions, supplier engagement, and product design. Getting the calculation right here has the highest leverage for emissions reduction.

**Core Concept: Upstream = Procurement Leverage**

### 4.2.1.1 Category 1: Purchased Goods & Services — The Big One
**Typical Share:** 40-70% of Scope 3 for manufacturers/retailers

**Calculation Methods (Hierarchy):**
| Tier | Method | When to Use | Data Needs |
|------|--------|-------------|------------|
| **1** | Supplier-specific LCA/EPD | Strategic suppliers, high spend | Cradle-to-gate LCA, verified |
| **2** | Supplier activity + secondary EF | Willing suppliers, no LCA | Supplier fuel, electricity, process data |
| **3** | Industry average LCA databases | No supplier data | Ecoinvent, GaBi, DEFRA, Agri-footprint |
| **4** | Spend-based (EEIO) | No other data | $ spend × sector intensity (EXIOBASE, USEEIO) |

**Allocation for Multi-Product Facilities:**
| Method | When to Use | Pros | Cons |
|--------|-------------|------|------|
| **Physical** (mass, energy) | Physically measurable | Causality clear | May not reflect economic value |
| **Economic** (revenue, cost) | No physical basis | Reflects value driver | Market volatility |
| **Hybrid** | Mixed processes | Best of both | Complex |

**Supplier Engagement Strategy:**
```
Tier 1 (Top 80% spend): Direct engagement → LCA request → Site visit → Primary data
Tier 2 (Next 15%): Survey + secondary EF → Follow up on outliers
Tier 3 (Long tail): Spend-based EEIO → Monitor for hotspots
```

**Data Request Template (Minimum):**
1. Total energy consumption by fuel type (MWh, tonnes, m³)
2. Process emissions (non-combustion) by type
3. Production volume by product (tonnes, units)
4. Waste generation by type/disposal method
5. Renewable energy procurement (RECs, PPAs)

### 4.2.1.2 Category 2: Capital Goods
**Key Challenge:** Emissions occur upfront; benefits spread over asset life.

**Approaches:**
| Method | Formula | When to Use |
|--------|---------|-------------|
| **Supplier LCA** | Cradle-to-gate of equipment | Major equipment (>₹1 Cr) |
| **Industry Average** | Capex × sector intensity (kgCO2e/₹) | Standard equipment |
| **Hybrid** | Major items: LCA; rest: intensity | Mixed portfolio |

**Amortization:** Allocate emissions over asset useful life (straight-line or declining balance). Disclose method.

**India Context:** Indian infrastructure capex growing 15% YoY; steel/cement intensity high. Use Indian steel EF (2.5-2.8 tCO2/t) vs global avg (1.8-2.0).

### 4.2.1.3 Category 3: Fuel & Energy Related Activities (Not in Scope 1/2)
**Includes:** Upstream emissions of fuels (extraction, processing, transport), T&D losses, purchased steam/heat/cooling upstream.

**Calculation:**
```
Scope 3 Cat 3 = Σ (Scope 1 fuel × upstream EF) + (Scope 2 electricity × T&D loss EF) + (purchased steam/heat × upstream EF)
```

**Key EF Sources:**
- **Well-to-Tank (WTT) EFs:** DEFRA, IEA, GREET, Indian Petroleum Ministry
- **T&D Losses:** India ~18-20% (CEA); EF = grid EF × loss %
- **Steam/Heat:** Boiler efficiency × fuel upstream EF

**Avoid Double Counting:** Scope 1/2 already includes combustion emissions. Cat 3 = upstream only.

### 4.2.1.4 Category 4: Upstream Transportation & Distribution
**Scope:** Third-party logistics (not owned vehicles = Scope 1).

**Data Hierarchy:**
| Tier | Method | Data |
|------|--------|------|
| 1 | Carrier-specific (tonne-km × mode EF) | Carrier reports, telematics |
| 2 | Shipment-level (weight × distance × mode EF) | BOL, waybills, GPS |
| 3 | Spend-based + avg distance | Spend × avg distance × mode EF |
| 4 | EEIO | Spend only |

**Mode EFs (India, WTW):**
| Mode | EF (kgCO2e/tonne-km) |
|------|---------------------|
| Road (truck) | 0.08-0.12 |
| Rail | 0.015-0.025 |
| Coastal Ship | 0.005-0.015 |
| Air | 0.5-1.2 |

**Allocation for Shared Loads:** Weight-based (tonne-km) or volume-based (m³-km).

### 4.2.1.5 Category 5: Waste Generated in Operations
**Scope:** Operational waste sent to third-party disposal (not on-site = Scope 1).

**Waste Disposal EFs (India, kgCO2e/tonne):**
| Disposal Method | CO2e | CH4 (GWP) | Total |
|----------------|------|-----------|-------|
| Landfill (unmanaged) | 0 | ~1,200 | ~1,200 |
| Landfill (managed, gas capture) | 0 | ~200 | ~200 |
| Incineration (energy recovery) | 300-500 | ~50 | ~400 |
| Composting | 0 | ~50 | ~50 |
| Recycling (avoided) | -500 to -2000 | 0 | Negative |

**Key:** Measure waste by type (hazardous, non-hazardous, organic, recyclable) and disposal method.

### 4.2.1.6 Category 6: Business Travel
**Modes & EFs (India, kgCO2e/passenger-km):**
| Mode | EF (WTW) | Notes |
|------|----------|-------|
| Domestic Flight | 0.20-0.25 | Includes RFI ~1.9 |
| International Flight (short) | 0.15-0.20 | Includes RFI |
| International Flight (long) | 0.10-0.15 | Higher altitude |
| Train (electric) | 0.02-0.04 | Grid EF dependent |
| Train (diesel) | 0.04-0.06 | |
| Car (petrol, single) | 0.18-0.22 | |
| Car (EV, India grid) | 0.08-0.12 | Grid EF dependent |
| Hotel (per room-night) | 15-30 kgCO2e | Varies by star rating |

**Data Sources:** Travel management system, corporate card, employee surveys.

### 4.2.1.7 Category 7: Employee Commuting
**Approaches:**
1. **Survey-based:** Annual survey → mode share × distance × EF
2. **Model-based:** Census data × employee count × avg distance
3. **Hybrid:** Survey sample (20%) × extrapolation

**EFs (India, kgCO2e/passenger-km):**
| Mode | EF |
|------|-----|
| Car (petrol, solo) | 0.18 |
| Car (pool, 4 persons) | 0.045 |
| 2W (petrol) | 0.05 |
| 2W (EV) | 0.015 |
| Bus (public) | 0.02 |
| Metro/Rail | 0.015 |
| Walk/Cycle | 0 |

**Remote Work Adjustment:** Deduct commuting days per policy (hybrid: 40-60% reduction).

### 4.2.1.8 Category 8: Upstream Leased Assets
**Scope:** Assets leased *by* reporting org, operated by lessor (not in Scope 1/2).

**Examples:** Leased offices, warehouses, vehicles (if lessor operates), equipment.

**Calculation:** Same as Scope 1/2 for those assets, but attributed to lessee.

**India Context:** Growing co-working/warehousing lease market; ensure lease agreements clarify emissions responsibility.

### 4.2.1.8 Common Upstream Mistakes
1. **Cat 1 double counting:** Including Cat 3 (fuel upstream) in Cat 1 for same fuel
2. **Cat 4 allocation:** Using spend only for freight — inaccurate for dense vs light goods
3. **Cat 5 waste:** Reporting recycling as positive emissions (use negative for avoided)
4. **Cat 6/7:** Using only spend data — travel/commuting needs activity data
5. **Cat 8 confusion:** Leased assets where lessee operates = Scope 1/2, not Cat 8

### 4.2.1.9 Professional Judgement Points
- For Cat 1: Invest in Tier 1/2 for top 50 suppliers; Tier 4 for long tail
- For Cat 3: Use supplier-specific WTT EFs where available (oil/gas majors publish)
- For Cat 4: Require tonne-km from carriers — spend-based is audit weak
- For Cat 11 (downstream): Engage product engineering for energy consumption data

### 4.2.1.9 Practical Exercise: Upstream Calculation Workshop
*Scenario:* A textile manufacturer: ₹200 Cr fabric purchases, ₹50 Cr capex, 50 GWh grid electricity, 10,000 t coal, 500 tons waste (30% landfill, 70% recycling), 500 employees, 200 tkm road transport, 50 tkm rail.
*Tasks:*
1. Calculate Cat 1-4, 5, 6, 7, 8 using Tier 3/4 methods
2. Identify top 3 categories for primary data investment
3. Design supplier data request for top 10 fabric suppliers
*Time:* 45 min
*Deliverable:* Calculation spreadsheet + data request template
*Rubric:* Method selection (40%), calculation accuracy (30%), prioritization (30%)

**Knowledge Check:**
1. Why is Cat 3 separate from Scope 1/2? (Upstream extraction/processing vs combustion)
2. What is the key allocation challenge in Cat 1 for multi-product suppliers? (Physical vs economic allocation)
3. Why is recycling in Cat 5 reported as negative emissions? (Avoided virgin production)
4. When is Cat 8 applicable vs Scope 1/2? (Lessor operates the asset)

**Sources:**
1. GHG Protocol Scope 3 Standard — Chapters 5-8 (Upstream categories)
2. GHG Protocol Scope 3 Technical Guidance — Chapters 5-8
3. DEFRA Conversion Factors 2023 — Transport, Waste, Fuels
4. Indian Railway / NHAI emission factors
5. PCAF India Sectoral Guidance (2023)

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC (Supply chain methodologies evolving) | Regulatory Review: Semi-annual*

---

### Lesson 4.2.2: Category Deep-Dive — Downstream Categories (9-15)
**Lesson Code:** C04.2.2
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** foundation

**Learning Objectives:**
1. Apply calculation methods for Categories 9-15 with focus on Cat 11 (Use of Products) and Cat 15 (Investments) (Bloom: Apply)
2. Analyze data challenges for downstream categories and design estimation approaches (Bloom: Analyze)
3. Evaluate the role of product design and portfolio strategy in downstream emissions (Bloom: Evaluate)

**Prerequisites:** C04.2.1

**Why This Matters:**
Downstream categories are where product design, business model, and investment decisions create emissions leverage. For energy-intensive products, Cat 11 (Use of Sold Products) often exceeds Scope 1+2 combined. For financial institutions, Cat 15 (Investments) is the entire ballgame. These categories require different data strategies — often engineering estimates and financial attribution rather than procurement data.

**Core Concept: Downstream = Product & Portfolio Leverage**

### 4.2.2.1 Category 9: Downstream Transportation & Distribution
**Scope:** Outbound logistics to customers (not owned = Scope 1).

**Key Difference from Cat 4:** Cat 4 = inbound (supplier → you); Cat 9 = outbound (you → customer).

**Data Sources:** Shipping manifests, WMS, carrier invoices, customer locations.

**Allocation:** Same as Cat 4 — tonne-km or m³-km.

**E-commerce Specific:** Last-mile delivery dominates; use carrier-specific last-mile EFs.

### 4.2.2.2 Category 10: Processing of Sold Products
**Scope:** Intermediate products sold to third parties for further processing.

**Examples:** Steel sold to auto parts maker; flour sold to bakery; chemicals sold to formulator.

**Calculation:**
```
Cat 10 = Σ (Mass sold × processing EF per tonne)
```
**Challenge:** Downstream process often unknown.

**Approaches:**
1. **Industry average:** Sectoral EFs (e.g., steel forming: 0.3-0.5 tCO2/t)
2. **Customer engagement:** Request data from key customers
3. **Default:** Assume standard processing route per material

**Allocation:** Mass-based for homogeneous products; economic for mixed.

### 4.2.2.3 Category 11: Use of Sold Products — The Energy-Intensive Giant
**Often the LARGEST category** for: appliances, vehicles, HVAC, industrial equipment, power generation equipment.

**Two Sub-Categories:**
| Sub-Category | Scope | Examples |
|--------------|-------|----------|
| **11a: Direct Use Phase** | Energy consumed during use | Vehicles (fuel), appliances (electricity), HVAC (electricity/gas) |
| **11b: Indirect Use Phase** | Upstream of use-phase energy | Fuel production for vehicles, grid upstream for appliances |

**Calculation Framework:**
```
Cat 11a = Σ (Units sold × Lifetime energy use × Use-phase EF)
Cat 11b = Σ (Units sold × Lifetime energy use × Upstream EF)
```

**Key Parameters per Product:**
| Parameter | Source | Uncertainty |
|-----------|--------|-------------|
| **Annual energy consumption** | Nameplate, test standards (BEE star, BIS) | ±10-20% |
| **Product lifetime** | Warranty, industry avg, engineering design | ±20-30% |
| **Use-phase EF** | Grid EF (location-based) or fuel EF | ±10-30% |
| **Upstream EF** | WTT for fuel; grid upstream for electricity | ±20-40% |

**Lifetime Calculation:**
```
Lifetime energy = Annual consumption × Design life (years)
Design life = min(Warranty, Technical life, Economic life)
```

**Worked Example — 1.5 Ton AC (India):**
- Rated power: 1.5 kW; Annual hours: 1,200; Lifetime: 10 years
- Annual electricity: 1,800 kWh; Lifetime: 18,000 kWh
- Grid EF (location): 0.71 kgCO2/kWh → Cat 11a = 12.8 tCO2/unit
- Grid upstream EF: 0.15 kgCO2/kWh → Cat 11b = 2.7 tCO2/unit
- **Total Cat 11 = 15.5 tCO2e/unit over 10 years**

**India Context:** BEE star rating mandatory for ACs, refrigerators, fans. Use star rating tables for annual consumption.

### 4.2.2.3 Category 12: End-of-Life Treatment
**Scope:** Disposal/recycling of sold products by end users.

**Calculation:**
```
Cat 12 = Σ (Mass sold × End-of-life EF)
```

**End-of-Life EFs (kgCO2e/tonne):**
| Material | Landfill | Incineration | Recycling (avoided) |
|----------|----------|--------------|---------------------|
| Steel | ~10 | ~50 | -1,500 |
| Aluminum | ~10 | ~50 | -8,000 |
| Plastic (mixed) | ~50 | ~1,500 | -1,500 |
| Copper | ~10 | ~50 | -4,000 |
| E-waste (mixed) | ~200 | ~500 | -2,000 |

**Key:** Recycling credits are negative emissions (avoided virgin production). Apply cutoff or 50/50 allocation.

### 4.2.2.4 Category 13: Downstream Leased Assets
**Scope:** Assets leased *to* others, operated by lessee (not in lessor's Scope 1/2).

**Mirror of Cat 8.** Same calculation as Scope 1/2 for those assets.

### 4.2.2.4 Category 14: Franchises
**Scope:** Franchisee emissions (Scope 1+2 of franchisee).

**Applicability:** Franchisors with operational control franchises.

**Calculation:**
```
Cat 14 = Σ (Franchisee Scope 1 + Scope 2)
```
**Data:** Franchisee utility bills, fuel receipts, or benchmark × floor area.

### 4.2.2.5 Category 15: Investments — The Financial Institution Category
**Scope:** Financed emissions (Scope 1+2 of investee, attributed to investor).

**Governance:** **PCAF Standard (Partnership for Carbon Accounting Financials)** — global standard.

**Asset Classes & Attribution:**
| Asset Class | Attribution Factor | Emissions Scope |
|-------------|-------------------|-----------------|
| **Listed Equity** | Investor equity % × Investee Scope 1+2 | 1+2 |
| **Business Loans** | Outstanding / Enterprise Value × Investee Scope 1+2 | 1+2 |
| **Project Finance** | Investor share × Project Scope 1+2 | 1+2 |
| **Commercial RE** | Investor share × Building Scope 1+2 | 1+2 |
| **Mortgages** | Outstanding / Property Value × Building Scope 1+2 | 1+2 |
| **Motor Vehicle** | Outstanding / Vehicle Value × Vehicle Scope 1 | 1 |
| **Sovereign Debt** | Not required (optional) | — |

**PCAF Data Quality Scores (1-5):**
| Score | Description |
|-------|-------------|
| 1 | Audited emissions + audited financials |
| 2 | Unaudited emissions + audited financials |
| 3 | Estimated emissions + audited financials |
| 4 | Estimated emissions + estimated financials |
| 5 | Sector/region average (proxy) |

**Data Quality Target:** Weighted average score ≤ 3.0 by 2025.

**India Context:** RBI Climate Risk Guidelines (2024) encourage PCAF adoption. Major banks (SBI, HDFC, ICICI) publishing financed emissions.

### 4.2.2.6 Downstream Calculation Challenges & Solutions

| Challenge | Solution |
|-----------|----------|
| **Cat 11: Product lifetime unknown** | Use warranty period as minimum; engineering estimate as max |
| **Cat 11: Grid EF varies by region/customer** | Use sales-weighted average grid EF; disclose range |
| **Cat 11: Product used differently than designed** | Apply usage profiles (high/medium/low); sensitivity analysis |
| **Cat 15: Investee data unavailable** | PCAF Scores 4-5 (proxy); engage for improvement |
| **Cat 15: Double counting across investors** | PCAF attribution factors ensure sum ≤ 100% |

### 4.2.2.7 India Context — Downstream Specifics
- **Cat 11 (Appliances):** BEE star rating data mandatory; use labeled consumption
- **Cat 11 (Vehicles):** ARAI certified mileage × fuel EF; EV grid EF evolving
- **Cat 15:** RBI Climate Risk Guidelines (2024) → PCAF adoption timeline
- **BRSR:** Principle 6, Q7 — Disclose Scope 3 categories, methodology, emissions
- **CCTS:** Scope 3 methodologies under development (draft 2024)

**EtherTrack Context:** Platform supports Cat 11 engineering calculations (lifetime modeling); Cat 15 PCAF-compliant attribution engine.

### 4.2.2.8 Common Downstream Mistakes
1. **Cat 11:** Using nameplate power × 24/7 × 365 (ignores duty cycle, standby)
2. **Cat 11:** Ignoring Cat 11b (upstream of use-phase energy) — can be 20-30% of 11a
3. **Cat 11:** Assuming all units used identically (no usage profile)
4. **Cat 15:** Attributing 100% of investee emissions (must use PCAF attribution)
5. **Cat 15:** Using equity % for loans (wrong — use outstanding/EV)

### 4.2.2.9 Professional Judgement Points
- For Cat 11: Build usage profiles (high/medium/low) from warranty data + surveys
- For Cat 11: Model grid decarbonization over product lifetime (IEA scenarios)
- For Cat 15: Prioritize listed equity + corporate loans (highest data availability)
- For Cat 15: Engage top 20 investees for primary data; use proxies for tail

### 4.2.2.9 Practical Exercise: Downstream Calculation Workshop
*Scenario:* An Indian AC manufacturer sells 500,000 units/yr (1.5T 3-star, 10-yr life). Also has ₹5,000 Cr loan portfolio (60% corporate, 20% project finance, 20% RE).
*Tasks:*
1. Calculate Cat 11a, 11b for AC portfolio (lifetime modeling)
2. Estimate Cat 15 for loan portfolio using PCAF proxies
3. Identify top 3 data gaps and collection plan
*Time:* 45 min
*Deliverable:* Calculation model + data gap register
*Rubric:* Model structure (40%), PCAF application (30%), gap analysis (30%)

**Knowledge Check:**
1. Why does Cat 11 often exceed Scope 1+2 for appliance manufacturers? (Lifetime energy >> manufacturing)
2. What is the PCAF attribution factor for a business loan? (Outstanding / Enterprise Value)
3. Why does Cat 11b exist separately from 11a? (Upstream of use-phase energy is distinct from use-phase)
4. What PCAF data quality score should a bank target for listed equity? (Score 1-2)

**Sources:**
1. GHG Protocol Scope 3 Standard — Chapters 9-15
2. PCAF Global Standard (2020/2022) — Part A (Methodology), Part B (Asset Classes)
3. BEE Star Rating Database (India) — Appliance consumption
4. ARAI Vehicle Certification — Mileage & emissions
5. IEA World Energy Outlook — Grid decarbonization scenarios
6. PCAF India Implementation Guide (2023)

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC (PCAF evolving, grid decarbonizing) | Regulatory Review: Semi-annual*

---

### Lesson 4.2.3: Scope 3 Data Quality, Assurance & Reduction Planning
**Lesson Code:** C04.2.3
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** foundation

**Learning Objectives:**
1. Apply GHG Protocol data quality indicators (DQI) to Scope 3 categories (Bloom: Apply)
2. Design a Scope 3 verification readiness package (Bloom: Create)
3. Develop a Scope 3 reduction target and implementation roadmap aligned with SBTi (Bloom: Create)

**Prerequisites:** C04.2.1, C04.2.2

**Why This Matters:**
Scope 3 is where credibility lives or dies. Investors, regulators (SEBI BRSR, CSRD), and standards (SBTi, VCMI) demand: data quality transparency, third-party verification, and science-aligned reduction targets. This lesson teaches you to build a Scope 3 program that withstands scrutiny and drives real reduction.

**Core Concept: Quality → Verification → Reduction → Credibility**

### 4.2.3.1 Data Quality Indicators (DQI) — GHG Protocol Framework

**Five DQI Dimensions (per category):**
| Indicator | Scale (1-5) | Assessment |
|-----------|-------------|------------|
| **Technological Representativeness** | 1=Same tech, 5=Different tech | Does EF match actual technology? |
| **Geographical Representativeness** | 1=Same region, 5=Different continent | Does EF match facility location? |
| **Temporal Representativeness** | 1=Same year, 5=>10 yr old | Is EF vintage current? |
| **Completeness** | 1=All sources, 5=Major gaps | Are all sub-sources covered? |
| **Reliability/Uncertainty** | 1=Measured, 5=Proxy estimate | What's the confidence interval? |

**Scoring:** Average of 5 dimensions → Category DQI Score (1=Best, 5=Worst)

**DQI Reporting Template:**
| Category | Tech Rep | Geo Rep | Temp Rep | Complete | Reliability | Avg DQI | Tier |
|----------|----------|---------|----------|----------|-------------|---------|------|
| Cat 1 | 2 | 3 | 2 | 3 | 3 | 2.6 | 3 |
| Cat 11 | 2 | 4 | 3 | 2 | 3 | 2.8 | 3 |

**Reporting:** DQI per category mandatory per GHG Protocol; CDP/SBTi require disclosure.

### 4.2.3.2 Verification Readiness — Scope 3 Specifics

**Verification Scope Options:**
| Level | Scope | Typical Use |
|-------|-------|-------------|
| **Limited Assurance** | Scope 1+2 only | Entry level |
| **Reasonable Assurance** | Scope 1+2+3 (selected) | SBTi, CDP Leadership |
| **Reasonable Assurance** | Full Scope 3 | Regulatory (CSRD), Investor-grade |

**Scope 3 Verification Focus Areas:**
| Area | Verifier Focus | Preparation |
|-------|----------------|-------------|
| **Boundary** | All 15 categories assessed? Exclusions justified? | Category screening matrix |
| **Methods** | Tier-appropriate? Consistent? | Methodology sheets per category |
| **Data Trail** | Source → calculation traceable? | Linked source docs in database |
| **Allocation** | Physical/economic justified? | Allocation method register |
| **Recalculation** | Base year restated correctly? | Recalculation log |
| **Uncertainty** | Quantified? DQI reported? | Uncertainty budget + DQI table |
| **Targets** | Aligned with inventory boundary? | Target-inventory mapping |

**Verification Package Checklist:**
- [ ] Inventory report (GHG Protocol format)
- [ ] Methodology sheets per category
- [ ] Source document repository (linked)
- [ ] Calculation workbooks (versioned)
- [ ] Uncertainty budget + DQI table
- [ ] Exclusion register with rationale
- [ ] Recalculation log
- [ ] Target-inventory mapping
- [ ] Prior year verification opinion (if any)

### 4.2.3.3 Scope 3 Reduction Targets — SBTi Alignment

**SBTi Scope 3 Requirements (Corporate Net-Zero Standard v1.2):**
| Requirement | Detail |
|-------------|--------|
| **Coverage** | Minimum 67% of Scope 3 (by emissions) |
| **Target Type** | Absolute reduction (preferred) or intensity |
| **Timeframe** | Near-term: 5-10 years; Long-term: 2050 |
| **Ambition** | 1.5°C pathway: ~4.2%/yr linear reduction |
| **Scope 3 Inclusion** | Mandatory if >40% of total emissions |

**Target Types:**
| Type | Formula | When to Use |
|------|---------|-------------|
| **Absolute** | Total tCO2e reduction | Preferred; immune to growth |
| **Intensity** | tCO2e / unit output (revenue, production) | High-growth sectors |
| **Supplier Engagement** | % suppliers with targets | Complementary |

**Target Setting Process:**
```
1. Complete Scope 3 inventory (all 15 categories)
2. Screen for material categories (>67% coverage)
3. Model reduction levers per category
4. Set absolute target aligned to 1.5°C pathway
5. Submit to SBTi for validation
6. Annual progress reporting
```

**Reduction Levers by Category:**
| Category | Levers |
|----------|--------|
| **Cat 1: Purchased Goods** | Supplier engagement, material substitution, circular design, renewable procurement |
| **Cat 2: Capital Goods** | Low-carbon procurement, circular economy, asset life extension |
| **Cat 3: Fuel/Energy** | Renewable PPAs, green hydrogen, electrification |
| **Cat 4/9: Transport** | Mode shift (rail/ship), load consolidation, EV fleet, SAF |
| **Cat 5: Waste** | Circular economy, waste reduction, recycling |
| **Cat 6/7: Travel/Commute** | Virtual meetings, EV fleet, public transit incentives, remote work |
| **Cat 11: Use of Products** | Energy efficiency, electrification, circular design, lifetime extension |
| **Cat 15: Investments** | Portfolio decarbonization, engagement, exclusion, green financing |

### 4.2.3.3 Scope 3 Reduction Roadmap — Template

| Phase | Years | Focus | Key Actions |
|-------|-------|-------|-------------|
| **Foundation** | 0-1 | Inventory, baseline, target setting | Complete inventory, SBTi submission, governance |
| **Quick Wins** | 1-2 | High-impact, low-cost | Renewable electricity, travel policy, waste |
| **Supplier Engagement** | 2-4 | Supply chain | Top 50 suppliers: targets, data sharing, renewable PPAs |
| **Product/Process** | 3-5 | Design & operations | Product efficiency, electrification, circular design |
| **Deep Decarbonization** | 5-10 | Hard-to-abate | Green hydrogen, CCS, novel materials, portfolio shift |

### 4.2.3.4 India Context — Scope 3 Target Setting
- **SBTi India:** 50+ companies committed; 20+ targets approved
- **BRSR:** Principle 6, Q8 — Disclose reduction targets, progress
- **CCTS:** Scope 3 reduction methodologies under development
- **Sectoral:** Steel (Cat 1, 2, 11), Cement (Cat 1, 2, 11), Auto (Cat 1, 11), Banking (Cat 15)

**EtherTrack Context:** Platform supports SBTi target tracking; auto-calculates required annual reduction; flags off-track categories.

### 4.2.3.4 Common Scope 3 Target Mistakes
1. **Boundary mismatch:** Target covers different categories than inventory
2. **Intensity trap:** Intensity target met but absolute emissions grow
3. **No supplier engagement plan:** Targets without supplier buy-in fail
4. **Ignoring Cat 15 (financials):** Mandatory for FIs per SBTi
5. **No verification:** Unverified targets lack credibility

### 4.2.3.5 Professional Judgement Points
- For target setting: Start with absolute; add intensity only if justified by growth
- For supplier engagement: Tier by spend + emissions; top 20 = 80% of Cat 1
- For product design: Cat 11 reduction = design efficiency + grid decarbonization
- For reporting: Align Scope 3 target progress with financial reporting cycle

### 4.2.3.5 Practical Exercise: Scope 3 Target Design
*Scenario:* An Indian FMCG company: Scope 1+2 = 50 ktCO2e; Scope 3 = 500 ktCO2e (Cat 1: 60%, Cat 3: 15%, Cat 4: 10%, Cat 11: 10%, Other: 5%). Revenue growing 15%/yr.
*Tasks:*
1. Design SBTi-aligned Scope 3 target (absolute vs intensity)
2. Model reduction pathway to 2030 (4.2%/yr)
3. Identify top 5 reduction levers with estimated impact
4. Design supplier engagement program for top 20 suppliers
*Time:* 50 min
*Deliverable:* Target submission package + reduction roadmap
*Rubric:* SBTi alignment (40%), lever credibility (30%), implementation realism (30%)

**Knowledge Check:**
1. What minimum Scope 3 coverage does SBTi require? (67% of Scope 3 emissions)
2. Can a company set only intensity targets for Scope 3? (Only if justified; absolute preferred)
3. What is the minimum Scope 3 coverage for SBTi target? (67% of Scope 3 emissions)
4. How often must Scope 3 targets be reviewed? (Every 5 years max per SBTi; annually for progress)

**Sources:**
1. SBTi Corporate Net-Zero Standard v1.2 (2023)
2. SBTi Scope 3 Guidance (2021)
3. GHG Protocol Scope 3 Standard — Chapter 11 (Targets)
4. SBTi Corporate Manual v2.0 (2023)
5. CDP Climate Change Questionnaire — Scope 3 Targets
6. SEBI BRSR — Principle 6, Question 8

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC (SBTi evolving) | Regulatory Review: Semi-annual*