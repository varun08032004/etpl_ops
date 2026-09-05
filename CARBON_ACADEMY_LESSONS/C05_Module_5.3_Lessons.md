# C05: Emissions Calculation & Data
## Module 5.3: Worked Calculations (3 lessons × 40min = 2h)

### Lesson 5.3.1: Fuel Combustion & Electricity — Complete Worked Examples
**Lesson Code:** C05.3.1
**Duration:** 40 minutes
**Lesson Type:** practical_exercise
**Tier:** foundation

**Learning Objectives:**
1. Execute complete Scope 1 fuel combustion calculations from raw data to tCO2e (Bloom: Apply)
2. Execute Scope 2 electricity calculations (location-based + market-based) (Bloom: Apply)
3. Document calculation workbook with traceability for verification (Bloom: Create)

**Prerequisites:** C05.1.1, C05.1.2, C05.2.1

**Why This Matters:**
Theory is clean; reality is messy. This lesson bridges the gap by walking through complete, realistic calculations with real-world complications: mixed fuels, partial metering, unit conversions, GCV/NCV, oxidation factors, and location vs market-based electricity.

**Core Concept: From Meter Reading to tCO2e — Every Step Documented**

### 5.3.1.1 Calculation Workbook Structure — Verification-Ready

**Standard Workbook Tabs:**
| Tab | Purpose | Key Columns |
|-----|---------|-------------|
| **01_Source_Data** | Raw activity data (immutable) | source_id, date, quantity, unit, source_system, quality_flag |
| **02_EF_Library** | Emission factors used | factor_id, value, unit, gas, version, source, uncertainty |
| **03_Unit_Conversion** | All unit conversions | from_unit, to_unit, factor, source |
| **04_Calculations** | Step-by-step calcs | source_id, step, formula, inputs, output |
| **05_Aggregation** | Scope/category rollup | scope, category, gas, tCO2e, uncertainty |
| **06_Uncertainty** | Uncertainty budget | input, u_rel, sensitivity, contribution |
| **07_Cross_Checks** | Reconciliations | check_name, expected, actual, status |
| **08_Summary** | Final inventory | scope, category, gas, tCO2e, u_rel |

### 5.3.1.2 Example 1: Coal-Fired Boiler — Complete Calculation

**Scenario:** 500 MW coal plant. Monthly data for January 2024.

**Raw Data (Source: PI System, SAP MM, Weighbridge):**
| Parameter | Value | Source | Quality Flag |
|-----------|-------|--------|--------------|
| Coal Received | 125,000 tonnes | Weighbridge (SAP MM) | weighed |
| Opening Stock | 45,000 tonnes | SAP WM | weighed |
| Closing Stock | 38,000 tonnes | SAP WM | weighed |
| GCV (as received) | 4,250 kcal/kg | Lab report (daily composite) | lab_tested |
| Carbon Content | 44.2% | Lab report (ultimate analysis) | lab_tested |
| Hydrogen | 3.4% | Lab report | lab_tested |
| Moisture | 8.5% | Lab report | lab_tested |
| Ash | 12.0% | Lab report | lab_tested |

**Step 1: Coal Consumption (Mass Balance)**
```
Coal Consumed = Receipts + Opening - Closing
             = 125,000 + 45,000 - 38,000
             = 132,000 tonnes
```
*QC Check:* Imbalance = Receipts + Opening - Closing - Consumption = 0 ✓

**Step 2: GCV → NCV Conversion**
```
GCV = 4,250 kcal/kg = 17.78 MJ/kg
H% = 3.4%
NCV = GCV - 2.447 × H% × 9
    = 17.78 - 2.447 × 3.4 × 9/100
    = 17.78 - 0.75 = 17.03 MJ/kg
```
*Alternative:* NCV = GCV × (1 - 0.01 × H% × 9 × 2.447/GCV) — same result

**Step 3: Carbon Content per MJ**
```
Carbon Content = 44.2% = 0.442 kg C/kg coal
Carbon per MJ = 0.442 / 17.03 = 0.02595 kg C/MJ
```

**Step 4: CO2 Emission Factor (with Oxidation)**
```
Oxidation Factor (coal) = 0.98 (IPCC default)
CO2 per MJ = 0.02595 × 0.98 × (44/12)
           = 0.02595 × 0.98 × 3.667
           = 0.0932 kg CO2/MJ
```

**Step 5: Total Emissions**
```
Energy Input = 132,000 t × 17.03 MJ/kg = 2,247,960 GJ
CO2 Emissions = 2,247,960 GJ × 0.0932 tCO2/GJ
             = 209,510 tCO2
```

**Step 6: CH4 & N2O (IPCC 2006 Defaults)**
| Gas | EF (kg/TJ) | Energy (TJ) | Emissions (t) | GWP100 (AR6) | tCO2e |
|-----|------------|-------------|---------------|--------------|-------|
| CH4 | 1 | 2,248 | 2.25 | 27.9 | 62.7 |
| N2O | 1.5 | 2,248 | 3.37 | 273 | 920.0 |

**Step 7: Total CO2e**
```
Total CO2e = 209,510 + 62.7 + 920.0 = 210,493 tCO2e
```

**Uncertainty Budget:**
| Input | Value | u_rel | Contribution |
|-------|-------|-------|------------|
| Coal Quantity | 132,000 t | 1.5% (weighbridge) | 2.25% |
| GCV/NCV | 17.03 MJ/kg | 2.0% (lab) | 4.0% |
| Carbon Content | 44.2% | 2.5% (lab) | 6.25% |
| Oxidation Factor | 0.98 | 1.0% (IPCC default) | 1.0% |
| **Combined u_rel** | | | **7.7%** |

**Verification Documentation:**
- Source data files linked (weighbridge CSV, lab PDFs, PI export)
- Calculation workbook: `Jan2024_Coal_Calc_v1.0.xlsx` (hash: sha256:...)
- Cross-check: CEMS CO2 vs calculated (target ±5%)

### 5.3.1.2 Example 2: Natural Gas Combined Cycle — Complete Calculation

**Scenario:** 300 MW NGCC plant. January 2024.

**Raw Data:**
| Parameter | Value | Source |
|-----------|-------|--------|
| Gas Consumption | 12,500,000 m³ (at STP) | Gas meter (custody transfer) |
| Gas GCV | 38.5 MJ/m³ | Gas chromatograph (daily) |
| Gas Composition | CH4: 92%, C2H6: 4%, C3H8: 2%, Inerts: 2% | Gas chromatograph |
| Oxidation Factor | 0.995 | IPCC default |

**Calculation:**

**Step 1: Energy Input**
```
Energy = 12,500,000 m³ × 38.5 MJ/m³ = 481,250 GJ
```
(Using GCV for gas volume billing; NCV for EF calculation)

**Step 2: NCV Calculation**
```
NCV ≈ GCV × 0.9 (typical for NG) = 38.5 × 0.9 = 34.65 MJ/m³
Energy (NCV) = 12,500,000 × 34.65 = 432,812 GJ
```

**Step 3: Carbon Content**
```
CH4: 92% × 16 g/mol = 14.72 g C/mol gas
C2H6: 4% × 24 g/mol = 0.8 g C/mol
C3H8: 2% × 36 g/mol = 0.72 g C/mol
Total C per mol = 16.24 g
Molar mass mix ≈ 18.5 g/mol
Carbon mass fraction = 16.24/18.5 = 0.876 kg C/kg gas
Density at STP ≈ 0.78 kg/m³
Carbon per m³ = 0.876 × 0.78 = 0.683 kg C/m³
```

**Step 4: CO2 EF (NCV basis)**
```
CO2 per m³ = 0.683 × 0.995 × (44/12) = 2.49 kg CO2/m³
CO2 per MJ (NCV) = 2.49 / 34.65 = 0.0718 kg CO2/MJ
```

**Step 5: Emissions**
```
CO2 = 12,500,000 m³ × 2.49 kg CO2/m³ = 31,125 tCO2
Energy (NCV) = 432,812 GJ
CO2 per GJ = 31,125 / 432.8 = 71.9 kg CO2/GJ
```
*IPCC Default for NG: 56.1 kg CO2/GJ (NCV) — our calc higher due to ethane/propane*

**CH4/N2O (IPCC Defaults):**
| Gas | EF (kg/TJ) | Emissions (t) | tCO2e |
|-----|------------|---------------|-------|
| CH4 | 1 | 0.43 | 12.0 |
| N2O | 0.1 | 0.043 | 11.8 |

**Total:** 31,137 tCO2e

### 5.3.1.3 Example 3: Grid Electricity — Location vs Market Based

**Scenario:** Manufacturing facility. January 2024 consumption: 2,500 MWh.

**Location-Based (Grid Average):**
```
CEA Grid EF (2023-24): 0.71 kgCO2/kWh
Scope 2 (Location) = 2,500 MWh × 1,000 kWh/MWh × 0.71 kgCO2/kWh
                    = 1,775 tCO2
```

**Market-Based:**
```
REC Retired: 800 MWh (solar, IEX, retired Jan 2024)
Residual Consumption: 1,700 MWh
Residual EF: Use location-based (no residual mix published for India)
Scope 2 (Market) = 800 × 0 + 1,700 × 0.71 = 1,207 tCO2
```

**REC Documentation Required:**
- REC Certificate IDs (IEX)
- Retirement Confirmation (IEX retirement report)
- Vintage Match (2023-24 RECs for 2023-24 consumption)
- No Double Counting (same REC not used elsewhere)

**Uncertainty:**
| Method | EF Uncertainty | Activity Uncertainty | Combined |
|---------|----------------|---------------------|----------|
| Location-Based | 5% (CEA) | 1% (meter) | 5.1% |
| Market-Based | 0% (REC) + 5% (residual) | 1% | 5.1% |

### 5.3.1.3 Cross-Checks & Reconciliation

| Check | Expected | Tolerance | Action if Fail |
|-------|----------|-----------|----------------|
| **Fuel Mass Balance** | Receipts + Open - Close = Consumption | ±2% | Investigate losses |
| **Energy Balance** | Fuel Energy = Electricity Out + Heat Rate × Gen | ±3% | Check heat rate |
| **CEMS vs Calculated** | CEMS CO2 vs Fuel Calc | ±5% | Investigate bias |
| **Scope 2 Cat 3 vs Scope 1** | Cat 3 = f(Scope 1 fuel) | ±5% | Check upstream EF |
| **Scope 3 Cat 11 vs Product Data** | Units sold × lifetime = Cat 11 | ±10% | Check usage profiles |

### 5.3.1.3 Professional Judgement Points
- **Document every unit conversion** — verifiers check GCV→NCV, m³→MJ, kcal→MJ
- **Show oxidation factor explicitly** — don't bury in EF
- **Separate biogenic CO2** — report as memo item
- **Archive source files** — weighbridge CSV, lab PDF, meter export, REC certificate
- **Hash the workbook** — SHA256 in verification package

### 5.3.1.3 Practical Exercise: Complete Calculation Workshop
*Scenario:* A paper mill: 500 t/d pulp, 300 t/d paper. Fuels: 50 t/d coal (GCV 4500, C=48%), 20 t/d furnace oil, 5 t/d LPG. Grid import: 15 MWh/d. 500 kg R-410A (10% leak). 200 kg SF6 (0.2% leak).
*Tasks:*
1. Build complete calculation workbook (Scope 1, 2, basic Scope 3)
2. Include unit conversions, EF selection, uncertainty
3. Add cross-checks (mass balance, energy balance)
4. Document verification package
*Time:* 50 min
*Deliverable:* Complete workbook (Excel/CSV) + verification package outline
*Rubric:* Completeness (40%), traceability (30%), cross-checks (30%)

**Knowledge Check:**
1. What is the GCV to NCV conversion for coal with 4% H? (NCV = GCV - 0.88 MJ/kg)
2. What oxidation factor for natural gas? (0.995)
3. What REC proof is needed for market-based Scope 2? (Retirement certificate from IEX/PXIL)
4. What cross-check validates Scope 3 Cat 3? (Cat 3 = f(Scope 1 fuel × WTT EF))

**Sources:**
1. IPCC 2006 Guidelines — Volume 2, Chapters 1-4
2. CEA CO2 Baseline Database — Methodology
3. GHG Protocol Scope 2 Guidance — Chapter 6 (Market-Based)
4. IPCC 2006 Guidelines Volume 2, Chapter 2 (Stationary Combustion)
4. BEE PAT Guidelines — Data Requirements & Formats

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC (Grid EF, fuel specs updating) | Regulatory Review: Quarterly*

---

### Lesson 5.3.2: Process Emissions & Fugitives — Worked Examples
**Lesson Code:** C05.3.2
**Duration:** 40 minutes
**Lesson Type:** practical_exercise
**Tier:** foundation

**Learning Objectives:**
1. Execute cement calcination and process emissions calculations (Bloom: Apply)
2. Execute refrigerant and SF6 fugitive emission calculations (Bloom: Apply)
3. Build fugitive inventory with mass balance reconciliation (Bloom: Create)

**Prerequisites:** C05.1.3, C05.3.1

**Why This Matters:**
Process and fugitive emissions are where inventories most often go wrong — they don't follow simple fuel × EF patterns. Cement calcination, chemical reactions, refrigerant leaks, and SF6 require stoichiometry, inventory tracking, and leak rate estimation. This lesson builds the muscle memory for these critical calculations.

**Core Concept: Process = Stoichiometry; Fugitive = Inventory × Leak Rate × GWP**

### 5.3.2.1 Example 1: Cement Plant — Complete Process + Fuel Calculation

**Scenario:** 3,000 tpd clinker plant (1 Mt/yr). January 2024 data.

**Raw Data:**
| Parameter | Value | Source |
|-----------|-------|--------|
| Clinker Production | 93,000 tonnes | Production log |
| Clinker Factor (CaO%) | 66.5% | Lab (XRF) |
| Coal Consumption (kiln) | 18,500 tonnes | Weighbridge |
| Coal GCV | 4,300 kcal/kg | Lab |
| Coal Carbon | 46.0% | Lab |
| Petcoke (calciner) | 3,200 tonnes | Weighbridge |
| Petcoke GCV | 8,200 kcal/kg | Lab |
| Petcoke Carbon | 88.5% | Lab |
| Kiln Dust (CKD) | 1,850 tonnes | Dust collector |
| CKD CaO% | 42% | Lab |
| Grid Import | 4,500 MWh | Meter |

**Step 1: Process CO2 — Calcination**
```
CaCO3 → CaO + CO2
Stoichiometric: 44.01/100.09 = 0.4397 tCO2/t CaCO3
CaO in Clinker = 93,000 × 66.5% = 61,845 t CaO
CaCO3 Equivalent = 61,845 / 0.5608 = 110,280 t CaCO3
Calcination CO2 = 110,280 × 0.4397 = 48,492 tCO2
```
**CKD Correction:**
```
CaO in CKD = 1,850 × 42% = 777 t CaO
CKD CaCO3 Equiv = 777 / 0.5608 = 1,385 t
CKD CO2 = 1,385 × 0.4397 = 609 tCO2
```
**Total Process CO2 = 48,492 + 609 = 49,101 tCO2**

**Step 2: Fuel Emissions**
```
Kiln Coal: 18,500 t × 4,200 kcal/kg × 0.45 C × 0.98 × 44/12 / NCV
NCV = 4,200 - 2.447×3.5×9/100 = 17.4 MJ/kg
Coal CO2 = 18,500 × 17.4 × 0.46 × 0.98 × 44/12 / 17.4 = 18,500 × 0.46 × 0.98 × 3.667 = 30,480 tCO2

Petcoke: 3,200 t × 8,200 kcal/kg = 34.3 MJ/kg (NCV ≈ 32.5)
Carbon = 88.5%, Ox = 0.98
Petcoke CO2 = 3,200 × 0.885 × 0.98 × 3.667 = 10,230 tCO2

Total Fuel CO2 = 30,480 + 10,230 = 40,710 tCO2
```

**Step 3: Total Scope 1**
```
Process CO2 = 49,101 tCO2
Fuel CO2 = 40,710 tCO2
Scope 1 Total = 89,811 tCO2
```

**Step 4: Scope 2**
```
Grid Import = 4,500 MWh
Location-Based EF = 0.71 kgCO2/kWh
Scope 2 = 4,500 × 1,000 × 0.71 = 3,195 tCO2
```

**Step 5: Fugitives**
```
Refrigerant: 500 kg R-410A (GWP 2,088) × 12% leak = 60 kg × 2,088 = 125 tCO2e
SF6: 1,200 kg × 0.4% leak × 25,200 = 1,209 tCO2e
```

**Total = 89,811 + 3,195 + 125 + 1,209 = 94,340 tCO2e**

### 5.3.2.2 Example 2: Refrigerant Fugitive — Complete Inventory

**Scenario:** Commercial building portfolio. 15 sites. January 2024.

**Refrigerant Inventory (Asset-Level):**
| Site | System | Refrigerant | Charge (kg) | Install Date | Leak Rate Source |
|------|--------|-------------|-------------|--------------|------------------|
| HQ | Chiller 1 | R-410A | 350 | 2018 | Service log (12%/yr) |
| HQ | Chiller 2 | R-410A | 350 | 2020 | Service log (8%/yr) |
| Plant A | AC Units (×20) | R-32 | 5.0 each | 2022 | Mfr default (10%) |
| Plant B | Cold Storage | R-404A | 120 | 2015 | LDAR (18%/yr) |
| Warehouse | AC Units (×50) | R-410A | 3.0 each | 2019 | Default (15%/yr) |

**Mass Balance Approach (Preferred):**
```
For each system:
Emissions = Opening Charge + Purchases - Closing Charge - Retirements
```

**Simplified (Leak Rate) Calculation:**
| System | Charge (kg) | Leak Rate | GWP (AR6) | Annual Emissions (kg) | tCO2e |
|--------|-------------|-----------|-----------|----------------------|-------|
| HQ Chiller 1 | 350 | 12% | 2,088 | 42.0 | 87.7 |
| HQ Chiller 2 | 350 | 8% | 2,088 | 28.0 | 58.5 |
| Plant A (×20) | 100 | 10% | 675 | 10.0 | 6.75 |
| Plant B Cold | 120 | 18% | 3,922 | 21.6 | 84.7 |
| Warehouse (×50) | 150 | 15% | 2,088 | 22.5 | 47.0 |
| **Total** | **770** | | | **124.1** | **284.7** |

**Mass Balance Reconciliation (Year-End):**
```
For each system:
Opening Charge (Jan 1) + Purchases During Year - Closing Charge (Dec 31) = Emissions
```
*If closing charge unknown:* Use leak rate method + flag as estimated.

**Quality Checks:**
- Total purchases from invoices = Σ (Closing - Opening + Emissions) ?
- Leak rates within IPCC ranges? (Commercial AC: 5-35%)
- Phase-out schedule tracked? (R-22 → R-410A → R-32/R-290)

### 5.3.2.2 Example 3: SF6 — Complete Mass Balance

**Scenario:** Utility with 45 GIS units. January-December 2023.

**SF6 Inventory (Asset Register):**
| Asset ID | Type | Nameplate (kg) | Install Year | Last Leak Test |
|----------|------|----------------|--------------|----------------|
| GIS-001 | GIS 400kV | 1,200 | 2010 | 2023-06 (0.2%) |
| GIS-002 | GIS 400kV | 1,200 | 2012 | 2023-06 (0.15%) |
| GIS-003 | GIS 220kV | 450 | 2018 | 2023-06 (0.1%) |
| CB-001 to CB-020 | Breaker | 80 each | 2015-2022 | Annual (0.5%) |
| XFMR-001 to XFMR-010 | Transformer | 50 each | 2010-2020 | Biennial (0.2%) |

**Mass Balance Approach (Gold Standard):**
```
Total Emissions = Opening Inventory + Purchases - Closing Inventory - Retirements
```

**Data Collection:**
| Transaction | Quantity (kg) | Date | Asset |
|-------------|---------------|------|-------|
| Opening Inventory (Jan 1) | 14,500 | 2023-01-01 | All |
| Purchase (refill GIS-001) | 15 | 2023-03-15 | GIS-001 |
| Purchase (refill CB-007) | 5 | 2023-07-22 | CB-007 |
| Retirement (CB-015 decommissioned) | -80 | 2023-11-01 | CB-015 |
| Closing Inventory (Dec 31) | 14,420 | 2023-12-31 | All |

**Mass Balance Calculation:**
```
Emissions = 14,500 + 15 + 5 - 14,420 - 80 = 15 kg SF6
tCO2e = 15 × 25,200 = 378 tCO2e
```

**Leak Rate Verification (Cross-Check):**
```
Total Inventory Avg = (14,500 + 14,420)/2 = 14,460 kg
Implied Leak Rate = 15 / 14,460 = 0.104%/yr
```
*Consistent with modern GIS (0.1-0.5%/yr).*

**Per-Asset Allocation (for asset management):**
- Allocate proportionally to nameplate charge
- GIS-001: 1,200/14,460 × 15 = 1.24 kg
- GIS-002: 1,200/14,460 × 15 = 1.24 kg
- etc.

**tCO2e = 378 tCO2e (Scope 1)**

### 5.3.2.3 Cross-Checks & Verification Package

**Mass Balance Reconciliation Template:**
| Asset Class | Opening | Purchases | Retirements | Closing | Calculated Emissions | Leak Rate | Status |
|-----------|---------|-----------|-------------|---------|---------------------|-----------|--------|
| Refrigerant R-410A | 1,200 | 50 | 0 | 1,150 | 100 kg | 8.3% | ✓ |
| Refrigerant R-134a | 800 | 0 | 0 | 780 | 20 kg | 2.5% | ✓ |
| SF6 | 14,500 | 20 | 80 | 14,420 | 15 kg | 0.1% | ✓ |

**Verification Package Contents:**
1. **Asset Register** (complete, current, with nameplate photos)
2. **Transaction Log** (every purchase, refill, retirement, disposal)
3. **Leak Test Reports** (dated, signed, per asset)
4. **Mass Balance Workbook** (opening + purchases - retirements - closing = emissions)
4. **Leak Rate Benchmarking** (vs IPCC/IEC defaults)
5. **Phase-Out Tracker** (R-22 → R-410A → R-32/R-290 per Kigali)
6. **Emission Calculation Workbook** (hash documented)

### 5.3.2.3 Professional Judgement Points
- **Refrigerant mass balance > leak rate default** — track every kg
- **SF6 mass balance is gold standard** — leak rates vary wildly
- **Track by asset, not facility** — charge, type, age, location per asset
- **Phase-out planning:** R-22 → R-410A → R-32/R-290 per Kigali schedule
- **LDAR frequency:** Quarterly (high-risk), Annual (medium), Risk-based

### 5.3.2.3 Practical Exercise: Fugitive Calculation Workshop
*Scenario:* A campus: 200 kg R-410A (12% leak), 500 kg R-134a (8% leak), 50 kg R-22 (20% leak), 2,500 kg SF6 (GIS: 0.3%, Breakers: 1.2%). Gas pipeline: 5 km × 200 mm (0.8% leak, gas CH4 95%).
*Tasks:*
1. Calculate total fugitive emissions (tCO2e) by gas
2. Build mass balance reconciliation template
3. Prioritize LDAR investment by $/tCO2e reduced
4. Design phase-out schedule per Kigali Amendment
*Time:* 45 min
*Deliverable:* Fugitive register + LDAR investment priority + phase-out plan
*Rubric:* Calculation accuracy (40%), mass balance design (30%), prioritization (30%)

**Knowledge Check:**
1. What is the GWP100 of R-410A (AR6)? (2,088)
2. Which is more accurate for SF6: leak rate default or mass balance? (Mass balance)
3. What is the Kigali Amendment phase-down for India? (Freeze 2028, 85% reduction by 2047)
4. What is the typical leak rate for modern sealed GIS? (0.1-0.5%/yr)

**Sources:**
1. IPCC 2006 Guidelines — Volume 2 (Fugitive), Volume 3 (IPPU)
2. IPCC 2006 Guidelines Volume 3, Chapter 7 (Fluorinated Compounds)
3. EPA Method 21 / EPA OOOOa — LDAR
4. IEC 60480 — SF6 Handling
5. Kigali Amendment (2016) — HFC Phase-down
6. CPCB LDAR Guidelines (2018)

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC (Refrigerant transition, SF6 alternatives) | Regulatory Review: Quarterly*

---

### Lesson 5.3.3: Scope 3 — Complete Worked Examples
**Lesson Code:** C05.3.3
**Duration:** 40 minutes
**Lesson Type:** practical_exercise
**Tier:** foundation

**Learning Objectives:**
1. Execute Cat 1 (Purchased Goods) with hybrid Tier 2/3/4 approach (Bloom: Apply)
2. Execute Cat 11 (Use of Sold Products) with lifetime modeling (Bloom: Apply)
3. Execute Cat 15 (Investments) with PCAF attribution (Bloom: Apply)

**Prerequisites:** C05.3.1, C05.3.2

**Why This Matters:**
Scope 3 is where most emissions — and most errors — live. Cat 1 (Purchased Goods) and Cat 11 (Use of Products) often dominate but use the shakiest data. Cat 15 (Investments) requires financial attribution discipline. This lesson walks through complete, audit-ready calculations for the three highest-impact Scope 3 categories.

**Core Concept: Scope 3 = Engineering Estimates + Financial Attribution + Supplier Engagement**

### 5.3.3.1 Example 1: Cat 1 — Purchased Goods (Hybrid Tier 2/3/4)

**Scenario:** Auto component manufacturer. FY2024 procurement: ₹450 Cr.

**Spend Breakdown:**
| Category | Spend (₹Cr) | % | Tier | Method |
|----------|-------------|-----|------|--------|
| Steel (flat/long) | 180 | 40% | 2 | Supplier EF + qty |
| Aluminum | 45 | 10% | 2 | Supplier EF + qty |
| Plastics/Polymers | 60 | 13% | 3 | Industry avg (Ecoinvent) |
| Electronics | 75 | 17% | 4 | EEIO (EXIOBASE) |
| Chemicals/Paints | 30 | 7% | 3 | Industry avg |
| Packaging | 25 | 5% | 2 | Supplier qty + EF |
| Services/Other | 35 | 8% | 4 | EEIO |

**Tier 2 Calculation (Steel — Supplier Data):**
```
Top 5 steel suppliers = 85% of steel spend
Supplier A: 50,000 t × 2.1 tCO2e/t (supplier LCA) = 105,000 tCO2e
Supplier B: 30,000 t × 2.3 tCO2e/t = 69,000 tCO2e
Supplier C: 20,000 t × 2.0 tCO2e/t = 40,000 tCO2e
Remaining 15%: ₹27 Cr × 2.2 tCO2e/₹Cr (sector avg) = 59,400 tCO2e
Total Steel = 273,400 tCO2e
```

**Tier 3 Calculation (Plastics — Industry Average):**
```
Ecoinvent 3.9: PP granulate = 1.8 kgCO2e/kg
PE = 2.1 kgCO2e/kg
PVC = 2.5 kgCO2e/kg
Weighted avg (by spend): 2.0 kgCO2e/kg
Plastics qty = ₹60 Cr / ₹120/kg = 50,000 t
Emissions = 50,000 × 2.0 = 100,000 tCO2e
```

**Tier 4 Calculation (Electronics — EEIO):**
```
EXIOBASE 3.8.1: Electronics sector = 0.45 kgCO2e/₹ (2015 prices)
Inflation adjust (2015→2024): ×1.55 = 0.70 kgCO2e/₹
Electronics spend = ₹75 Cr
Emissions = 75 × 0.70 = 52.5 ktCO2e
Uncertainty: ±50% (EEIO)
```

**Packaging (Tier 2 — Supplier Qty):**
```
Corrugated: 5,000 t × 0.9 kgCO2e/kg = 4,500 tCO2e
Plastic film: 2,000 t × 2.5 = 5,000 tCO2e
Pallets (wood): 10,000 × 0.15 = 1,500 tCO2e
Total = 11,000 tCO2e
```

**Total Cat 1 Summary:**
| Category | tCO2e | Tier | Uncertainty |
|-----------|-------|------|-------------|
| Steel | 273,400 | 2 | ±15% |
| Aluminum | 45,000 t × 12 tCO2e/t = 540,000 | 2 | ±20% |
| Plastics | 100,000 | 3 | ±35% |
| Electronics | 52,500 | 4 | ±50% |
| Chemicals | 30 Cr × 4.0 = 120,000 | 3 | ±35% |
| Packaging | 11,000 | 2 | ±20% |
| Other (EEIO) | 35 Cr × 0.70 = 24,500 | 4 | ±50% |
| **Total Cat 1** | **~1.02 MtCO2e** | **Mixed** | **±25%** |

**Data Quality Indicators:**
| Category | Tier | Tech Rep | Geo Rep | Temp Rep | Complete | Reliability | Avg DQI |
|-----------|------|----------|---------|----------|----------|-------------|---------|
| Steel | 2 | 2 | 2 | 2 | 3 | 2 | 2.2 |
| Electronics | 4 | 3 | 4 | 3 | 4 | 4 | 3.6 |

### 5.3.3.2 Example 2: Cat 11 — Use of Sold Products (Appliance Manufacturer)

**Scenario:** AC manufacturer. 500,000 units/yr (1.5T 3-star split AC). 10-year design life.

**Product Specifications (BEE Star Rating):**
- 1.5T 3-Star Split AC: 1,100 kWh/yr (BEE label)
- Lifetime: 10 years (design)
- Annual Sales: 500,000 units

**Grid EF Projection (India):**
| Year | Grid EF (kgCO2/kWh) | Source |
|------|---------------------|--------|
| 2024 | 0.71 | CEA Actual |
| 2025 | 0.68 | CEA Projected |
| 2026 | 0.65 | CEA Projected |
| 2027 | 0.62 | IEA STEPS |
| 2028 | 0.59 | IEA STEPS |
| 2029 | 0.57 | IEA STEPS |
| 2030 | 0.55 | IEA STEPS |
| 2031 | 0.53 | IEA STEPS |
| 2032 | 0.51 | IEA STEPS |
| 2033 | 0.49 | IEA STEPS |

**Cat 11a Calculation (Use Phase — Direct):**
```
For each vintage cohort:
Units sold in year Y × Annual Consumption × Σ(Grid EF_year × Lifetime_Remaining)
```

**Cohort 2024 (500,000 units, 10-yr life):**
```
Year 2024: 500,000 × 1,100 × 0.71 = 388,500 tCO2
Year 2025: 500,000 × 1,100 × 0.68 = 374,000 tCO2
...
Year 2033: 500,000 × 1,100 × 0.49 = 269,500 tCO2
Cohort Total = Σ = 3,272,500 tCO2 over 10 years
```

**Cohort 2025 (500,000 units):**
```
Starts 2025, ends 2034
Total = 3,120,000 tCO2
```

**Annual Cat 11a (Steady State after 10 yrs):**
```
At maturity: 10 cohorts active
Annual = 500,000 × 1,100 × Avg Grid EF (10-yr avg ≈ 0.58) = 319,000 tCO2/yr
```

**Cat 11b (Upstream of Use-Phase Energy):**
```
Grid Upstream EF (WTW) ≈ 0.15 kgCO2/kWh (CEA + PPAC)
Annual Cat 11b = 500,000 × 1,100 × 0.15 × 10 = 82,500 tCO2/yr (steady state)
```

**Total Cat 11 (Steady State):**
```
Cat 11a + 11b = 319,000 + 82,500 = 401,500 tCO2e/yr
```

**Uncertainty Drivers:**
| Parameter | Uncertainty | Contribution |
|-----------|-------------|--------------|
| Annual Consumption | ±15% (usage variation) | High |
| Lifetime | ±20% (10±2 yr) | High |
| Grid EF Projection | ±20% (policy dependent) | High |
| Upstream EF | ±30% | Medium |

### 5.3.3.3 Example 3: Cat 15 — Investments (PCAF Attribution)

**Scenario:** NBFC with ₹10,000 Cr AUM. Portfolio breakdown:

| Asset Class | Outstanding (₹Cr) | Attribution Factor | Investee Scope 1+2 (tCO2e) | Attributed Emissions |
|-------------|-------------------|-------------------|----------------------------|---------------------|
| Listed Equity | 3,000 | Equity % = 0.5% avg | 50 MtCO2e (portfolio weighted) | 250,000 |
| Corporate Loans | 4,000 | Outstanding/EV = 15% avg | 200 MtCO2e (portfolio) | 30,000 |
| Project Finance | 1,500 | Investor Share = 40% avg | 5 MtCO2e (project) | 2,000 |
| Commercial RE | 1,000 | Investor Share = 60% avg | 0.5 MtCO2e | 300 |
| Motor Vehicle | 500 | Outstanding/Vehicle Value = 80% | 0.1 MtCO2e | 80 |

**PCAF Data Quality Scores:**
| Asset Class | Score | Rationale |
|-------------|-------|-----------|
| Listed Equity | 2 | Audited financials, reported emissions (BRSR) |
| Corporate Loans | 3 | Unaudited emissions, audited financials |
| Project Finance | 2 | Project-level emissions tracked |
| Commercial RE | 3 | Building-level estimates |
| Motor Vehicle | 4 | Vehicle-level estimates |

**Weighted Average DQS:**
```
(3,000×2 + 4,000×3 + 1,500×2 + 1,000×3 + 500×4) / 10,000 = 2.55
```
*Target: ≤3.0 by 2025 per PCAF*

**Total Cat 15 = 282,380 tCO2e (DQS 2.55)**

### 5.3.3.3 Cross-Checks & Verification Package

**Cat 1 Cross-Check:**
- Spend coverage >95% of procurement spend
- Top 20 suppliers = Tier 1/2 data
- Mass balance: Input materials ≈ Output products + Waste + Emissions

**Cat 11 Cross-Check:**
- Units sold × Lifetime energy ≈ Cat 11a
- Compare with peer benchmarks (tCO2e/unit)
- Sensitivity: Grid decarbonization scenario analysis

**Cat 15 Cross-Check:**
- PCAF DQS weighted avg ≤ 3.0
- Attribution factors sum ≤ 100% per investee
- Investee emissions from public reports (BRSR, CDP, Sustainability Reports)

**Verification Package for Scope 3:**
1. **Cat 1:** Supplier data log, EEIO methodology doc, Tier coverage %
2. **Cat 11:** Product specs, lifetime assumptions, grid EF projection, usage profiles
3. **Cat 15:** PCAF attribution workbook, DQS per asset class, investee data sources
4. **All:** Uncertainty budget, DQI scores, cross-category reconciliation

### 5.3.3.4 Professional Judgement Points
- **Cat 1:** Invest Tier 1/2 for top 20 suppliers; Tier 4 for long tail
- **Cat 11:** Model grid decarbonization (IEA STEPS/APS); usage profiles from warranty data
- **Cat 15:** Prioritize listed equity + corporate loans (highest data quality)
- **All Scope 3:** Document DQI per category; disclose uncertainty; prioritize reduction

### 5.3.3.4 Practical Exercise: Scope 3 Complete Workshop
*Scenario:* EV two-wheeler manufacturer. 200,000 units/yr (3 kWh/100km, 50 km/day, 8-yr life). ₹2,000 Cr procurement (60% battery cells, 20% aluminum, 20% other). ₹500 Cr loan portfolio.
*Tasks:*
1. Calculate Cat 1 (battery cells: Tier 2 supplier LCA; aluminum: Tier 2; other: Tier 4)
2. Calculate Cat 11 (lifetime modeling with grid decarbonization)
3. Calculate Cat 15 (PCAF attribution for loan portfolio)
4. Build uncertainty budget + DQI for all three
*Time:* 55 min
*Deliverable:* Complete Scope 3 workbook + uncertainty budget + DQI table
*Rubric:* Calculation rigor (40%), methodology appropriateness (30%), uncertainty transparency (30%)

**Knowledge Check:**
1. What is the PCAF attribution factor for a business loan? (Outstanding / Enterprise Value)
2. For Cat 11, why separate 11a (use-phase) and 11b (upstream of use-phase)? (Different EFs, different decarbonization levers)
3. What is the minimum PCAF DQS for a credible inventory? (≤3.0 weighted average)
4. What is the key uncertainty driver for Cat 11? (Grid decarbonization trajectory + usage profile)

**Sources:**
1. GHG Protocol Scope 3 Standard — Chapters 5, 11, 15
2. PCAF Global Standard (2020/2022) — Parts A & B
3. BEE Star Rating Database — Appliance consumption
4. IEA World Energy Outlook — Grid decarbonization scenarios
5. PCAF India Implementation Guide (2023)
5. EXIOBASE / USEEIO — EEIO factors

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC (Grid decarbonization, PCAF evolving) | Regulatory Review: Quarterly*