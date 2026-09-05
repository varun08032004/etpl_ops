# C10: Registries & Credit Issuance
## Module 10.1: Registry Architecture (3 lessons x 40min = 2h)

### Lesson 10.1.1: Registry Types, Roles & Governance
**Lesson Code:** C10.1.1
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** professional

**Learning Objectives:**
1. Distinguish between major registry types (Verra, Gold Standard, CDM, CORSIA, national) and their governance models (Bloom: Understand)
2. Explain the registry's role in credit integrity: uniqueness, transparency, chain of custody (Bloom: Understand)
3. Evaluate registry selection criteria for a given project type and market pathway (Bloom: Evaluate)

**Prerequisites:** C03.3.1 (Trading → Retirement → Claims), C08.3.1 (MRV Frameworks)

**Why This Matters:**
The registry is the "bank" of the carbon market — it issues, holds, transfers, and retires credits. Choosing the wrong registry can limit market access, increase costs, or create compliance risk. Understanding registry governance helps you navigate rules changes, fee structures, and the evolving landscape of Article 6 corresponding adjustments.

**Core Concept: Registry as Trust Infrastructure — Not Just a Database**

### 10.1.1.1 What Is a Carbon Registry?

**Registry Core Functions:**
| Function | Description | Why It Matters |
|----------|-------------|----------------|
| **Issuance** | Create unique serialised credits from verified ERs | Establishes credit existence |
| **Holding** | Maintain accounts, balances, credit metadata | Ownership record |
| **Transfer** | Move credits between accounts (trade, allocation) | Market liquidity |
| **Retirement** | Permanently remove credits for claims | Claim integrity |
| **Cancellation** | Remove credits without claim (quality control) | Market hygiene |
| **Transparency** | Public ledger of projects, credits, transactions | Market confidence |
| **Governance** | Rules, fees, standards, dispute resolution | Operational certainty |

**Registry ≠ Exchange:**
| Registry | Exchange |
|----------|----------|
| System of record (issuance, holding, retirement) | Trading venue (price discovery, matching) |
| Non-profit / standard-body operated | For-profit / licensed |
| Mandatory for credit existence | Optional for trading |
| Immutable ledger | Order book + matching engine |

### 10.1.1.2 Major Registry Landscape (2024)

| Registry | Standard | Governance | Key Scope | 2023 Issuance (MtCO2e) |
|----------|----------|------------|-----------|------------------------|
| **Verra (VCS)** | VCS, CCB, SD VISta | Non-profit (Verra) | Voluntary, global, all sectors | ~200 |
| **Gold Standard** | GS4GG, GS VER | Non-profit (GS Foundation) | Voluntary, high-integrity, SDG focus | ~50 |
| **CDM Registry** | CDM | UNFCCC | Kyoto/Article 6.4, compliance | ~15 (legacy) |
| **Article 6.4 Registry** | A6.4 | UNFCCC Supervisory Body | Article 6.4 mechanism | New (2024+) |
| **CORSIA Registries** | CORSIA | ICAO | Aviation compliance | ~30 |
| **National Registries** | Various | Government | Compliance (EU ETS, NZ ETS, Korea, China, **India CCTS**) | Varies |
| **Blockchain Registries** | Various | DAO/Foundation | Voluntary, tokenised (Toucan, Celo, EtherTrack) | Emerging |

**Registry Selection Criteria:**
| Criterion | Questions to Ask |
|-----------|------------------|
| **Project Eligibility** | Does registry accept my methodology/project type? |
| **Market Access** | Which buyers/prefer this registry? OTC vs exchange? |
| **Integrity Reputation** | ICVCM CCP-eligible? Calyx/Sylvera ratings? |
| **Cost Structure** | Issuance fees, account fees, transaction fees, annual fees |
| **Governance Stability** | Rule change frequency, stakeholder process, transparency |
| **Technology** | API access, automation, blockchain bridge, data export |
| **Article 6 Readiness** | Corresponding adjustment support, authorization tracking |
| **Geographic Coverage** | Host country acceptance, import/export restrictions |

### 10.1.1.3 Registry Governance Models

| Model | Examples | Decision-Making | Pros | Cons |
|-------|----------|-----------------|------|------|
| **Standard-Body Owned** | Verra, Gold Standard | Board + technical committees + public consultation | Integrated standard + registry; consistent rules | Monopoly risk; slower innovation |
| **UNFCCC/Intergovernmental** | CDM, A6.4, CORSIA | COP/SB/Supervisory Body + national parties | Global legitimacy; compliance-grade | Political; slow; bureaucratic |
| **Government/National** | EU ETS, China ETS, **India CCTS** | Ministry/regulator + legislation | Legal enforceability; compliance integration | Jurisdiction-limited; political risk |
| **Industry Consortium** | ICROA members, some sectoral | Member voting + secretariat | Industry-aligned; responsive | Potential conflicts of interest |
| **Decentralised/DAO** | Toucan, KlimaDAO, **EtherTrack** | Token governance + core team | Transparent; programmable; global | Regulatory uncertainty; security risk |

### 10.1.1.4 Registry Rules — What You Must Know

**Key Rule Categories (All Registries):**
| Rule Area | Typical Content | Change Frequency |
|-----------|-----------------|------------------|
| **Account Opening** | KYC/AML, entity types, authorized representatives | Low |
| **Project Registration** | Eligibility, documentation, validation requirements | Medium (methodology updates) |
| **Issuance** | Verification requirements, serialisation, vintage, labelling | Medium |
| **Transfer/Trade** | Settlement cycles, block trades, restricted transfers | Low |
| **Retirement/Cancellation** | Claim types, labelling, irreversibility | Low |
| **Fees** | Account, issuance, transaction, retirement, annual | Annual |
| **Compliance/Enforcement** | Freezes, investigations, reversals, penalties | Event-driven |
| **Data/Transparency** | Public reports, API access, bulk download | Increasing |

**Rule Change Process (Typical):**
1. Proposal (staff, board, stakeholders)
2. Impact assessment
3. Public consultation (30-60 days)
4. Board/Committee decision
5. Implementation timeline (immediate to 12 months)
6. Grandfathering provisions (or not)

### 10.1.1.5 India CCTS Registry — Critical Context

**CCTS Registry Architecture (BEE CCTS 2023):**
| Layer | Component | Role |
|-------|-----------|------|
| **National Registry** | ICMS (Indian Carbon Market System) | Central ledger for all CCCs |
| **Registry Operator** | BEE / Designated Agency | Governance, rules, oversight |
| **Account Types** | Obligated Entity, Voluntary, Trading, Registry | Defined in CCTS |
| **Credit Type** | Carbon Credit Certificate (CCC) | Unique Indian instrument |
| **Linkage** | Verra/GS/CDM → ICMS (via bridging) | International recognition |

**Key CCTS Registry Rules (Draft/Notified):**
- **CCC Serialisation:** Unique ID with vintage, project, methodology, vintage
- **Obligated Entity Accounts:** Mandatory for compliance entities
- **Voluntary Accounts:** Open to any Indian entity
- **Corresponding Adjustment:** Required for international transfers (Article 6.2)
- **Retirement for Claims:** Specific labelling for BRSR, voluntary claims
- **Fee Structure:** BEE-notified (account, issuance, transaction, retirement)

### 10.1.1.6 Registry Fees — Cost Modelling

**Typical Fee Structure (Verra VCS Example):**
| Fee Type | Amount (Indicative) | Frequency |
|----------|---------------------|-----------|
| **Account Opening** | $2,500 - $5,000 | One-time |
| **Annual Account Fee** | $1,500 - $3,000 | Annual |
| **Project Registration** | $0.10 - $0.20 per tCO2e (capped) | Per issuance |
| **Issuance Fee** | Included in registration | Per issuance |
| **Transaction Fee** | $0.01 - $0.05 per credit | Per transfer |
| **Retirement Fee** | $0.01 - $0.05 per credit | Per retirement |
| **Additional Services** | Bulk transfer, API access, custom reports | As used |

**Cost Comparison Exercise:**
```
Project: 100,000 tCO2e/yr issuance, 5-year crediting period
Registry A: $0.15/t issuance + $2,000/yr account + $0.02/t retirement
Registry B: $0.10/t issuance + $5,000/yr account + $0.01/t retirement
Registry C: $0.20/t issuance + $0 account + $0.03/t retirement (blockchain)

5-Year Cost:
A: (100,000 × 0.15 × 5) + (2,000 × 5) + (100,000 × 0.02 × 5) = $750,000 + $10,000 + $10,000 = $770,000
B: (100,000 × 0.10 × 5) + (5,000 × 5) + (100,000 × 0.01 × 5) = $500,000 + $25,000 + $5,000 = $530,000
C: (100,000 × 0.20 × 5) + $0 + (100,000 × 0.03 × 5) = $1,000,000 + $0 + $15,000 = $1,015,000
```

---

### Practical Exercise: Registry Selection Memo

**Scenario:** Your company is developing a 50 MW solar project in Rajasthan (VCS AMS-I.D). Target markets: (1) Voluntary corporate buyers (global), (2) Potential CCTS compliance buyers (India), (3) CORSIA-eligible for future aviation sales. Project lifetime: 25 years. Expected annual issuance: 90,000 tCO2e.

**Task:** Prepare a registry selection memo comparing:
1. **Verra VCS** (primary) + **ICMS bridge** (for CCTS)
2. **Gold Standard** (primary) + **ICMS bridge** (for CCTS)
3. **Direct ICMS registration** (if methodology accepted)

**Comparison Dimensions:**
- Eligibility for project type
- Buyer preference / market liquidity
- ICVCM CCP status
- 5-year cost projection (fees)
- Article 6 / corresponding adjustment readiness
- Technology / API / automation
- Reputational risk / governance stability

**Deliverable:** 2-page memo with recommendation and rationale
**Time:** 35 min
**Rubric:** Comparison completeness (30%), cost accuracy (20%), strategic alignment (30%), clarity (20%)

**Knowledge Check:**
1. What is the fundamental difference between a registry and an exchange?
2. Why might a project register with Verra but also bridge to ICMS?
3. What is a "corresponding adjustment" in registry terms?
4. Which registry governs CORSIA-eligible credits?

**Sources:**
1. Verra VCS Standard v4.4 — Registry System
2. Gold Standard — Registry Requirements
3. CDM Registry User Guide
4. CORSIA Registry Framework (ICAO)
5. BEE CCTS Guidelines (2023) — Registry & ICMS
6. ICVCM Assessment Framework (2024) — Registry Governance
7. Article 6.2 / 6.4 Guidance — Corresponding Adjustments

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC (Registry rules evolving) | Regulatory Review: Quarterly*

---

### Lesson 10.1.2: Registry Data Model & Credit Lifecycle
**Lesson Code:** C10.1.2
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** professional

**Learning Objectives:**
1. Describe the registry data model: projects, credits, accounts, transactions, metadata (Bloom: Understand)
2. Trace a credit's full lifecycle from issuance to retirement across registry states (Bloom: Apply)
3. Identify critical metadata fields that determine credit quality, eligibility, and value (Bloom: Analyze)

**Prerequisites:** C10.1.1

**Why This Matters:**
Every credit in a registry carries metadata that determines its usability, value, and compliance status. Missing or incorrect metadata — wrong vintage, missing methodology, incorrect labelling — can make credits unsellable or non-compliant. Understanding the data model lets you design projects that produce registry-ready credits and troubleshoot issues before they block transactions.

**Core Concept: Credit as Structured Data — Metadata Is the Product**

### 10.1.2.1 Registry Data Model — Core Entities

**Entity Relationship Overview:**
```
ACCOUNT (Holder)
    │
    ├── HOLDS → CREDIT BATCH (Balance)
    │
    └── INITIATES → TRANSACTION
                         │
                         ├── SOURCE: CREDIT BATCH (Debit)
                         ├── DESTINATION: CREDIT BATCH (Credit)
                         ├── TYPE: Issuance / Transfer / Retirement / Cancellation
                         └── STATUS: Pending / Settled / Failed / Reversed
                          
CREDIT BATCH (The Atom)
    │
    ├── PROJECT (Parent)
    │     ├── Methodology
    │     ├── Location/Geometry
    │     ├── Proponent/Developer
    │     ├── VVB
    │     ├── Validation/Verification Records
    │     └── Status: Registered / Suspended / Cancelled
    │
    ├── VINTAGE (Year of ER generation)
    │
    ├── METHODOLOGY (Specific version)
    │
    ├── STANDARD (VCS, GS, CDM, CCTS...)
    │
    ├── LABELS/TAGS (Quality, SDG, CORSIA, Article 6...)
    │
    ├── SERIALISATION (Unique ID range)
    │
    ├── QUANTITY (tCO2e)
    │
    └── STATE: Active / Retired / Cancelled / Frozen / Pending
```

**Credit Batch = Minimum Transferable Unit:**
- Not individual tonnes (too granular)
- Batch = contiguous serial range from same project/vintage/methodology
- Typical batch: 1,000 - 1,000,000 credits
- Splitting/merging allowed via transactions

### 10.1.2.2 Critical Credit Metadata Fields

| Field | Example | Purpose | Quality Impact |
|-------|---------|---------|----------------|
| **Serial Number** | VCS-1234-567890-2023-0001-100000 | Unique identification | Traceability |
| **Project ID** | VCS-1234 | Project linkage | Due diligence |
| **Vintage** | 2023 | Year of ER generation | Price, eligibility |
| **Methodology** | VCS AMS-I.D v18.0 | Calculation basis | Quality assessment |
| **Standard** | Verra VCS | Governance framework | Market access |
| **Project Type** | Renewable Energy / Solar PV | Sector classification | Buyer preference |
| **Country/Region** | India / Rajasthan | Geographic eligibility | CORSIA, Article 6 |
| **Validation Date** | 2023-06-15 | Design approval | Credibility |
| **Verification Period** | 2023-01-01 to 2023-12-31 | Performance period | Vintage alignment |
| **VVB** | SGS, DNV, Aster Global | Auditor credibility | Quality signal |
| **Labels** | CORSIA-eligible, SDG 7/13, Article 6.2 authorized | Special eligibility | Premium pricing |
| **Corresponding Adjustment** | Yes/No/Authorized/Applied | Article 6 compliance | International transfer |
| **Sustainable Development** | SDG claims verified | Co-benefits | Buyer preference |
| **Vintage Start/End** | 2023-01-01 / 2023-12-31 | Precise period | Regulatory compliance |

### 10.1.2.3 Credit Lifecycle States

**State Machine:**
```
ISSUED (Active)
    │
    ├── TRANSFER → ISSUED (Active) [New holder]
    │
    ├── RETIRE → RETIRED (Immutable, claim recorded)
    │
    ├── CANCEL → CANCELLED (Immutable, no claim)
    │
    ├── FREEZE → FROZEN (Dispute, investigation, sanction)
    │       │
    │       ├── RESOLVE → ISSUED (Active)
    │       └── REVOKE → CANCELLED
    │
    └── REVERSE (VVB error, fraud) → CANCELLED + New issuance (corrected)

TERMINAL STATES: RETIRED, CANCELLED (immutable)
ACTIVE STATES: ISSUED, FROZEN, PENDING
```

**State Transition Rules:**
| Transition | Trigger | Authorization | Reversible? |
|------------|---------|---------------|-------------|
| **Issuance** | VVB verification report + standard body approval | Registry + Standard Body | No (but can reverse) |
| **Transfer** | Account holder instruction (or API) | Source account holder | No (but can transfer back) |
| **Retirement** | Account holder instruction + claim details | Account holder | **Never** |
| **Cancellation** | Account holder / Registry (quality) | Account holder or Registry | **Never** |
| **Freeze** | Registry (dispute, sanction, investigation) | Registry operator | Yes (resolve) |
| **Reverse** | Registry (error, fraud, VVB withdrawal) | Registry + Standard Body | Creates new issuance |

### 10.1.2.4 Vintage & Vintage Integrity

**Vintage Definition:**
- Vintage = Calendar year in which emission reductions occurred
- **Not** year of issuance, verification, or retirement
- Critical for: CORSIA (vintage eligibility), Article 6 (corresponding adjustment year), buyer vintage preferences

**Vintage Rules:**
| Rule | Typical Implementation |
|------|------------------------|
| **Vintage Assignment** | At issuance, based on verification period |
| **Split Vintage** | If verification spans Jan 1, credits split by vintage |
| **Vintage Integrity** | Cannot change vintage after issuance |
| **Vintage Eligibility** | CORSIA: 2021+; Article 6: host country NDC period |
| **Vintage Price Curve** | Current vintage premium; older vintages discount |

**Split Vintage Example:**
```
Verification Period: 2023-10-01 to 2024-03-31
Total ERs: 150,000 tCO2e
- 2023 Vintage: 75,000 tCO2e (Oct-Dec 2023)
- 2024 Vintage: 75,000 tCO2e (Jan-Mar 2024)
→ Two separate issuance batches with different vintage metadata
```

### 10.1.2.5 Labels, Tags & Quality Signals

**Common Registry Labels:**
| Label | Registry | Meaning | Value Impact |
|-------|----------|---------|--------------|
| **CORSIA Eligible** | Verra, GS, CDM | Meets ICAO CORSIA criteria | Premium (aviation buyers) |
| **SDG Verified** | GS (SD VISta), Verra | Specific SDG contributions verified | ESG buyer premium |
| **Article 6.2 Authorized** | Host country registry | Host country LoA issued | International transfer ready |
| **Article 6.4** | A6.4 Registry | Supervisory Body approved | Compliance market |
| **CCB Gold/Platinum** | Verra CCB | High biodiversity/community | Premium |
| **Removal / Avoidance** | All | Credit type classification | Different buyer pools |
| **Vintage 2021+** | All | Post-Paris vintage | CORSIA/Article 6 eligibility |

**EtherTrack-Specific Labels (ERC-1155 Metadata):**
```json
{
  "projectId": "ET-2024-001",
  "vintage": 2024,
  "methodology": "VCS-AMS-I.D-v18",
  "standard": "Verra",
  "labels": ["CORSIA-eligible", "SDG-7", "SDG-13", "Article6.2-authorized"],
  "correspondingAdjustment": "authorized",
  "hostCountry": "IN",
  "registry": "Verra",
  "bridgeStatus": "bridged-to-ICMS",
  "qualityScore": 87,
  "verifier": "SGS",
  "verificationPeriod": "2024-01-01/2024-12-31"
}
```

### 10.1.2.6 Public Data & Transparency

**What Registries Make Public:**
| Data Category | Verra | Gold Standard | CDM | CCTS (Planned) |
|---------------|-------|---------------|-----|----------------|
| **Project List** | ✓ Full | ✓ Full | ✓ Full | ✓ |
| **Project Documents** | PDD, VR, MR, VVB reports | PDD, MR, Verification reports | PDD, VR, MR | PDD, VR, MR |
| **Credit Holdings** | ✓ Account balances | ✓ Account balances | ✓ | ✓ |
| **Transaction History** | ✓ Full (anonymized parties) | ✓ Full | ✓ | ✓ |
| **Retirement Details** | ✓ Beneficiary, purpose | ✓ Beneficiary, purpose | ✓ | ✓ |
| **API Access** | ✓ REST API | ✓ REST API | Limited | Planned |
| **Bulk Download** | ✓ CSV/JSON | ✓ CSV | ✓ | Planned |

**Data Analysis Use Cases:**
- **Market Surveillance:** Track issuance/retirement trends by vintage, type, region
- **Due Diligence:** Verify project status, credit availability, ownership chain
- **Price Analysis:** Correlate metadata with transaction prices
- **Compliance:** Verify CORSIA/Article 6 eligibility before purchase

---

### Practical Exercise: Credit Metadata Audit

**Scenario:** You are reviewing a portfolio of 10,000 credits for a corporate buyer. The credits are from a Verra VCS project (VCS-2847), 2022 vintage, AMS-I.D solar. The seller provides a spreadsheet with credit serial numbers.

**Data Provided:**
| Field | Value in Spreadsheet |
|-------|---------------------|
| Serial Range | VCS-2847-2022-000001-10000 |
| Vintage | 2022 |
| Methodology | AMS-I.D v17.0 |
| Standard | Verra |
| Labels | "CORSIA-eligible", "SDG-7" |
| VVB | "SGS" |
| Verification Period | "2022" |
| Corresponding Adjustment | "N/A" |

**Registry Lookup (Verra Public Data) Shows:**
| Field | Registry Value |
|-------|----------------|
| Serial Range | VCS-2847-2022-000001-10000 ✓ |
| Vintage | 2022 ✓ |
| Methodology | AMS-I.D v18.0 ✗ (spreadsheet says v17.0) |
| Standard | Verra ✓ |
| Labels | "CORSIA-eligible" ✓, no SDG label ✗ |
| VVB | "SGS" ✓ |
| Verification Period | 2022-01-01 to 2022-12-31 ✓ |
| Corresponding Adjustment | Not authorized ✓ |

**Task:** 
1. Identify all discrepancies between seller spreadsheet and registry
2. Assess materiality of each discrepancy (Critical / Major / Minor / None)
3. Determine if credits are CORSIA-eligible based on registry data
3. Recommend: Proceed / Renegotiate / Walk away

*Time:* 35 min
*Deliverable:* Discrepancy Table + Materiality Assessment + Recommendation
*Rubric:* Discrepancy identification (40%), materiality judgment (30%), recommendation logic (30%)

**Knowledge Check:**
1. What is the difference between "Retired" and "Cancelled" credit states?
2. Why can't vintage be changed after issuance?
3. What metadata field determines CORSIA eligibility?
4. How does a credit batch get split across vintages?

**Sources:**
1. Verra Registry System Specification v4.4
2. Gold Standard Registry Requirements
3. CDM Registry Data Model
4. BEE CCTS — CCC Data Structure (2023)
5. ICAO CORSIA — Eligibility Criteria
6. Article 6.2 Guidance — Corresponding Adjustment Metadata

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC | Regulatory Review: Quarterly*

---

### Lesson 10.1.3: Cross-Registry Interoperability & Article 6
**Lesson Code:** C10.1.3
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** professional

**Learning Objectives:**
1. Explain the mechanisms for moving credits between registries: bridging, cancellation-reissuance, Article 6.2 (Bloom: Understand)
2. Analyze the role of corresponding adjustments in international credit transfers (Bloom: Analyze)
3. Evaluate interoperability risks: double counting, fragmentation, settlement failure (Bloom: Evaluate)

**Prerequisites:** C10.1.2, C02.2.2 (Market Evolution CDM→Article 6)

**Why This Matters:**
No single registry covers all markets. A project registered with Verra may need to serve CORSIA buyers (requiring CORSIA registry), CCTS compliance (requiring ICMS), and voluntary buyers (Verra). Moving credits between registries introduces operational, legal, and integrity risks. Article 6 corresponding adjustments add a sovereign layer. Understanding these mechanisms is essential for market access and compliance.

**Core Concept: Interoperability as Controlled Transfer — Not Free Movement**

### 10.1.3.1 Why Interoperability Matters

**The Fragmentation Problem:**
| Market | Primary Registry | Credit Type |
|--------|------------------|-------------|
| **Voluntary Global** | Verra, Gold Standard | VCU, GS VER |
| **CORSIA Aviation** | CORSIA Registry (ICAO) | CORSIA Eligible Units |
| **Article 6.4** | A6.4 Registry (UNFCCC) | A6.4 ERs |
| **Article 6.2** | National Registries (bilateral) | ITMOs |
| **India Compliance** | **ICMS (CCTS)** | **CCC** |
| **EU ETS** | EU Registry | EUAs |
| **China ETS** | China National Registry | CCERs |
| **Tokenised/DeFi** | Toucan, Celo, **EtherTrack** | TCO2, BCT, ET-CCC |

**A Single Project May Need:**
- Verra registration (voluntary market primary)
- ICMS bridging (India CCTS compliance)
- CORSIA label (aviation sales)
- Article 6.2 authorization (international transfer)
- Tokenisation (DeFi liquidity)

### 10.1.3.2 Interoperability Mechanisms

| Mechanism | Description | Used For | Integrity Control |
|-----------|-------------|----------|-------------------|
| **1. Bridging (Tokenisation)** | Lock in source registry → mint token on blockchain | DeFi, fractionalization, programmable | Source credits frozen; 1:1 backing; audit |
| **2. Cancellation-Reissuance** | Cancel in Registry A → Reissue in Registry B | Registry migration, compliance transfer | Double cancellation proof; VVB re-verification |
| **3. Article 6.2 Transfer** | Host country authorizes → Corresponding adjustment → Transfer to buyer registry | International sovereign transfers | Host LoA; CA applied; transparency |
| **4. CORSIA Eligibility** | Verra/GS → CORSIA Registry (via eligibility) | Aviation compliance | ICAO TAB assessment; vintage rules |
| **5. Direct Registry Link** | API-based transfer between registries | Emerging (Verra↔GS pilot) | Technical standards; governance MoU |

### 10.1.3.3 Bridging — Tokenised Credits (EtherTrack Context)

**Bridge Architecture (EtherTrack Example):**
```
SOURCE REGISTRY (Verra/GS)          BLOCKCHAIN (EtherTrack)          DESTINATION (ICMS/Other)
┌─────────────────────┐             ┌─────────────────────┐          ┌─────────────────────┐
│ Credit Batch        │             │ ERC-1155 Token      │          │ Credit Batch        │
│ - Serial range      │  ──LOCK──→  │ - Metadata mirror   │  ──MINT─→ │ - New serial range  │
│ - Frozen status     │             │ - Bridge proof      │          │ - Linked to source  │
│ - Bridge request    │             │ - Ownership = wallet│          │ - Corresponding adj │
└─────────────────────┘             └─────────────────────┘          └─────────────────────┘
         │                                    │                                    │
         ▼                                    ▼                                    ▼
   Registry API                        Smart Contract                        Registry API
   - Verify ownership                  - Verify lock                         - Verify CA
   - Freeze credits                    - Mint/burn                           - Issue CCC
   - Notify bridge                     - Emit events                         - Notify bridge
```

**Bridge Integrity Requirements:**
| Requirement | Implementation |
|-------------|----------------|
| **1:1 Backing** | Every token = 1 frozen registry credit; provable on-chain |
| **Freeze Verification** | Registry API confirms freeze before mint; challenge period |
| **Metadata Fidelity** | All critical metadata mirrored on-chain (vintage, methodology, labels) |
| **Reversibility** | Burn token → unfreeze in source registry (if no transfer occurred) |
| **Audit Trail** | Immutable on-chain events + registry API logs |
| **Governance** | Multi-sig bridge operators; emergency pause; dispute resolution |

**EtherTrack Bridge Flow (Operational):**
1. **Project Onboarding** → Verra project registered in EtherTrack (C15.2.2)
2. **Bridge Request** → User initiates bridge via dashboard/API
3. **Registry Freeze** → EtherTrack calls Verra API to freeze credit batch
4. **Verification** → Oracle confirms freeze; challenge window (24h)
5. **Mint** → ERC-1155 tokens minted to user wallet
6. **Trade/Settle** → Tokens traded on marketplace or transferred
7. **Retire/Bridge Out** → Burn tokens → unfreeze (retire) or reissue in destination registry

### 10.1.3.4 Article 6.2 — Corresponding Adjustments

**What Is a Corresponding Adjustment (CA)?**
- **Definition:** Host country adjusts its NDC inventory to avoid double counting when credits are transferred internationally
- **Mechanism:** Host country "gives up" the reduction in its NDC accounting; buyer country "adds" it
- **Article 6.2 Requirement:** Mandatory for all cooperative approaches (bilateral/multilateral)

**CA Process Flow:**
```
1. PROJECT DEVELOPER → Host Country (DNA/Focal Point)
   Request: Authorization for international transfer
   
2. HOST COUNTRY → Assessment
   - Additionality, baseline, safeguards, SD
   - Issues Letter of Authorization (LoA)
   - Specifies: vintage, quantity, buyer country, purpose
   
3. REGISTRY → Corresponding Adjustment Applied
   - Host registry: Marks credits "CA Applied"
   - Buyer registry: Receives credits with CA metadata
   - International Registry (Article 6.4) or bilateral tracking
   
4. TRANSPARENCY → Reporting
   - Host country: Biennial Transparency Report (BTR)
   - UNFCCC: Article 6 Database
   - Public: Authorization status, quantities
```

**CA Metadata on Credits (Critical for Buyers):**
| Field | Values | Meaning |
|-------|--------|---------|
| **CA Status** | Not Required / Authorized / Applied / Not Authorized | Transfer readiness |
| **Authorizing Party** | Host Country DNA | Sovereign authority |
| **Authorization Date** | Date | Validity period |
| **Authorized Quantity** | tCO2e | Max transferable |
| **Authorized Purpose** | CORSIA / NDC / Other / Unrestricted | Use restriction |
| **Buyer Country** | Country code / "Any" | Destination restriction |
| **First Transfer Date** | Date | When CA applied |

**India CCTS & Article 6.2:**
- **CCTS Rule:** International transfer of CCCs requires CA (BEE notification)
- **Process:** Project → BEE (DNA) → LoA → ICMS marks CA → Transfer
- **Implication:** CCCs for voluntary export need CA; domestic compliance CCCs don't
- **EtherTrack:** Bridge to ICMS must verify CA status before minting exportable tokens

### 10.1.3.5 Interoperability Risks & Mitigations

| Risk | Description | Mitigation |
|------|-------------|------------|
| **Double Counting** | Same credit active in two registries | Freeze-before-mint; CA; registry reconciliation |
| **Double Issuance** | Two registries issue for same ERs | Unique project ID; VVB cross-check; standard body coordination |
| **Metadata Loss** | Critical fields dropped in transfer | Schema mapping; mandatory fields; validation |
| **Settlement Failure** | Bridge completes but registry fails | Atomic transactions; escrow; rollback procedures |
| **Regulatory Arbitrage** | Move to lax registry | CA requirements; ICVCM CCP eligibility; buyer due diligence |
| **Fragmentation** | Credit splits across registries, hard to track | Unified identifiers (ISIN-like); aggregation layers |
| **Governance Conflict** | Registry rules contradict | MoUs; common standards (ICVCM); dispute resolution |

### 10.1.3.6 Emerging Standards — Interoperability Protocols

| Initiative | Scope | Status |
|------------|-------|--------|
| **ICVCM Core Carbon Principles** | Quality threshold for all registries | Operational (2023+) |
| **Carbon Credits Tokenisation Standards** (IWA 42) | Tokenised credit metadata, bridging | ISO drafting |
| **Climate Action Data Trust** (CAD Trust) | Aggregated registry data, reconciliation | Pilot (World Bank) |
| **Article 6.4 Registry** | Centralized mechanism registry | Operational (2024+) |
| **Verra-GS Interoperability Pilot** | Direct credit transfer | Pilot |
| **EtherTrack Bridge Protocol** | Verra/GS/ICMS ↔ ERC-1155 | Operational |

---

### Practical Exercise: Interoperability Strategy

**Scenario:** Your company holds 500,000 VCUs (Verra) from a 100 MW Indian solar project (2023 vintage, AMS-I.D v18). The buyer is an Indian airline needing CORSIA-eligible credits for 2024 compliance. The buyer also wants an option to use credits for CCTS compliance if prices are favorable.

**Current State:**
- Credits in Verra registry, Account: YourCompany
- Labels: CORSIA-eligible ✓, Article 6.2: Not Authorized
- Project: India, Rajasthan
- VVB: SGS, Verified 2023

**Task:** Design the transfer strategy:
1. **Path A:** Verra → CORSIA Registry (for airline compliance)
2. **Path B:** Verra → ICMS (for CCTS compliance)
3. **Path C:** Verra → EtherTrack (tokenise) → ICMS (bridge)

**For Each Path, Specify:**
- Required authorizations (LoA, CA, etc.)
- Registry actions (cancellation, bridging, reissuance)
- Timeline & costs
- Risks & mitigations
- Metadata changes (what labels gained/lost)

**Deliverable:** Comparison Table + Recommended Path with Rationale
**Time:** 35 min
**Rubric:** Technical accuracy (30%), regulatory compliance (30%), operational feasibility (20%), cost/timeline realism (20%)

**Knowledge Check:**
1. What is the difference between "bridging" and "cancellation-reissuance"?
2. Why is a corresponding adjustment required for Article 6.2 but not for domestic CCTS compliance?
3. What happens to Verra credit labels when bridged to EtherTrack?
4. Can a credit be simultaneously active in Verra and ICMS?

**Sources:**
1. Article 6.2 Guidance (UNFCCC) — Corresponding Adjustments
2. ICAO CORSIA — Registry & Eligibility
3. BEE CCTS (2023) — International Transfer Rules
4. Verra — Bridge Protocol / Tokenisation
5. Gold Standard — Interoperability Position
6. ICVCM — Core Carbon Principles (Interoperability)
7. IWA 42 / ISO 14068 — Carbon Credit Tokenisation

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC (Article 6 rules evolving) | Regulatory Review: Quarterly*