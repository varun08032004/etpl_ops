# C05: Emissions Calculation & Data
## Module 5.3: Data Quality, Uncertainty & QA/QC

### Lesson 5.3.1: Data Quality, Uncertainty & QA/QC
**Lesson Code:** C05.3.1
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** professional

**Learning Objectives:**
1. Design and implement a data quality management system that produces verification-ready emissions data (Bloom: Apply)
2. Quantify and propagate uncertainty through calculation chains using IPCC approaches (Bloom: Apply)
3. Evaluate data quality gaps and design remediation strategies for audit readiness (Bloom: Evaluate)

**Prerequisites:** C05.1.1 (Emission Factors), C05.2.1 (Calculation Engines)

**Why This Matters:**
A calculation engine is only as credible as the data that feeds it. Verifiers spend 60%+ of their time checking data quality, not formulas. A calculation engine with perfect formulas but poor data quality produces precise garbage. This lesson teaches you to build data quality into the calculation pipeline from source to report.

**Core Concept: Data Quality as a System, Not an Afterthought**

### 5.3.1.1 Data Quality Framework — The GHG Protocol Approach

**Data Quality Dimensions (GHG Protocol / ISO 14064-3):**

| Dimension | Definition | Assessment Method | Target |
|-----------|------------|-------------------|--------|
| **Completeness** | % of required data present | % of expected records present | ≥98% per parameter/period |
| **Accuracy** | Closeness to true value | Cross-check error vs independent source | <2% for Scope 1/2 |
| **Precision** | Repeatability of measurements | Duplicate sampling RPD | <10% RPD for duplicates |
| **Timeliness** | Data available when needed | % on-time submission | ≥95% on-time |
| **Consistency** | Internal coherence across time/sources | Trend analysis, cross-checks | No unexplained step-changes |
| **Traceability** | Traceable to source | Audit trail completeness | 100% traceable |
| **Representativeness** | Data represents the population | Sampling design review | Representative sampling |

**Data Quality Grading (GHG Protocol / ISO 14064-3):**
| Grade | Criteria | Typical Use |
|-------|----------|-------------|
| **A** | Measured, calibrated, verified, low uncertainty | Scope 1/2 core, verification-grade |
| **B** | Measured, some gaps filled conservatively | Scope 1/2 secondary, Scope 3 hybrid |
| **C** | Estimated, modeled, high uncertainty | Scope 3 screening, low-impact categories |
| **D** | Rough estimate, high uncertainty | Screening only, not for verification |

### 5.3.1.1 Data Quality Architecture — Source to Report

```
Source → Capture → Validate → Store → Process → Report → Archive
   │         │          │        │        │         │
Meter   Logger   Range check  DB     Calc     Report   Archive
Sensor   Form     Cross-check  Backup   Engine   Template  Audit log
```

**Data Flow Principles:**
1. **Single Source of Truth:** One authoritative record per parameter
2. **Immutable Raw Data:** Raw data never overwritten; corrections via adjustment entries
3. **Traceability:** Every reported value traceable to raw measurement
4. **Automated Where Possible:** Reduce manual transcription errors

### 5.3.1.2 Data Capture — Methods & Controls

| Source | Capture Method | Controls |
|--------|----------------|----------|
| **Meters/Sensors** | Automated logging (API, Modbus, pulse) | Range checks, gap detection, calibration alerts |
| **Manual Forms** | Digital forms (tablet/app), offline-capable | Required fields, dropdowns, photo evidence |
| **Lab Results** | Electronic upload (API/email), PDF + CSV | Chain of custody, lab accreditation check |
| **Remote Sensing** | API pull (satellite APIs), scheduled download | Cloud cover check, geometric correction |
| **Surveys** | Mobile app (offline), GPS-tagged, timestamps | GPS validation, timestamp, required fields |

### 5.3.1.3 QA/QC Procedures — Prevention, Detection, Correction

| QA (Prevention) | QC (Detection) | Correction |
|-----------------|----------------|------------|
| **Calibration** | Traceable standards, schedule, certificates | Calibration logs, drift alerts |
| **Cross-Checks** | Independent meter, mass balance, energy balance | Reconciliation reports, discrepancy thresholds |
| **Range Checks** | Min/max, rate-of-change, physical limits | Automated flags, manual review queue |
| **Trend Analysis** | Seasonal patterns, trend breaks, step changes | Statistical process control (SPC) |
| **Duplicate Sampling** | Field duplicates, lab duplicates, split samples | Precision calculation (RPD) |
| **Audit Trail** | Immutable log: who, what, when, why | Immutable log, digital signatures |

**QA/QC Frequency Matrix:**
| Activity | Frequency | Responsible |
|----------|-----------|-------------|
| Calibration | Per schedule (annual/quarterly) | Qualified technician |
| Cross-Check | Per monitoring period | Independent verifier |
| Range Check | Real-time / per upload | Automated |
| Trend Review | Monthly / quarterly | Data analyst |
| Duplicate Sampling | 5-10% of samples | Field team / lab |
| Audit Trail Review | Quarterly | QA manager |

### 5.3.1.3 Data Gaps & Uncertainty — Managing the Inevitable

| Gap Type | Cause | Acceptable Fill Method | Documentation |
|----------|-------|------------------------|---------------|
| **Short Gap (< freq)** | Sensor glitch, comms fail | Linear interpolation | Gap log, method, duration |
| **Long Gap (> freq)** | Equipment failure, access denied | Conservative default / model | Gap log, method, justification |
| **Systematic Bias** | Calibration drift, sensor fault | Recalibrate, back-correct | Calibration record, correction factor |
| **Outlier** | Measurement error, anomaly | Investigate → exclude if justified | Outlier log, justification |
| **Missing Parameter** | Not monitored, lost data | Conservative default (methodology) | Gap log, assumption, uncertainty |

**Uncertainty Quantification (IPCC Approach 1):**
```
u_total = √(u₁² + u₂² + ... + uₙ²)  for independent uncertainties
Where u = relative uncertainty (%)
Conservative: Use upper bound of uncertainty range
```

**Conservative Treatment:**
- Use upper confidence bound for uncertain parameters
- If uncertainty >20%, apply conservativeness factor (e.g., 1.5× upper bound)
- Report uncertainty at parameter and project level

### 5.3.1.4 Data Management — Verification-Ready Architecture

| Requirement | Implementation |
|-------------|----------------|
| **Raw Data Immutability** | Write-once storage, audit trail, checksums |
| **Version Control** | Parameter versioning, change log with approval |
| **Access Control** | Role-based access, MFA |
| **Backup & Recovery** | Daily incremental, weekly full, off-site, tested restore |
| **Audit Trail** | Immutable log: user, action, timestamp, before/after values |
| **Export/Reporting** | Standardized export (CSV, JSON) for verifier |

**Data Quality KPIs (Monitored by Proponent & DOE):**
| KPI | Target |
|-----|--------|
| **Completeness** | ≥98% (per parameter, per period) |
| **Timeliness** | ≥95% on-time submission |
| **Accuracy** | Cross-check error <2% |
| **Gap Rate** | <1% of expected records |
| **Calibration Compliance** | 100% on schedule |

### 5.3.1.4 Uncertainty Management — From Parameter to Project

**Propagation (IPCC Approach 1 — Error Propagation):**
```
If ER = A × B × C
u_ER/ER = √( (u_A/A)² + (u_B/B)² + (u_C/C)² )
```

**Conservative Treatment:**
- Use upper confidence bound for uncertain parameters
- If uncertainty >20%, apply conservativeness factor (e.g., 1.5× upper bound)
- Report uncertainty at parameter and project level

**3.3.1.3 Data Gap Management — Protocol**

| Gap Duration | Action | Documentation |
|--------------|--------|---------------|
| < 1 monitoring interval | Interpolate (linear) | Gap log, method |
| 1 interval to 1 week | Conservative default / model | Gap log, method, justification |
| > 1 week | Conservative default + increased uncertainty | Gap log, method, uncertainty inflation |
| > 1 month | Root cause analysis, corrective action | Full investigation report |

### 5.3.1.5 Version Control & Change Management

| Change Type | Process | Documentation |
|-------------|---------|---------------|
| **Parameter Addition** | Change request → approval → version bump | CR form, approval, version log |
| **Method Change** | Deviation request → DOE review → approval | Deviation record, DOE letter |
| **Boundary Change** | Re-validation → re-registration | Validation report |
| **Correction** | Correction log → version bump | Correction log, reason, impact |

### 5.3.1.6 India Context

- **CEA Metering Regulations:** Meter accuracy class (0.2S, 0.5S), calibration annually
- **CEA Grid Code:** Real-time data communication (IEGC), SCADA integration
- **BEE PAT:** Specific monitoring forms, quarterly reporting
- **CCTS:** BEE-prescribed monitoring templates; quarterly submission to BEE
- **Forest Projects:** FSI data vintage rules; GPS + drone survey standards

### 5.3.1.7 EtherTrack Context

- Platform data ingestion: REST API, MQTT, CSV/Excel upload
- Platform validation: Schema validation, range checks, cross-parameter logic
- Platform QA/QC dashboard: Real-time completeness, gap alerts, calibration tracking
- Platform audit trail: Immutable event store (append-only)

### Common Mistakes:
1. No calibration schedule → expired calibrations at verification
2. Manual data entry without cross-checks → transcription errors
3. No gap-filling protocol → verifier imposes conservative defaults
4. Overwriting raw data → audit trail broken
5. No uncertainty quantification → verifier applies maximum uncertainty
5. Manual processes without automation → human error, delays

### Professional Judgement Points:
- When to automate vs manual: Automate high-frequency, high-risk parameters
- When to accept higher uncertainty: Only when conservative and documented
- When to escalate data gaps: >24h for continuous, >1 week for periodic

### Practical Exercise: QA/QC System Design
*Scenario:* Design QA/QC for a 100 MW wind project monitoring (generation, availability, curtailment).
*Tasks:*
1. Define calibration schedule for 200+ meters
2. Design cross-check (SCADA vs meter vs settlement)
3. Define gap-filling protocol for SCADA outages
*Time:* 40 min
*Deliverable:* QA/QC plan excerpt (calibration schedule + cross-check matrix + gap protocol)
*Rubric:* Completeness (40%), risk-based prioritization (30%), verifiability (30%)

### Knowledge Check:
1. What is the difference between QA and QC? (QA = process; QC = product verification)
2. What is the maximum acceptable gap for hourly generation data before conservative default required? (Typically 1-2 intervals)
3. How should a systematic meter bias be corrected? (Recalibrate, apply correction factor to historical data, document)

**Sources:**
1. VCS Standard v4.4 — Monitoring Plan Requirements
2. Gold Standard — Monitoring Plan Requirements
3. IPCC 2006 Guidelines — Chapter 3: Uncertainties
4. CEA Metering Regulations (India)
5. IPCC 2006 Guidelines — Volume 1: Uncertainty
6. BEE CCTS Guidelines (2023) — Monitoring requirements

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC (Monitoring tech evolving) | Regulatory Review: Semi-annual*