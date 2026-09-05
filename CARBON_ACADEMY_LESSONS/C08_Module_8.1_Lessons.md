# C08: Methodologies & MRV
## Module 8.1: Methodology Architecture (3 lessons × 40min = 2h)

### Lesson 8.1.1: Methodology Architecture
**Lesson Code:** C08.1.1
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** professional

**Learning Objectives:**
1. Explain the components of a carbon methodology: applicability, baseline, monitoring, calculation (Bloom: Understand)
2. Navigate the methodology landscape: CDM, VCS, GS, ART, CCTS, ISO 14064-2 (Bloom: Understand)
3. Select the right methodology for a given project type and context (Bloom: Apply)

**Prerequisites:** C06.1.1, C07.1.1

**Why This Matters:**
A methodology is the rulebook that governs how a project quantifies its emission reductions. Choosing the wrong methodology — or misinterpreting its requirements — leads to validation rejection, verification findings, and rejected credits. This lesson teaches you to navigate the methodology landscape and select the right rulebook for your project.

**Core Concept: Methodology = Applicability + Baseline + Monitoring + Calculation**

### 8.1.1.1 Methodology Anatomy — Standard Components

Every carbon methodology (VCS, GS, CDM, ART, CCTS, ISO 14064-2) contains these core modules:

| Module | Purpose | Key Content |
|--------|---------|-------------|
| **Applicability Conditions** | Defines what projects can use this methodology | Technology, geography, scale, baseline type, vintage |
| **Baseline Methodology** | How to determine the counterfactual scenario | Baseline type, parameters, equations, conservativeness |
| **Project Emissions** | How to calculate project emissions | Emission sources, parameters, equations |
| **Leakage** | How to quantify displacement effects | Leakage types, quantification methods, deduction |
| **Emission Reductions** | Net ER calculation | ER = Baseline - Project - Leakage |
| **Monitoring Plan** | What to measure, how, how often | Parameters, frequency, methods, QA/QC |
| **Data & Parameters** | Fixed vs monitored; default vs measured | Source, vintage, uncertainty, QA/QC |
| **Project Boundary** | Geographic, temporal, GHG, pools, leakage | Spatial, temporal, gas, pool definitions |

### 8.1.1.2 Methodology Landscape — Major Standards & Families

| Standard | Methodology Format | Key Characteristics |
|----------|-------------------|---------------------|
| **CDM** | AM (Approved Methodology), AMS (Small-scale) | UNFCCC governed; rigorous; legacy |
| **VCS (Verra)** | VM (Methodology), VT (Tool) | Modular; 200+ methodologies; market leader |
| **Gold Standard** | TPDDTEC, GS4GG Activity Requirements | SDG co-benefits mandatory; stricter safeguards |
| **ART/TREES** | TREES Standard v2.0 | Jurisdictional REDD+ only |
| **CCTS (India)** | BEE-approved methodologies | CCTS-specific; aligned with VCS/CDM |
| **ISO 14064-2** | Generic framework | Principles-based; adaptable to any project |
| **ACR** | Methodology + Protocol | US-focused; California compliance eligible |
| **Plan Vivo** | Community-based | Community forestry focus |

### 8.1.1.3 Methodology Selection Decision Tree

```
START: What is the project type?
├─ Renewable Energy (grid) → AMS-I.D (small) / ACM0002 (large)
├─ Renewable Energy (off-grid) → AMS-I.A, AMS-III.R
├─ Energy Efficiency (industrial) → AMS-II.A-J, AM0046
├─ Waste (landfill gas, wastewater) → AMS-III.A-H, AM0080
├─ Forestry (ARR) → AR-ACM0001/0003, VM0017
├─ REDD+ (Avoided Deforestation) → VM0007, VM0037, ART TREES
├─ IFM → VM0010, VM0012
├─ Blue Carbon → VM0033, VM0044
├─ Soil Carbon/Ag → VM0017, VM0042, GS SALM
├─ Cookstoves → AMS-II.G, GS-HED
├─ Biogas → AMS-III.D, AMS-III.R
└─ Transport → AMS-III.C, AMS-III.S
```

**Selection Criteria Checklist:**
- [ ] Project type matches methodology scope
- [ ] Applicability conditions ALL met
- [ ] Baseline approach appropriate for project context
- [ ] Monitoring requirements feasible for project capacity
- [ ] Standard accepted by target buyers (CORSIA, CCTS, voluntary)
- [ ] Methodology version current (not withdrawn/superseded)
- [ ] Tools/references available (EF databases, calculation tools)

### 8.1.1.4 Methodology Versioning — Critical for Audits

**Version Control Rules:**
| Event | Version Change | Action |
|-------|----------------|--------|
| **Minor correction** (typo, clarification) | Patch (v1.0 → v1.0.1) | Update references; no re-validation |
| **Clarification** (no material change) | Minor (v1.0 → v1.1) | Update PDD references |
| **Material change** (new equations, parameters) | Major (v1.0 → v2.0) | Re-validate; new registration if registered |
| **New methodology** | New ID | New validation |

**Best Practice:**
- Pin methodology version at validation (lock v1.2, not "latest")
- Document version in PDD, monitoring plan, calculation workbook
- Track version in EF library and calculation engine
- Monitor standard body announcements for updates/supersessions

### 8.1.1.5 India Context — CCTS & BEE Methodologies

**CCTS Methodology Framework:**
- BEE approves methodologies for CCTS compliance
- CCTS methodologies aligned with VCS/CDM but with India-specific parameters
- Key methodologies: Grid-connected RE, Industrial EE, Cement, PAT sectors
- BEE methodology list updated quarterly; check BEE portal

**BEE PAT Sectoral Baselines:**
- Sector-specific benchmarks (SEC) for PAT cycles
- Used as baseline for CCTS industrial projects
- Updated per PAT cycle; version-controlled

**EtherTrack Context:** Platform methodology registry auto-matches project type to eligible methodologies; flags version updates; checks applicability conditions automatically.

### 8.1.1.5 Common Mistakes
1. Using superseded methodology version (e.g., AMS-I.D v17 instead of v18)
2. Ignoring applicability condition "project must not be mandated by law"
3. Mixing methodology versions (baseline from v1, monitoring from v2)
3. Ignoring "shall" vs "should" in methodology text
4. Not checking for methodology withdrawal/supersession notice

### 8.1.1.5 Practical Exercise: Methodology Selection
*Scenario:* Client has: (a) 50 MW wind farm in Gujarat, (b) 5 MW rooftop solar for captive use in Maharashtra, (c) 20 MW biomass plant in Punjab using rice husk.
*Tasks:*
1. Select methodology for each (standard + version)
2. List applicability conditions to verify
3. Identify any methodology gaps (no approved methodology)
*Time:* 35 min
*Deliverable:* Methodology selection matrix
*Rubric:* Correct methodology (50%), applicability completeness (30%), gap identification (20%)

**Knowledge Check:**
1. What is the difference between AMS-I.D and ACM0002? (Scale: small vs large; simplified vs full)
2. Can you use CDM methodology for VCS project? (Yes, if not withdrawn; VCS accepts CDM methodologies)
3. What happens if methodology is updated after validation? (Project stays on validated version; new projects use new version)
4. Where to check latest methodology versions? (Verra/GS/CDM websites; methodology catalogues)

**Sources:**
1. Verra Methodology Catalogue (2024)
2. Gold Standard Methodology Library (2024)
3. CDM Methodology Panel — Approved Methodologies
4. ART TREES Standard v2.0
4. BEE CCTS Methodology List (2024)
5. ISO 14064-2:2019 — Methodology Framework

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC (Methodologies evolving) | Regulatory Review: Quarterly*

---

### Lesson 8.1.2: Applicability Conditions — Deep Dive
**Lesson Code:** C08.1.2
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** professional

**Learning Objectives:**
1. Systematically verify applicability conditions for any methodology (Bloom: Apply)
2. Distinguish mandatory vs conditional vs informational conditions (Bloom: Analyze)
3. Build an applicability screening tool for project screening (Bloom: Create)

**Prerequisites:** C08.1.1

**Why This Matters:**
Applicability conditions are the gatekeepers of methodology use. Missing even one condition invalidates the entire PDD. This lesson teaches you to systematically verify every condition — not just check boxes — so your project sails through validation.

**Core Concept: Applicability = ALL Conditions MUST Be Met (AND Logic)**

### 8.1.2.1 Applicability Condition Types

| Type | Definition | Example |
|------|------------|---------|
| **Mandatory (Shall)** | Non-negotiable; failure = methodology cannot be used | "Project shall be grid-connected" |
| **Conditional (If...Then)** | Applies only if trigger condition met | "If project includes storage, then..." |
| **Informational (Should/May)** | Best practice; non-compliance = finding, not rejection | "Project should engage stakeholders early" |

### 8.1.2.2 Applicability Categories — Universal Checklist

| Category | Typical Conditions | Verification Method |
|----------|-------------------|---------------------|
| **Project Type** | Technology, sector, activity | PDD Section 1 vs methodology scope |
| **Geography** | Country, region, grid boundary | Maps, coordinates, grid maps |
| **Scale/Size** | Capacity thresholds (MW, t/yr, ha) | Nameplate, design docs |
| **Technology** | Specific tech, vintage, vintage limits | Equipment specs, commissioning certs |
| **Baseline Eligibility** | Baseline type allowed, data availability | Baseline chapter vs methodology rules |
| **Additionality** | Test applicability (e.g., "not mandated by law") | Regulatory review, barrier docs |
| **Boundary** | Geographic, temporal, GHG, pools | GIS, project timeline, GHG list |
| **Leakage** | Leakage belt definition, magnitude | Leakage assessment |
| **Monitoring** | Parameter measurability, frequency | Meter specs, lab accreditation |
| **Safeguards** | FPIC, ESA, gender, grievance | Consultation reports, ESMP |
| **Regulatory** | Host country approvals, licenses | Permits, LoAs, regulatory letters |
| **Vintage/Time** | Crediting period limits, start date rules | Project timeline, registration date |

### 8.1.2.3 Condition Verification Workflow

**Step-by-Step Verification Process:**
```
1. EXTRACT: Copy ALL applicability conditions from methodology (verbatim)
2. CLASSIFY: Tag each as Mandatory / Conditional / Informational
3. MAP: Map each condition to PDD section + evidence document
4. VERIFY: For each condition:
   - Is condition met? (Y/N/Partial)
   - Evidence cited? (Doc ref, page, section)
   - Evidence sufficient? (Y/N)
5. DOCUMENT: Applicability matrix (Condition → Status → Evidence → Gap)
6. ESCALATE: Any "N" on Mandatory = STOP; fix before submission
```

### 8.1.2.4 Applicability Matrix Template

| # | Condition Text (Verbatim) | Type | PDD Ref | Evidence Doc | Status | Gap/Notes |
|---|---------------------------|------|---------|--------------|--------|-----------|
| 1 | Project shall be grid-connected | Mandatory | Sec 1.2 | PPA, grid conn. agreement | ✅ Met | — |
| 2 | Project shall not be mandated by law | Mandatory | Sec 5.1 | Legal opinion | ✅ Met | — |
| 3 | Plant capacity ≤ 15 MW | Mandatory | Sec 1.3 | Nameplate cert | ⚠️ Partial | 18 MW (exceeds) |
| 4 | If storage included, then... | Conditional | Sec 3.2 | N/A | N/A | Not applicable |
| 5 | Project should engage stakeholders | Informational | Sec 9 | Stakeholder report | ✅ Met | Best practice |

### 8.1.2.4 Common Applicability Failures

| Failure | Root Cause | Prevention |
|---------|------------|------------|
| **Capacity exceedance** | Project expanded after methodology selection | Check capacity limits at concept stage |
| **Technology mismatch** | Methodology for "wind" but project is "wind-solar hybrid" | Verify tech scope covers hybrid |
| **Geographic exclusion** | Project in excluded region (e.g., Annex I only) | Check geography list early |
| **Vintage restriction** | Methodology only for post-2012 projects | Check vintage rules before selection |
| **Fuel type exclusion** | Biomass methodology but using coal co-firing | Check fuel eligibility list |
| **Scale threshold** | Small-scale methodology but project >15 MW | Size check at concept note |
| **Baseline incompatibility** | Methodology requires historical baseline; project is greenfield | Baseline compatibility check |

### 8.1.2.5 Automated Applicability Screening (Platform Design)

**Screening Engine Logic:**
```
For each methodology in registry:
  score = 0
  For each mandatory condition:
    if condition.type == "numeric":
      score += (project.value >= condition.threshold) ? 1 : 0
    elif condition.type == "categorical":
      score += (project.value in condition.allowed_values) ? 1 : 0
    elif condition.type == "boolean":
      score += (project.value == condition.required_value) ? 1 : 0
  If score == total_mandatory_conditions:
    methodology.eligible = true
  Else:
    methodology.eligible = false
    gaps = list of failed conditions
```

**Platform Features:**
- Auto-suggest methodologies based on project concept note
- Highlight failed conditions with evidence gaps
- Track methodology version updates and re-screen projects
- Export applicability matrix for PDD appendix

### 8.1.2.5 Professional Judgement Points
- **Partial compliance = fail** for mandatory conditions; no "substantial compliance"
- **Conditional conditions:** Only verify if trigger is true; document why trigger false
- **Regulatory surplus:** "Not mandated by law" = check ALL applicable laws (national, state, local)
- **Scale thresholds:** Check at validation AND at each renewal (capacity upgrades)
- **Document "why not applicable":** For conditional conditions where trigger is false

### 8.1.2.5 Practical Exercise: Applicability Screening
*Scenario:* Screen 3 methodologies (AMS-I.D v18, ACM0002 v17, AMS-I.A v16) for a 25 MW solar-wind hybrid project in Rajasthan with 20 MWh battery storage.
*Tasks:*
1. List all mandatory applicability conditions for each
2. Check project against each (capacity, hybrid tech, storage, location)
3. Identify which methodology fits best
4. List gaps for non-fitting methodologies
*Time:* 40 min
*Deliverable:* Applicability matrix with pass/fail
*Rubric:* Condition extraction (30%), project mapping (40%), gap analysis (30%)

**Knowledge Check:**
1. What happens if one mandatory applicability condition fails? (Methodology cannot be used)
2. Can you use a methodology if conditional conditions don't apply? (Yes — only verify if trigger is true)
3. What is "regulatory surplus" in applicability? (Project not mandated by law)
4. Where to find official methodology applicability conditions? (Methodology document Section 2 / Applicability Conditions)

**Sources:**
1. VCS Standard v4.4 — Section 3.2 (Applicability Conditions)
2. CDM Methodological Tools — Applicability Conditions sections
3. Gold Standard — Applicability Conditions Guidance
4. VCS Methodology Templates — Applicability Conditions sections
4. CDM Methodological Tools — Applicability Conditions
5. BEE CCTS Guidelines (2023) — Applicability Conditions

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC (Methodologies evolving) | Regulatory Review: Quarterly*

---

### Lesson 8.1.3: Methodology Evolution & Transition Management
**Lesson Code:** C08.1.3
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** professional

**Learning Objectives:**
1. Manage methodology transitions: version upgrades, supersessions, withdrawals (Bloom: Apply)
2. Handle methodology gaps: no approved methodology for project type (Bloom: Analyze)
3. Build a methodology management system for portfolio governance (Bloom: Create)

**Prerequisites:** C08.1.1, C08.1.2

**Why This Matters:**
Methodologies evolve — versions update, new ones emerge, old ones are withdrawn. A project validated under v1.0 may need re-validation under v2.0. A project type may have no approved methodology today but get one tomorrow. This lesson teaches you to manage methodology lifecycle across your portfolio.

**Core Concept: Methodology = Living Document; Project = Pinned Version**

### 8.1.3.1 Methodology Lifecycle — Version Events

| Event | Trigger | Impact on Projects | Action Required |
|-------|---------|-------------------|-----------------|
| **Patch** (v1.0.1) | Typo fix, clarification | None | Update references |
| **Minor** (v1.1) | Clarification, minor new option | Update PDD references | Low effort |
| **Major** (v2.0) | New equations, parameters, scope | Re-validate if registered | High effort |
| **Supersession** | New methodology replaces old | Transition plan needed | Migration project |
| **Withdrawal** | Methodology retired | No new registrations | Migrate or close |

### 8.1.3.2 Transition Management — From Old to New

**Transition Scenarios:**
| Scenario | Trigger | Project Impact | Migration Path |
|----------|---------|----------------|----------------|
| **Version Upgrade** | v1.2 → v1.3 (clarification) | Update PDD refs; minor recalc | Low effort |
| **Major Upgrade** | v1.0 → v2.0 (new equations) | Re-validation likely | Plan 3-6 months |
| **Supersession** | AMS-I.D v18 → AMS-I.D v19 | Must migrate for new issuance | Map old→new params |
| **Methodology Merger** | Two methodologies merged | Re-validate under new ID | Full re-validation |

**Transition Checklist:**
- [ ] Subscribe to standard body methodology announcements
- [ ] Maintain methodology version registry per project
- [ ] Flag projects on superseded/withdrawn methodologies
- [ ] Pre-assess migration effort (gap analysis old vs new)
- [ ] Budget for re-validation (VVB fees, internal effort)
- [ ] Communicate to buyers (vintage eligibility may change)

### 8.1.3.2 Managing Methodology Gaps

**When No Approved Methodology Exists:**
| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| **New Methodology Submission** | Submit to Verra/GS/CDM | First-mover advantage | 12-24 months; high cost |
| **Methodology Deviation** | Request deviation from VVB | Faster (if accepted) | Limited scope; case-by-case |
| **Alternative Methodology** | Use closest approved methodology | Faster | May not fit perfectly |
| **Wait for Standard Body** | Wait for methodology development | No cost | Uncertain timeline |

**Methodology Deviation Process (VCS):**
1. Project proponent requests deviation from VVB
2. VVB assesses if deviation maintains integrity
3. VVB submits to Verra for approval
4. Verra approves/denies with conditions
5. If approved: documented in validation report

### 8.1.3.3 Methodology Portfolio Management

**Portfolio Methodology Registry:**
| Project | Methodology | Version | Status | Next Review |
|---------|-------------|---------|--------|-------------|
| Solar Gujarat | AMS-I.D | v18 | Active | 2025-Q2 |
| Wind Tamil Nadu | ACM0002 | v17 | Active | 2025-Q3 |
| Biomass Punjab | AMS-III.R | v6 | Active | 2025-Q1 |
| Cookstoves Odisha | GS-HED | v2.2 | Active | 2025-Q4 |

**Governance Processes:**
- **Quarterly:** Screen all projects for methodology updates
- **Annually:** Full methodology portfolio review
- **On Event:** Re-screen affected projects on methodology change
- **Escalation:** Projects on withdrawn/superseded → immediate action

### 8.1.3.3 Professional Judgement Points
- **Pin at validation:** Project stays on validated methodology version; new projects use latest
- **Monitor standard body channels:** Verra/GS/CDM/BEE methodology announcement feeds
- **Budget for migration:** Major version upgrade = re-validation cost + timeline
- **Buyer communication:** Vintage eligibility may change with methodology version

### 8.1.3.3 Practical Exercise: Methodology Transition Plan
*Scenario:* Portfolio has 5 projects on AMS-I.D v17. Verra releases v19 with new degradation parameter and revised OM/BM weights.
*Tasks:*
1. Gap analysis: v17 vs v19 key changes
2. Impact assessment: ER impact per project
3. Migration plan: timeline, VVB engagement, cost
4. Buyer communication: vintage eligibility changes
*Time:* 45 min
*Deliverable:* Migration plan with timeline and budget
*Rubric:* Gap analysis (30%), impact quantification (30%), migration plan (40%)

**Knowledge Check:**
1. What is the difference between a patch, minor, and major version update? (Patch=typo; Minor=clarification; Major=new equations/parameters)
2. Can a registered project stay on old methodology version? (Yes, for existing vintages; new issuance may require upgrade)
3. What is a methodology deviation? (Formal request to deviate from methodology requirement)
4. How long does methodology development take? (12-24 months for new methodology)

**Sources:**
1. VCS Standard v4.4 — Section 3.1 (Methodology Approval)
2. Verra Methodology Catalogue — Version History
4. Gold Standard — Methodology Update Process
5. CDM Methodology Panel — Work Programme
4. BEE CCTS — Methodology Update Notifications
5. ICVCM — Methodology Assessment Process

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC (Methodologies evolving) | Regulatory Review: Quarterly*