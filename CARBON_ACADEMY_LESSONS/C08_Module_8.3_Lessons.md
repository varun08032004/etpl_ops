# C08: Methodologies & MRV
## Module 8.3: Monitoring & MRV Design (3 lessons × 40min = 2h)

### Lesson 8.3.1: Monitoring & MRV Design
**Lesson Code:** C08.3.1
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** professional

**Learning Objectives:**
1. Design a Monitoring, Reporting & Verification (MRV) system that meets methodology and standard requirements (Bloom: Create)
2. Select appropriate monitoring parameters, methods, and frequencies per methodology (Bloom: Apply)
3. Build QA/QC into the MRV process from day one (Bloom: Create)

**Prerequisites:** C06.1.1, C07.1.1, C05.1.1, C05.2.1

**Why This Matters:**
The MRV system is the operational backbone of any carbon project. A poorly designed MRV leads to missed measurements, unverifiable data, verification findings, and delayed issuance. A robust MRV turns monitoring from a compliance burden into a management tool that optimizes project performance.

**Core Concept: The MRV System is the Project's Operating Manual**

### 8.3.1.1 MRV System — Purpose & Position

**Position in Project Cycle:**
```
PDD Registered → MRV System Implemented → Data Collected → Verification → Issuance
     ↑                                                                    │
     └──────────────────────── Feedback Loop ────────────────────────────┘
```

**MRV Functions:**
1. **Defines WHAT to measure** — Parameters, methods, frequency
2. **Defines HOW to measure** — Instruments, methods, QA/QC
3. **Defines WHO measures** — Roles, responsibilities, training
4. **Defines WHEN** — Frequency, timing, vintage alignment
5. **Defines QUALITY** — QA/QC, uncertainty, data management

### 8.3.1.1 Monitoring Plan Structure (Per Methodology/Standard)

| Section | Purpose | Verification Focus |
|---------|---------|-------------------|
| **1. Monitored Parameters** | Parameter ID, description, unit, source | Completeness vs methodology |
| **2. Measurement Methods** | Instruments, methods, calibration, frequency | Methodology compliance |
| **3. QA/QC Procedures** | Calibration, cross-checks, uncertainty, data management | ISO 14064-3 alignment |
| **4. Data Management** | Collection, storage, backup, access, retention | Traceability, audit trail |
| **5. Roles & Responsibilities** | Who measures, who checks, who approves | Competence, segregation |
| **6. Training & Capacity** | Training plan, competency records | Competence evidence |
| **7. Emergency Procedures** | Equipment failure, data gaps, force majeure | Continuity planning |

### 8.3.1.2 Parameter Selection — Methodology-Driven

**Parameter Categories:**
| Category | Examples | Typical Frequency |
|----------|----------|-------------------|
| **Activity Data** | Fuel consumption, electricity gen, tonnes produced, area | Continuous/Daily |
| **Emission Factors** | Fuel GCV/NCV, carbon content, oxidation factor | Per batch/Monthly |
| **Process Parameters** | Temperature, pressure, flow rates, operating hours | Continuous/Hourly |
| **Environmental** | Temperature, humidity, rainfall (for AFOLU) | Daily/Event-based |
| **Leakage** | Displacement surveys, market data | Per verification |
| **Safeguards** | Stakeholder feedback, grievance logs | Periodic |

**Parameter Documentation Template:**
```json
{
  "parameter_id": "P-001",
  "description": "Coal consumption at Boiler #1",
  "unit": "tonnes",
  "source": "Weighbridge (SAP MM)",
  "frequency": "Continuous (15-min intervals)",
  "method": "Weighbridge (WB-01), calibrated quarterly",
  "qa_qc": "Calibration cert QB-2024-001; daily zero-check; monthly cross-check with belt scale",
  "uncertainty": "±1.5% (weighbridge class 0.5)",
  "data_management": "PI System → Historian → SQL; retention 10 yr",
  "responsible": "Shift Engineer → Plant Manager",
  "backup": "Manual logbook (daily total)"
}
```

### 8.3.1.2 Monitoring Methods — Selection & QA/QC

| Parameter Type | Preferred Method | Fallback | QA/QC Requirements |
|----------------|------------------|----------|-------------------|
| **Fuel Mass** | Weighbridge (custody transfer) | Belt scale + density | Quarterly calibration; daily zero-check; mass balance closure |
| **Fuel Energy (GCV/NCV)** | Lab analysis (daily composite) | Supplier certificate | Lab accreditation; duplicate analysis; QC samples |
| **Electricity** | Revenue meter (0.2S/0.5S class) | Check meter | Monthly cross-check; annual calibration |
| **Gas Flow** | Ultrasonic/orifice (custody transfer) | Thermal mass flow | Calibration per AGA-3/8; pressure/temp correction |
| **Gas Composition** | Gas chromatograph (daily) | Manual sampling | Calibration gas; duplicate analysis |
| **Area/Forest** | GIS + ground truthing | Satellite only | Ground truthing 10% plots; topology checks |
| **Biomass/Soil** | Plot sampling (nested plots) | Remote sensing only | QA/QC per IPCC GPG; lab accreditation |

### 8.3.1.3 QA/QC — Building Quality In

**QC (Self-Checking) vs QA (Independent Review):**
| Aspect | **Quality Control (QC)** | **Quality Assurance (QA)** |
|--------|--------------------------|----------------------------|
| **Performed By** | Data collectors, plant staff | Independent reviewer (internal/external) |
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

### 8.3.1.3 Automated QC Rules (Examples)

```python
# Gap detection
if hours_without_data > 4: flag("data_gap")

# Rate of change
if abs(value - rolling_avg) > 3 * rolling_std: flag("anomaly")

# Mass balance
if abs(fuel_input - gen_output - losses) / fuel_input > 0.03: flag("mass_balance")

# Cross-category
if abs(cat3_upstream - scope1_fuel * wtt_factor) / scope1_fuel > 0.05: flag("cat3_mismatch")
```

### 8.3.1.4 Professional Judgement Points
- **Metering investment priority:** >5% of scope → meter it; <1% → estimate acceptable
- **Data frequency:** Monthly minimum for Scope 1/2; Quarterly for Scope 3 suppliers
- **Gap filling:** Document method (interpolation, extrapolation, proxy) + uncertainty
- **Retention:** Keep source documents 7+ years (tax/audit/verification)
- **Single source of truth:** One activity data lake → all calculations downstream

### 8.3.1.4 Practical Exercise: MRV System Design
*Scenario:* Design MRV system for a 3-plant cement company (BF-BOF, 3 Mt/yr). Key sources: coke ovens, sinter, blast furnace, BOF, rolling mills, captive power (300 MW), 500 km rail transport.
*Tasks:*
1. Design monitoring parameters table (parameter, method, frequency, QA/QC)
2. Define automated validation rules for coke oven coal feed, blast furnace gas flow, grid electricity
3. Design cross-category reconciliation (coal input vs coke + BF gas + emissions)
4. Draft QC log template for verifier handover
*Time:* 45 min
*Deliverable:* Monitoring parameters table + validation rules + QC log template
*Rubric:* Parameter completeness (30%), validation logic (40%), QA/QC design (30%)

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

### Lesson 8.3.2: QA/QC System — Quality Assurance & Quality Control
**Lesson Code:** C08.3.2
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** professional

**Learning Objectives:**
1. Design a QA/QC system per IPCC 2006 / ISO 14064-3 requirements (Bloom: Create)
2. Implement automated QC checks (mass balance, trend analysis, cross-category reconciliation) (Bloom: Apply)
3. Manage QC documentation for verification readiness (Bloom: Create)

**Prerequisites:** C08.3.1, C05.2.2

**Why This Matters:**
QA/QC is not optional — it's a mandatory element of GHG Protocol and ISO 14064-1. A QC system catches errors before verifiers do. A QA system ensures continuous improvement. Without both, your inventory is a liability, not an asset.

**Core Concept: QC = Self-Checking; QA = Independent Review**

### 8.3.2.1 QC vs QA — Definitions & Responsibilities

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

### 8.3.2.2 Tier 1 QC Checks — Mandatory for Every Inventory

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

-- Cross-Category: Scope 3 Cat 3 vs Scope 1 fuel reconciliation
SELECT scope1_fuel * upstream_factor - cat3_emissions AS diff
FROM emissions
WHERE ABS(diff) / scope1_fuel > 0.05;

-- Trend Check: YoY change > 20% without structural change
SELECT current_year, prev_year, 
       (current_year - prev_year) / prev_year AS pct_change
FROM scope1_emissions
WHERE ABS(pct_change) > 0.2 AND no_structural_change_flag = true;
```

### 8.3.2.2 Tier 2 QC — Source-Specific Checks (Key Categories)

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

### 8.3.2.3 QC Documentation — The QC Log

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

### 8.3.2.4 QA — Independent Review

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

### 8.3.2.4 QC/QA Documentation Package for Verification

**Required Package:**
1. **QC Log** (all checks, results, resolutions)
2. **Automated QC Output** (query results, dashboards)
3. **QA Report** (independent reviewer)
3. **Recalculation Log** (if any)
4. **Methodology Change Log** (if any)
5. **EF Version Log** (versions used per category)
6. **Uncertainty Budget** (per category)
7. **DQI Scores** (per category)
8. **Cross-Category Reconciliation** (Cat 3 vs Scope 1, etc.)
9. **Recalculation Log** (if base year changed)
10. **Prior Verification Opinion** (if any)

### 8.3.2.4 Professional Judgement Points
- **Automation first:** 100% automated recalculation eliminates transcription errors
- **Tier 2 focus:** Spend 80% QC effort on key categories (>5% of scope)
- **Cross-category reconciliation:** Cat 3 vs Scope 1, Cat 11 vs product data — catches biggest errors
- **Trend alerts:** >20% YoY change without structural change = investigate
- **Verifier readiness:** Package QC/QA docs 2 weeks before verifier arrival

### 8.3.2.5 Practical Exercise: QC System Design
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

### Lesson 8.3.3: Advanced MRV — Digital MRV, Remote Sensing & Automation
**Lesson Code:** C08.3.3
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** professional

**Learning Objectives:**
1. Design digital MRV (dMRV) systems: sensors, IoT, satellite, blockchain (Bloom: Create)
2. Apply remote sensing for AFOLU and leakage monitoring (Bloom: Apply)
3. Evaluate automation trade-offs: cost, accuracy, verifiability, regulatory acceptance (Bloom: Evaluate)

**Prerequisites:** C08.3.1, C08.3.2

**Why This Matters:**
Traditional MRV is manual, periodic, and error-prone. Digital MRV (dMRV) — sensors, satellites, blockchain, AI — promises continuous, transparent, auditable monitoring. But technology introduces new risks: cybersecurity, data integrity, regulatory acceptance. This lesson teaches you to navigate the dMRV landscape.

**Core Concept: dMRV = Continuous + Transparent + Auditable (when done right)**

### 8.3.3.1 Digital MRV (dMRV) — Architecture & Components

**dMRV Stack:**
```
┌─────────────────────────────────────────────────────────────┐
│                    DATA INGESTION LAYER                      │
│  Smart Meters (Modbus/M-Bus/LoRaWAN) │ Telematics/GPS     │
│  Satellite/Drone Imagery             │ Supplier APIs        │
│  IoT Sensors (temp, pressure, flow)  │ Manual Entry (fallback)│
├─────────────────────────────────────────────────────────────┤
│                    PROCESSING LAYER                            │
│  Stream Processing (Kafka/Flink) → Validation → Enrichment   │
│  Unit Conversion → QC Rules → Gap Filling → Aggregation     │
├─────────────────────────────────────────────────────────────┤
│                    STORAGE LAYER                               │
│  Time-Series DB (InfluxDB/TimescaleDB) + Audit Log (Append-only)│
├─────────────────────────────────────────────────────────────┤
│                    CALCULATION LAYER                           │
│  Versioned Engine (Pure Functions) → Immutable Results + Hash │
├─────────────────────────────────────────────────────────────┤
│                    OUTPUT LAYER                                │
│  Verification Package | Registry API | Dashboard | Reports   │
└─────────────────────────────────────────────────────────────┘
```

**Data Ingestion Sources:**
| Source | Protocol | Frequency | Typical Parameters |
|--------|----------|-----------|-------------------|
| **Smart Meters** | Modbus, M-Bus, LoRaWAN, MQTT | 15-min to 1-sec | kWh, kW, PF, V, A |
| **Gas Meters** | Modbus, Pulse, AMR | Hourly/Daily | m³, MJ, GCV, composition |
| **Telematics** | GPS + CAN bus (J1939) | 1-60 sec | km, fuel, RPM, load |
| **Satellite/Drone** | API (Planet, Sentinel, custom) | Daily-Weekly | NDVI, biomass, deforestation, leakage |
| **IoT Sensors** | LoRaWAN, NB-IoT, BLE | 1-min to 1-hr | Temp, pressure, flow, level, vibration |
| **ERP/Financial** | REST API, SFTP, EDI | Daily/Monthly | Fuel receipts, production, sales |
| **Lab/Manual** | Web form, mobile app | Per sample | Lab results, composite samples |

### 8.3.3.2 Remote Sensing for AFOLU & Leakage

**Satellite Data Sources:**
| Platform | Resolution | Revisit | Cost | Best For |
|----------|-----------|---------|------|----------|
| **Sentinel-2** | 10m | 5 days | Free | Forest cover, crop health, leakage |
| **Landsat 8/9** | 30m | 16 days | Free | Historical trends, large area |
| **PlanetScope** | 3-5m | Daily | Commercial | High-cadence monitoring |
| **MAXAR/WorldView** | 0.3-0.5m | On-demand | High | Verification, audit |
| **LiDAR (GEDI, Airborne)** | 25m footprints | Campaign | High | Biomass, canopy height |

**Remote Sensing Applications:**
| Application | Method | Output | Uncertainty |
|-------------|--------|--------|-------------|
| **Forest Cover Change** | Time-series NDVI/EVI + segmentation | Deforestation/regeneration alerts | ±10-20% area |
| **Biomass Estimation** | LiDAR + allometric equations | tC/ha maps | ±15-25% |
| **Leakage Detection** | Buffer zone NDVI trend analysis | Displacement alerts | ±20% |
| **Crop/Soil Carbon** | Spectral indices + soil sampling | SOC maps | ±20-30% |
| **Fire Detection** | VIIRS/MODIS active fire | Burned area, emissions | ±10% area |

**Remote Sensing QA/QC:**
- Atmospheric correction (SR vs TOA reflectance)
- Cloud/cloud shadow masking (Fmask, Sentinel-2 QA band)
- Geometric accuracy (RMSE < 0.5 pixel)
- Radiometric calibration (cross-calibration with ground truth)
- Time series consistency (BRDF correction)

### 8.3.3.3 dMRV Verification & Regulatory Acceptance

**Verification Challenges for dMRV:**
| Challenge | Traditional | dMRV | Solution |
|-----------|-------------|------|----------|
| **Data Integrity** | Paper trail | Digital stream | Immutable logs (append-only DB, blockchain pilot) |
| **Sensor Drift** | Manual calibration | Continuous auto-calibration | Reference sensor cross-check |
| **Data Gaps** | Manual interpolation | Automated gap-filling | Documented algorithm + uncertainty |
| **Cybersecurity** | Physical docs | Digital stream | Encryption, access control, audit trail |
| **Regulatory Acceptance** | Established | Emerging | Standards development (ISO, Verra, GS) |

**Verification Package for dMRV:**
1. **System Architecture Diagram** (data flow, components, interfaces)
2. **Sensor Registry** (specs, calibration certs, locations, install dates)
3. **Data Flow Diagram** (ingestion → processing → storage → calculation)
4. **QC Rules Documentation** (automated rules, thresholds, version)
4. **Gap-Filling Algorithm** (method, uncertainty, validation)
5. **Cybersecurity Assessment** (pen test, access controls, encryption)
5. **Audit Trail Sample** (immutable log entries for sample period)
6. **Verification Report** (VVB opinion on dMRV system)

### 8.3.3.3 Blockchain & Tokenization in MRV

**Use Cases:**
| Application | Benefit | Status |
|-----------|---------|--------|
| **Credit Tokenization** | ERC-20/1155 for fractional ownership | Pilot (Toucan, KlimaDAO, Carbonplace) |
| **Immutable Registry** | Credit lineage on-chain | Pilot (Verra-Verra Registry Bridge) |
| **Automated Retirement** | Smart contract retirement on claim | Pilot (KlimaDAO, Celo) |
| **Settlement** | Instant DvP (Delivery vs Payment) | Emerging (Carbonplace, Xpansiv) |
| **MRV Audit Trail** | Immutable sensor logs | Pilot (Verra-Toucan bridge) |

**Risks & Mitigations:**
| Risk | Mitigation |
|------|------------|
| **Regulatory Uncertainty** | Engage regulators early; design for compliance |
| **Smart Contract Bugs** | Formal verification; bug bounties; upgradeability |
| **Oracle Risk** | Multiple oracles; consensus mechanisms |
| **Token Standards** | Use established (ERC-20, ERC-1155); avoid custom |
| **Gas Costs** | L2 solutions (Polygon, Arbitrum); batch operations |

### 8.3.3.3 Professional Judgement Points
- **dMRV ≠ No Verification:** Verifiers still audit the system, not just data
- **Automation ≠ Accuracy:** Sensors drift; algorithms have bugs; validate continuously
- **Cost-Benefit:** dMRV ROI > 2-3 years for large projects; longer for small
- **Standard Alignment:** Align dMRV design with Verra/GS/ICVCM digital MRV guidelines (emerging)
- **Fallback Plan:** Always have manual backup for critical parameters

### 8.3.3.3 Practical Exercise: dMRV Architecture Design
*Scenario:* Design dMRV for a 10,000 ha mangrove restoration project in Gujarat. Sources: 50 IoT water level sensors, monthly Sentinel-2, quarterly drone LiDAR, community patrol app.
*Tasks:*
1. Design data ingestion pipeline (protocols, frequency, validation)
2. Define QC rules for sensor data, satellite, drone
3. Design verification package structure for VVB
4. Estimate capex/opex vs traditional MRV
*Time:* 50 min
*Deliverable:* dMRV architecture diagram + QC rule set + cost model
*Rubric:* Architecture completeness (40%), QC design (30%), cost realism (30%)

**Knowledge Check:**
1. What is the key difference between traditional MRV and dMRV? (Continuous automated data vs periodic manual)
2. What is the biggest barrier to dMRV regulatory acceptance? (Data integrity proof; cybersecurity; standardization)
3. Can satellite data replace ground truthing for forest carbon? (No — calibrates/validates; ground truthing still required)
4. What is the role of blockchain in carbon MRV? (Immutable registry; automated retirement; DvP settlement — emerging)

**Sources:**
1. Verra Digital MRV Guidelines (2024, draft)
2. Gold Standard dMRV Requirements (2024)
3. ICVCM Digital MRV Position Paper (2024)
4. IPCC 2006 Guidelines — Volume 4 (AFOLU) — Remote Sensing
5. ESA Sentinel-2 / NASA Landsat — Product Guides
6. Verra Registry Bridge Specification (2023)

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC (dMRV tech evolving rapidly) | Regulatory Review: Quarterly*