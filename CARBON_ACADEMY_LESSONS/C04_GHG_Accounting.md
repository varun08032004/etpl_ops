# C04: GHG Accounting (Scopes 1/2/3)
## Module 4.3: Scope 3 — Value Chain Emissions

### Lesson 4.3.1: Scope 3 Mapping & Calculation
**Lesson Code:** C04.3.1
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** foundation

**Learning Objectives:**
1. Screen all 15 Scope 3 categories for relevance using the GHG Protocol relevance test (Bloom: Apply)
2. Calculate Scope 3 emissions using spend-based, supplier-specific, and hybrid methods (Bloom: Apply)
3. Evaluate data quality, uncertainty, and disclosure requirements for Scope 3 reporting (Bloom: Evaluate)

**Prerequisites:** C04.1.1, C04.2.1

**Why This Matters:**
Scope 3 typically represents 70-95% of a company's total emissions but is the least accurately measured. Poor Scope 3 accounting undermines net-zero targets, SBTi validation, investor confidence, and regulatory compliance (CSRD, BRSR, SEC). This lesson teaches you to build a credible, auditable Scope 3 inventory.

**Core Concept: Scope 3 as Strategic Intelligence, Not Just Compliance**

**4.3.1.1 Scope 3 Categories — The 15 Categories Framework**

| # | Category | Direction | Typical % of Total Scope 3 | Screening Question |
|---|----------|-----------|----------------------------|--------------------|
| 1 | Purchased Goods & Services | Upstream | 30-60% | Do we buy goods/services? |
| 2 | Capital Goods | Upstream | 5-15% | Do we buy capex equipment? |
| 3 | Fuel & Energy Related | Upstream | 5-10% | Do we buy fuel/electricity not in Scope 1/2? |
| 4 | Upstream Transportation | Upstream | 2-10% | Do we ship/receive goods? |
| 5 | Waste Generated | Upstream | 1-5% | Do we generate waste? |
| 6 | Business Travel | Upstream | 1-5% | Do employees travel? |
| 7 | Employee Commuting | Upstream | 1-3% | Do employees commute? |
| 8 | Upstream Leased Assets | Upstream | <1-2% | Do we lease assets (not in Scope 1/2)? |
| 9 | Downstream Transportation | Downstream | 2-10% | Do we ship products? |
| 10 | Processing of Sold Products | Downstream | 1-5% | Do intermediate products get processed? |
| 11 | Use of Sold Products | Downstream | 10-30% | Do products consume energy? |
| 12 | End-of-Life Treatment | Downstream | 1-5% | Do products become waste? |
| 13 | Downstream Leased Assets | Downstream | <1% | Do we lease assets to others? |
| 14 | Franchises | Downstream | <1% | Do we have franchisees? |
| 15 | Investments | Downstream | 5-20% | Do we have equity/debt investments? |

**Relevance Screening — The GHG Protocol Test:**
```
For each category:
1. SIZE: Emissions magnitude (estimate via spend/activity)
2. INFLUENCE: Can we reduce/influence?
3. RISK: Regulatory, reputational, financial
4. STAKEHOLDER EXPECTATION: Investors, customers, regulators
5. OUTSOURCING RISK: Do we outsource core activities?
→ If ANY = HIGH → INCLUDE in inventory
→ Document reasoning for EXCLUDED categories
```

**4.3.1.2 Calculation Methods — Hierarchy of Accuracy**

| Method | Description | Accuracy | Use Case |
|--------|-------------|----------|----------|
| **Supplier-Specific** | Primary data from suppliers (primary data) | Highest | Strategic suppliers, high-impact categories |
| **Hybrid** | Supplier data + secondary for gaps | High | Most categories (best practice) |
| **Average-Data** | Industry average EFs × activity data | Medium | Screening, low-impact categories |
| **Spend-Based** | Spend ($) × EEIO EF (kgCO2e/$) | Lowest | Screening, complete coverage, low-impact |

**Method Selection Hierarchy (GHG Protocol):**
```
1. Supplier-specific (primary data) → IF available & quality
2. Hybrid → Supplier data + secondary for gaps
3. Average-data → Industry averages × activity data
4. Spend-based → EEIO factors × spend → Last resort / screening
```

**4.3.1.3 Calculation Methods by Category**

| Category | Primary Method | Key Data Needs |
|----------|----------------|----------------|
| **Cat 1: Purchased Goods** | Hybrid (supplier-specific + spend-based) | Supplier surveys, spend data, LCA databases |
| **Cat 2: Capital Goods** | Spend-based + amortization | Capex data, asset lifetimes |
| **Cat 3: Fuel/Energy** | Activity × EF | Fuel bills, utility bills |
| **Cat 4: Upstream Transport** | Distance × weight × EF | Logistics data, distance, mode |
| **Cat 5: Waste** | Waste tonnage × EF | Waste manifests, disposal method |
| **Cat 6: Business Travel** | Distance × mode EF | Travel records, booking systems |
| **Cat 7: Employee Commuting** | Survey × distance × mode EF | Employee surveys, HR data |
| **Cat 11: Use of Sold Products** | Units sold × lifetime energy × EF | Sales data, product specs, lifetime |
| **Cat 15: Investments** | Proportional (equity share) | Financial statements, portfolio data |

**4.3.1.3 Scope 3 Calculation — Spend-Based Method (EEIO)**

**EEIO Formula:**
```
Emissions = Σ (Spend_i × EF_i)
Where:
  Spend_i = Procurement spend in category i ($)
  EF_i = EEIO emission factor (kgCO2e/$) for sector i
```

**Key EEIO Databases:**
| Database | Region | Sectors | Year | Access |
|----------|---------|---------|------|--------|
| **EXIOBASE** | Global | 163-200 | 2011-2022 | Subscription |
| **Eora** | Global | 26-500 | 1990-2015 | Free/Academic |
| **EXIOBASE 3** | EU/Global | 163 | 1995-2011 | Subscription |
| **US EEIO (EPA)** | US | 389 | 2012 | Free |
| **EXIOBASE 3.8.1** | Global | 163×49 | 1995-2011 | Subscription |

**Spend-Based Limitations:**
- Aggregation error (sector averages vs specific supplier)
- Price inflation vs real emissions
- Double-counting risk (capital goods vs goods/services)
- No supplier differentiation

**4.3.1.4 Hybrid Approach — Best Practice for Credible Inventories**

**Hybrid Methodology:**
```
For each Category:
1. Identify top suppliers (80/20 rule: top 20% spend = 80% emissions)
2. Request primary data from top suppliers (survey, CDP, direct)
3. For respondents: Use supplier-specific EF
4. For non-respondents: Apply category-average EF (hybrid)
5. For remaining spend: Spend-based EEIO
```

**Data Quality Hierarchy (GHG Protocol):**
| Tier | Data Source | Uncertainty | Verification |
|------|-------------|-------------|--------------|
| **Tier 1** | Supplier primary data (verified) | Lowest | Audit/assurance |
| **Tier 2** | Supplier primary data (unverified) | Low-Med | Supplier declaration |
| **Tier 3** | Industry average (LCA databases) | Medium | LCA study reference |
| **Tier 4** | EEIO / Spend-based | Highest | Database citation |

**4.3.1.4 Data Quality & Uncertainty Management**

**Data Quality Indicators (GHG Protocol):**
| Indicator | Metric | Target |
|-----------|--------|--------|
| **Completeness** | % of spend covered by Tier 1/2 data | >70% for Cat 1 |
| **Temporal Representativeness** | Data vintage vs reporting year | <3 years |
| **Geographical Representativeness** | Region match | Same region |
| **Technological Representativeness** | Technology match | Same process |
| **Uncertainty** | Quantified per category | <30% for Cat 1 |

**Uncertainty Propagation (IPCC Approach 1):**
```
u_total = √(u₁² + u₂² + ... + uₙ²)  for independent uncertainties
```
**Conservative Treatment:** If Category 1 uncertainty >30%, apply conservativeness factor.

**4.3.1.5 Data Quality Management — Verification-Ready Scope 3**

| QA/QC Control | Implementation |
|---------------|----------------|
| **Supplier Data Validation** | Cross-check: spend vs reported emissions, unit consistency |
| **Temporal Consistency** | Year-over-year trends, explain outliers |
| **Supplier Engagement** | CDP supply chain, direct surveys, contractual clauses |
| **Data Governance** | Version control, change log, approval workflow |
| **Uncertainty Documentation** | Per category: method, assumptions, range |

**India Context — Scope 3 Specifics:**
- **BRSR Core:** Top 250 listed — Scope 3 disclosure + reasonable assurance
- **BRSR Format:** Category-wise emissions, methodology, base year
- **SEBI Green Taxonomy:** Aligns Scope 3 categories with taxonomy
- **Indian Supply Chain:** High SME share → spend-based dominates; supplier engagement critical
- **Export-Oriented:** Downstream categories (9, 11, 12) critical for exporters

**EtherTrack Context:**
- Platform Scope 3 module: Category mapping, supplier onboarding, data ingestion
- Platform supplier portal: Self-service emission data submission
- Platform EEIO engine: EXIOBASE/EXIOBASE 3 integration for spend-based
- Platform supplier portal: Self-service emission data submission, CDP integration

**Common Mistakes:**
1. Reporting only spend-based for all categories (lazy, high uncertainty)
2. No screening documentation for excluded categories
3. Double-counting: Cat 1 (goods) + Cat 2 (capital) overlap
4. Cat 11 (Use of Sold Products) ignored for energy-intensive products
4. Cat 15 (Investments) omitted for financial institutions
5. No uncertainty quantification → verifier applies maximum

**Professional Judgement Points:**
- When to invest in supplier engagement: Spend >$1M or >5% of category
- When to use hybrid vs pure spend: >20% supplier response rate → hybrid
- For Cat 11 (Use of Sold Products): Critical for auto, appliances, tech
- For Cat 15 (Investments): Equity share × investee Scope 1+2 (proportional)

**Practical Exercise: Scope 3 Inventory Build**
*Scenario:* Mid-size manufacturer (₹500 Cr revenue). Build Scope 3 inventory.
*Steps:*
1. Spend-based screening (all 15 cats) → identify top 3 categories
2. For top category: Design supplier engagement plan
3. Build hybrid calculation for top category
*Time:* 45 min
*Deliverable:* Screening matrix + hybrid calc for top category
*Rubric:* Screening rigor (30%), method selection (30%), calculation accuracy (40%)

**Knowledge Check:**
1. Which Scope 3 category is typically largest for manufacturers? (Cat 1: Purchased Goods)
2. When is spend-based acceptable vs supplier-specific required? (Screening vs reporting)
3. How to avoid double-counting Cat 1 & Cat 2? (Cat 2 = capitalized; Cat 1 = expensed)

**Sources:**
1. GHG Protocol Scope 3 Standard (2011) — Full standard
2. GHG Protocol Technical Guidance for Calculating Scope 3 Emissions (2013)
4. GHG Protocol Corporate Value Chain (Scope 3) Standard
5. CDP Technical Note: Scope 3 Accounting (2022)
5. SBTi Corporate Manual (2023) — Scope 3 requirements
6. SEBI BRSR Framework (2023) — Scope 3 reporting
6. IPCC 2006 Guidelines — Volume 1, Chapter 3 (Uncertainty)
7. EXIOBASE / Eora documentation

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC (Methodologies evolving) | Regulatory Review: Quarterly*

---