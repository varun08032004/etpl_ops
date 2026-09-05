# C16: Integrated Carbon Project Simulation
## Module 16.1: Project Brief & Data Room (3 lessons × 40min = 2h)

### Lesson 16.1.1: Project Brief — The Foundation of the Capstone
**Lesson Code:** C16.1.1
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** capstone

**Learning Objectives:**
1. Analyze a comprehensive project brief for a carbon credit project (Bloom: Understand)
2. Identify critical information gaps and risks in a project brief (Bloom: Analyze)
3. Structure a data room for efficient due diligence (Bloom: Create)

**Prerequisites:** All previous courses (C01-C15)

**Why This Matters:**
The project brief is the single source of truth that every stakeholder — developers, investors, validators, registries — references. A well-structured brief accelerates due diligence, reduces back-and-forth, and prevents costly misunderstandings. This lesson teaches you to create and evaluate project briefs that withstand scrutiny.

**Core Concept: The Project Brief = Single Source of Truth for the Entire Deal**

### 16.1.1.1 Anatomy of a Project Brief — Mandatory Sections

**Standard Project Brief Structure:**
```
PROJECT BRIEF — CONFIDENTIAL
============================================================
PROJECT ID: [ID] | VERSION: [vX.Y] | DATE: [DATE] | CLASSIFICATION: [CONFIDENTIAL]

1. EXECUTIVE SUMMARY (1 page)
   - Project name, type, location, capacity
   - Technology, methodology, registry, vintage
   - Key metrics: Capacity, Annual ERs, Vintage, Price range
   - Investment ask: Equity/Debt, Amount, Target close date

2. TECHNICAL SPECIFICATION (3-5 pages)
   2.1 Technology & Design
   2.2 Site & Resource Assessment
   2.3 Capacity & Generation Profile
   2.4 Equipment & OEM
   2.5 Degradation & Lifetime Assumptions

3. CARBON METHODOLOGY & BASELINE (2-3 pages)
   3.1 Methodology & Version
   3.2 Applicability Conditions Checklist
   3.2 Baseline Scenario & Justification
   3.4 Additionality Argument (Investment/Barrier/Common Practice)
   3.5 Leakage Assessment

4. MONITORING & VERIFICATION PLAN (2-3 pages)
   4.1 Parameters, Frequency, Methods, QA/QC
   4.2 Roles & Responsibilities
   4.3 Data Management & QA/QC

4. CARBON CREDIT PROFILE (1-2 pages)
   5.1 Annual ER Estimates (by vintage)
   5.2 Vintage Schedule & Crediting Period
   5.3 Labels: CCP, CORSIA, Article 6, SDG
   5.4 Buffer/Reversal Risk & Mitigation

5. FINANCIAL MODEL & CARBON REVENUE (3-4 pages)
   6.1 Capex & Phasing
   6.2 Revenue Stack (PPA, Carbon, REC, Ancillary)
   6.3 Opex, Debt Service, Tax
   6.4 Returns: Project IRR, Equity IRR, NPV, Payback
   6.5 Sensitivity: Carbon Price, Generation, Capex, Opex
   6.6 Breakeven Carbon Price (NPV=0, IRR=Hurdle, DSCR=Min)

5. REGULATORY & LEGAL (2-3 pages)
   7.1 Permits & Approvals Status
   7.2 Land & Rights Status
   7.3 PPA / Offtake Agreements
   7.4 ERPA / Offtake Term Sheet
   7.5 Host Country LoA / Article 6 Status

6. ESG & SAFEGUARDS (2 pages)
   8.1 Environmental & Social Impact Assessment
   8.2 FPIC & Stakeholder Consultation
   8.3 Grievance Mechanism
   8.4 SDG Contributions

6. DATA ROOM INDEX (1 page)
   10.1 Document Index with Links
   10.2 Version Control Log
   10.3 Access Control List
```

### 16.1.1.2 Data Room Architecture — Structure & Governance

**Data Room Folder Structure:**
```
📁 PROJECT_DATA_ROOM/
├── 00_INDEX_README.md                    ← START HERE
├── 01_EXECUTIVE_SUMMARY/
│   ├── Project_Brief_v1.2.pdf
│   └── Investment_Teaser_1pager.pdf
├── 02_TECHNICAL/
│   ├── 01_Technical_Specs/
│   ├── 02_Resource_Assessment/
│   ├── 03_Generation_Model/
│   └── 04_Equipment_Specs/
├── 03_CARBON/
│   ├── 01_PDD/
│   ├── 02_Methodology/
│   ├── 03_Baseline/
│   ├── 04_Additionality/
│   ├── 05_Monitoring_Plan/
│   └── 06_Verification_Reports/
├── 04_FINANCIAL/
│   ├── 01_Financial_Model.xlsx
│   ├── 02_Capex_Breakdown.xlsx
│   ├── 03_Revenue_Stack.xlsx
│   ├── 04_Sensitivity_Analysis.xlsx
│   └── 05_Breakeven_Analysis.xlsx
├── 05_REGULATORY_LEGAL/
│   ├── 01_Permits/
│   ├── 02_Land_Rights/
│   ├── 03_PPA_Oftake/
│   ├── 05_ERPA_Term_Sheet/
│   └── 06_Regulatory_Approvals/
├── 06_ESG_SAFEGUARDS/
│   ├── 01_ESIA/
│   ├── 02_FPIC/
│   ├── 03_Grievance/
│   └── 04_SDG_Mapping/
├── 07_VERIFICATION/
│   ├── 01_VVB_Reports/
│   ├── 02_Monitoring_Reports/
│   ├── 03_Calculation_Workbooks/
│   └── 04_VVB_Correspondence/
├── 08_FINANCIAL_LEGAL/
│   ├── 01_Capex_Funding/
│   ├── 02_Debt_Term_Sheets/
│   ├── 03_PPA_Oftake/
│   ├── 05_ERPA_Term_Sheet/
│   ├── 06_Insurance/
│   └── 07_Legal_Opinions/
└── 09_DATA_ROOM_ADMIN/
    ├── 01_Access_Log.xlsx
    ├── 02_Permission_Matrix.xlsx
    └── 03_Version_Control_Log.xlsx
```

**Naming Convention (Enforced):**
```
[Category]_[DocumentType]_[Version]_[Date]_[Status].[ext]
Example: CARBON_PDD_v1.2_2025-01-15_DRAFT.pdf
         FINANCIAL_Model_v3.1_2025-01-20_FINAL.xlsx
```

### 16.1.1.3 Data Room Governance — Access, Versioning, Audit

**Permission Matrix (RBAC):**
| Role | View | Download | Upload | Delete | Admin |
|------|------|----------|--------|--------|-------|
| **Deal Lead** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Technical Lead** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Financial Analyst** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Legal Counsel** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **VVB/Verifier** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Standard Body** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Potential Buyer** | ✅ (watermarked) | ❌ | ❌ | ❌ | ❌ |
| **Regulator** | ✅ (read-only) | ❌ | ❌ | ❌ | ❌ |

**Version Control & Audit Trail:**
- All documents versioned (Git-like: v1.0, v1.1, v2.0)
- Every change logged: who, what, when, why
- Immutable audit log (append-only, tamper-evident)
- Watermarking on downloads (user ID, timestamp, NDA ref)

### 16.1.1.4 Professional Judgement Points
- **Completeness > Perfection:** A 90% complete brief today > 100% complete next month
- **Single source of truth:** One brief, one data room, one version at a time
- **Anticipate DD questions:** Structure folders to answer DD questions before asked
- **Version discipline:** Every change logged; no silent edits
- **Access = Trust:** Grant minimum necessary access; audit trail on every view/download

### 16.1.1.4 Practical Exercise: Project Brief Critique
*Scenario:* Review a 28-page project brief for a 50 MW wind project in Gujarat (Verra, ACM0002). Identify 5 critical gaps that would cause validation delays.
*Tasks:*
1. Review provided brief (provided separately)
2. Identify 5 critical gaps with severity (Fatal/Critical/Material)
3. For each gap: specify exact missing information, why it matters, how to fix
4. Prioritize fixes by impact on validation timeline
*Time:* 35 min
*Deliverable:* Gap Analysis Table + Prioritized Action List
*Time:* 35 min
*Rubric:* Gap identification (40%), severity accuracy (30%), actionability (30%)

**Knowledge Check:**
1. What is the single most common cause of validation delays? (Incomplete additionality argument)
2. Why separate "Project Brief" from "Data Room"? (Brief = narrative; Data Room = evidence)
3. What is the one document a validator opens first? (PDD)
4. How do you handle a missing document that's "in progress"? (Note in index with ETA; flag in DD memo)

**Sources:**
1. Verra — Project Description Template
2. Gold Standard — PDD Template
3. CDM — Project Design Document Form
4. BEE CCTS — Project Brief Guidelines
5. ICVCM — Project Eligibility Criteria
6. ICROA — Code of Best Practice (Project Documentation)

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC | Regulatory Review: Quarterly*

---

### Lesson 16.1.2: Data Room Setup — Structure, Permissions & Workflow
**Lesson Code:** C16.1.2
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** capstone

**Learning Objectives:**
1. Build a data room folder structure that accelerates due diligence (Bloom: Create)
2. Configure permissions, versioning, and audit trails for multi-party access (Bloom: Apply)
3. Design workflows for document upload, review, Q&A, and version control (Bloom: Create)

**Prerequisites:** C16.1.1

**Why This Matters:**
A disorganized data room kills deals. A well-structured data room accelerates due diligence, reduces Q&A cycles, and signals professionalism to buyers and validators. This lesson teaches you to build a data room that works as hard as you do.

**Core Concept: Data Room = Product — Designed for the User (Buyer/Validator)**

### 16.1.2.1 Folder Taxonomy — The "Zero-Click" Principle

**Design Principle:** Any document findable in ≤ 3 clicks from root.

**Optimized Folder Taxonomy:**
```
📁 PROJECT_DATA_ROOM/
├── 00_INDEX_README.md                    ← START HERE
├── 01_EXECUTIVE_SUMMARY/
│   ├── Project_Brief_v1.2.pdf
│   └── Investment_Teaser_1pager.pdf
├── 02_TECHNICAL/
│   ├── 01_Technical_Specs/
│   ├── 02_Resource_Assessment/
│   ├── 03_Generation_Model/
│   └── 04_Equipment_Specs/
├── 03_CARBON/
│   ├── 01_PDD/
│   ├── 02_Methodology/
│   ├── 03_Baseline/
│   ├── 04_Additionality/
│   ├── 05_Monitoring_Plan/
│   └── 06_Verification_Reports/
├── 04_FINANCIAL/
│   ├── 01_Financial_Model.xlsx
│   ├── 02_Capex_Breakdown.xlsx
│   ├── 03_Revenue_Stack.xlsx
│   ├── 04_Sensitivity_Analysis.xlsx
│   └── 05_Breakeven_Analysis.xlsx
├── 05_REGULATORY_LEGAL/
│   ├── 01_Permits/
│   ├── 02_Land_Rights/
│   ├── 03_PPA_Oftake/
│   ├── 05_ERPA_Term_Sheet/
│   └── 06_Regulatory_Approvals/
├── 06_ESG_SAFEGUARDS/
│   ├── 01_ESIA/
│   ├── 02_FPIC/
│   ├── 03_Grievance/
│   └── 04_SDG_Mapping/
├── 07_VERIFICATION/
│   ├── 01_VVB_Reports/
│   ├── 02_Monitoring_Reports/
│   ├── 03_Calculation_Workbooks/
│   └── 04_VVB_Correspondence/
├── 08_FINANCIAL_LEGAL/
│   ├── 01_Capex_Funding/
│   ├── 02_Debt_Term_Sheets/
│   ├── 03_PPA_Oftake/
│   ├── 05_ERPA_Term_Sheet/
│   ├── 06_Insurance/
│   └── 07_Local_Opinions/
└── 09_DATA_ROOM_ADMIN/
    ├── 01_Access_Log.xlsx
    ├── 02_Permission_Matrix.xlsx
    ├── 03_Version_Control_Log.xlsx
```

**Naming Convention (Enforced):**
```
[Category]_[DocumentType]_[Version]_[Date]_[Status].[ext]
Example: CARBON_PDD_v1.2_2025-01-15_DRAFT.pdf
         FINANCIAL_Model_v3.1_2025-01-20_FINAL.xlsx
```

### 16.1.2.2 Permissions & Access Control — RBAC for Data Rooms

**Permission Matrix (RBAC):**
| Role | View | Download | Upload | Delete | Admin |
|------|------|----------|--------|--------|-------|
| **Deal Lead** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Technical Lead** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Financial Analyst** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Legal Counsel** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **VVB/Verifier** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Standard Body** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Potential Buyer** | ✅ (watermarked) | ❌ | ❌ | ❌ | ❌ |
| **Regulator** | ✅ (read-only) | ❌ | ❌ | ❌ | ❌ |

**Watermarking on Download:**
```
Watermark: "CONFIDENTIAL — [User Name] — [Timestamp] — [NDA Ref]"
Applied via: PDF stamping / Image overlay / DRM (for sensitive)
```

### 16.1.2.2 Workflow Automation — Upload, Review, Q&A, Versioning

**Document Lifecycle Workflow:**
```
UPLOAD → VIRUS SCAN → METADATA EXTRACTION → VERSIONING → PERMISSIONS → NOTIFICATION
     │
     ├── Virus Scan (ClamAV) → Quarantine if infected
     ├── Metadata Extraction (EXIF, OCR, properties)
     ├── Auto-Tagging (category, confidentiality, project)
     ├── Versioning (v1.0, v1.1, v2.0...)
     ├── Permission Application (RBAC)
     └── Notifications (Slack/Email/In-app) to relevant roles
```

**Q&A Workflow (Replaces Email Threads):**
```
QUESTION POSTED
    ↓
ASSIGNED TO: [Technical/Legal/Financial] Lead
    ↓
ANSWER DRAFTED → INTERNAL REVIEW → PUBLISHED
    ↓
DOCUMENT FEEDBACK → CATEGORIZE → INCORPORATE → RE-PUBLISH
    ↓
ARCHIVED IN: Q&A Thread (searchable, versioned)
```

**Version Control Rules:**
- Every upload = new version (v1.0, v1.1, v2.0)
- Major version = structural change; Minor = content update
- Previous versions immutable; accessible via version history
- "Current" pointer always points to latest approved version

### 16.1.2.3 Professional Judgement Points
- **Structure for the buyer:** Organize by DD workstream, not internal departments
- **Search > Browse:** Full-text search + tags > folder browsing
- **Watermark everything:** Every download watermarked with user + timestamp
- **Audit trail = Legal protection:** Every view/download logged immutably
- **Q&A > Email:** All questions in data room; no email attachments

### 16.1.2.3 Practical Exercise: Data Room Build
*Scenario:* Set up a data room for a 100 MW hybrid solar-wind project in Karnataka (VCS + CCTS dual registration). 50+ documents, 5 user roles, 3 external parties.
*Tasks:*
1. Design folder structure (max 3-click rule)
2. Define permission matrix for 5 roles
3. Design upload workflow (scan → tag → version → permission → notify)
3. Design Q&A workflow (ask → assign → answer → publish → notify)
*Time:* 40 min
*Deliverable:* Folder tree + Permission matrix + Workflow diagram
*Time:* 40 min
*Rubric:* Structure logic (40%), permission accuracy (30%), workflow completeness (30%)

**Knowledge Check:**
1. What is the "3-click rule" and why does it matter?
2. Why watermark downloads instead of blocking downloads?
3. How do you handle a document that applies to multiple folders?
4. What happens when a document is updated after a buyer has downloaded it?

**Sources:**
1. Intralinks / Datasite / Intralinks — Data Room Best Practices
2. ICROA — Due Diligence Data Room Standards
3. Verra/GS — Data Room Requirements for Validation
3. ISO 27001 — Access Control Annex A.9
4. ISO 27001 — Access Control Annex A.9
4. EtherTrack — Internal Data Room Standards

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC | Regulatory Review: Quarterly*