# C04: GHG Accounting (Scopes 1/2/3)
## Module 4.1: GHG Protocol & Scopes 1/2 (3 lessons × 40min = 2h)

### Lesson 4.1.1: GHG Protocol Corporate Standard — Principles & Scope 1
**Lesson Code:** C04.1.1
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** foundation

**Learning Objectives:**
1. Explain the five GHG Protocol principles (relevance, completeness, consistency, transparency, accuracy) (Bloom: Understand)
2. Define Scope 1 emissions and identify all seven Kyoto gases (Bloom: Apply)
3. Apply organizational boundary approaches (operational control, financial control, equity share) (Bloom: Apply)

**Prerequisites:** C01.1.1, C01.1.2, C01.1.3

**Why This Matters:**
The GHG Protocol Corporate Standard is the global foundation for organizational carbon accounting. Every carbon credit, corporate net-zero claim, and regulatory disclosure traces back to these principles. Misapplying boundaries or principles leads to misstated inventories, failed audits, and greenwashing exposure.

**Core Concept: Principles First, Calculations Second**

### 4.1.1.1 GHG Protocol — Five Principles
| Principle | Definition | Practical Test |
|-----------|------------|----------------|
| **Relevance** | Inventory reflects emissions that matter to users | Would excluding this source change decisions? |
| **Completeness** | All material sources within boundary included | Can you prove nothing material is missing? |
| **Consistency** | Same methods, boundaries, assumptions over time | Can you compare year-over-year without restatement? |
| **Transparency** | Methods, assumptions, exclusions disclosed | Can a third party replicate your results? |
| **Accuracy** | Uncertainties reduced as far as practicable | Are uncertainties quantified and reported? |

**Hierarchy:** Principles are not optional — they're audit criteria. Every methodological choice must be justifiable against all five.

### 4.1.1.2 Organizational Boundaries — Three Approaches
The GHG Protocol requires selecting **one** consolidation approach:

| Approach | Definition | Consolidation Rule | Typical Use |
|----------|------------|-------------------|-------------|
| **Operational Control** | Authority to introduce/implement operating policies | 100% of emissions from operations you control | Most common; aligns with management authority |
| **Financial Control** | Ability to direct financial/operating policies for economic benefit | 100% of emissions from entities you financially control | Aligns with financial reporting (IFRS/GAAP) |
| **Equity Share** | Share of equity interest | % of emissions = equity % | Joint ventures, partial ownership |

**Decision Framework:**
- **Single approach mandatory** — cannot mix within same inventory
- **Must be consistent** across years (changes require restatement)
- **Must be documented** with rationale
- **Subsidiaries:** Apply chosen approach recursively

**Worked Example:**
Company A owns 60% of Subsidiary B (operational control), 40% of Subsidiary C (financial control), 25% equity in JV D.
| Approach | Subsidiary B | Subsidiary C | JV D |
|----------|--------------|--------------|------|
| Operational Control | 100% (A controls) | 0% (no control) | 100% (A controls) |
| Financial Control | 100% | 100% (A controls) | 0% (no control) |
| Equity Share | 60% | 40% | 25% |

**India Context:** SEBI BRSR requires disclosure of consolidation approach. CCTS methodology mandates operational control for obligated entities.

### 4.1.1.3 Scope 1 — Direct Emissions
**Definition:** Emissions from sources owned or controlled by the organization.

**Seven Kyoto Gases:**
| Gas | Chemical Formula | GWP100 (AR6) | Common Sources |
|-----|------------------|--------------|----------------|
| Carbon Dioxide | CO2 | 1 | Combustion, process |
| Methane | CH4 | 27.9 | Fugitive, waste, agriculture |
| Nitrous Oxide | N2O | 273 | Combustion, fertilizers, industry |
| HFCs | Various | 53-14,600 | Refrigeration, AC, foam |
| PFCs | Various | 7,380-12,400 | Aluminum, semiconductors |
| SF6 | SF6 | 25,200 | Electrical equipment |
| NF3 | NF3 | 17,400 | Semiconductors, solar |

**Scope 1 Categories (GHG Protocol):**
| Category | Examples | Key Data Needs |
|----------|----------|----------------|
| **Stationary Combustion** | Boilers, furnaces, turbines, generators | Fuel quantity, type, GCV, EF |
| **Mobile Combustion** | Owned/leased fleet, off-road equipment | Fuel by vehicle type, distance |
| **Process Emissions** | Cement (calcination), chemicals, metals | Production data, stoichiometric EF |
| **Fugitive Emissions** | CH4 (coal, oil/gas), HFCs (refrigerant leaks), SF6 (switchgear) | Equipment counts, leak rates |

**Excluded from Scope 1:**
- Biomass combustion CO2 (reported separately as biogenic)
- Purchased electricity/steam (Scope 2)
- Employee commuting (Scope 3)
- Upstream/downstream transport (Scope 3)

### 4.1.1.4 Scope 2 — Indirect Energy Emissions
**Definition:** Indirect emissions from purchased/generated energy consumed by the organization.

**Two Accounting Methods (must report both):**
| Method | Definition | Data Source | Use Case |
|--------|------------|-------------|----------|
| **Location-Based** | Grid average emission factor | Grid average EF (e.g., CEA India: 0.71 kgCO2/kWh) | Physical reality, grid decarbonization tracking |
| **Market-Based** | Contractual instruments (PPAs, RECs, GOs) | Supplier-specific EF, residual mix | Procurement decisions, renewable claims |

**Quality Criteria for Market-Based (GHG Protocol Scope 2 Guidance):**
1. **Contractual** — Legal ownership of attribute
2. **Exclusive** — No double counting (retired/cancelled)
3. **Current** — Same reporting year
4. **Geographic** — Same market boundary
5. **Verified** — Third-party certified

**Scope 2 Categories:**
- Purchased electricity
- Purchased steam
- Purchased heating
- Purchased cooling

**Reporting Requirement:** Both methods mandatory; if only one feasible, explain why.

### 4.1.1.5 Scope 1 vs 2 — Common Boundary Errors
| Error | Example | Consequence |
|-------|---------|-------------|
| **Double counting** | Leased vehicles in Scope 1 (lessee) + Scope 2 (lessor electricity) | Overstatement |
| **Missing fugitives** | Refrigerant leaks not tracked | Understatement (HFCs high GWP) |
| **Biomass CO2 in Scope 1** | Wood boiler CO2 in Scope 1 total | Overstatement (report separately) |
| **Scope 2 method mismatch** | Location-based for target, market-based for reporting | Inconsistent claims |

### 4.1.1.6 India Context — BRSR & CCTS Alignment
- **BRSR (SEBI):** Mandates GHG Protocol alignment; requires both Scope 1 & 2 disclosure
- **CCTS Methodology:** Uses operational control; requires Scope 1+2 for obligated entities
- **Grid EF:** CEA publishes annual location-based EF (2023: 0.71 kgCO2/kWh)
- **Renewable Claims:** Market-based requires valid REC/GEC retirement on IEX/PXIL

**EtherTrack Context:** Platform automates Scope 1/2 calculation from activity data; supports both location-based and market-based; auto-generates GHG Protocol-compliant inventory reports.

### 4.1.1.6 Common Mistakes
1. Mixing boundary approaches across subsidiaries
2. Reporting biomass CO2 in Scope 1 total (must be separate memo item)
3. Using location-based EF for market-based claims
4. Ignoring fugitive emissions (refrigerants, SF6) — often 5-20% of Scope 1
5. Not reporting both location-based and market-based Scope 2

### 4.1.1.7 Professional Judgement Points
- For leased assets: Operational control usually follows lessee for Scope 1, lessor for Scope 2
- For joint ventures: Equity share often most defensible for non-controlling stakes
- For district heating/cooling: Treat as Scope 2 (purchased energy) unless self-generated

### 4.1.1.8 Practical Exercise: Boundary Setting Workshop
*Scenario:* A conglomerate has: (1) 100% owned manufacturing plant, (2) 60% JV with operational control, (3) 30% equity in logistics company (no control), (4) leased warehouse (lessee controls operations), (5) outsourced data center (colocation).
*Tasks:*
1. Map each asset to Scope 1/2/3 under operational control
2. Repeat under equity share
3. Document rationale for chosen approach
*Time:* 35 min
*Deliverable:* Boundary decision matrix with rationale
*Rubric:* Correct classification (50%), rationale quality (30%), consistency (20%)

**Knowledge Check:**
1. Can an organization use operational control for Scope 1 and equity share for Scope 2? (No — single approach for entire inventory)
2. Are biomass CO2 emissions reported in Scope 1? (No — separate memo item as biogenic)
3. What's the difference between location-based and market-based Scope 2? (Grid average vs contractual instruments)
4. Is leased vehicle fuel Scope 1 or 2? (Scope 1 if lessee has operational control)

**Sources:**
1. GHG Protocol Corporate Standard (2004, revised 2015)
2. GHG Protocol Scope 2 Guidance (2015)
3. GHG Protocol Corporate Value Chain (Scope 3) Standard (2011)
4. IPCC 2006 Guidelines — Volume 2 (Energy), Volume 3 (IPPU)
5. SEBI BRSR Framework (2021)
6. BEE CCTS Methodology Guidelines (2023)

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC (GHG Protocol updates) | Regulatory Review: Annual*

---

### Lesson 4.1.2: Scope 3 Mapping — 15 Categories, Screening & Prioritization
**Lesson Code:** C04.1.2
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** foundation

**Learning Objectives:**
1. List all 15 Scope 3 categories and identify which apply to a given organization (Bloom: Apply)
2. Apply screening criteria (magnitude, influence, risk, stakeholder) to prioritize categories (Bloom: Apply)
3. Design a Scope 3 data collection plan for high-priority categories (Bloom: Create)

**Prerequisites:** C04.1.1

**Why This Matters:**
Scope 3 typically represents 70-95% of corporate emissions but is the least measured. The GHG Protocol's 15 categories provide a systematic framework, but not all apply equally. A structured screening and prioritization process ensures resources focus on material categories while maintaining completeness.

**Core Concept: Scope 3 is a Value Chain Map, Not a Single Number**

### 4.1.2.1 The 15 Scope 3 Categories (GHG Protocol Corporate Value Chain Standard)

| # | Category | Direction | Description | Typical Applicability |
|---|----------|-----------|-------------|----------------------|
| **1** | Purchased Goods & Services | Upstream | Cradle-to-gate emissions of purchased products | All organizations |
| **2** | Capital Goods | Upstream | Cradle-to-gate of capital equipment | All with capex |
| **3** | Fuel & Energy Related | Upstream | Upstream of Scope 1/2 fuels/electricity | All with Scope 1/2 |
| **4** | Upstream Transportation | Upstream | Third-party logistics (not owned) | Most with physical goods |
| **5** | Waste Generated | Upstream | Disposal/treatment of operational waste | All |
| **6** | Business Travel | Upstream | Employee travel (air, rail, road, hotel) | All with travel |
| **7** | Employee Commuting | Upstream | Home-to-work transport | All with employees |
| **8** | Upstream Leased Assets | Upstream | Lessor-operated assets not in Scope 1/2 | Lessees |
| **9** | Downstream Transportation | Downstream | Customer/distributor logistics | Product sellers |
| **10** | Processing of Sold Products | Downstream | Third-party processing of intermediates | Intermediate goods |
| **11** | Use of Sold Products | Downstream | End-use energy consumption | Energy-using products |
| **12** | End-of-Life Treatment | Downstream | Disposal/recycling of sold products | Product sellers |
| **13** | Downstream Leased Assets | Downstream | Lessee-operated assets not in Scope 1/2 | Lessors |
| **14** | Franchises | Downstream | Franchisee operations | Franchisors |
| **15** | Investments | Downstream | Financed emissions (equity/debt/project finance) | Financial institutions |

### 4.1.2.2 Category Applicability — Decision Tree

```
For each category:
1. Does the activity occur in our value chain? (Y/N)
   If N → Not applicable (document rationale)
2. Is the category likely material? (Screening criteria below)
   If N → Optional (but document)
3. Can we access data? (Primary vs secondary)
   If N → Plan data improvement
4. Include in inventory with method selection
```

### 4.1.2.3 Materiality Screening — Four Criteria (GHG Protocol)

| Criterion | Question | Threshold Guidance |
|-----------|----------|-------------------|
| **Magnitude** | % of total Scope 3? | >1% of total Scope 3 = likely material |
| **Influence** | Can we reduce through decisions? | High influence = prioritize |
| **Risk** | Regulatory, reputational, physical? | High risk = prioritize |
| **Stakeholder Interest** | Investors, customers, NGOs ask? | High interest = prioritize |

**Screening Matrix Template:**
| Category | Magnitude Estimate | Influence (H/M/L) | Risk (H/M/L) | Stakeholder Interest | Decision |
|----------|-------------------|-------------------|--------------|---------------------|----------|
| Cat 1: Purchased Goods | 45% | H | M | H | **Include** |
| Cat 2: Capital Goods | 8% | M | L | M | **Include** |
| Cat 3: Fuel/Energy | 12% | M | H | H | **Include** |
| Cat 4: Upstream Transport | 8% | M | M | M | **Include** |
| Cat 11: Use of Products | 20% | M | H | H | **Include** |
| Cat 15: Investments | 5% | L | H | H | **Include** (if FI) |
| Cat 8: Upstream Leased | <1% | L | L | L | Exclude (doc) |

### 4.1.2.4 Data Collection Hierarchy (Quality Ranking)

| Tier | Data Source | Uncertainty | Example |
|------|-------------|-------------|---------|
| **1 — Primary** | Supplier-specific actuals (cradle-to-gate) | ±10-20% | Supplier LCA/EPD |
| **2 — Hybrid** | Supplier activity data + secondary EFs | ±20-30% | Supplier fuel use × EF |
| **3 — Secondary** | Industry average (Ecoinvent, GaBi, DEFRA) | ±30-50% | Average steel EF |
| **4 — Proxy/Extrapolation** | Spend-based, revenue-based, intensity | ±50-100% | $ spend × EEIO factor |

**Golden Rule:** Use highest tier feasible; document method per category.

### 4.1.2.3 Calculation Methods by Category

| Category | Preferred Method | Fallback |
|----------|------------------|----------|
| **Cat 1: Purchased Goods** | Supplier-specific LCA (Tier 1) | Spend-based EEIO (Tier 4) |
| **Cat 2: Capital Goods** | Supplier LCA or industry average | Capex × industry intensity |
| **Cat 3: Fuel/Energy** | Fuel consumption × upstream EF | Scope 1/2 fuel × upstream factor |
| **Cat 4: Upstream Transport** | Carrier-specific (tonne-km × EF) | Spend-based + distance proxy |
| **Cat 5: Waste** | Waste type × disposal method EF | Waste tonnage × avg EF |
| **Cat 6: Business Travel** | Distance × mode-specific EF | Spend-based (last resort) |
| **Cat 7: Commuting** | Employee survey × mode × distance | Avg distance × mode split × EF |
| **Cat 11: Use of Products** | Units sold × lifetime energy × EF | Sales × avg lifetime × EF |
| **Cat 15: Investments** | PCAF Standard (attribution factor) | Portfolio weight × sector intensity |

### 4.1.2.4 India Context — Scope 3 in BRSR & CCTS
- **BRSR (SEBI):** Principle 6, Question 7 — Disclose Scope 3 categories assessed, methodology, emissions
- **CCTS:** Currently focuses on Scope 1+2; Scope 3 methodologies under development
- **PCAF India:** Growing adoption for Cat 15 (financed emissions)
- **CDP India:** 200+ companies report Scope 3; Cat 1, 3, 11 most reported

**EtherTrack Context:** Platform supports Scope 3 screening workflow; auto-suggests categories based on sector; integrates with supplier data collection.

### 4.1.2.4 Common Mistakes
1. Reporting all 15 categories without screening (wastes resources, dilutes focus)
2. Using only spend-based (Tier 4) for all categories — audit fail
3. Double counting: Cat 3 (upstream fuel) overlaps with Scope 1/2 fuel combustion
4. Ignoring Cat 11 (use of sold products) for energy-intensive products
5. Excluding Cat 15 (investments) for financial institutions — mandatory per PCAF

### 4.1.2.4 Professional Judgement Points
- For Cat 1 (Purchased Goods): Start with top 80% spend suppliers for primary data
- For Cat 11 (Use of Products): Requires product energy consumption data — engage R&D
- For Cat 15 (Investments): Follow PCAF Standard; attribution = equity share × emissions
- Always document exclusions with rationale — auditors check this first

### 4.1.2.5 Practical Exercise: Scope 3 Screening Workshop
*Scenario:* A mid-sized Indian auto component manufacturer (₹500 Cr revenue). Known data: ₹300 Cr raw materials, ₹50 Cr capex, ₹20 Cr electricity, 500 employees, 500k units sold/yr (avg 10 yr life, 500 kWh/yr), 5% waste, ₹10 Cr logistics.
*Tasks:*
1. Estimate magnitude for each applicable category
2. Apply screening criteria
3. Select top 5 categories for primary data collection
4. Design data request template for top suppliers
*Time:* 45 min
*Deliverable:* Screening matrix + data collection plan
*Rubric:* Completeness (30%), screening logic (40%), prioritization realism (30%)

**Knowledge Check:**
1. Which Scope 3 category is typically largest for manufacturers? (Cat 1: Purchased Goods)
2. Why is Cat 3 (Fuel/Energy) separate from Scope 1/2? (Upstream extraction/processing/refining)
3. What is the PCAF Standard? (Partnership for Carbon Accounting Financials — Cat 15 methodology)
4. Can a category be excluded if data is unavailable? (Yes, but must document rationale and improvement plan)

**Sources:**
1. GHG Protocol Corporate Value Chain (Scope 3) Standard (2011)
2. GHG Protocol Scope 3 Technical Guidance (2013)
3. PCAF Global GHG Accounting Standard for Financials (2020/2022)
4. CDP Scope 3 Technical Note (2023)
5. SBTi Scope 3 Guidance (2021)
6. BEE CCTS Scope 3 Methodology (draft, 2024)

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC (Scope 3 methodologies evolving) | Regulatory Review: Semi-annual*

---

### Lesson 4.1.3: Inventory Design, Base Year & Reporting
**Lesson Code:** C04.1.3
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** foundation

**Learning Objectives:**
1. Design a GHG inventory management system (process, roles, tools, schedule) (Bloom: Create)
2. Select and justify a base year; apply recalculation policy for structural changes (Bloom: Evaluate)
2. Apply GWP values correctly and report per GHG Protocol/ISO 14064-1 format (Bloom: Apply)

**Prerequisites:** C04.1.1, C04.1.2

**Why This Matters:**
An inventory is not a one-time calculation — it's a management system that must produce consistent, auditable results year after year. Base year selection, recalculation triggers, and reporting format determine whether your inventory survives audit, supports target-setting, and enables year-over-year comparison.

**Core Concept: Inventory as a Living System, Not a Snapshot**

### 4.1.3.1 Inventory Management System — Core Components

| Component | Requirements | Typical Tools |
|-----------|--------------|---------------|
| **Governance** | Owner, steering committee, data owners | RACI matrix, steering charter |
| **Process** | Annual cycle: plan → collect → calculate → verify → report | Workflow software, calendar |
| **Data Management** | Centralized repository, version control, audit trail | Database, version control (Git), audit log |
| **Methodology Library** | Versioned methodologies, EFs, calculation logic | Version-controlled repo (Git) |
| **Quality Control** | Automated checks, peer review, uncertainty tracking | Automated rules + peer review |
| **Documentation** | Methodology sheets, assumptions, exclusions | Structured templates |
| **Verification** | Internal review → external verification | Verification protocol |

### 4.1.3.2 Annual Inventory Cycle

| Phase | Timing | Activities | Outputs |
|-------|--------|------------|---------|
| **1. Plan** | Q1 | Scope confirmation, methodology updates, data request design | Inventory plan, data request pack |
| **2. Collect** | Q1-Q2 | Data requests, supplier engagement, meter reads, fuel receipts | Raw data repository |
| **3. Calculate** | Q2 | Unit conversion, EF application, aggregation, QC checks | Draft inventory |
| **4. Review** | Q2-Q3 | Internal review, uncertainty analysis, trend analysis | Reviewed inventory |
| **5. Verify** | Q3 | Internal audit → external verification (if required) | Verification opinion |
| **6. Report** | Q3-Q4 | Public report, BRSR/CDP/regulatory filing | Final report |
| **7. Archive** | Q4 | Package v1.0, lock methodology, store evidence | Audit-ready package |

### 4.1.3.3 Base Year Selection & Recalculation Policy

**Base Year Criteria (GHG Protocol):**
- Representative of typical operations
- Reliable data available
- Fixed for target-setting (SBTi, net-zero)

**Recalculation Triggers (Mandatory Recalculation):**
| Trigger | Action |
|---------|--------|
| **Structural Change** | Merger, acquisition, divestiture, outsourcing/insourcing >5% of base year emissions |
| **Methodology Change** | New EF source, improved method, GWP version change |
| **Boundary Change** | New facilities, closed facilities, leased asset changes |
| **Error Discovery** | Material error (>5% of category) discovered |

**Recalculation Procedure:**
1. Recalculate base year and all subsequent years with new method/boundary
2. Document old vs new values with rationale
3. Restate all prior year public reports
4. Update targets if base year changed (SBTi requires)

**Recalculation Threshold:** GHG Protocol: >5% of base year emissions; SBTi: >5% of base year or any structural change

### 4.1.3.4 GWP Version Management

| Decision | Options | Recommendation |
|----------|---------|----------------|
| **GWP Version** | AR4, AR5, AR6 | Use latest (AR6) for new inventories; disclose version |
| **Time Horizon** | GWP100 (mandatory), GWP20 (optional) | Report both for CH4-intensive sectors |
| **GWP vs GTP** | GWP for compliance/VCM; GTP for long-term targets | Disclose metric used |

**Version Change Management:**
- Treat GWP update as methodology change → trigger recalculation
- Maintain parallel reporting during transition year
- Archive previous GWP version calculations

### 4.1.3.5 Reporting Format — GHG Protocol / ISO 14064-1

**Required Disclosures:**
1. **Organizational Boundary:** Approach, list of entities, consolidation % 
2. **Operational Boundary:** Scopes included, categories excluded with rationale
3. **Base Year:** Year, rationale, recalculation history
4. **Methodologies:** Standards, EF sources, versions, GWP
5. **Emissions Data:** By scope, category, gas (tCO2e), biogenic CO2 separate
6. **Uncertainty:** Qualitative (high/med/low) or quantitative (±%)
7. **Verification:** Internal/external, scope, opinion
8. **Targets:** Base year, target year, % reduction, progress

**ISO 14064-1 Additional Requirements:**
- Quantitative uncertainty assessment (Level of Assurance)
- Specific reporting format (Annex B)
- Third-party verification mandatory for certification

### 4.1.3.6 Verification Readiness Checklist

| Area | Ready? | Evidence |
|------|--------|----------|
| **Data Trail** | Every number traceable to source document | Source docs linked in database |
| **Methodology** | Version-controlled, changes documented | Git repo with tags |
| **EF Sources** | Cited, versioned, dates documented | EF library with metadata |
| **Calculations** | Reproducible from raw data | Scripts/notebooks versioned |
| **Uncertainty** | Quantified per category | Uncertainty budget |
| **Exclusions** | Documented with rationale | Exclusion register |
| **Recalculations** | All prior years restated | Recalculation log |
| **Targets** | Aligned with inventory boundary | Target-inventory mapping |

### 4.1.3.6 India Context — BRSR & CCTS Reporting
- **BRSR Format:** Section C, Principle 6 — standardized template (Scope 1, 2, 3, intensity)
- **CCTS Reporting:** Quarterly to BEE via prescribed format; includes verification opinion
- **CDP Alignment:** BRSR maps to CDP questionnaire (Scope 1/2/3, targets, governance)
- **Assurance:** BRSR requires "reasonable assurance" for top 1000; CCTS requires accredited verifier

**EtherTrack Context:** Platform generates BRSR-ready, CDP-ready, CCTS-ready reports from inventory; auto-populates verification package.

### 4.1.3.6 Common Mistakes
1. Changing base year without recalculation → targets become incomparable
2. Not recalculating for structural changes (>5% threshold) — audit finding
3. Using different GWP versions across years without disclosure
4. Omitting biogenic CO2 memo item
5. No uncertainty assessment — "we don't know" is not acceptable

### 4.1.3.7 Professional Judgement Points
- For fast-growing companies: Consider rolling base year (fixed target year, rolling base)
- For M&A: Treat as structural change — recalculate from acquisition date
- For methodology improvements: Apply retrospectively; document "what changed and why"
- For verification: Prepare package 4 weeks before verifier arrival

### 4.1.3.8 Practical Exercise: Inventory Design
*Scenario:* Design inventory system for a ₹1,000 Cr Indian cement company (3 plants, 1 grinding unit, 1 captive power plant). Current state: ad-hoc Excel, no base year, no verification.
*Tasks:*
1. Design organizational boundary (operational control vs equity)
2. Select base year (data availability check)
3. Design annual cycle calendar
3. Define QC checks for kiln data, fuel data, grid electricity
4. Draft verification scope for first verification
*Time:* 40 min
*Deliverable:* Inventory design document (2 pages)
*Rubric:* Boundary logic (30%), cycle design (30%), QC/verification (40%)

**Knowledge Check:**
1. What triggers mandatory base year recalculation? (Structural change >5%, methodology change, boundary change, material error)
2. Can you change base year without recalculating? (No — all years must be restated)
3. What is the difference between verification and QC? (QC = internal checks; verification = independent third-party opinion)
4. What must be reported for Scope 2? (Both location-based AND market-based)

**Sources:**
1. GHG Protocol Corporate Standard — Chapter 5 (Base Year), Chapter 9 (Verification)
2. ISO 14064-1:2018 — Section 9 (Reporting), Section 10 (Verification)
3. SBTi Corporate Manual — Base Year & Recalculation
4. SEBI BRSR Format — Principle 6
5. BEE CCTS Verification Guidelines (2023)

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC (Reporting standards evolving) | Regulatory Review: Annual*