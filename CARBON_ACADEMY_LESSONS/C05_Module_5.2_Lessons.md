# C05: Emissions Calculation & Data
## Module 5.2: Activity Data & QA/QC (3 lessons × 40min = 2h)

### Lesson 5.2.1: Activity Data Collection — Sources, Quality & Automation
**Lesson Code:** C05.2.1
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** foundation

**Learning Objectives:**
1. Identify primary activity data sources for each Scope 1/2/3 category (Bloom: Apply)
2. Design data collection templates with built-in quality checks (Bloom: Create)
3. Evaluate automation opportunities (meters, APIs, IoT) vs manual collection (Bloom: Evaluate)

**Prerequisites:** C05.1.1, C05.1.2

**Why This Matters:**
Activity data is the numerator in every emission calculation. No matter how perfect your emission factors, garbage activity data produces garbage emissions. This lesson teaches you to build robust data collection systems that survive audit scrutiny and minimize manual effort.

**Core Concept: Activity Data Quality = Emission Data Quality**

### 5.2.1.1 Activity Data Sources by Scope & Category

| Scope | Category | Primary Data Sources | Frequency | Quality Indicators |
|-------|----------|---------------------|-----------|-------------------|
| **Scope 1** | Stationary Combustion | Fuel receipts, weighbridge, tank gauges, gas meters | Monthly | Mass balance closure ±2% |
| | Mobile Combustion | Fuel cards, telematics, logbooks, odometer | Monthly | Fuel vs distance closure |
| | Process Emissions | Production logs, batch records, CEMS | Continuous/Daily | Mass balance closure |
| | Fugitive (Refrigerant) | Charge records, service logs, leak tests | Per event/Annual | Mass balance ±10% |
| | Fugitive (SF6) | Nameplate, purchase/return records, LDAR | Per event/Annual | Mass balance ±5% |
| **Scope 2** | Purchased Electricity | Utility bills, meter reads, SCADA, AMI | Monthly | Bill vs meter ±1% |
| | Purchased Steam/Heat | Supplier invoices, steam meters | Monthly | Energy balance |
| | Purchased Cooling | Chiller logs, supplier data | Monthly | COP × runtime |
| **Scope 3** | Cat 1: Purchased Goods | PO data, supplier surveys, spend data | Annual/Quarterly | Supplier response rate |
| | Cat 3: Fuel Upstream | Fuel receipts × WTT EF | Monthly | Same as Scope 1 |
| | Cat 4/9: Transport | Carrier data, TMS, BOL, weighbridge | Monthly | Tonne-km closure |
| | Cat 6/7: Travel/Commute | Travel system, card data, surveys | Monthly/Annual | Distance × mode closure |

### 5.2.1.2 Data Collection Templates — Standardized Structure

**Minimum Required Fields (per data point):**
```json
{
  "source_id": "unique_identifier",
  "timestamp": "ISO8601",
  "scope": "1|2|3",
  "category": "stationary_combustion|mobile_combustion|...",
  "activity_type": "fuel_consumption|electricity|distance|mass|volume",
  "quantity": "numeric_string",
  "unit": "kg|tonne|MJ|kWh|km|m3|litre",
  "source_system": "SAP|meter|telematics|manual|supplier_survey",
  "quality_flags": ["estimated","metered","supplier_reported","interpolated"],
  "metadata": {
    "fuel_type": "coal|diesel|natural_gas|grid_electricity",
    "equipment_id": "boiler_01",
    "location": "plant_mumbai",
    "method": "metered|estimated|supplier_reported"
  }
}
```

**Quality Flags Taxonomy:**
| Flag | Meaning | Typical Uncertainty |
|------|---------|---------------------|
| `metered` | Direct meter reading | ±1-2% |
| `weighed` | Weighbridge/scale | ±0.5-2% |
| `metered_corrected` | Meter with calibration correction | ±1-3% |
| `supplier_reported` | From utility/supplier bill | ±2-5% |
| `estimated` | Engineering estimate | ±20-50% |
| `interpolated` | Gap-filled from adjacent periods | ±10-20% |
| `extrapolated` | Extended beyond data range | ±30-50% |
| `default` | Used default EF/activity | ±50-100% |

### 5.2.1.3 Automated Data Collection — Architecture

**Data Ingestion Layers:**
```
┌─────────────────────────────────────────────────────────────┐
│                    ACTIVITY DATA LAKE                        │
├─────────────────────────────────────────────────────────────┤
│  Sources                  │ Ingestion      │ Validation      │
├───────────────────────────┼────────────────┼────────────────┤
│ Smart Meters (Modbus/     │ MQTT/HTTP      │ Range checks    │
│  M-Bus/LoRaWAN)           │ → Kafka        │ Rate of change  │
│                           │                │ Gap detection   │
├───────────────────────────┼────────────────┼────────────────┤
│ ERP/Financial (SAP,       │ API/ETL        │ PO-GR matching  │
│  Oracle, Tally)           │ (daily)        │ Spend categoriz.│
├───────────────────────────┼────────────────┼────────────────┤
│ Telematics/GPS            │ Webhook/       │ Geofence check  │
│ (fleet, logistics)        │ API (real-time)│ Speed sanity    │
├───────────────────────────┼────────────────┼────────────────┤
│ Utility Portals           │ API (scheduled)│ Bill vs meter   │
│ (Discom, GAIL, IOCL)      │ (monthly)      │ Gap fill        │
├───────────────────────────┼────────────────┼────────────────┤
│ Supplier Portals/Surveys  │ Email/API      │ Completeness    │
│ (Scope 3)                 │ (quarterly)    │ Consistency     │
├───────────────────────────┼────────────────┼────────────────┤
| Manual Entry (Web Form)   | Direct entry   | Mandatory fields|
| (fallback)                |                | Approval workflow|
└───────────────────────────┴────────────────┴────────────────┘
```

**Validation Rules (Automated):**
| Check | Threshold | Action |
|-------|-----------|--------|
| **Zero/Null Quantity** | = 0 or null | Flag for review |
| **Negative Quantity** | < 0 | Reject |
| **Rate of Change** | >3σ from rolling avg | Flag |
| **Gap Detection** | > expected frequency | Auto-interpolate + flag |
| **Mass Balance** | Input ≠ Output + Stock Change | Flag if >2% |
| **Unit Consistency** | Unit matches category | Reject if mismatch |
| **Duplicate Detection** | Same source+timestamp+qty | Dedupe + flag |

### 5.2.1.4 Manual Collection — When Automation Isn't Feasible

**When Manual is Needed:**
- Supplier surveys (Scope 3 Cat 1, 2, 4, 5, 6, 7)
- Small/unmetered sources (<1% of scope)
- Historical data backfill
- One-time studies (waste composition, leakage tests)

**Manual Entry Controls:**
- Web form with mandatory fields + dropdowns (no free text for categories)
- Approval workflow (data entry → reviewer → approver)
- Version history (who, what, when)
- Attachment upload (invoices, receipts, photos)
- Auto-calculation of derived fields (e.g., MJ from kg × NCV)

### 5.2.1.5 India Context — Data Sources & Challenges

| Source | Access Method | Frequency | Challenges |
|--------|---------------|-----------|------------|
| **CEA Grid EF** | PDF/Excel download | Annual | Manual download, format changes |
| **Discom Bills** | Portal/Email/Physical | Monthly | Format variation, delayed |
| **GAIL/IOCL/BPCL** | Portal/API | Monthly | Portal downtime, format |
| **Indian Railways** | FOIA/RTI/Annual Report | Annual | Not real-time |
| **CPCB/SPCB** | Portal/RTI | Periodic | Data gaps, lag |
| **Supplier Surveys** | Email/Portal | Annual | Low response rate |

**Mitigation Strategies:**
- Build API wrappers for stable portals
- Standardize bill parsing (template per utility)
- Supplier portal with pre-filled templates
- Quarterly pulse surveys vs annual deep dive
- Automated reminder escalation

### 5.2.1.6 Professional Judgement Points
- **Metering investment priority:** >5% of scope → meter it; <1% → estimate acceptable
- **Data frequency:** Monthly minimum for Scope 1/2; Quarterly for Scope 3 suppliers
- **Gap filling:** Document method (interpolation, extrapolation, proxy) + uncertainty
- **Retention:** Keep source documents 7+ years (tax/audit/verification)
- **Single source of truth:** One activity data lake → all calculations downstream

### 5.2.1.6 Practical Exercise: Data Collection Design
*Scenario:* Design activity data collection for a 3-plant cement company (2 Mt/yr clinker). Sources: 50+ meters, 3 utility bills, 20 suppliers, 50 vehicles, 500 employees.
*Tasks:*
1. Design data collection matrix (source × frequency × method × owner)
2. Define automated validation rules for kiln coal feed, grid electricity, diesel
3. Design supplier survey template for top 20 raw material suppliers
4. Estimate automation ROI (manual hours saved vs capex)
*Time:* 45 min
*Deliverable:* Data collection matrix + validation rules + ROI calc
*Rubric:* Completeness (30%), validation logic (40%), ROI realism (30%)

**Knowledge Check:**
1. What is the minimum frequency for Scope 1/2 activity data collection? (Monthly)
2. What quality flag would you assign to a weighbridge reading? (`weighed` ±0.5-2%)
3. How do you handle a 3-day gap in hourly meter data? (Interpolate + flag `interpolated`)
4. What is the minimum required field for activity data traceability? (source_id, timestamp, quantity, unit)

**Sources:**
1. GHG Protocol Corporate Standard — Chapter 6 (Data Collection)
2. ISO 14064-1:2018 — Section 7 (Data Management)
3. ISO 14064-3:2019 — Verification of Data
3. BEE PAT Guidelines — Data Requirements
3. CEA Grid Code — Metering Standards
4. CPCB Guidelines — Continuous Emission Monitoring

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC (IoT, meter tech evolving) | Regulatory Review: Quarterly*

---

### Lesson 5.2.2: Quality Assurance/Quality Control (QA/QC) System
**Lesson Code:** C05.2.2
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** foundation

**Learning Objectives:**
1. Design a QA/QC system per IPCC 2006 / ISO 14064-3 requirements (Bloom: Create)
2. Implement automated QC checks (mass balance, trend analysis, cross-category reconciliation) (Bloom: Apply)
3. Manage QC documentation for verification readiness (Bloom: Create)

**Prerequisites:** C05.2.1

**Why This Matters:**
QA/QC is not optional — it's a mandatory element of GHG Protocol and ISO 14064-1. A QC system catches errors before verifiers do. A QA system ensures continuous improvement. Without both, your inventory is a liability, not an asset.

**Core Concept: QC = Self-Checking; QA = Independent Review**

### 5.2.2.1 QC vs QA — Definitions & Responsibilities

| Aspect | **Quality Control (QC)** | **Quality Assurance (QA)** |
|--------|--------------------------|----------------------------|
| **Performed By** | Inventory compiler (internal) | Independent reviewer (internal/external) |
| **Timing** | During/after compilation | After QC complete, before verification |
| **Focus** | Routine checks, error detection | System effectiveness, methodology review |
| **Scope** | 100% of calculations, data checks | Sampling, methodology, documentation |
| **Output** | QC log, corrected data | QA report, improvement recommendations |

**IPCC 2006 QC Tiers:**
| Tier | Activities | Frequency |
|------|------------|-----------|
| **Tier 1 (General)** | Cross-checks, completeness, transcription, units, recalculation | Every inventory cycle |
| **Tier 2 (Source-Specific)** | Source-specific checks, expert review, uncertainty analysis | Key categories (>5% of scope) |
| **Tier 3 (Advanced)** | External peer review, inter-lab comparison, Monte Carlo | High-risk, high-uncertainty |

### 5.2.2.2 Tier 1 QC Checks — Mandatory for Every Inventory

| Check Category | Specific Checks | Automation |
|----------------|-----------------|------------|
| **Completeness** | All sources/categories covered? No gaps? | Auto: category coverage % |
| **Transcription** | Source → calculation no manual entry errors | Auto: API/ETL eliminates |
| **Calculation** | 100% recalculation of sample (or 100% if automated) | Auto: 100% re-run |
| **Units** | Consistent units throughout (SI) | Auto: unit validation |
| **Labels** | All rows/columns labeled correctly | Auto: schema validation |
| **Cross-Category** | Scope 3 Cat 3 vs Scope 1 fuel reconciliation | Auto: cross-check queries |
| **Time Series** | Year-over-year trends plausible? | Auto: trend alerts >20% |
| **Documentation** | All methods, assumptions, sources cited | Auto: doc completeness check |

**Automated QC Rules (Examples):**
```sql
-- Mass Balance: Fuel Input = Combustion + Stock Change + Losses
SELECT plant_id, fuel_type, 
       SUM(fuel_receipts) - SUM(fuel_consumption) - SUM(stock_change) AS imbalance
FROM fuel_data
WHERE ABS(imbalance) / SUM(fuel_receipts) > 0.02;

-- Cross-Category: Scope 3 Cat 3 upstream = f(Scope 1 fuel)
SELECT scope1_fuel * upstream_factor - cat3_emissions AS diff
FROM emissions
WHERE ABS(diff) / scope1_fuel > 0.05;

-- Trend Check: YoY change > 20% without structural change
SELECT current_year, prev_year, 
       (current_year - prev_year) / prev_year AS pct_change
FROM scope1_emissions
WHERE ABS(pct_change) > 0.2 AND no_structural_change_flag = true;
```

### 5.2.2.2 Tier 2 QC — Source-Specific Checks (Key Categories)

| Category | Specific Checks |
|----------|-----------------|
| **Stationary Combustion** | Fuel GCV/NCV consistency; Oxidation factor reasonableness; Ash balance |
| **Mobile Combustion** | Fuel vs distance closure; Fleet efficiency trends; EF appropriateness |
| **Process Emissions** | Stoichiometric balance; Production vs emissions ratio; CKD factor |
| **Fugitive (Refrigerant)** | Mass balance (charge + purchases - retirement = emissions); Leak rate reasonableness |
| **Fugitive (SF6)** | Mass balance; Leak rate vs IEC standards; Inventory reconciliation |
| **Scope 2 Electricity** | Location vs market-based reconciliation; RE claim validation (REC retirement) |
| **Scope 3 Cat 1** | Spend coverage >80%; Supplier data quality scoring |
| **Scope 3 Cat 11** | Lifetime assumptions documented; Usage profiles vs nameplate |

### 5.2.2.3 QC Documentation — The QC Log

**QC Log Entry Template:**
| Field | Example |
|-------|---------|
| **Check ID** | QC-2024-001 |
| **Date** | 2024-07-15 |
| **Performed By** | J. Patel, ESG Analyst |
| **Check Type** | Tier 1 / Tier 2 / Automated |
| **Scope/Category** | Scope 1 / Stationary Combustion |
| **Check Description** | Mass balance: Coal receipts vs consumption + stock change |
| **Data Source** | SAP MM (receipts), PI System (consumption), SAP WM (stock) |
| **Expected Result** | Imbalance < 2% |
| **Actual Result** | Imbalance = 1.8% |
| **Status** | PASS / FAIL / FLAG |
| **Finding** | Plant 2: 3.2% imbalance — investigate unrecorded losses |
| **Corrective Action** | Investigate weighbridge calibration Plant 2 |
| **Resolved** | 2024-07-20 (weighbridge recalibrated) |
| **Verified By** | S. Sharma, ESG Lead |

### 5.2.2.4 QA — Independent Review

**QA Reviewer Independence:**
- Not involved in inventory compilation
- No conflict of interest (no consulting on same inventory)
- Technical competence (sector experience)

**QA Review Scope:**
| Area | Review Method |
|------|---------------|
| **Methodology** | Appropriate for sector? Current version? Consistent? |
| **EF Selection** | Hierarchy followed? Version current? Source cited? |
| **Boundary** | Organizational/operational consistent? Changes documented? |
| **Calculations** | Sample recalculation (100% if automated) |
| **Uncertainty** | Quantified? Methods appropriate? DQI reported? |
| **Documentation** | Complete? Traceable? Version-controlled? |
| **Trends** | Plausible? Structural changes explained? |

**QA Report Template:**
| Section | Content |
|---------|---------|
| **Scope** | Inventory period, boundary, scopes covered |
| **Reviewer** | Name, role, independence statement |
| **Methodology Review** | Standard, version, changes from prior year |
| **Key Findings** | Table: Finding, Severity, Category, Recommendation |
| **Overall Opinion** | "No material misstatements found" / "Material misstatements found" |
| **Recommendations** | Prioritized improvement actions |

### 5.2.2.4 QC/QA Documentation Package for Verification

**Required Package:**
1. **QC Log** (all checks, results, resolutions)
2. **Automated QC Output** (query results, dashboards)
3. **QA Report** (independent reviewer)
4. **Recalculation Log** (if any)
5. **Methodology Change Log** (if any)
6. **EF Version Log** (versions used per category)
7. **Uncertainty Budget** (per category)
8. **DQI Scores** (per category)
9. **Cross-Category Reconciliation** (Cat 3 vs Scope 1, etc.)
10. **Recalculation Log** (if base year changed)

### 5.2.2.4 Professional Judgement Points
- **Automation first:** 100% automated recalculation eliminates transcription errors
- **Tier 2 focus:** Spend 80% QC effort on key categories (>5% of scope)
- **Cross-category reconciliation:** Cat 3 vs Scope 1, Cat 11 vs product data — catches biggest errors
- **Trend alerts:** >20% YoY change without structural change = investigate
- **Verifier readiness:** Package QC/QA docs 2 weeks before verifier arrival

### 5.2.2.5 Practical Exercise: QC System Design
*Scenario:* Design QC system for a 3-plant steel company (BF-BOF, 3 Mt/yr). Key sources: coke ovens, sinter, blast furnace, BOF, rolling mills, captive power (300 MW), 500 km rail transport.
*Tasks:*
1. Design Tier 1 automated checks (5 rules)
2. Design Tier 2 checks for top 3 sources (coke oven, BF, captive power)
3. Design cross-category reconciliation (coal input vs coke + BF gas + emissions)
4. Draft QC log template for verifier handover
*Time:* 45 min
*Deliverable:* QC rule set + cross-reconciliation queries + QC log template
*Rubric:* Rule completeness (40%), cross-check logic (30%), template usability (30%)

**Knowledge Check:**
1. What is the difference between QC and QA? (Internal self-check vs independent review)
2. What is the typical Tier 1 QC frequency? (Every inventory cycle)
3. What is a cross-category reconciliation example? (Scope 3 Cat 3 upstream fuel = f(Scope 1 fuel))
4. What should be in a QC log? (Check ID, date, performer, check type, result, finding, action, resolution)

**Sources:**
1. IPCC 2006 Guidelines — Volume 1, Chapter 6 (QA/QC)
2. ISO 14064-1:2018 — Section 7.3 (QC), Section 7.4 (QA)
3. ISO 14064-3:2019 — Verification of GHG Assertions
4. GHG Protocol — Quality Assurance Guidance
4. BEE PAT Guidelines — Data Quality Requirements
5. ISO 14064-3:2019 — Section 7 (Verification Process)

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC (Automation tools evolving) | Regulatory Review: Quarterly*

---

### Lesson 5.2.3: Uncertainty Quantification & Management
**Lesson Code:** C05.2.3
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** foundation

**Learning Objectives:**
1. Apply IPCC/ISO uncertainty methods (Tier 1: error propagation; Tier 2: Monte Carlo) (Bloom: Apply)
2. Build an uncertainty budget per scope/category (Bloom: Create)
3. Use uncertainty to prioritize data quality improvements (Bloom: Apply)

**Prerequisites:** C05.2.1, C05.2.2

**Why This Matters:**
Uncertainty is not academic — it drives verification level, target credibility, and investment prioritization. A 5% uncertainty in Scope 1 vs 50% in Scope 3 tells you exactly where to invest in data quality. Regulators (SEBI, CSRD, CCTS) and standards (SBTi, ISO 14064) require uncertainty disclosure.

**Core Concept: Uncertainty is a Management Tool, Not a Compliance Burden**

### 5.2.3.1 Uncertainty Typology — Types & Sources

| Type | Source | Quantification Method |
|--------|---------|----------------------|
| **Parameter Uncertainty** | EF uncertainty, measurement error | Error propagation / Monte Carlo |
| **Model Uncertainty** | Methodology simplifications, missing processes | Expert elicitation, model comparison |
| **Sampling Uncertainty** | Limited measurements, temporal gaps | Statistical (standard error) |
| **Extrapolation Uncertainty** | Proxy data, temporal/spatial gaps | Expert judgment / Monte Carlo |
| **Definition/Boundary** | Categorization errors, double counting | Expert judgment / reconciliation |

### 5.2.3.1 Uncertainty Propagation — Tier 1 (Analytical)

**Basic Rules (Independent Variables):**
| Operation | Formula (Relative Uncertainty) |
|-----------|--------------------------------|
| **Multiplication/Division** | u_rel(z)² = u_rel(x)² + u_rel(y)² |
| **Addition/Subtraction** | u_abs(z)² = u_abs(x)² + u_abs(y)² |
| **Power** | u_rel(z) = |n| × u_rel(x) (z = xⁿ) |
| **Sum of Independent** | u²(z) = Σ u²(x_i) (for z = Σ x_i) |

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

### 5.2.3.2 Tier 2 — Monte Carlo Simulation

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

### 5.2.3.2 Uncertainty Budget — Per Category

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

### 5.2.3.3 Uncertainty in Verification & Targets

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

### 5.2.3.3 Using Uncertainty to Prioritize Improvements

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

### 5.2.3.3 Professional Judgement Points
- **Don't over-precision:** Report uncertainty to 1-2 significant figures (e.g., 12%, not 12.34%)
- **Correlations matter:** Fuel price & consumption often negatively correlated
- **Scope 3 uncertainty:** Don't hide it — disclose, explain, prioritize reduction
- **Verification level:** High Scope 3 uncertainty → Limited assurance for Scope 3
- **Target tracking:** Use best estimate for progress; report uncertainty band

### 5.2.3.4 Professional Judgement Points
- **Don't hide uncertainty:** Transparency > false precision
- **Correlations:** Fuel consumption & price often negatively correlated
- **Scope 3 uncertainty:** Disclose, explain, prioritize reduction
- **Verification level:** High Scope 3 uncertainty → Limited assurance acceptable
- **Target tracking:** Use best estimate for progress; report uncertainty band

### 5.2.3.4 Practical Exercise: Uncertainty Budget Workshop
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