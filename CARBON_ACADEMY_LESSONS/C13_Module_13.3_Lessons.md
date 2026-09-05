# C13: Indian Carbon Market & CCTS
## Module 13.3: CCTS Platform Operations & Market Analytics (3 lessons × 40min = 2h)

### Lesson 13.3.1: ICMS Registry Operations & Data Analytics
**Lesson Code:** C13.3.1
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** india_ether_track

**Learning Objectives:**
1. Operate the ICMS registry: account management, CCC lifecycle, reporting (Bloom: Apply)
2. Build data analytics pipelines for compliance tracking and market intelligence (Bloom: Create)
3. Integrate ICMS with external systems: exchanges, exchanges, ERP, BI tools (Bloom: Analyze)

**Prerequisites:** C13.1.1, C13.1.2, C13.2.1

**Why This Matters:**
The ICMS (Indian Carbon Market System) is the central nervous system of CCTS. Every CCC issuance, transfer, retirement, and surrender passes through it. Mastering ICMS operations and building analytics on top of its data is essential for compliance teams, traders, and platform operators.

**Core Concept: ICMS as the Single Source of Truth — Registry as Platform**

### 13.3.1.1 ICMS Account Hierarchy & Permissions

**Account Hierarchy:**
```
ICMS Root
├── Obligated Entity (OE) Accounts
│   ├── Compliance Sub-Account (surrender-only)
│   ├── Holding Sub-Account (surplus banking)
│   └── Transaction Sub-Account (trading)
├── Voluntary Accounts
│   ├── Corporate Voluntary (BRSR, ESG)
│   ├── Individual Voluntary (retail)
│   └── NGO/Institutional
├── Project Developer Accounts
│   ├── Issuance Receipt Wallet
│   ├── Project-Specific Sub-Wallets (per project)
│   └── Bridge-Out Wallet (for international transfer)
├── Exchange Clearing Accounts
│   ├── IEX Clearing
│   ├── PXIL Clearing
│   └── NSE/BSE Clearing (future)
├── Bridge/International Accounts
│   ├── DNA-Authorized (Art 6.2 export)
│   ├── ICC-Registered (Int'l import)
│   └── Bridge Operator Accounts (EtherTrack, etc.)
└── System Accounts
    ├── Buffer Pool (BEE-managed)
    ├── CCTS Reserve (CERC)
    └── System Reserve (ICMS Admin)
```

**Permission Matrix (RBAC):**
| Role | View Holdings | Initiate Transfer | Approve Transfer | Retire/Surrender | Manage Users | API Access |
|------|---------------|-------------------|------------------|------------------|--------------|------------|
| **Account Admin** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Compliance Officer** | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| **Trader** | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| **Analyst** | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Auditor** | ✅ | ❌ | ❌ | ❌ | ❌ | Read-only |
| **API Service Account** | ✅ | ✅ (via API) | ❌ | ✅ (via API) | ❌ | ✅ |

### 13.3.1.2 CCC Lifecycle Operations — API-First Design

**CCC State Machine:**
```
DRAFT → ISSUED → ACTIVE → TRANSFERRED → RETIRED / SURRENDERED / CANCELLED
                    ↓
              BRIDGE_OUT (Export) / BRIDGE_IN (Import)
```

**API-First Operations (ICMS v2.0+):**
| Operation | HTTP Method | Endpoint | Idempotency Key | Async? |
|-----------|-------------|----------|-----------------|--------|
| **Issue CCCs** | POST | `/api/v1/credits/issue` | Required | Yes (async) |
| **Transfer** | POST | `/api/v1/credits/transfer` | Required | Yes (async, DvP) |
| **Retire** | POST | `/api/v1/credits/retire` | Required | Yes (async) |
| **Surrender** | POST | `/api/v1/credits/surrender` | Required | Yes (async) |
| **Cancel** | POST | `/api/v1/credits/cancel` | Required | Admin only |
| **Balance Query** | GET | `/api/v1/accounts/{id}/balances` | N/A | No |
| **Transaction History** | GET | `/api/v1/accounts/{id}/transactions` | N/A | No |
| **Webhook Registration** | POST | `/api/v1/webhooks` | N/A | No |

**Idempotency Design:**
```json
{
  "idempotency_key": "txn-2025-01-15-abc123",
  "operation": "transfer",
  "from_account": "OE-ACC-123",
  "to_account": "HOLD-456",
  "credits": [
    {"serial_range": "CCC-2024-000001-010000", "quantity": 10000}
  ]
}
```
- Server stores `idempotency_key` + result for 90 days
- Duplicate key → returns original response (no double-execution)
- Client retries safely on network timeout

### 13.3.1.2 Data Analytics Pipeline — From Registry to Intelligence

**Data Flow Architecture:**
```
ICMS Event Stream (Kafka/Pulsar)
    │
    ├── CDC (Change Data Capture) → PostgreSQL (Operational DB)
    │
    ├── Stream Processor (Flink/Spark Streaming)
    │   ├── Real-time Aggregations (balances, flows, velocities)
    │   ├── Anomaly Detection (unusual transfers, frozen credits)
    │   └── Regulatory Calculations (compliance position, deficit/surplus)
    │
    ├── Data Lake (S3/ADLS — Parquet, partitioned by date/account)
    │   ├── Raw Events (immutable, append-only)
    │   ├── Aggregated Views (daily, vintage, project, account)
    │   └── Audit Trail (immutable, tamper-evident)
    │
    └── Serving Layer (ClickHouse/Druid/Trino)
        ├── Dashboards (Grafana/Superset)
        ├── API Gateway (REST/GraphQL)
        └── ML Feature Store (for ML models)
```

**Key Analytical Views (Materialized):**
| View | Grain | Refresh | Use Case |
|--------|-------|---------|----------|
| **Account Balance** | Account × Vintage × Methodology | Real-time | Portfolio mgmt, compliance check |
| **Project Performance** | Project × Vintage × Verification Cycle | Post-verification | Issuance tracking, yield analysis |
| **Market Flow** | From_Account × To_Account × Vintage × Hour | Hourly | Trading analysis, liquidity |
| **Compliance Position** | OE × FY × Vintage | Daily (post-surrender) | Compliance monitoring |
| **Price Discovery** | Exchange × Vintage × Methodology × Hour | 15-min | Trading, valuation |
| **Bridge Flow** | Bridge × Direction × Vintage × Day | 15-min | Cross-border monitoring |

### 13.3.1.3 Professional Judgement Points
- **API-first:** All operations via API; portal as fallback — enables automation
- **Idempotency keys:** Mandatory for all mutations; prevents double-spend on retry
- **Event sourcing:** Immutable event log = audit trail + replay capability
- **Versioned schemas:** Avro/Protobuf with schema registry; backward compatibility
- **Data residency:** ICMS data in India (MeitY mandate); plan DR accordingly

### 13.3.1.3 Practical Exercise: ICMS Operations Design
*Scenario:* Design the ICMS integration for a multi-registry trading desk managing 500k+ CCCs across Verra, GS, ICMS, and CCTS.
*Tasks:*
1. Design account structure (sub-accounts, roles, API keys)
2. Define webhook event handlers (issuance, transfer, retirement, freeze)
3. Design reconciliation job (daily, batch-level, auto-resolve timing diffs)
4. Define API contract for external bridge operators (EtherTrack, etc.)
*Time:* 45 min
*Deliverable:* ICMS integration spec (OpenAPI spec snippet + event schema + reconciliation logic)
*Rubric:* API design (40%), event handling (30%), reconciliation logic (30%)

**Knowledge Check:**
1. Why is idempotency key mandatory for all mutating operations?
2. What is the difference between "Retired" and "Surrendered" state?
3. How does ICMS handle a blockchain reorg that reverses a bridge mint?
4. What data retention policy applies to ICMS transaction logs?

**Sources:**
1. ICMS Technical Specification (BEE, 2024)
2. CERC — Registry Technical Standards
3. Verra/GS/ICMS API Specifications
3. ISO 20022 — Securities Reconciliation
4. EtherTrack Bridge Protocol Spec (Internal)

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC (ICMS API evolving) | Regulatory Review: Quarterly*

---

### Lesson 13.3.2: Market Analytics & Price Discovery
**Lesson Code:** C13.3.2
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** india_ether_track

**Learning Objectives:**
1. Build market data pipelines for CCC price discovery, volatility, and liquidity (Bloom: Create)
2. Design analytics for compliance tracking, portfolio optimization, and regulatory reporting (Bloom: Create)
3. Evaluate market structure: concentration, price formation, arbitrage (Bloom: Analyze)

**Prerequisites:** C13.1.1, C13.1.3, C13.2.1

**Why This Matters:**
The CCTS market is nascent but growing fast. Price discovery, liquidity analysis, and arbitrage detection require robust market data infrastructure. This lesson teaches you to build the analytics layer that turns raw trade data into actionable market intelligence.

**Core Concept: Market Data as Strategic Asset — Not Just Compliance Byproduct**

### 13.3.2.1 Market Data Pipeline — From Trade to Insight

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

### 13.3.2.2 Price Discovery & Index Construction

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

### 13.3.2.2 Market Analytics — From Data to Decisions

**Key Analytical Models:**
| Model | Inputs | Output | Use Case |
|--------|--------|----------|----------|
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

### 13.3.2.3 Professional Judgement Points
- **Data quality > Quantity:** 100 clean trades > 10,000 noisy ones
- **Vintage ≠ Age:** 2023 vintage in 2025 ≠ 2022 vintage in 2024 (different compliance eligibility)
- **Liquidity ≠ Volume:** 100k tCO2e traded once vs 10k traded daily — different liquidity
- **Arb detection:** Cross-exchange arb = market inefficiency; act fast, report to exchange
- **Regulatory lag:** Market data leads regulation; build adaptive models

### 13.3.2.3 Practical Exercise: Market Analytics Dashboard
*Scenario:* Build a CCTS market analytics dashboard for a trading desk managing 200k CCCs/month across IEX, PXIL, and bilateral.
*Tasks:*
1. Design data ingestion pipeline (sources, normalization, latency targets)
2. Define 5 core KPIs with alert thresholds
3. Design vintage curve construction + confidence intervals
3. Design arbitrage detection rules (cross-exchange, cross-vintage, cross-standard)
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
2. IEX/PXIL — Market Data API Specs
3. Verra/GS/ICMS — Trade Data Feeds
4. ICVCM — Market Integrity Guidelines
4. CERC — Position Limit & Surveillance Regulations
5. IOSCO — Principles for Financial Benchmarks

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC (Market data evolving) | Regulatory Review: Quarterly*