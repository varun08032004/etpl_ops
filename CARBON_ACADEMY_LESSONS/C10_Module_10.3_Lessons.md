# C10: Registries & Credit Issuance
## Module 10.3: Issuance & Retirement Mechanics (3 lessons x 40min = 2h)

### Lesson 10.3.1: Issuance Workflow: VVB → Registry → Account
**Lesson Code:** C10.3.1
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** professional

**Learning Objectives:**
1. Trace the end-to-end issuance workflow from verification report to credited account (Bloom: Understand)
2. Identify the critical control points, timelines, and failure modes at each stage (Bloom: Analyze)
3. Calculate issuance timelines and manage stakeholder expectations (Bloom: Apply)

**Prerequisites:** C09.2.3 (Verification Conclusion & Issuance), C10.1.1

**Why This Matters:**
Issuance is the moment verified emission reductions become tradable assets. Delays, errors, or rejections at this stage directly impact project cash flow and market credibility. Understanding the workflow lets you anticipate bottlenecks, prepare documentation correctly, and escalate effectively when standard body review takes longer than expected.

**Core Concept: Issuance as Controlled Asset Creation — Verification to Registry to Account**

### 10.3.1.1 Issuance Workflow — End-to-End

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│ MONITORING  │───→│ VERIFICATION │───→│ VERIFICATION│───→│ STANDARD BODY│───→│ REGISTRY    │
│ PERIOD END  │    │ BY VVB       │    │ REPORT      │    │ REVIEW       │    │ ISSUANCE    │
└─────────────┘    └──────────────┘    └─────────────┘    └──────────────┘    └─────────────┘
       │                  │                  │                  │                  │
       ▼                  ▼                  ▼                  ▼                  ▼
  Proponent          VVB Team           VVB +              Standard Body      Registry
  prepares MR        conducts           submits            reviews:           creates:
  + data             verification       report to          - Completeness     - Credit batches
                     site visit                      standard body      - Methodology    - Serial numbers
                     issues CARs/         (Verra/GS/         - Technical      - Vintage
                     CLs/FARs             CDM/BEE)           - Quality         - Metadata
                     closes findings      via portal         - Precedent      - Account credit
                     issues opinion                                                       │
                                                                                                   ▼
                                                          ┌─────────────────────────────────────┐
                                                          │ ACCOUNT CREDITED                     │
                                                          │ - Balance updated                    │
                                                          │ - Notifications sent                 │
                                                          │ - Public ledger updated              │
                                                          └─────────────────────────────────────┘
```

### 10.3.1.2 Stage 1: Verification Report Submission

**VVB Submission Package (Verra/GS/CDM):**
| Document | Required? | Format | Notes |
|----------|-----------|--------|-------|
| **Verification Report** | Yes | PDF (standard template) | Signed by team leader |
| **Monitoring Report** | Yes | PDF | Proponent's MR (verified version) |
| **Calculation Workbook** | Yes | Excel (unlocked) | Independent recalculation |
| **Site Visit Report** | Yes | PDF | Photos, interviews, GPS |
| **Finding Closure Evidence** | Yes | PDF + supporting docs | All CARs/CLs closed |
| **VVB Independence Declarations** | Yes | PDF | All team members |
| **Verification Opinion** | Yes | In report | Positive/Qualified/Negative |
| **Issuance Recommendation** | Yes | In report | Quantity (tCO2e), vintage |

**Submission Timelines:**
| Standard | Submission Deadline | Typical Review Start |
|----------|---------------------|---------------------|
| **Verra** | Within 6 months of period end | 5-10 business days after submission |
| **Gold Standard** | Within 12 months | 5-10 business days |
| **CDM** | Per DOE contract | 5-10 business days |
| **CCTS (ICMS)** | Per BEE notification | 5-10 business days |

### 10.3.1.3 Stage 2: Standard Body Review

**Review Stages (Verra Example):**

| Stage | Duration | Focus | Possible Outcomes |
|-------|----------|-------|-------------------|
| **1. Completeness Check** | 5-10 business days | All docs present, formats correct, signatures | Accept / Return for completion |
| **2. Technical Review** | 15-30 business days | Methodology compliance, calculation audit, finding classification | Accept / Clarification Request / Reject |
| **3. Quality Assurance** | 5-10 business days | Consistency, precedent, risk flags | Approve / Escalate |
| **4. Decision** | 5 business days | Final issuance approval | **Approve Issuance** / Request Revision / Reject |

**Total Typical Timeline:** 30-55 business days (6-11 weeks)

**Common Review Findings (Cause Delays):**
| Issue | Frequency | Resolution |
|-------|-----------|------------|
| **Calculation discrepancy** | High | VVB provides corrected workbook |
| **Missing finding closure evidence** | High | VVB submits missing docs |
| **Methodology interpretation** | Medium | Standard body issues ruling |
| **Vintage assignment error** | Medium | Correct vintage split |
| **Label/eligibility error** | Medium | Remove/add labels per criteria |
| **VVB competence concern** | Low | Surveillance audit triggered |

### 10.3.1.4 Stage 3: Registry Issuance Mechanics

**Registry Issuance Process (Verra):**
```
1. STANDARD BODY → REGISTRY: Issuance Instruction
   - Project ID, vintage, quantity, serial range start, labels
   
2. REGISTRY ENGINE:
   - Validates instruction against project registration
   - Generates serial numbers: PREFIX-PROJECT-VINTAGE-START-END
   - Creates credit batches in project account
   - Updates project account balance
   
3. CREDIT BATCH CREATION:
   - One batch per vintage per methodology
   - Metadata attached: vintage, methodology, labels, VVB, verification period
   
4. NOTIFICATION:
   - Account holder notified (email, API webhook)
   - Public registry updated (project page, credit listings)
   
5. PUBLIC DISCLOSURE:
   - Issuance appears in public reports (typically next business day)
```

**Serial Number Format Examples:**
| Registry | Format | Example |
|----------|--------|---------|
| **Verra (VCS)** | VCS-{ProjectID}-{Vintage}-{Start}-{End} | VCS-1234-2023-000001-100000 |
| **Gold Standard** | GS-{ProjectID}-{Vintage}-{Start}-{End} | GS-5678-2023-000001-050000 |
| **CDM** | CDM-{ProjectID}-{Vintage}-{Start}-{End} | CDM-9876-2023-000001-020000 |
| **ICMS (CCC)** | CCC-{ProjectID}-{Vintage}-{Start}-{End} | CCC-IND-2024-000001-100000 |

### 10.3.1.5 Issuance Timelines — Managing Expectations

**End-to-End Timeline (Best Case → Realistic → Worst Case):**

| Phase | Best Case | Realistic | Worst Case |
|-------|-----------|-----------|------------|
| **MR Preparation** | 2 weeks | 4-6 weeks | 8+ weeks |
| **VVB Verification** | 4 weeks | 8-12 weeks | 16+ weeks |
| **Finding Closure** | 1 week | 2-4 weeks | 8+ weeks |
| **VVB Report Finalization** | 1 week | 2 weeks | 4 weeks |
| **Standard Body Review** | 4 weeks | 6-8 weeks | 12+ weeks |
| **Registry Issuance** | 1 day | 3-5 days | 2 weeks |
| **TOTAL** | **~12 weeks** | **~22-34 weeks** | **~50+ weeks** |

**Critical Path Accelerators:**
- Pre-submission completeness check (VVB)
- Parallel calculation audit (proponent + VVB)
- Early standard body engagement (pre-submission meeting)
- Automated calculation workbooks (reduce audit time)
- Dedicated VVB team (no resource conflicts)

### 10.3.1.6 Issuance Failures & Remediation

| Failure Point | Symptom | Root Cause | Remediation |
|---------------|---------|------------|-------------|
| **VVB Negative Opinion** | No issuance recommendation | Fundamental non-conformity | Major project redesign; re-verify |
| **Standard Body Rejection** | Review rejects verification | Methodology non-compliance, calculation errors | Correct + resubmit (new review cycle) |
| **Registry Rejection** | Issuance instruction fails | Project suspended, account frozen, data mismatch | Resolve registry issue; re-instruct |
| **Partial Issuance** | Quantity < recommended | Conservative adjustment, vintage split | Accept partial; plan for remainder |
| **Label Error** | Wrong labels on credits | Eligibility criteria not met | Registry correction (if caught early) |

---

### Practical Exercise: Issuance Timeline Planning

**Scenario:** Your 100 MW solar project (Verra VCS-1234) completed Year 2 monitoring on Dec 31, 2024. Target: Credits in account by June 30, 2025 for Q3 sales.

**Current Status (Jan 15, 2025):**
- Monitoring data: Ready
- MR Draft: 80% complete
- VVB: Contracted (SGS), kickoff scheduled Jan 20
- Expected ERs: ~95,000 tCO2e (2024 vintage)

**Task:** Build a detailed issuance timeline with:
1. Weekly milestones from Jan 15 to June 30
2. Critical path activities and dependencies
3. Buffer weeks for each phase
4. Go/No-Go decision points
5. Escalation triggers (if milestone missed by >1 week)

**Deliverable:** Gantt-style Timeline + Risk Register
**Time:** 35 min
**Rubric:** Timeline realism (30%), dependency mapping (30%), buffer adequacy (20%), escalation clarity (20%)

**Knowledge Check:**
1. What document does the VVB submit to the standard body to trigger issuance?
2. How long does Verra's technical review typically take?
3. What happens if the standard body finds a calculation error during review?
4. Can credits be issued before the standard body approves?

**Sources:**
1. Verra VCS Standard v4.4 — Issuance Process
2. Gold Standard — Verification & Issuance
3. CDM — Verification & Issuance Procedure
4. BEE CCTS — CCC Issuance Process (2023)
5. Verra Program Guide — Standard Body Review

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC | Regulatory Review: Quarterly*

---

### Lesson 10.3.2: Retirement, Cancellation & Labeling
**Lesson Code:** C10.3.2
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** professional

**Learning Objectives:**
1. Execute a compliant retirement transaction with correct claim metadata (Bloom: Apply)
2. Distinguish retirement from cancellation and apply each correctly (Bloom: Understand)
3. Design retirement labeling strategies for voluntary, compliance, and multi-jurisdictional claims (Bloom: Create)

**Prerequisites:** C10.2.2

**Why This Matters:**
Retirement is the "moment of truth" for carbon claims — it's when a credit fulfills its purpose and the buyer makes their public assertion. Wrong labeling (e.g., claiming "carbon neutral" with non-CORSIA credits for aviation) invites greenwashing accusations, regulatory penalties, and reputational damage. Cancellation is the quality control tool for removing defective credits. Both require precision.

**Core Concept: Retirement as Claim Finalization — Irreversible, Auditable, Defensible**

### 10.3.2.1 Retirement vs Cancellation — The Critical Distinction

| Aspect | Retirement | Cancellation |
|--------|------------|--------------|
| **Purpose** | Claim emission reduction (voluntary or compliance) | Remove defective/unusable credits |
| **Claim Made** | Yes — public assertion | No — quality control |
| **Beneficiary** | Required (entity making claim) | Not applicable |
| **Jurisdiction/Purpose** | Required (label) | Optional (reason) |
| **Reversibility** | **Never** | **Never** |
| **Credit State** | RETIRED (terminal) | CANCELLED (terminal) |
| **Public Record** | Beneficiary, purpose, date, quantity | Reason, date, quantity |
| **Typical Volume** | High (market demand) | Low (quality issues) |
| **Cost** | Retirement fee | Cancellation fee (often waived) |

### 10.3.2.2 Retirement Metadata — Claim Defensibility

**Required Retirement Fields (All Registries):**
| Field | Example | Defensibility Role |
|-------|---------|-------------------|
| **Beneficiary Name** | "Acme Corporation Ltd" | Legal entity making claim |
| **Beneficiary Type** | Corporate / Government / Individual / NGO | Claim category |
| **Claim Purpose** | "FY2024 Carbon Neutrality" / "CORSIA 2024 Compliance" / "BRSR FY2024" | Specific assertion |
| **Claim Jurisdiction** | "Global" / "India" / "EU" / "ICAO" | Regulatory scope |
| **Retirement Date** | 2025-03-15 | Timing of claim |
| **Quantity** | 50,000 tCO2e | Magnitude of claim |
| **Credit Serials** | VCS-1234-2023-000001-050000 | Traceability to source |
| **Supporting Doc Ref** | "Sustainability Report 2024 p.45" | Evidence linkage |

**Voluntary Claim Labels (Common):**
| Label | Meaning | Credibility Requirements |
|-------|---------|--------------------------|
| **Carbon Neutral** | Net-zero for defined boundary | GHG inventory + reduction plan + retirement = residual |
| **Net Zero** | Science-aligned (SBTi) | SBTi validation + long-term target + retirement |
| **Climate Positive** | Beyond net zero | Same as net zero + additional retirement |
| **Compensation** | Offset for specific activity | Activity boundary defined + retirement |
| **Contribution** | No neutrality claim | Transparent: "We retired X credits" |

**Compliance Claim Labels (Mandatory):**
| Regulation | Required Label | Registry Support |
|------------|----------------|------------------|
| **CORSIA** | CORSIA Compliance | Verra/GS/ICAO auto-label |
| **CCTS (India)** | CCTS_Compliance / BRSR | ICMS mandatory fields |
| **EU ETS** | EU_ETS_Surrender | EU Registry (EUAs, not VCUs) |
| **Article 6.2** | ITMO_Transfer | National registry + CA metadata |

### 10.3.2.3 Retirement Strategies by Use Case

**Strategy 1: Corporate Voluntary (Carbon Neutrality)**
```
1. Measure: GHG inventory (Scopes 1+2+3) per GHG Protocol
2. Reduce: Implement reduction plan (SBTi-aligned preferred)
3. Calculate Residual: Inventory - Reductions = Residual tCO2e
4. Source Credits: Match vintage, quality, geography to claim
5. Retire: Single transaction with claim "FY2024 Carbon Neutral - Scopes 1+2+3"
6. Disclose: Public retirement certificate + inventory + reduction plan
```
**Key Risk:** Vintage mismatch (retiring 2020 credits for 2024 claim)

**Strategy 2: CORSIA Airline Compliance**
```
1. Determine: Offset requirement per CORSIA (baseline vs actual)
2. Source: CORSIA-eligible credits (vintage 2021+, eligible methodology)
3. Verify: ICAO TAB eligibility list + registry CORSIA label
4. Retire: In CORSIA registry (or Verra/GS with CORSIA label + transfer)
5. Claim: "CORSIA 2024 Compliance - {Airline} - {Route/Total}"
6. Report: To ICAO via state authority
```
**Key Risk:** Using non-eligible vintage/methodology

**Strategy 3: CCTS Compliance (India)**
```
1. Determine: PAT target vs actual → surrender obligation (tCO2e)
2. Source: CCCs from ICMS (or bridged VCUs with CA)
3. Verify: Vintage within compliance period, methodology approved
4. Retire: ICMS surrender transaction with purpose "CCTS_Compliance"
5. Claim: Auto-recorded in ICMS for BEE compliance
6. BRSR: Voluntary retirement with "BRSR" label for SEBI reporting
```
**Key Risk:** Missing surrender deadline (March 31)

**Strategy 4: Multi-Jurisdictional Claim**
```
Scenario: Multinational corp claims "Global Carbon Neutral"
Approach:
- Single retirement transaction? NO (different jurisdictions)
- Separate retirements per jurisdiction with local labels
- Consolidated disclosure: "Global claim = Sum of jurisdictional retirements"
- Example:
  * Retirement 1: 50,000 tCO2e → "EU Carbon Neutral 2024" (EU label)
  * Retirement 2: 30,000 tCO2e → "India BRSR 2024" (BRSR label)  
  * Retirement 3: 20,000 tCO2e → "US Voluntary 2024" (Voluntary label)
  * Total: 100,000 tCO2e → "Global Carbon Neutral 2024"
```

### 10.3.2.4 Cancellation — Quality Control Tool

**When to Cancel (Not Retire):**
| Scenario | Reason | Example |
|----------|--------|---------|
| **VVB Error** | Verification flawed; credits invalid | Wrong EF used; baseline error |
| **Methodology Ineligibility** | Project found ineligible post-issuance | Applicability condition failed |
| **Double Issuance** | Same ERs issued twice | Registry error; bridge double-mint |
| **Fraud/Manipulation** | Data fabrication discovered | Meter tampering; false monitoring |
| **Regulatory Reversal** | Host country revokes authorization | Article 6.2 LoA withdrawn |
| **Quality Downgrade** | ICVCM CCP status lost | Standard fails integrity assessment |

**Cancellation Process:**
```
1. IDENTIFY: Issue detected (VVB, registry, standard body, buyer)
2. INVESTIGATE: Registry freezes credits; investigation launched
3. DECIDE: Standard body / registry determines cancellation warranted
4. EXECUTE: Registry cancels specific serial ranges
5. NOTIFY: All affected account holders notified
6. COMPENSATE: If buyer held credits → refund/replace (contractual)
7. RECORD: Public cancellation record with reason
```

**Cancellation Metadata:**
| Field | Example |
|-------|---------|
| **Reason Code** | VVB_ERROR / INELIGIBLE / DOUBLE_ISSUANCE / FRAUD / REGULATORY |
| **Reason Detail** | "Verification report VER-2024-001 found non-conservative EF" |
| **Authority** | "Verra Technical Review Committee Decision TRC-2024-045" |
| **Affected Serials** | VCS-1234-2023-000001-100000 |
| **Date** | 2024-06-15 |

### 10.3.2.5 Retirement Certificate — The Audit Artifact

**Retirement Certificate Contents (Verra/GS/ICMS):**
```
┌─────────────────────────────────────────────────────────────┐
│ RETIREMENT CERTIFICATE                                      │
├─────────────────────────────────────────────────────────────┤
│ Certificate ID: RET-2025-001234                             │
│ Date: 2025-03-15 14:32 UTC                                  │
│ Transaction ID: TXN-789456                                  │
├─────────────────────────────────────────────────────────────┤
│ BENEFICIARY: Acme Corporation Ltd (IN-PAN-ABCDE1234F)      │
│ CLAIM PURPOSE: FY2024 Carbon Neutrality (Scopes 1+2+3)     │
│ JURISDICTION: Global                                        │
├─────────────────────────────────────────────────────────────┤
│ CREDITS RETIRED:                                            │
│ ┌──────────────┬────────┬──────────┬──────────────────────┐ │
│ │ Serial Range │ Vintage│ Quantity │ Project              │ │
│ ├──────────────┼────────┼──────────┼──────────────────────┤ │
│ │ VCS-1234-    │ 2023   │ 30,000   │ 50 MW Solar Rajasthan│ │
│ │ 2023-000001  │        │          │ (VCS AMS-I.D v18)    │ │
│ │ -030000      │        │          │                      │ │
│ ├──────────────┼────────┼──────────┼──────────────────────┤ │
│ │ VCS-5678-    │ 2023   │ 20,000   │ 30 MW Wind Tamil Nadu│ │
│ │ 2023-050001  │        │          │ (GS ACM0002 v19)     │ │
│ │ -070000      │        │          │                      │ │
│ └──────────────┴────────┴──────────┴──────────────────────┘ │
│ TOTAL: 50,000 tCO2e                                         │
├─────────────────────────────────────────────────────────────┤
│ QUALITY INDICATORS:                                         │
• ICVCM CCP-Eligible: Yes                                   │
• CORSIA-Eligible: No (vintage 2023)                        │
• Additionality: Verified                                   │
• VVB: SGS / DNV                                            │
├─────────────────────────────────────────────────────────────┤
│ VERIFICATION:                                               │
│ This retirement is recorded in the Verra Registry           │
│ and may be verified at: registry.verra.org/retirement/      │
│ RET-2025-001234                                             │
└─────────────────────────────────────────────────────────────┘
```

### 10.3.2.6 Common Retirement Errors & Prevention

| Error | Consequence | Prevention |
|-------|-------------|------------|
| **Wrong Vintage** | Claim challenged (vintage mismatch) | Validate vintage vs claim period before submit |
| **Wrong Label** | Non-compliance (e.g., CORSIA label missing) | Check eligibility list; use registry validation API |
| **Insufficient Quantity** | Claim underdelivered | Calculate residual precisely; buffer 5-10% |
| **Missing Beneficiary** | Claim unattributable | Mandate field in workflow; UI validation |
| **Double Retirement** | Credits retired twice (system error) | Idempotency keys; pre-check balance |
| **Premature Retirement** | Credits retired before claim period | Workflow gate: claim period end date check |

---

### Practical Exercise: Retirement Strategy Design

**Scenario:** "GlobalTech Inc" (multinational, HQ US, ops in EU, India, Singapore) commits to "2024 Carbon Neutral (Scopes 1+2+3)". 2024 residual emissions: 120,000 tCO2e.
- EU ops: 50,000 tCO2e (subject to CSRD reporting)
- India ops: 40,000 tCO2e (subject to BRSR)
- Singapore/Other: 30,000 tCO2e (voluntary only)

**Available Credits:**
| Batch | Registry | Vintage | Qty | Labels |
|-------|----------|---------|-----|--------|
| A | Verra | 2023 | 50,000 | CORSIA-eligible, ICVCM CCP |
| B | GS | 2023 | 40,000 | SDG 7/13, ICVCM CCP |
| C | ICMS | 2024 | 30,000 | CCC, CCTS_Compliance eligible |
| D | Verra | 2022 | 20,000 | ICVCM CCP (older vintage) |

**Task:** Design retirement plan:
1. Allocate batches to jurisdictions (EU, India, Singapore/Other)
2. Specify retirement labels per jurisdiction
3. Address vintage alignment (2024 claim vs 2022/2023 credits)
4. Calculate total quantity and any gaps
5. Identify regulatory risks for each jurisdiction

**Deliverable:** Retirement Allocation Table + Risk Assessment
**Time:** 35 min
**Rubric:** Allocation logic (30%), label accuracy (30%), vintage alignment (20%), risk identification (20%)

**Knowledge Check:**
1. What is the difference between "Carbon Neutral" and "Net Zero" claims?
2. Why can't you use a single retirement transaction for multi-jurisdictional claims?
3. When would you cancel credits instead of retiring them?
4. What makes a retirement certificate audit-ready?

**Sources:**
1. Verra — Retirement Process & Certificate
2. Gold Standard — Retirement Guidelines
3. ICAO CORSIA — Retirement & Reporting
4. BEE CCTS — Surrender & BRSR Labeling (2023)
5. SBTi — Corporate Net Zero Standard
6. ICVCM — Claims Code of Practice
7. GHG Protocol — Corporate Standard (Claim Guidance)

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC | Regulatory Review: Quarterly*

---

### Lesson 10.3.3: Registry Reconciliation & Dispute Resolution
**Lesson Code:** C10.3.3
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** professional

**Learning Objectives:**
1. Design and execute registry reconciliation procedures for multi-registry portfolios (Bloom: Create)
2. Diagnose and resolve common discrepancies: timing, failed transactions, double counting (Bloom: Analyze)
3. Navigate registry dispute resolution processes and standard body escalation (Bloom: Apply)
2. Diagnose and resolve common discrepancies: timing, failed transactions, double counting (Bloom: Analyze)
3. Navigate registry dispute resolution processes and standard body escalation (Bloom: Apply)

**Prerequisites:** C10.3.2, C10.2.3

**Why This Matters:**
Reconciliation is the daily discipline that catches errors before they become losses. A missing credit, a failed settlement, or a double-counted batch can mean financial loss, compliance failure, or reputational damage. Dispute resolution is the last line of defense when automated systems fail. Mastering both protects your portfolio integrity and your professional credibility.

**Core Concept: Reconciliation as Continuous Assurance — Not Periodic Cleanup**

### 10.3.3.1 Reconciliation Framework — Daily Discipline

**Reconciliation Scope:**
| Level | Frequency | Scope | Owner |
|-------|-----------|-------|-------|
| **Transaction-Level** | Real-time (webhook) | Each transaction settlement | Automated |
| **Daily Balance** | Daily (EOD) | All accounts, all registries | Operations |
| **Monthly Full** | Monthly | Complete ledger vs all registries | Finance/Compliance |
| **Quarterly Audit** | Quarterly | Third-party verification | Internal Audit |
| **Annual Financial** | Year-end | Financial statement alignment | External Audit |

**Reconciliation Data Model:**
```
RECONCILIATION RECORD:
- Reconciliation ID: REC-2025-01-15-001
- Date: 2025-01-15
- Account: TA-001 (Trading)
- Registry: Verra
- Local Balance (Batch-Level): {BatchID: Quantity}
- Registry Balance (Batch-Level): {BatchID: Quantity}
- Discrepancies: [List]
- Status: CLEAN / DISCREPANCIES / INVESTIGATING
- Resolver: [Name]
- Resolution Date: [Date]
- Evidence: [Transaction IDs, Screenshots, API Logs]
```

### 10.3.3.2 Discrepancy Types & Detection

| Discrepancy Type | Detection Method | Typical Cause | Auto-Resolvable? |
|------------------|------------------|---------------|------------------|
| **Timing Difference** | Daily balance ≠ Registry (pending txns) | Settlement cycle (T+0 vs T+1) | Yes (wait) |
| **Failed Transaction** | Local: debited; Registry: no change | Auth timeout, insufficient balance, freeze | Yes (retry) |
| **Duplicate Transaction** | Local: 1; Registry: 2 (or vice versa) | Idempotency failure, double-submit | Yes (dedupe) |
| **Missing Transaction** | Local: 0; Registry: 1 | Webhook missed, API error, manual entry | Manual |
| **Quantity Mismatch** | Local: 10,000; Registry: 9,950 | Partial fill, rounding, split batch | Manual |
| **Batch Identity Mismatch** | Serial ranges don't match | Bridge split, registry migration | Manual |
| **Frozen Credits** | Local: active; Registry: frozen | Dispute, investigation, sanction | Manual |
| **Cross-Registry Double Count** | Same serial in Verra + ICMS | Bridge incomplete, double mint | Manual |

### 10.3.3.3 Reconciliation Algorithm (Daily)

```python
async def daily_reconciliation(account_id, registry):
    # 1. FETCH REGISTRY BALANCE (batch-level)
    registry_balances = await registry_api.get_balances(account_id)
    # Returns: [{serial_range, vintage, methodology, quantity, state}, ...]
    
    # 2. FETCH LOCAL LEDGER BALANCE (batch-level)
    local_balances = await local_ledger.get_balances(account_id)
    
    # 3. NORMALIZE (same key: serial_range + vintage + methodology)
    reg_map = {(b['serial_range'], b['vintage'], b['methodology']): b for b in registry_balances}
    loc_map = {(b['serial_range'], b['vintage'], b['methodology']): b for b in local_balances}
    
    # 4. COMPARE
    all_keys = set(reg_map.keys()) | set(loc_map.keys())
    discrepancies = []
    
    for key in all_keys:
        reg = reg_map.get(key)
        loc = loc_map.get(key)
        
        if not reg:
            discrepancies.append({
                'type': 'MISSING_IN_REGISTRY',
                'key': key,
                'local_qty': loc['quantity'],
                'registry_qty': 0
            })
        elif not loc:
            discrepancies.append({
                'type': 'MISSING_IN_LOCAL',
                'key': key,
                'local_qty': 0,
                'registry_qty': reg['quantity']
            })
        elif reg['quantity'] != loc['quantity']:
            discrepancies.append({
                'type': 'QUANTITY_MISMATCH',
                'key': key,
                'local_qty': loc['quantity'],
                'registry_qty': reg['quantity'],
                'diff': loc['quantity'] - reg['quantity']
            })
        elif reg['state'] != loc['state']:
            discrepancies.append({
                'type': 'STATE_MISMATCH',
                'key': key,
                'local_state': loc['state'],
                'registry_state': reg['state']
            })
    
    # 5. CLASSIFY & AUTO-RESOLVE
    for d in discrepancies:
        if d['type'] in ['MISSING_IN_REGISTRY', 'MISSING_IN_LOCAL']:
            # Check pending transactions
            pending = await get_pending_transactions(account_id, d['key'])
            if pending:
                d['classification'] = 'TIMING'
                d['auto_resolve'] = True
            else:
                d['classification'] = 'UNEXPLAINED'
                d['auto_resolve'] = False
        elif d['type'] == 'QUANTITY_MISMATCH':
            # Check partial fills, splits
            txns = await get_transactions_for_batch(account_id, d['key'])
            if explains_difference(txns, d['diff']):
                d['classification'] = 'EXPLAINED'
                d['auto_resolve'] = True
            else:
                d['classification'] = 'UNEXPLAINED'
                d['auto_resolve'] = False
    
    # 6. RECORD & ALERT
    await save_reconciliation_record(account_id, registry, discrepancies)
    unresolved = [d for d in discrepancies if not d['auto_resolve']]
    if unresolved:
        await alert_ops(unresolved)
    
    return discrepancies
```

### 10.3.3.4 Dispute Resolution — Registry Level

**Dispute Categories:**
| Category | Example | Registry Process | Timeline |
|----------|---------|------------------|----------|
| **Transaction Error** | Wrong destination, wrong quantity | Registry support ticket → investigation | 5-10 business days |
| **Balance Discrepancy** | Credits missing/extra | Formal dispute form → audit trail review | 10-20 business days |
| **Ownership Dispute** | Two parties claim same credits | Freeze → evidence review → decision | 20-40 business days |
| **Label/Metadata Error** | Wrong vintage, missing CORSIA label | Correction request → verification → update | 5-15 business days |
| **Freeze/Restriction** | Credits frozen without notice | Challenge freeze → registry review | 5-10 business days |

**Dispute Evidence Package:**
```
1. DISPUTE FORM (Registry template)
   - Account IDs, transaction IDs, serial ranges
   - Claimed vs actual state
   
2. SUPPORTING EVIDENCE
   - Transaction confirmations (registry + local)
   - API logs (request/response with timestamps)
   - Webhook payloads (received/not received)
   - Email correspondence
   - Contractual agreements (for ownership)
   
3. IMPACT STATEMENT
   - Financial impact (credit value)
   - Operational impact (trades blocked, compliance risk)
   - Reputational impact
   
4. REQUESTED REMEDY
   - Credit restoration / transfer / cancellation / label correction
```

### 10.3.3.5 Standard Body Escalation

**When to Escalate Beyond Registry:**
| Trigger | Standard Body | Process |
|---------|---------------|---------|
| **Registry error affects methodology compliance** | Verra/GS/CDM | Formal complaint → Technical review → Ruling |
| **VVB verification error caused issuance error** | Standard body | VVB investigation → Possible re-verification |
| **Systemic registry issue** | Standard body + Regulator | Surveillance audit → Corrective action |
| **Fraud/suspected manipulation** | Standard body + Law enforcement | Investigation → Sanctions |
| **Article 6 / CORSIA eligibility dispute** | UNFCCC / ICAO | State party engagement |

**Escalation Package (Add to Dispute Package):**
```
5. REGISTRY RESPONSE HISTORY
   - All correspondence, tickets, decisions
   - Timeline of registry actions
   
6. TECHNICAL ANALYSIS
   - Methodology clause references
   - Calculation audit trail
   - Independent expert opinion (if obtained)
   
7. REQUESTED STANDARD BODY ACTION
   - Specific ruling sought
   - Remedy requested (re-issuance, cancellation, label correction)
```

### 10.3.3.6 Cross-Registry Reconciliation (Bridge Portfolios)

**Bridge Reconciliation Challenge:**
```
VERRA (Source)          ETHERTRACK (Bridge)          ICMS (Destination)
┌─────────────────┐     ┌─────────────────┐          ┌─────────────────┐
│ Frozen: 50,000  │     │ Minted: 50,000  │          │ Issued: 50,000  │
│ Serial: VCS-... │────▶│ Token: ET-...   │─────────▶│ Serial: CCC-... │
└─────────────────┘     └─────────────────┘          └─────────────────┘
        │                       │                           │
        ▼                       ▼                           ▼
   Balance: -50,000        Balance: +50,000             Balance: +50,000
   (Project Acct)          (User Wallet)                (ICMS Acct)
```

**Reconciliation Checks (Daily):**
| Check | Verra | EtherTrack | ICMS | Tolerance |
|-------|-------|------------|------|-----------|
| **Frozen = Minted** | Frozen qty | Token supply (bridged) | — | Zero |
| **Minted = Issued** | — | Token supply (bridged) | Issued qty | Zero |
| **Metadata Match** | Vintage, methodology, labels | On-chain metadata | CCC metadata | Exact |
| **Ownership Chain** | Project → Bridge → User | Wallet → Bridge → ICMS | User → ICMS | Continuous |

**Bridge Discrepancy Types:**
| Type | Detection | Resolution |
|------|-----------|------------|
| **Freeze Confirmed, No Mint** | Verra frozen > EtherTrack minted | Retry mint; check oracle; alert bridge ops |
| **Mint Confirmed, No Issue** | EtherTrack minted > ICMS issued | Check bridge-out status; retry; alert |
| **Metadata Drift** | Verra vintage ≠ Token vintage ≠ CCC vintage | Root cause: bridge mapping error; correct all three |
| **Double Mint** | Verra frozen once, EtherTrack minted twice | Burn excess; investigate idempotency failure |
| **Reorg Loss** | Blockchain reorg loses mint txn | Re-mint from freeze; verify finality |

### 10.3.3.7 Reconciliation Reporting & Audit Trail

**Daily Reconciliation Report (Auto-Generated):**
```
RECONCILIATION REPORT: 2025-01-15
Account: TA-001 (Trading Desk)
Registries: Verra, GS, ICMS, EtherTrack

SUMMARY:
- Total Batches Reconciled: 147
- Clean: 142 (96.6%)
- Auto-Resolved (Timing): 3
- Under Investigation: 2
- Escalated: 0

DISCREPANCIES:
1. Verra | VCS-1234-2023-000001-10000 | TIMING | Auto-resolved
   Local: 10,000 | Registry: 9,500 | Diff: +500
   Cause: Transfer TXN-789456 pending settlement (initiated 14:30)
   Resolution: Wait for settlement (T+0)
   
2. EtherTrack | ET-CCC-2024-00001-05000 | UNEXPLAINED | Under Investigation
   Local: 5,000 | Bridge: 4,950 | Diff: +50
   Cause: Unknown - no pending transactions
   Action: Bridge ops alerted; transaction log review initiated

NEXT REVIEW: 2025-01-16 02:00 UTC
```

**Audit Requirements (Retain 7+ Years):**
- Daily reconciliation reports (signed hash)
- Discrepancy investigation records
- Resolution evidence (transaction logs, correspondence)
- Escalation packages
- Standard body rulings
- Financial impact assessments

---

### Practical Exercise: Reconciliation Investigation

**Scenario:** Daily reconciliation for Trading Account TA-001 (Verra) shows:

**Discrepancy 1:**
- Local: Batch VCS-1234-2023-000001-10000 = 10,000
- Verra: Same batch = 9,500
- Diff: +500 local
- Recent TXNs: Transfer 500 to Client A (TXN-789456) initiated 2025-01-14 16:45, status PENDING_AUTH

**Discrepancy 2:**
- Local: Batch VCS-5678-2023-000001-05000 = 5,000
- Verra: Same batch = 5,000 ✓
- But: Local shows 2 batches (split), Verra shows 1 batch
- Serials: Local: ...00001-02500 + ...02501-05000; Verra: ...00001-05000

**Discrepancy 3:**
- Local: Batch GS-9999-2023-000001-03000 = 3,000
- GS: Batch NOT FOUND
- Recent TXNs: None for this batch in last 30 days
- History: Received via transfer from Counterparty B (TXN-445566) 2024-12-20, settled

**Task:** For each discrepancy:
1. Classify (Timing / Failed / Duplicate / Missing / Split / Unexplained)
2. Determine if auto-resolvable
3. Design investigation steps
4. Estimate resolution timeline
5. Identify if escalation needed

**Deliverable:** Investigation Plan Table
**Time:** 35 min
**Rubric:** Classification accuracy (30%), investigation design (40%), resolution practicality (30%)

**Knowledge Check:**
1. What is the difference between a "timing difference" and a "failed transaction" in reconciliation?
2. Why is batch-level reconciliation superior to account-level?
3. When should you escalate a discrepancy to the standard body vs the registry?
4. What evidence is needed to prove a bridge discrepancy vs a registry discrepancy?

**Sources:**
1. Verra Registry — Reconciliation Guidelines
2. Gold Standard — Dispute Resolution Process
3. BEE CCTS — ICMS Dispute Mechanism (2023)
4. ISO 20022 — Securities Reconciliation
5. EtherTrack Bridge Protocol — Reconciliation Spec
6. ISDA — Operational Reconciliation Best Practices

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC | Regulatory Review: Quarterly*