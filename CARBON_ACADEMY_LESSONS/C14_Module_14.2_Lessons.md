# C14: Marketplace & Trading
## Module 14.2: Market Operations & Analytics (3 lessons × 40min = 2h)

### Lesson 14.2.1: Market Operations — Liquidity, Price Discovery & Surveillance
**Lesson Code:** C14.2.1
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** india_ether_track

**Learning Objectives:**
1. Analyze market microstructure: liquidity, price formation, order flow (Bloom: Analyze)
2. Design market surveillance: manipulation detection, wash trading, spoofing (Bloom: Create)
3. Build operational workflows: trade support, settlement ops, reconciliation (Bloom: Apply)

**Prerequisites:** C14.1.1, C14.1.2, C10.1.1

**Why This Matters:**
Market operations are the engine room of carbon trading. Without liquidity, price discovery fails. Without surveillance, manipulation thrives. Without robust operations, settlement fails. This lesson teaches you to build and run the operational backbone of a carbon market.

**Core Concept: Market Operations = Microstructure + Surveillance + Operations = Trust**

### 14.2.1.1 Market Microstructure — Liquidity & Price Formation

**Liquidity Metrics — What to Measure:**
| Metric | Formula | Healthy Range | Action if Breached |
|--------|---------|---------------|-------------------|
| **Bid-Ask Spread** | (Best Ask - Best Bid) / Mid | < 2% of mid | Widen → Liquidity alert |
| **Depth** | Σ Bid Qty @ Best 5 Levels / Mid | > 5% of daily vol | Thin → Market maker incentive |
| **Volume / OI** | Daily Volume / Open Interest | > 5% | Declining → Liquidity drying |
| **Turnover Rate** | Daily Volume / Total Listed | > 0.5%/day | Stagnant → Liquidity program |
| **Vintage Spread** | |P_vintage_n - P_vintage_n-1| / P_vintage_n-1 | < 10% | Wide spread → Vintage arbitrage |

**Price Discovery Process:**
```
PRICE DISCOVERY MECHANISM:
1. Order Flow (Limit/Market orders) → Order Book
2. Matching Engine → Trade Price + Volume
3. VWAP / TWAP Calculation → Reference Price
4. Vintage/Methodology Adjustment → Adjusted Price Curve
5. Index Publication → Benchmark for OTC/Contracts
```

**Order Book Dynamics:**
| Order Type | Role in Price Discovery | Risk |
|------------|------------------------|------|
| **Limit Orders (Maker)** | Provide liquidity; set price levels | Adverse selection |
| **Market Orders (Taker)** | Consume liquidity; price discovery | Slippage; impact |
| **Iceberg/Hidden** | Hide size; manage footprint | Detection risk |
| **Algo/Algo** | Speed; pattern recognition | Arms race; flash crashes |

### 14.2.1.2 Market Surveillance — Detecting Manipulation

**Key Manipulation Patterns:**
| Pattern | Detection Method | Red Flag |
|-----------|------------------|----------|
| **Wash Trading** | Same entity both sides; no beneficial ownership change | Same counterparty; circular flows; zero economic purpose |
| **Spoofing/Layering** | Large orders placed/cancelled to move price | Large orders cancelled >90%; one-sided |
| **Marking the Close** | Aggressive buying/selling near settlement | Volume spike last 15 min; price revert |
| **Pump & Dump** | Coordinated buying + hype + dump | Volume spike + news + sharp reversal |
| **Cross-Market Manipulation** | Move price on Exchange A to profit on Exchange B | Correlated moves; lead-lag analysis |

**Surveillance Stack:**
```
┌─────────────────────────────────────────────────────────────┐
│                    SURVEILLANCE STACK                        │
├─────────────────────────────────────────────────────────────┤
│  DATA INGESTION                                              │
│  • Trade feed (real-time) → Kafka/Pulsar                    │
│  • Order book snapshots (100ms) → Time-series DB            │
│  • Reference data (contracts, participants) → Reference DB  │
├─────────────────────────────────────────────────────────────┤
│  RULE ENGINE (Drools / Custom Rules Engine)                 │
│  • Rule: Wash Trade → Same LEI both sides; qty match ±5%    │
│  • Rule: Spoofing → Order/Trade ratio > 10:1; cancel rate > 90% │
│  • Rule: Marking Close → VWAP deviation > 2σ in last 15min │
│  • Rule: Layering → Orders at 5+ price levels; cancel > 95% │
├─────────────────────────────────────────────────────────────┤
│  ALERTING & CASE MANAGEMENT                                 │
│  • Alert → Case → Investigation → Action → Report           │
│  • Integration: Registry, Exchange, KYC, Legal              │
└─────────────────────────────────────────────────────────────┘
```

### 14.2.1.3 Settlement Operations — The Back-Office Backbone

**Settlement Workflow (T+1 DvP):**
```
T (Trade Date):
  1. Trade Match → Confirmation (Both parties)
  2. Novation → CCP (if cleared) / Bilateral (OTC)
  2. Settlement Instructions → Registry + Payment System

T+1 (Settlement Date):
  3. Registry: Credit Transfer (Seller → Buyer) [Atomic]
  4. Payment System: Funds Transfer (Buyer → Seller) [Atomic]
  5. DvP Confirmation: Both legs settled → Settlement Complete
  6. Reporting: Trade Confirmation + Settlement Confirmation

T+2+:
  - Failed Settlement Management
  - Reconciliation (Registry vs Ledger vs Bank)
  - Failed Trade Management (Buy-in, Cash Settlement, Penalties)
```

**Settlement Risk Controls:**
| Control | Implementation |
|--------|----------------|
| **DvP (Delivery vs Payment)** | Atomic: Registry transfer ⇔ Funds transfer |
| **CCP Novation** | Exchange CCP becomes central counterparty |
| **Settlement Limits** | Per-counterparty, per-vintage, daily caps |
| **Failed Trade Management** | Buy-in (T+2); Cash settlement (penalty); Penalty fees |
| **Reconciliation** | Daily: Registry vs Ledger vs Bank; Weekly: Full position |

### 14.2.1.3 Reconciliation — The Daily Discipline

**Reconciliation Layers:**
| Level | Frequency | Scope | Owner |
|--------|-----------|-------|-------|
| **Transaction** | Real-time (per trade) | Each settlement | Auto |
| **Daily Balance** | Daily (EOD) | All accounts, all registries | Operations |
| **Cash** | Daily | Bank vs Ledger | Finance |
| **Position (Registry vs Ledger)** | Daily | All accounts, all registries | Ops/Compliance |
| **Full Audit** | Monthly | All entities, all registries | Internal Audit |

**Reconciliation Breaks — Classification & Resolution:**
| Break Type | Detection | Typical Cause | Auto-Resolvable? |
|------------|-----------|---------------|------------------|
| **Timing Difference** | Registry settled; Ledger pending | Settlement lag | Yes (wait) |
| **Failed Transaction** | Trade confirmed; settlement failed | Auth timeout, insufficient balance, freeze | Yes (retry) |
| **Duplicate Transaction** | Local: 1; Registry: 2 | Idempotency failure; double-submit | Yes (dedupe) |
| **Missing Transaction** | Local: 0; Registry: 1 | Webhook missed; API error; manual entry | Manual |
| **Quantity Mismatch** | Local: 10,000; Registry: 9,950 | Partial fill; rounding; split batch | Manual |
| **Batch Identity Mismatch** | Serial ranges don't match | Bridge split; registry migration | Manual |
| **Frozen Credits** | Local: active; Registry: frozen | Dispute, investigation, sanction | Manual |
| **Cross-Registry Double Count** | Same serial in Verra + ICMS | Bridge incomplete, double mint | Manual |

**Reconciliation Automation:**
```python
def daily_reconciliation(account, registry):
    # 1. FETCH REGISTRY BALANCE (batch-level)
    registry_balances = await registry_api.get_balances(account_id)
    
    # 2. FETCH LOCAL LEDGER BALANCE (batch-level)
    local_balances = await local_ledger.get_balances(account_id)
    
    # 3. NORMALIZE (same key: serial_range + vintage + methodology)
    reg_map = {(b['serial'], b['vintage'], b['methodology']): b for b in registry_balances}
    loc_map = {(b['serial'], b['vintage'], b['methodology']): b for b in local_balances}
    
    # 4. COMPARE
    all_keys = set(reg_map.keys()) | set(loc_map.keys())
    discrepancies = []
    
    for key in all_keys:
        reg = reg_map.get(key)
        loc = loc_map.get(key)
        if not reg: discrepancies.append({'type': 'MISSING_IN_REGISTRY', 'local_qty': loc['quantity']})
        elif not loc: discrepancies.append({'type': 'MISSING_IN_LOCAL', 'registry_qty': reg['quantity']})
        elif reg['quantity'] != loc['quantity']: discrepancies.append({'type': 'QUANTITY_MISMATCH', 'diff': loc['quantity'] - reg['quantity']})
        elif reg['state'] != loc['state']: discrepancies.append({'type': 'STATE_MISMATCH', ...})
    
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
    
    # 5. RECORD & ALERT
    await save_reconciliation_record(account_id, registry, discrepancies)
    unresolved = [d for d in discrepancies if not d['auto_resolve']]
    if unresolved:
        await alert_ops(unresolved)
    
    return discrepancies
```

### 14.2.1.4 Professional Judgement Points
- **Reconciliation is not optional:** It's the control that catches everything else
- **Automate 95%:** Manual reconciliation doesn't scale; build the pipeline
- **Unresolved breaks = Risk:** Age breaks; escalate at 24h, 48h, 72h
- **Audit trail:** Every break must have resolution evidence (not just "fixed")

### 14.2.1.4 Practical Exercise: Operations Design
*Scenario:* Build the market operations runbook for a new CCTS trading desk handling 500k CCCs/month across IEX, PXIL, and bilateral.
*Tasks:*
1. Design daily ops runbook (schedule, owners, SLAs)
2. Design surveillance rule set (5 key rules)
3. Design reconciliation pipeline (architecture + alerts)
4. Define escalation matrix (break types → owner → SLA)
*Time:* 45 min
*Deliverable:* Ops runbook outline + Surveillance rules + Reconciliation flow + Escalation matrix
*Time:* 45 min
*Rubric:* Operational completeness (40%), surveillance coverage (30%), reconciliation rigor (30%)

**Knowledge Check:**
1. What is the difference between a "timing difference" and a "failed transaction" in reconciliation?
2. Why is batch-level reconciliation superior to account-level?
3. When should you escalate a discrepancy to the standard body vs the registry?
4. What evidence is needed to prove a bridge discrepancy vs a registry discrepancy?

**Sources:**
1. CERC — Market Surveillance Regulations
2. IEX/PXIL — Market Operations Manual
3. Verra/GS — Registry Operations Manual
4. ICROA — Market Operations Best Practices
5. ISO 20022 — Securities Reconciliation

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC (Market ops evolving) | Regulatory Review: Quarterly*

---

### Lesson 14.2.2: Market Analytics & Price Discovery
**Lesson Code:** C14.2.2
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** professional

**Learning Objectives:**
1. Build market data pipelines for CCC price discovery, volatility, and liquidity (Bloom: Create)
2. Design analytics for compliance tracking, portfolio optimization, and regulatory reporting (Bloom: Create)
3. Evaluate market structure: concentration, price formation, arbitrage (Bloom: Analyze)

**Prerequisites:** C14.1.1, C14.1.2, C10.1.1

**Why This Matters:**
The carbon market is nascent but growing fast. Price discovery, liquidity analysis, and arbitrage detection require robust market data infrastructure. This lesson teaches you to build the analytics layer that turns raw trade data into actionable market intelligence.

**Core Concept: Market Data as Strategic Asset — Not Just Compliance Byproduct**

### 14.2.2.1 Market Data Pipeline — From Trade to Insight

**Data Sources:**
| Source | Data Type | Latency | Access Method |
|----------|-----------|---------|---------------|
| **IEX/PXIL Trade Feed** | Tick-level trades (price, qty, vintage, methodology) | Real-time (WebSocket) | WebSocket / REST |
| **IEX/PXIL Order Book** | L1/L2 depth (bids/asks, volumes) | Real-time | WebSocket |
| **ICMS Settlement** | Settled trades (T+1 confirmed) | T+1 EOD | API / SFTP |
| **ICMS Registry** | Holdings, transfers, retirements | Real-time (webhook) | Webhook / API |
| **External Registries** | Verra, GS, CDM, ART | Near real-time | API / Webhook |
| **Regulatory Feeds** | BEE targets, CERC orders, DNA LoAs | Event-driven | RSS / API / Email |

**Data Normalization Layer:**
```python
class CCCTrade:
    trade_id: str
    timestamp: datetime
    exchange: Literal["IEX", "PXIL", "NSE", "BSE", "OTC"]
    buyer_account: str
    seller_account: str
    serial_range: SerialRange  # start, end
    vintage: int
    methodology: str
    standard: Literal["VCS", "GS", "CDM", "CCTS", "CCER"]
    quantity: int  # tCO2e
    price_inr: Decimal
    price_usd: Optional[Decimal]
    trade_type: Literal["SPOT", "FORWARD", "BLOCK", "AUCTION"]
    settlement_status: Literal["PENDING", "SETTLED", "FAILED"]
    settlement_date: date
```

### 14.2.2.2 Price Discovery & Index Construction

**CCC Price Index Methodology (CCTS Index — Proposed):**
| Component | Methodology |
|-----------|-------------|
| **Universe** | All CCC trades on recognized exchanges (IEX, PXIL) |
| **Filters** | Vintage ≤ 3 years; Standard ∈ {CCTS, VCS, GS}; Methodology ∈ eligible list |
| **Weighting** | Volume-weighted (VWAP) per vintage × methodology bucket |
| **Rebalancing** | Monthly (1st business day) |
| **Publication** | Daily EOD; Intraday indicative (15-min) |

**Index Families:**
| Index | Universe | Weighting | Use Case |
|-------|----------|-----------|----------|
| **CCTS Composite** | All eligible CCC trades | VWAP | Benchmark |
| **CCTS Compliance** | CCTS CCCs only | VWAP | Compliance benchmark |
| **CCTS Vintage 2024** | 2024 vintage only | VWAP | Vintage-specific pricing |
| **CCTS Renewable** | Solar/Wind/Hydro methodologies | VWAP | RE project valuation |
| **CCTS Removal** | ARR, Blue Carbon, Soil | VWAP | Removal premium tracking |
| **CCTS Vintage Spread** | 2022 vs 2023 vs 2024 | Spread | Vintage arbitrage |

**Price Discovery Quality Metrics:**
| Metric | Formula | Healthy Threshold |
|--------|---------|-------------------|
| **Liquidity** | Daily volume / Open interest | > 5% daily turnover |
| **Bid-Ask Spread** | (Best Ask - Best Bid) / Mid | < 2% of mid |
| **Price Impact** | ΔPrice / √Volume | < 0.5% per 10k tCO2e |
| **Vintage Spread** | |P_vintage_n - P_vintage_n-1| / P_vintage_n-1 | < 10% |
| **Cross-Exchange Arb** | |P_IEX - P_PXIL| / P_IEX | < 1% |

### 14.2.2.2 Market Analytics — From Data to Decisions

**Key Analytical Models:**
| Model | Inputs | Output | Use Case |
|-------|--------|----------|----------|
| **Vintage Curve Fitting** | Vintage × Price points | Smooth curve + confidence bands | Vintage valuation; interpolation |
| **Liquidity Scoring** | Volume, spread, depth, frequency | 0-100 score | Execution planning |
| **Arbitrage Detection** | Cross-exchange, cross-vintage, cross-standard | Arb opportunities | Trading desk alerts |
| **Concentration Risk** | HHI by holder, exchange, vintage | HHI + Concentration ratio | Risk limits |
| **Price Forecasting** | Fundamental (supply/demand) + Technical | 30/90-day forecast | Procurement planning |

**Vintage Curve Construction (Example):**
```
Input: {(2021, ₹1,150), (2022, ₹1,180), (2023, ₹1,250), (2024, ₹1,320)}
Method: Monotonic cubic spline (enforce: price non-decreasing with vintage)
Output: Continuous price curve + 95% CI
Usage: Vintage interpolation for off-run vintages; vintage premium quantification
```

### 14.2.2.3 Professional Judgement Points
- **Data quality > Quantity:** 100 clean trades > 10,000 noisy ones
- **Vintage ≠ Age:** 2023 vintage in 2025 ≠ 2022 vintage in 2024 (different compliance eligibility)
- **Liquidity ≠ Volume:** 100k tCO2e traded once vs 10k traded daily — different liquidity
- **Arb detection:** Cross-exchange arb = market inefficiency; act fast, report to exchange
- **Regulatory lag:** Market data leads regulation; build adaptive models

### 14.2.2.3 Practical Exercise: Market Analytics Dashboard
*Scenario:* Build a CCTS market analytics dashboard for a trading desk managing 200k CCCs/month across IEX, PXIL, and bilateral.
*Tasks:*
1. Design data ingestion pipeline (sources, normalization, latency targets)
2. Define 5 core KPIs with alert thresholds
3. Design vintage curve construction + confidence intervals
4. Design arbitrage detection rules (cross-exchange, cross-vintage, cross-standard)
*Time:* 45 min
*Deliverable:* Architecture diagram + KPI definitions + alert rules
*Rubric:* Architecture completeness (40%), KPI relevance (30%), alert design (30%)

**Knowledge Check:**
1. Why use volume-weighted average price (VWAP) instead of simple average for CCC index?
2. What is the "vintage spread" and why does it matter for compliance entities?
3. How do you detect wash trading in CCC markets?
4. What is the minimum data history needed to build a reliable vintage curve?

**Sources:**
1. CERC — Market Surveillance Guidelines (2024)
2. IEX/PXIL — Market Data API Documentation
4. ICVCM — Cross-Registry Coordination Framework (2024)
5. Verra/GS/ACR/ART — Registry APIs
6. ICAO Assembly A40 Resolution (2019) — CORSIA eligibility criteria
8. Decision 2/CMA.3 Annex — Article 6.2 Rules

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC (Market data evolving) | Regulatory Review: Quarterly*

---

### Lesson 14.2.3: Market Surveillance, Compliance & Regulatory Reporting
**Lesson Code:** C14.2.3
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** professional

**Learning Objectives:**
1. Design market surveillance: manipulation detection, wash trading, spoofing (Bloom: Create)
2. Build regulatory reporting pipelines: CERC, SEBI, BEE, ICAO (Bloom: Create)
3. Design compliance workflows for market participants (Bloom: Apply)

**Prerequisites:** C14.1.1, C14.1.2, C14.2.1

**Why This Matters:**
Surveillance and reporting are the immune system of a carbon market. Without them, manipulation erodes trust, compliance fails, and regulators intervene. This lesson teaches you to build the surveillance and reporting infrastructure that keeps the market clean and compliant.

**Core Concept: Surveillance = Continuous Assurance; Reporting = Regulatory Proof**

### 14.2.3.1 Surveillance Architecture — Detecting Manipulation

**Key Manipulation Patterns:**
| Pattern | Detection Method | Red Flag |
|-----------|------------------|----------|
| **Wash Trading** | Same entity both sides; no beneficial ownership change | Same counterparty; circular flows; zero economic purpose |
| **Spoofing/Layering** | Large orders placed/cancelled to move price | Large orders cancelled >90%; one-sided |
| **Marking the Close** | Aggressive buying/selling near settlement | Volume spike last 15 min; price revert |
| **Pump & Dump** | Coordinated buying + hype + dump | Volume spike + news + sharp reversal |
| **Cross-Market Manipulation** | Move price on Exchange A to profit on Exchange B | Correlated moves; lead-lag analysis |

**Surveillance Stack:**
```
┌─────────────────────────────────────────────────────────────┐
│                    SURVEILLANCE STACK                        │
├─────────────────────────────────────────────────────────────┤
│  DATA INGESTION                                              │
│  • Trade feed (real-time) → Kafka/Pulsar                    │
│  • Order book snapshots (100ms) → Time-series DB            │
│  • Reference data (contracts, participants) → Reference DB  │
├─────────────────────────────────────────────────────────────┤
│  RULE ENGINE (Drools / Custom Rules Engine)                 │
│  • Rule: Wash Trade → Same LEI both sides; qty match ±5%    │
│  • Rule: Spoofing → Order/Trade ratio > 10:1; cancel rate > 90% │
│  • Rule: Marking Close → VWAP deviation > 2σ in last 15min │
│  • Rule: Layering → Orders at 5+ price levels; cancel > 95% │
├─────────────────────────────────────────────────────────────┤
│  ALERTING & CASE MANAGEMENT                                 │
│  • Alert → Case → Investigation → Action → Report           │
│  • Integration: Registry, Exchange, KYC, Legal              │
└─────────────────────────────────────────────────────────────┘
```

### 14.2.3.2 Regulatory Reporting Pipelines — Automated Compliance

**Reporting Obligations Matrix:**
| Report | Regulator | Frequency | Data Scope | Format |
|--------|-----------|-----------|------------|--------|
| **Trade Reporting** | CERC/SEBI | Real-time (T+0) | All trades | API / FTP |
| **Position Reporting** | CERC | Daily (EOD) | Open positions | XML/CSV |
| **Large Trader Report** | SEBI/CERC | Weekly | > Position limit | Structured |
| **Suspicious Trade** | CERC/SEBI | Immediate | STRs | SAR format |
| **CORSIA Compliance** | ICAO/DGCA | Annual | Airline surrender | ICAO format |
| **CCTS Compliance** | BEE/CERC | Quarterly | OE surrender | BEE format |
| **Article 6.4** | UNFCCC | Per issuance | A6.4ER issuance | UNFCCC schema |

**Automation Architecture:**
```
Source Systems (Exchange, Registry, OMS)
    ↓
ETL / Stream Processing (Kafka → Flink/Spark)
    ↓
Data Validation & Enrichment (Reference Data, KYC)
    ↓
Report Generation (Template Engine + Rules Engine)
    ↓
Validation (Schema, Business Rules, Cross-checks)
    ↓
Submission (API / Portal / SFTP) + Acknowledgment
    ↓
Audit Trail (Immutable Log + Digital Signature)
```

### 14.2.3.3 Market Participant Compliance Workflows

**Compliance Obligations by Participant Type:**
| Participant | Key Obligations | Reporting | Monitoring |
|-----------|-----------------|-----------|------------|
| **Exchange** | Surveillance, reporting, fair access | Trade/position reports; Surveillance alerts | Real-time |
| **Clearing Corp** | Novation, margining, settlement | Margin calls; Default fund; Default mgmt | Daily |
| **Trading Member** | KYC, position limits, reporting | Position reports; Trade confirmations | Real-time |
| **Clearing Member** | Margin collection; Client segregation | Margin reports; Client money | Intraday |
| **Project Developer** | MRV compliance; Issuance rules | MR, VR, Issuance requests | Per cycle |
| **Buyer (Compliance)** | Surrender deadlines; Vintage rules | Surrender proof; BRSR | Annual |
| **Intermediary/Broker** | KYC; Suitability; Order routing | Trade reports; Client money | Real-time |

### 14.2.3.3 Professional Judgement Points
- **Surveillance is not optional:** It's a license condition for exchanges
- **Automate 90%:** Human review for alerts only; rules engine for the rest
- **Data quality in = Report quality out:** Garbage in = regulatory breach
- **Cross-border coordination:** CORSIA, Article 6 require multi-jurisdiction reporting
- **Audit trail is everything:** Immutable logs; digital signatures; tamper-evident

### 14.2.3.3 Practical Exercise: Surveillance & Reporting Design
*Scenario:* Design the surveillance and reporting stack for a new CCTS exchange (IEX Carbon).
*Tasks:*
1. Define 5 core surveillance rules with parameters
2. Design regulatory reporting calendar (what, when, to whom, how)
3. Design data pipeline architecture (ingestion → validation → reporting)
4. Define escalation matrix for surveillance alerts
*Time:* 45 min
*Deliverable:* Surveillance rulebook + Reporting calendar + Pipeline architecture
*Rubric:* Rule completeness (30%), pipeline architecture (40%), regulatory coverage (30%)

**Knowledge Check:**
1. What are the three types of double counting? (Issuance, Use, Claiming)
2. What triggers a Corresponding Adjustment under Article 6? (First international transfer)
3. What is the difference between "retirement" and "cancellation" in registry status? (Voluntary vs compliance use)
4. What is the role of the "Large Trader Report" in SEBI/CERC framework?

**Sources:**
1. CERC — Market Surveillance Regulations (2024)
2. SEBI — LODR & Market Surveillance Circulars
3. Verra/GS — Registry Surveillance Guidelines
4. ICAO CORSIA Document (2024) — Eligible Emissions Units
5. ICVCM Cross-Registry Coordination Framework (2024)
6. Verra Registry Specification (2023)
7. Article 6 International Transaction Log (ITL) Technical Spec (2023)

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC (Surveillance tech evolving) | Regulatory Review: Quarterly*