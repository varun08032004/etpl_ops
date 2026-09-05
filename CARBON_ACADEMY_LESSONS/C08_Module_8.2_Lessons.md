# C08: Methodologies & MRV
## Module 8.2: Applicability Conditions (3 lessons × 40min = 2h)

### Lesson 8.2.1: Applicability Conditions
**Lesson Code:** C08.2.1
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

### 8.2.1.1 Applicability Condition Types

| Type | Definition | Example |
|------|------------|---------|
| **Mandatory (Shall)** | Non-negotiable; failure = methodology cannot be used | "Project shall be grid-connected" |
| **Conditional (If...Then)** | Applies only if trigger condition met | "If project includes storage, then..." |
| **Informational (Should/May)** | Best practice; non-compliance = finding, not rejection | "Project should engage stakeholders early" |

### 8.2.1.2 Applicability Categories — Universal Checklist

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

### 8.2.1.3 Condition Verification Workflow

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

### 8.2.1.4 Applicability Matrix Template

| # | Condition Text (Verbatim) | Type | PDD Ref | Evidence Doc | Status | Gap/Notes |
|---|---------------------------|------|---------|--------------|--------|-----------|
| 1 | Project shall be grid-connected | Mandatory | Sec 1.2 | PPA, grid conn. agreement | ✅ Met | — |
| 2 | Project shall not be mandated by law | Mandatory | Sec 5.1 | Legal opinion | ✅ Met | — |
| 3 | Plant capacity ≤ 15 MW | Mandatory | Sec 1.3 | Nameplate cert | ⚠️ Partial | 18 MW (exceeds) |
| 4 | If storage included, then... | Conditional | Sec 3.2 | N/A | N/A | Not applicable |
| 5 | Project should engage stakeholders | Informational | Sec 9 | Stakeholder report | ✅ Met | Best practice |

### 8.2.1.4 Common Applicability Failures

| Failure | Root Cause | Prevention |
|---------|------------|------------|
| **Capacity exceedance** | Project expanded after methodology selection | Check capacity limits at concept stage |
| **Technology mismatch** | Methodology for "wind" but project is "wind-solar hybrid" | Verify tech scope covers hybrid |
| **Geographic exclusion** | Project in excluded region (e.g., Annex I only) | Check geography list early |
| **Vintage restriction** | Methodology only for post-2012 projects | Check vintage rules before selection |
| **Fuel type exclusion** | Biomass methodology but using coal co-firing | Check fuel eligibility list |
| **Scale threshold** | Small-scale methodology but project >15 MW | Size check at concept note |
| **Baseline incompatibility** | Methodology requires historical baseline; project is greenfield | Baseline compatibility check |

### 8.2.1.5 Automated Applicability Screening (Platform Design)

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

### 8.2.1.5 Professional Judgement Points
- **Partial compliance = fail** for mandatory conditions; no "substantial compliance"
- **Conditional conditions:** Only verify if trigger is true; document why trigger false
- **Regulatory surplus:** "Not mandated by law" = check ALL applicable laws (national, state, local)
- **Scale thresholds:** Check at validation AND at each renewal (capacity upgrades)
- **Document "why not applicable":** For conditional conditions where trigger is false

### 8.2.1.5 Practical Exercise: Applicability Screening
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
3. Gold Standard — Applicability Conditions Guidelines
4. VCS Methodology Templates — Applicability Conditions sections
4. CDM Methodological Tools — Applicability Conditions
5. BEE CCTS Guidelines (2023) — Applicability Conditions

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC (Methodologies evolving) | Regulatory Review: Quarterly*

---

### Lesson 8.2.2: Applicability Screening & Automation
**Lesson Code:** C08.2.2
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** professional

**Learning Objectives:**
1. Build an automated applicability screening engine for project concept notes (Bloom: Create)
2. Design condition parsing logic for mandatory, conditional, informational types (Bloom: Apply)
3. Handle edge cases: partial compliance, version drift, regulatory changes (Bloom: Analyze)

**Prerequisites:** C08.1.2, C08.2.1

**Why This Matters:**
Manual applicability checking is slow and error-prone. An automated screening engine can evaluate 50+ methodologies against a concept note in seconds, flagging gaps before expensive PDD development begins. This lesson teaches you to build that engine.

**Core Concept: Applicability = Structured Logic + Evidence Mapping**

### 8.2.2.1 Condition Parsing — From Text to Logic

**Condition Types & Parsing Logic:**

| Condition Type | Text Pattern | Logic Representation | Evaluation |
|----------------|--------------|---------------------|------------|
| **Numeric Threshold** | "Capacity shall not exceed 15 MW" | `project.capacity <= 15` | Boolean |
| **Categorical Inclusion** | "Technology shall be wind or solar" | `project.tech in ["wind", "solar"]` | Boolean |
| **Boolean** | "Project shall not be mandated by law" | `not project.mandated_by_law` | Boolean |
| **Conditional** | "If storage > 10 MWh, then..." | `if project.storage > 10 then ...` | Conditional Boolean |
| **Date/Vintage** | "Project start date after 2016" | `project.start_date > '2016-01-01'` | Boolean |
| **Geographic** | "Project located in non-Annex I country" | `project.country not in annex1_list` | Boolean |
| **Conditional (If-Then)** | "If storage included, then capacity ≤ 20% of generation" | `if storage: storage ≤ 0.2 * generation` | Conditional |

**Parsing Pipeline:**
```
Raw Methodology Text
    ↓
NLP / Rule-based Parser → Structured Conditions (JSON)
    ↓
Condition Type Classification (Mandatory/Conditional/Info)
    ↓
Logic Compilation (AST → Executable Function)
    ↓
Condition Registry (Versioned, Cached)
```

### 8.2.2.2 Condition Evaluation Engine

**Evaluation Engine Architecture:**
```python
class ApplicabilityEngine:
    def __init__(self, methodology_registry):
        self.registry = methodology_registry
        self.condition_cache = {}
    
    def evaluate(self, project_data, methodology_id):
        methodology = self.registry.get(methodology_id)
        conditions = methodology.conditions
        
        results = []
        for condition in conditions:
            if condition.type == "mandatory":
                passed = self.evaluate_condition(condition, project_data)
                results.append({
                    "condition_id": condition.id,
                    "text": condition.text,
                    "type": "mandatory",
                    "passed": passed,
                    "evidence_required": condition.evidence_hint
                })
            elif condition.type == "conditional":
                if self.evaluate_trigger(condition.trigger, project_data):
                    passed = self.evaluate_condition(condition.then_clause, project_data)
                    results.append({
                        "condition_id": condition.id,
                        "text": condition.text,
                        "type": "conditional",
                        "triggered": True,
                        "passed": passed
                    })
                else:
                    results.append({
                        "condition_id": condition.id,
                        "type": "conditional",
                        "triggered": False,
                        "passed": True  # Not triggered = auto-pass
                    })
        
        all_mandatory_passed = all(r["passed"] for r in results if r["type"] == "mandatory")
        return {
            "methodology_eligible": all_mandatory_passed,
            "results": results,
            "gaps": [r for r in results if not r["passed"] and r["type"] == "mandatory"]
        }
    
    def evaluate_condition(self, condition, project_data):
        # Evaluate parsed AST against project data
        # Returns (passed: bool, evidence: dict)
        pass
```

### 8.2.2.2 Evidence Mapping & Gap Reporting

**Evidence Mapping Rules:**
| Condition Type | Evidence Required | Auto-Fetch Sources |
|----------------|-------------------|-------------------|
| **Capacity ≤ X MW** | Nameplate certificate, commissioning cert | ERP, PPA, commissioning cert |
| **Grid-connected** | PPA, grid connection agreement | PPA registry, utility portal |
| **Not mandated by law** | Legal opinion, regulatory scan | Legal DB, regulatory tracker |
| **Technology in list** | Equipment specs, commissioning report | Equipment registry, OEM certs |
| **Location in region** | GIS coordinates, land records | GIS, land records API |

**Gap Report Output:**
```json
{
  "methodology_id": "AMS-I.D_v18",
  "eligible": false,
  "mandatory_passed": 12,
  "mandatory_failed": 1,
  "gaps": [
    {
      "condition_id": "capacity_limit",
      "text": "Plant capacity shall not exceed 15 MW",
      "type": "mandatory",
      "project_value": 25,
      "threshold": 15,
      "evidence": "Nameplate certificate",
      "severity": "blocking"
    }
  ],
  "conditional_triggered": 3,
  "conditional_passed": 3,
  "informational_count": 5
}
```

### 8.2.2.3 Edge Cases & Edge Logic

**Edge Case Handling:**
| Scenario | Logic | Resolution |
|-----------|-------|------------|
| **Partial Compliance** | "Capacity ≤ 15 MW" but project is 15.2 MW | FAIL — no partial credit for mandatory |
| **Conditional Not Triggered** | "If storage > 10 MWh..." but project has 5 MWh | AUTO-PASS (condition not triggered) |
| **Conflicting Conditions** | "Capacity ≤ 15 MW" AND "Capacity ≥ 10 MW" for 12 MW | Both must pass |
| **Version Drift** | Methodology v17 says ≤15 MW; v18 says ≤20 MW | Use methodology version pinned at validation |
| **Regulatory Change** | New law mandates RE purchase; "not mandated" fails | Re-evaluate at each verification; flag for review |
| **Data Gap** | Required evidence document missing | FLAG — cannot evaluate; request document |

### 8.2.2.3 Automation Workflow Integration

**Screening Pipeline:**
```
Concept Note Input
    ↓
Project Feature Extraction (tech, capacity, location, fuel, etc.)
    ↓
Methodology Registry Query (all active methodologies)
    ↓
Parallel Condition Evaluation (per methodology)
    ↓
Results Aggregation:
  - Eligible methodologies (ranked by fit score)
  - Gaps per methodology (blocking + non-blocking)
  - Recommended methodology (highest fit score)
    ↓
Output: Screening Report + Applicability Matrix + Gap Report
```

**Integration Points:**
- **Concept Note Stage:** Initial screening (50+ methodologies in seconds)
- **Pre-PDD:** Deep dive on shortlisted methodologies
- **Pre-Validation:** Final verification with evidence package
- **Post-Registration:** Re-screen on methodology updates

### 8.2.2.4 Professional Judgement Points
- **Invest in parsing accuracy:** False positives waste months; false negatives miss opportunities
- **Version pinning:** Always pin methodology version at concept note; re-screen on version change
- **Human-in-the-loop:** Automated screening = recommendation; human makes final call
- **Audit trail:** Log every evaluation (project, methodology, version, result, timestamp)
- **Regulatory change monitoring:** Auto-flag projects when regulations change applicability

### 8.2.2.4 Practical Exercise: Screening Engine Design
*Scenario:* Build a screening engine for 50+ methodologies. Input: project concept note (JSON). Output: ranked methodology list with gap analysis.
*Tasks:*
1. Design condition parsing grammar (DSL or NLP)
2. Design evaluation engine with evidence tracking
3. Design gap report format for PDD appendix
4. Design version update notification system
*Time:* 45 min
*Deliverable:* Engine architecture diagram + sample output JSON
*Rubric:* Architecture completeness (40%), edge case handling (30%), integration design (30%)

**Knowledge Check:**
1. What happens if a conditional condition's trigger is false? (Auto-pass — condition not applicable)
2. Can partial compliance satisfy a mandatory numeric threshold? (No — binary pass/fail)
3. How to handle methodology version updates in screening? (Pin version at concept note; re-screen on update)
4. What is the difference between "informational" and "mandatory" conditions? (Informational = best practice; Mandatory = gatekeeper)

**Sources:**
1. VCS Standard v4.4 — Applicability Conditions parsing
2. CDM Methodological Tools — Condition Logic
3. Gold Standard — Applicability Conditions
3. Verra Methodology Templates — Condition Structure
4. CDM Methodological Tools — Condition Logic
4. BEE CCTS Guidelines — Applicability Conditions

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC (Automation logic evolving) | Regulatory Review: Quarterly*

---

### Lesson 8.2.3: Applicability Edge Cases & Regulatory Alignment
**Lesson Code:** C08.2.3
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** professional

**Learning Objectives:**
1. Handle complex applicability edge cases: hybrids, phased projects, nested programs (Bloom: Analyze)
2. Align applicability with evolving regulations: CCTS, Article 6, CORSIA (Bloom: Analyze)
3. Design compliance monitoring for applicability drift over project lifetime (Bloom: Create)

**Prerequisites:** C08.2.1, C08.2.2

**Why This Matters:**
Real projects don't fit neatly into methodology boxes. Hybrids, phased developments, and regulatory changes create applicability edge cases that can derail validation. This lesson teaches you to navigate the gray zones and build compliance monitoring that catches drift before it becomes a finding.

**Core Concept: Applicability = Living Assessment, Not One-Time Check**

### 8.2.3.1 Edge Cases — Hybrids, Phased, Nested

**Hybrid Projects (Multiple Technologies):**
| Scenario | Challenge | Resolution |
|----------|-----------|------------|
| **Solar + Wind Hybrid** | Single methodology? | Check if methodology covers hybrid; else separate PDDs per tech |
| **Solar + Storage** | Storage as separate activity? | AMS-I.D for solar; AMS-III.R for storage (if separate revenue) |
| **RE + Green H2** | Electrolysis powered by RE | Separate PDDs: RE (AMS-I.D) + H2 (new methodology) |
| **Biomass + Solar Hybrid** | Co-firing / hybrid boiler | Check if methodology covers co-firing; else separate |

**Phased Projects (Multi-Stage Development):**
| Phase | Applicability Check | Registration Strategy |
|--------|---------------------|----------------------|
| **Phase 1: 50 MW** | Check Phase 1 capacity vs methodology limit | Register Phase 1 separately |
| **Phase 2: +50 MW** | Re-check applicability (cumulative capacity?) | New PDD or amendment? Check methodology rules |
| **Phase 3: +Storage** | Storage may change applicability | New methodology or amendment |

**Nested Programs (Jurisdictional + Project):**
| Level | Applicability Check |
|--------|---------------------|
| **Jurisdictional (Level 1)** | Jurisdictional methodology applicability (ART TREES, etc.) |
| **Project (Level 2)** | Project methodology + consistency with jurisdictional ref level |
| **Consistency Check** | Project baseline ⊆ Jurisdictional reference level |

### 8.2.3.2 Regulatory Alignment — CCTS, Article 6, CORSIA

**CCTS (India) Applicability Alignment:**
| CCTS Requirement | Methodology Implication | Check |
|------------------|-------------------------|------|
| **Obligated Entity** | Must use CCTS-approved methodology | Check BEE methodology list |
| **CCTS Baseline** | May differ from VCS/GS baseline | Baseline alignment check |
| **CCTS Registry** | CCC issuance on IEX/PXIL | Registry bridge compatibility |
| **CCTS Verification** | BEE-empaneled verifier only | VVB must be BEE-empaneled |

**Article 6.2 (Cooperative Approaches):**
| Requirement | Applicability Impact |
|-------------|---------------------|
| **Host Party Authorization** | Methodology must allow host country LoA |
| **Corresponding Adjustment** | Methodology must support CA tracking |
| **ITMO Characteristics** | Methodology must define ITMO characteristics |
| **First Transfer** | Registry must support first transfer tracking |

**CORSIA Alignment:**
| CORSIA Phase | Eligible Standards | Vintage Rules |
|--------------|-------------------|---------------|
| **Pilot (2021-23)** | CDM, VCS, GS, ACR, ART | 2016-2020 |
| **Phase 1 (2024-26)** | + ACR, ART | 2021-2023 |
| **Phase 2 (2027-35)** | To be determined | TBD |

**Regulatory Drift Monitoring:**
```
Monitor: BEE gazette, UNFCCC decisions, ICAO Assembly, standard body announcements
Trigger: New regulation → Re-screen affected projects
Action: Update applicability matrix; flag projects needing PDD amendment
```

### 8.2.3.3 Applicability Drift Monitoring — Lifetime Compliance

**Drift Sources:**
| Drift Type | Cause | Detection | Mitigation |
|------------|-------|-----------|------------|
| **Capacity Creep** | Capacity upgrades over time | Annual capacity audit | Contractual cap in PDD |
| **Technology Change** | Retrofit/upgrade changes tech class | Asset change management | Pre-approval for modifications |
| **Regulatory Change** | New law mandates project type | Regulatory monitoring | Legal alert service |
| **Methodology Update** | New version changes applicability | Methodology watch list | Auto-re-screen on version change |
| **Boundary Shift** | Leakage belt expansion, land use change | Annual GIS audit | GIS change detection |

**Drift Monitoring Dashboard:**
| Metric | Frequency | Threshold | Action |
|--------|-----------|-----------|--------|
| **Applicability Score** | Quarterly | < 100% = Alert | Auto-generate gap report |
| **Condition Compliance** | Per monitoring period | Any "N" = Finding | Root cause analysis |
| **Regulatory Alignment** | Monthly | New regulation = Re-screen | Compliance team alert |
| **Methodology Version** | On release | Version > validated = Review | Schedule re-validation |

### 8.2.3.3 Professional Judgement Points
- **Applicability is not static:** Monitor for drift throughout crediting period
- **Regulatory changes = applicability events:** Treat new laws as applicability triggers
- **Phased projects:** Each phase may need separate applicability assessment
- **Nested programs:** Project applicability must nest within jurisdictional reference level
- **Document "why":** For every condition, document why met/not met — verifiers demand it

### 8.2.3.3 Practical Exercise: Compliance Monitoring Design
*Scenario:* A 100 MW solar project registered under AMS-I.D v18. CCTS launches new methodology requiring 5% higher capacity factor. Article 6.4 rules finalized requiring new MRV parameters.
*Tasks:*
1. Map applicability drift vectors (CCTS, Article 6.4, methodology v19)
2. Design quarterly compliance check workflow
3. Define escalation matrix (when to engage legal, when to amend PDD)
4. Design dashboard for real-time applicability health
*Time:* 45 min
*Deliverable:* Compliance monitoring SOP + dashboard mockup
*Rubric:* Drift vector identification (30%), workflow design (40%), dashboard utility (30%)

**Knowledge Check:**
1. What happens if a project's technology no longer meets applicability after a methodology update? (Project stays on validated version; new issuance may require upgrade)
2. How does CCTS methodology change affect existing registered projects? (Existing projects stay on old methodology; new projects use new)
3. What is the "regulatory surplus" test in CCTS context? (Project not mandated by CCTS obligations)
4. How to handle phased project where Phase 2 exceeds methodology capacity limit? (Separate PDD for Phase 2 or methodology amendment)

**Sources:**
1. VCS Standard v4.4 — Section 3.2 (Applicability), 3.8 (Methodology Updates)
2. BEE CCTS Guidelines (2023) — Applicability & Transition
3. Decision 2/CMA.3 — Article 6 Rules (Applicability)
3. ICAO CORSIA Document — Eligibility Criteria
4. Verra Methodology Update Notifications
5. BEE CCTS Guidelines (2023) — Methodology List

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC (Regulatory landscape evolving) | Regulatory Review: Quarterly*