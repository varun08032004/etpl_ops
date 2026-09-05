# C02: Carbon Markets
## Module 2.1: Market Types & Instruments (2h, 3 lessons × 40min)

### Lesson 2.1.1: Allowances, Credits, Offsets — Definitions & Distinctions
**Lesson Code:** C02.1.1
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** foundation

**Learning Objectives:**
1. Define and distinguish between allowances, carbon credits, and offsets with precise legal and functional criteria (Bloom: Understand)
2. Classify a given instrument as an allowance, credit, or offset based on its origin, regulatory context, and use case (Bloom: Apply)
3. Explain why the distinction matters for compliance, voluntary claims, and Article 6 eligibility (Bloom: Analyze)

**Prerequisites:** C01.3.1, C01.3.2

**Why This Matters:**
The terms "allowance," "credit," and "offset" are used interchangeably in casual conversation, but they have fundamentally different legal natures, regulatory treatments, and market implications. Misclassification leads to compliance failures, invalid claims, and financial losses. This lesson establishes the precise vocabulary every carbon professional must master.

**Core Concept: Three Instruments, Three Different Legal Realities**

**2.1.1.1 Allowances (Emissions Trading Systems)**
**Definition:** A tradable permit issued by a government/regulator authorizing the holder to emit a specific quantity of GHG (typically 1 tCO2e) within a capped system.

**Key Characteristics:**
- **Origin:** Created ex nihilo by regulatory authority (ex-ante allocation)
- **Legal Nature:** Property right / financial instrument (MiFID II in EU)
- **System Context:** Cap-and-trade (ETS) — total supply fixed by cap
- **Compliance Use:** Surrendered to cover verified emissions (EU ETS, Korea ETS, China ETS, California Cap-and-Trade, RGGI, etc.)
- **Banking/Borrowing:** Often allowed (banking = carry forward; borrowing = limited advance use)
- **Expiry:** May have vintage/expiry rules (e.g., EU ETS Phase 4: allowances valid indefinitely)

**Primary Markets:** Free allocation, auctions (primary); trading platforms, OTC, exchanges (secondary)
**Price Determinants:** Cap tightness, economic activity, fuel prices, policy signals, banking expectations

**Key Registries:** EU Union Registry, China National Registry, Korea ETS Registry, CARB CITSS, RGGI COATS

**2.1.1.2 Carbon Credits (Project-Based Credits / Offsets)**
**Definition:** A tradable unit representing 1 tCO2e of GHG reduction or removal achieved by a specific project, verified against a recognized standard.

**Key Characteristics:**
- **Origin:** Generated ex-post by a discrete project activity (project-based)
- **Legal Nature:** Contractual right / intangible asset (not a financial instrument per se in most jurisdictions)
- **Standards:** VCS (Verra), Gold Standard (GS), American Carbon Registry (ACR), Climate Action Reserve (CAR), ART/TREES, CDM, Article 6.4
- **Lifecycle:** Project design → Validation → Registration → Monitoring → Verification → Issuance → Transfer → Retirement/Cancellation
- **Vintage:** Year of emission reduction/removal occurrence
- **Use Cases:** Voluntary claims (VCMI), CORSIA compliance, Article 6.2 ITMOs, domestic voluntary markets, corporate net-zero (VCMI/SBTi)

**Key Distinction from Allowances:**
| Dimension | Allowance | Carbon Credit |
|-----------|-----------|---------------|
| **Creation** | Ex-ante (regulator) | Ex-post (project) |
| **Supply Control** | Fixed cap | Project pipeline |
| **Additionality** | N/A (cap ensures scarcity) | Core requirement |
| **Permanence** | N/A (surrendered) | Critical (buffer pools) |
| **Registry** | Government ETS registry | Standard-specific registry |
| **Legal Status** | Financial instrument (MiFID II) | Contractual right/asset |

**2.1.1.3 Offsets — A Subset, Not a Synonym**
"Offset" is a **use case**, not an instrument type.
- **Definition:** The act of using a carbon credit to compensate for emissions elsewhere (claim neutralization)
- **All offsets are credits, but not all credits are offsets** (credits can be held, traded, banked without offsetting)
- **Regulatory nuance:** Some jurisdictions restrict "offset" terminology (e.g., EU: "carbon credits" for voluntary; "offset" implies compliance use)

**2.1.1.4 Other Instruments in the Ecosystem**
| Instrument | Nature | Example |
|------------|--------|---------|
| **CER** | CDM credit (Kyoto) | Pre-2020, transitioning to Art 6.4 |
| **ERU** | JI credit (Kyoto) | Annex I → Annex I |
| **AAU** | Assigned Amount Unit (Kyoto) | Country-level AAUs |
| **ITMO** | Internationally Transferred Mitigation Outcome (Art 6.2) | Bilateral |
| **A6.4ER** | Article 6.4 Emission Reduction | Multilateral (Art 6.4) |
| **CCC** | Indian Carbon Credit Certificate (CCTS) | Indian compliance market |

**Worked Example: Instrument Classification**
*Scenario:* Classify each instrument:
1. EU Allowance (EUA) issued in 2024 auction → **Allowance**
2. VCU from Verra VCS REDD+ project, 2022 vintage, retired for "carbon neutral" claim → **Credit used as Offset**
3. CER from CDM hydro project, 2015 vintage, held in EU registry → **CER (Kyoto credit)**
4. ITMO authorized by Chile, transferred to Switzerland under Art 6.2 → **ITMO**
5. A6.4ER issued by Art 6.4 Supervisory Body for a DACCS project → **A6.4ER**
6. CCC issued under India's CCTS for a solar project → **CCC (Indian compliance unit)**

**India Context:**
- **CCTS (Carbon Credit Trading Scheme):** Launched 2023 under Energy Conservation (Amendment) Act 2022
- **Instruments:** CCC (Carbon Credit Certificate) for compliance; potential for voluntary credits
- **Obligated Entities:** Designated consumers under PAT scheme, expanding to others
- **Registry:** BEE-administered; integration with power exchanges (IEX, PXIL) for trading
- **Key Distinction:** CCC is a compliance instrument (like allowance) but generated from projects (like credit) — hybrid nature

**EtherTrack Context:**
- Platform supports multiple instrument types: allowances, VCUs, CERs, A6.4ERs, CCCs
- Registry bridge maps external instrument types to internal taxonomy
- Tokenization: ERC-1155 metadata includes instrument_type field (allowance/credit/offset/ITMO/A6.4ER/CCC)
- Workflow: Instrument type determines applicable workflows (e.g., allowance → surrender workflow; credit → retirement workflow)

**Common Mistakes:**
1. Calling an EUA a "carbon credit" — it's an allowance
2. Calling a VCU an "allowance" — it's a credit
3. Using "offset" as a noun for the instrument — it's a verb/use case
4. Assuming all credits are interchangeable — standards, vintages, co-benefits create heterogeneity
5. Ignoring that Article 6.2 ITMOs require Corresponding Adjustments; voluntary credits don't

**Professional Judgement Points:**
- When a client says "I need credits for compliance," first ask: Which compliance regime? (EU ETS → allowances; CCTS → CCCs; CORSIA → eligible credits; voluntary → any standard)
- For a new project: Will it generate allowances (unlikely, requires government allocation) or credits (project-based)?
- For a buyer: Does the registry support the required transfer/retirement workflow for the intended use case?

**Practical Exercise: Instrument Classification Workshop**
*Scenario:* You receive a portfolio of 15 instruments from a broker. Classify each and identify compliance/voluntary eligibility.
*Instruments:*
1. EUA Dec-2024 (EU ETS)
2. VCU 123456, VCS REDD+, 2021 vintage
3. CER 789012, CDM wind, 2018 vintage
4. ITMO authorized by Ghana, Art 6.2
5. A6.4ER from Supervisory Body, DACCS project
5. CCC from Indian solar project, CCTS
7. UKA (UK ETS allowance)
8. NZU (NZ ETS unit)
9. Gold Standard VER, cookstove project, 2022
10. ART TREES credit, jurisdictional REDD+
*Time:* 30 min
*Deliverable:* Classification table with instrument type, compliance eligibility (EU ETS, CCTS, CORSIA, voluntary), registry
*Rubric:* Correct classification (50%), eligibility mapping (30%), registry identification (20%)

**Knowledge Check:**
1. What is the fundamental legal difference between an EUA and a VCU? (Allowance = regulatory property right; Credit = contractual right from project)
2. Can a CER be used for EU ETS compliance today? (No, EU ETS Phase 3+ banned CERs; only EUAs)
3. What makes an ITMO different from a VCU? (ITMO = Art 6.2 authorized, requires CA; VCU = voluntary standard, no CA)

**Sources:**
1. EU ETS Directive 2003/87/EC (as amended 2023) — Allowance definition
2. Verra VCS Standard v4.4 (2023) — Credit definition
3. Paris Agreement Article 6 — ITMO, A6.4ER definitions
6. Decision 2/CMA.3, 3/CMA.3 — Article 6 rules
7. Energy Conservation (Amendment) Act 2022 (India) — CCTS/CCC
7. ICVCM Core Carbon Principles (2023) — Credit quality
8. ICAO CORSIA Eligible Emissions Units Criteria (2024)

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: STATIC | Regulatory Review: Annual*

---

### Lesson 2.1.2: Compliance vs Voluntary Markets
**Lesson Code:** C02.1.2
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** foundation

**Learning Objectives:**
1. Distinguish compliance carbon markets from voluntary carbon markets across legal basis, participants, price formation, and credit eligibility (Bloom: Analyze)
2. Map major compliance markets (EU ETS, UK ETS, China ETS, Korea ETS, CCTS, California, RGGI, NZ ETS, etc.) and their key design parameters (Bloom: Understand)
3. Evaluate the interaction between compliance and voluntary markets (fungibility, price signals, integrity spillovers) (Bloom: Evaluate)

**Prerequisites:** C02.1.1

**Why This Matters:**
The carbon market is not a single market. It is a constellation of legally distinct markets with different rules, participants, and price dynamics. An employee who cannot distinguish compliance from voluntary markets will misadvise clients, misprice instruments, and create compliance liabilities.

**Core Concept: Two Market Paradigms**

**2.1.2.1 Compliance Carbon Markets (Cap-and-Trade / Baseline-and-Credit)**

| Market | Jurisdiction | Start | Coverage | Key Features |
|--------|--------------|-------|----------|--------------|
| **EU ETS** | EU + EFTA | 2005 | Power, industry, aviation (intra-EU) | Largest, auctioning, MSR, CBAM link |
| **UK ETS** | UK | 2021 | Power, industry, aviation | Similar to EU ETS, separate |
| **China ETS** | China | 2021 | Power (expanding to cement, aluminum) | World's largest by coverage, intensity-based |
| **Korea ETS** | South Korea | 2015 | Power, industry, buildings, waste | Mature, auctioning increasing |
| **California Cap-and-Trade** | California, USA | 2013 | Power, industry, fuel distributors | Linked with Québec, offsets allowed (limited) |
| **RGGI** | 11 US NE states | 2009 | Power sector only | Regional, auction-only |
| **NZ ETS** | New Zealand | 2008 | All sectors incl. forestry | Only ETS with forestry in cap |
| **CCTS** | India | 2023 (phased) | Obligated entities (PAT+) | CCCs, intensity targets, BEE/CERC oversight |
| **Canada Federal** | Canada | 2019 | Federal backstop provinces | Output-based pricing + fuel charge |
| **Mexico ETS** | Mexico | 2023 (pilot) | Energy, industry | Pilot phase |

**Key Design Parameters:**
| Parameter | Variation |
|-----------|-----------|
| **Cap Setting** | Absolute (EU, Korea) vs Intensity (China) vs Output-based (California) |
| **Allocation** | Grandfathering → Auctioning (EU >50% auctioned); Free allocation for leakage risk |
| **Offsets** | Banned (EU ETS Phase 3+) → Limited (California 4-8%, Korea 10%, China pilot) |
| **Banking/Borrowing** | Banking universal; Borrowing rare (EU: no; California: limited) |
| **Price Management** | Price floors (UK, NZ), Auction reserve (EU), Allowance reserve (EU MSR) |
| **Linkage** | EU↔Switzerland, CA↔Québec, WA↔Québec (planned) |

**2.1.2.2 Voluntary Carbon Market (VCM)**
- **Definition:** Market where buyers voluntarily purchase credits for non-compliance purposes (CSR, net-zero, brand, pre-compliance)
- **Standards:** Verra VCS, Gold Standard, ACR, CAR, ART/TREES, Plan Vivo, BioCarbon
- **Governance:** Standard-setting bodies (non-profit), third-party validation/verification (DOEs/VVBs)
- **No regulatory mandate** — driven by corporate net-zero, consumer demand, investor pressure, pre-compliance
- **Credit Types:** Avoidance (RE, efficiency), Reduction (methane, N2O), Removal (ARR, DACCS, BECCS, blue carbon, biochar)

**VCM vs Compliance — Key Differences:**
| Dimension | Compliance | Voluntary |
|-----------|------------|-----------|
| **Legal Basis** | Statute/Regulation | Contract/Standard |
| **Participants** | Obligated entities | Any entity |
| **Price Driver** | Cap scarcity, policy | Quality, co-benefits, vintage, narrative |
| **Price Range (2023-24)** | €50-100 (EU), $15-30 (CA) | $1-50+ (wide spread by quality) |
| **Credit Eligibility** | Strict (domestic/linked) | Broad (standard-dependent) |
| **Registry** | Government | Standard-operated |
| **Compliance Enforcement** | Legal penalties | Reputational, contractual |
| **Price Transparency** | High (exchange-traded) | Low (OTC, bilateral) |

**2.1.2.3 Interaction & Convergence**
| Phenomenon | Description |
|------------|-------------|
| **Price Spillover** | EU ETS price ↑ → VCM prices ↑ (substitution) |
| **Pre-compliance Buying** | Entities buy voluntary credits anticipating future regulation |
| **Quality Convergence** | ICVCM CCPs → voluntary standards align with compliance-grade integrity |
| **Article 6 Bridge** | Article 6.2/6.4 may allow VCM credits → compliance use (with CA) |
| **CORSIA** | Voluntary standards (VCS, GS, ACR, ART) eligible for CORSIA compliance |

**Worked Example: Market Classification Exercise**
*Scenario:* Classify each transaction:
1. German steel mill buys 50,000 EUAs for 2024 surrender → **Compliance (EU ETS)**
2. Tech company buys 10,000 VCUs from Verra REDD+ for "carbon neutral" claim → **Voluntary**
3. Indian steel plant buys CCCs on IEX for CCTS compliance → **Compliance (CCTS)**
4. Airline buys CORSIA-eligible VCUs for 2024-2026 offsetting → **Compliance (CORSIA)**
5. Japanese utility buys ITMOs from Chile under Art 6.2 → **Compliance (Art 6.2)**
6. Crypto project retires VCUs for "carbon neutral" token → **Voluntary**

**India Context:**
- **CCTS (Carbon Credit Trading Scheme):** Launched June 2023 under Energy Conservation (Amendment) Act 2022
- **Obligated Entities:** Initially PAT-covered designated consumers; expanding
- **Instruments:** CCC (Carbon Credit Certificate) — compliance unit; 1 CCC = 1 tCO2e
- **Registry:** BEE-administered; trading on IEX/PXIL
- **Phased Rollout:** Phase 1 (2023-24): PAT entities; Phase 2: expansion
- **Link to VCM:** Indian VCS/GS projects can register for CCCs if methodology approved
- **Exchanges:** IEX, PXIL authorized for CCC trading
- **Regulators:** BEE (scheme admin), CERC (market regulation), MoP/MoEFCC (policy)

**EtherTrack Context:**
- Platform registry bridge connects to CCTS registry (BEE) for CCC lifecycle
- Platform marketplace supports both CCC (compliance) and voluntary credits
- Exchange integration: IEX/PXIL for CCC trading; OTC desk for bilateral
- Platform tracks instrument provenance: compliance vs voluntary origin tag

**Common Mistakes:**
1. Assuming VCM credits can be used for EU ETS compliance (they cannot)
2. Thinking CCTS CCCs are just "Indian VCUs" — they are compliance instruments with legal surrender obligation
3. Ignoring that CORSIA eligibility ≠ VCM standard eligibility (CORSIA has additional criteria)
4. Assuming price parity between compliance and voluntary — different drivers

**Professional Judgement Points:**
- When a client asks "Should I buy EUAs or VCUs?", first ask: "What is your compliance obligation?"
- For Indian clients: CCTS obligation ≠ voluntary net-zero; CCCs serve different purpose than VCUs
- For multinational: Compliance obligations are jurisdiction-specific; no global compliance credit

**Practical Exercise: Market Mapping**
*Scenario:* A multinational client operates in EU, India, California, and Japan. Map their compliance obligations and identify which markets/instruments apply to each jurisdiction.
*Time:* 30 min
*Deliverable:* Compliance obligation matrix (jurisdiction → market → instrument → registry → surrender deadline)
*Rubric:* Jurisdiction coverage (30%), instrument correctness (40%), deadline accuracy (30%)

**Knowledge Check:**
1. Which major compliance market banned international offsets entirely? (EU ETS Phase 3+)
2. What is the key difference between CCTS and India's PAT scheme? (PAT = energy efficiency targets; CCTS = carbon credit trading)
3. Can a California compliance entity use a Gold Standard credit for compliance? (Yes, up to 4-8% depending on vintage, per ARB rules)

**Sources:**
1. ICAP ETS Map (2024) - Global ETS status
2. World Bank State and Trends of Carbon Pricing (2024)
3. BEE CCTS Notification (2023) - Official scheme document
4. CARB Cap-and-Trade Regulation (2023) - Offset rules
5. ICAP ETS Linking Status Report (2023)
6. ICAO CORSIA Eligible Programs (2024)
6. BEE CCTS Notification S.O. 2447(E) (2023)

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC (CCTS evolving) | Regulatory Review: Quarterly*

---

### Lesson 2.1.3: Market Integrity — Additionality, Permanence, Leakage
**Lesson Code:** C02.1.3
**Duration:** 30 minutes
**Lesson Type:** document
**Tier:** foundation

**Learning Objectives:**
1. Define the three pillars of carbon credit integrity (additionality, permanence, leakage) and explain why each is necessary (Bloom: Understand)
2. Apply standard additionality tests (barrier, investment, common practice) to a project scenario (Bloom: Apply)
3. Identify leakage types and quantification approaches for major project types (Bloom: Analyze)

**Prerequisites:** C02.1.1, C02.1.2

**Why This Matters:**
A carbon credit is only as credible as its integrity. Additionality, permanence, and leakage are the three pillars that determine whether a tonne of CO2e claimed is a tonne of CO2e actually removed from the atmosphere. Without rigorous integrity, carbon markets fail their climate purpose.

**Core Concept: The Integrity Triad**

**2.1.3.1 Additionality — "Would This Happen Anyway?"**
**Definition:** The GHG reduction/removal would not have occurred in the absence of the carbon credit revenue (or the incentive created by the carbon market).

**Standard Additionality Tests (CDM Tool, VCS VT0001, GS Toolkit):**
1. **Investment Analysis:** Is the project financially unattractive without carbon revenue? (NPV, IRR, benchmark comparison)
2. **Barrier Analysis:** Are there barriers (technological, institutional, social) that carbon revenue overcomes?
3. **Common Practice Analysis:** Is the project type already widely adopted in the region without carbon finance?
4. **Regulatory Additionality:** Is the project mandated by law? (If yes → not additional)

**Additionality Assessment Framework (VCS VT0001 / CDM Tool 01):**
```
Step 1: Identify alternatives (baseline scenarios)
Step 2: Investment analysis OR Barrier analysis
Step 3: Common practice analysis
Step 4: If all passed → Additional
```

**Common Additionality Failures:**
- Renewable energy in grids with strong RPS/feed-in tariffs (common practice)
- Energy efficiency with payback <3 years (investment analysis fails)
- Projects mandated by regulation (regulatory surplus)
- "Free riders" — projects that would proceed for other reasons (CSR, regulation, economics)

**2.1.3.2 Permanence — "Will It Stay Removed?"**
**Definition:** The risk that stored carbon is re-released to the atmosphere (reversal).

**Permanence by Project Type:**
| Project Type | Reversal Risk | Mitigation |
|--------------|---------------|------------|
| Afforestation/Reforestation (ARR) | Fire, disease, harvest, land-use change | Buffer pool (10-30%), insurance, long-term contracts |
| Soil Carbon / Agriculture | Tillage reversal, drought, management change | Buffer pool, long-term contracts, monitoring |
| Blue Carbon (Mangroves, Seagrass) | Storms, sea-level rise, conversion | Buffer, legal protection, community agreements |
| BECCS / DACCS | Geological leakage (<0.01%/yr) | Site characterization, monitoring, liability transfer |
| Soil Carbon / Biochar | Oxidation, disturbance | Verification, conservative accounting |

**Permanence Mechanisms:**
| Mechanism | Mechanism | Typical Rate |
|-----------|-----------|--------------|
| **Buffer Pool** | % of credits withheld in reserve | 10-30% (VCS), 20% (GS) |
| **Insurance** | Financial guarantee for reversals | Emerging market |
| **Legal/Contractual** | Long-term land covenants, easements | Jurisdiction-dependent |
| **Monitoring** | Periodic verification of stock | Every 5-10 years |

**Reversal Accounting:**
- **Intentional:** Land-use change, harvest → full reversal liability
- **Unintentional:** Fire, disease, natural disaster → buffer pool covers
- **Liability:** Project proponent / buffer pool / insurance

**2.1.3.3 Leakage — "Did Emissions Just Move?"**
**Definition:** Displacement of emissions outside the project boundary caused by the project activity.

**Leakage Types:**
| Type | Description | Example |
|--------|-------------|---------|
| **Activity Shifting** | Activity moves outside boundary | Logging stops in project area → increases in adjacent forest |
| **Market Leakage** | Supply/demand shift | Reduced timber supply → price ↑ → harvest elsewhere |
| **Ecological Leakage** | Displacement of emissions via ecosystem processes | Wetland restoration → increased CH4 emissions |

**Leakage Quantification (VCS/GS/CDM Approaches):**
| Project Type | Typical Leakage Rate | Assessment Method |
|--------------|----------------------|-------------------|
| REDD+ (avoided deforestation) | 10-30% (activity shifting) | Reference area, agent-based modeling |
| ARR (afforestation) | 5-15% (grazing displacement) | Household surveys, remote sensing |
| Improved Forest Management | 10-20% (market leakage) | Econometric models, supply-demand |
| Agricultural (soil, rice) | 5-15% (N2O, CH4 displacement) | IPCC default factors, field measurement |
| Energy Efficiency | 0-10% (rebound effect) | Econometric, engineering models |

**Leakage Deduction:**
Net Reductions = Gross Reductions - Leakage
Leakage must be quantified and deducted ex-ante (conservative default factors) or ex-post (measured).

**Worked Example: Additionality Assessment**
*Scenario:* A 50 MW solar PV project in Rajasthan, India. Grid emission factor: 0.82 tCO2/MWh. Project IRR without carbon revenue: 14% (benchmark: 12%). Similar solar projects exist in state without carbon finance.
1. Investment Analysis: IRR 14% > 12% benchmark → **Fails investment analysis**
2. Barrier Analysis: No significant technological/institutional barriers → **Fails**
3. Common Practice: >50 similar solar projects in state without carbon finance → **Fails common practice**
*Conclusion:* **Not additional** under standard tests. Would need to demonstrate specific barriers (e.g., land acquisition risk, grid curtailment risk) or use a different baseline.

**India Context:**
- **Additionality in CCTS:** Methodologies must demonstrate additionality per BEE-approved guidelines
- **Permanence in Indian Context:** Forest projects require 30-year permanence; buffer pool 20% (ICFRE guidelines)
- **Leakage in Indian Context:** Agricultural displacement common; market leakage via commodity prices (wheat, rice, cotton)

**EtherTrack Context:**
- Platform integrity screening applies ICVCM CCP criteria to all listed credits
- Registry bridge validates buffer pool status and reversal history
- Platform flags projects with additionality flags (e.g., renewable energy in high-penetration grids)

**Common Mistakes:**
1. Treating additionality as binary (it's a spectrum of confidence)
2. Assuming buffer pools guarantee permanence (they pool risk, don't eliminate it)
3. Ignoring market leakage for commodity-producing projects
4. Using default leakage factors without project-specific justification

**Professional Judgement Points:**
- When a project claims "additionality via barrier analysis," demand evidence of the specific barrier and how carbon revenue overcomes it
- For forest projects: Ask for buffer pool balance, reversal history, and monitoring frequency
- For leakage: Demand project-specific quantification, not default factors

**Practical Exercise: Integrity Screening**
*Scenario:* You are screening 3 projects for EtherTrack listing:
1. 50 MW wind in Tamil Nadu (grid EF: 0.72 tCO2/MWh)
2. 5,000 ha mangrove restoration in Sundarbans
3. 10,000 ha improved forest management in Madhya Pradesh
*Task:* For each, identify the top 3 integrity risks and required evidence.
*Time:* 35 min
*Deliverable:* Risk matrix with evidence requirements
*Rubric:* Risk identification (40%), evidence specificity (30%), prioritization (30%)

**Knowledge Check:**
1. What is the "regulatory surplus" test for additionality? (Is the project required by law?)
2. Why do buffer pools use a percentage rather than fixed amount? (Risk scales with project size)
3. What is "market leakage" vs "activity shifting"? (Market = price-mediated; Activity = physical displacement)

**Sources:**
1. CDM Tool 01: "Tool for the demonstration and assessment of additionality" (v07.0)
2. VCS Standard v4.4 / VT0001 "Additionality" (2023)
3. Gold Standard Toolkit v2.2 — Additionality & Permanence
4. IPCC AR6 WG3 Chapter 7 — CDR, permanence, leakage
5. ICVCM Core Carbon Principles (2023) — Principles 2, 3, 4
5. ICFRE Guidelines for Forest Carbon Projects (India)
6. BEE CCTS Methodology Guidelines (2023)

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: STATIC | Regulatory Review: Annual*

---