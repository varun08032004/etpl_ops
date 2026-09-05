# C15: EtherTrack Platform & Workflows
## Module 15.3: Monitoring → Issuance → Settlement (3 lessons × 40min = 2h)

### Lesson 15.3.1: Monitoring → Verification → Issuance Pipeline
**Lesson Code:** C15.3.1
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** india_ether_track

**Learning Objectives:**
1. Build the automated pipeline: monitoring data → verification → issuance (Bloom: Create)
2. Handle data quality, gaps, and verification scheduling (Bloom: Apply)
3. Implement issuance automation: serial allocation, vintage management, registry deposit (Bloom: Create)

**Prerequisites:** C15.1.1, C06.2.1, C08.3.1, C15.2.1

**Why This Matters:**
The monitoring-to-issuance pipeline is the revenue engine of the carbon platform. Every delay, error, or manual step costs money and credibility. Automating this pipeline end-to-end — from sensor data to credited account — is the difference between a platform that scales and one that stalls.

**Core Concept: Pipeline = Data → Validation → Verification → Issuance = Revenue**

### 15.3.1.1 Pipeline Architecture — End-to-End Flow

**Pipeline Stages:**
```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  MONITORING  │───▶│  VALIDATION  │───▶│  VERIFICATION│───▶│  ISSUANCE    │───▶│  NOTIFICATION │
│   DATA IN    │    │   & QC       │    │  SCHEDULING  │    │  & REGISTRY  │    │  & REPORTING  │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
     │                  │                 │                  │                  │
  Raw Data          QC Rules           VVB                Registry          Webhook/
  (Meters, SCADA,   Schema, Range,      Scheduling,        Issuance,        Email,
   IoT, Manual)      Gaps, Outliers     Assignment,        Serials,         Webhook,
  Reports)          Imputation         Report Review      Deposit          API, SMS
```

**Pipeline SLA Targets:**
| Stage | Input → Output | SLA | Error Budget |
|---------|----------------|-----|--------------|
| **Ingestion → Validation** | Raw → Cleaned | < 5 min | 99.9% < 5 min |
| **Validation → Verification Queue** | Clean → Scheduled | < 1 hr | 99.9% |
| **Verification → Issuance** | Verified ERs → Credits | < 48h (post-VVB) | 99% < 24h |
| **Issuance → Notification** | Credits → User | < 5 min | 99.9% < 1 min |

### 15.3.1.1 Monitoring Data Ingestion — Multi-Source, Multi-Protocol

**Supported Sources & Protocols:**
| Source | Protocol | Frequency | Typical Payload | Quality Flags |
|----------|----------|-----------|-----------------|---------------|
| **Smart Meters / SCADA** | Modbus, MQTT, OPC-UA | 15-min / 1-hr | kWh, kW, V, A, PF, Hz | `metered`, `estimated`, `gap` |
| **Weather Stations** | MQTT, HTTP | 15-min | Temp, irradiance, wind, humidity | `measured`, `interpolated` |
| **Satellite/Drone** | API (Planet, Sentinel) | Daily/Weekly | NDVI, biomass, canopy height | `measured`, `cloud_mask` |
| **Manual Entry** | Web Form / Mobile App | Event-driven | Fuel logs, fuel receipts, activity logs | `manual`, `receipt_based` |
| **Lab Results** | Email / SFTP / API | Per sample | GCV, NCV, C%, H%, moisture, ash | `lab_certified` |
| **Financial/Contract** | ERP/Accounting API | Monthly | PPA rate, REC price, fuel cost | `contracted`, `spot` |

**Ingestion Pipeline (Kafka → Flink → TimescaleDB):**
```
Source → Protocol Adapter → Kafka (raw) → Flink Job (Validation/Enrichment) → TimescaleDB (hypertable)
                                                                    ↓
                              PostgreSQL (metadata, configs)
                              ↓
                        ClickHouse (analytics)
```

**Schema Enforcement at Ingestion:**
```protobuf
message MonitoringReading {
  string source_id = 1;           // e.g., "METER-SOLAR-001"
  int64 timestamp_ms = 2;         // UTC ms since epoch
  map<string, double> metrics = 3; // {"generation_kwh": 1250.5, "irradiance": 850.3}
  map<string, string> tags = 4;   // {"meter_id": "MTR-001", "location": "plant_a"}
  QualityFlags quality = 5;       // bitmask: MEASURED=1, ESTIMATED=2, GAP_FILLED=4
  string source_system = 6;       // "SCADA", "MANUAL", "SATELLITE"
  int64 ingestion_ts = 7;         // ingestion timestamp
}
```

### 15.3.1.2 Data Quality & Gap Handling — The Trust Layer

**Quality Dimensions & Gates:**
| Dimension | Check | Action on Fail |
|-----------|-------|----------------|
| **Completeness** | % non-null required fields | Reject if < 99% |
| **Validity** | Range, enum, format, cross-field | Quarantine + alert |
| **Consistency** | Cross-source (meter vs SCADA vs bill) | Flag discrepancy > 2% |
| **Timeliness** | Latency (event_ts → ingestion_ts) | Alert if > 15 min |
| **Uniqueness** | Duplicate (source_id, timestamp) | Dedup + alert |

**Gap Handling Strategies:**
| Gap Type | Detection | Strategy | Config |
|----------|-----------|----------|--------|
| **Short Gap (< 1hr)** | Timestamp gap | Linear interpolation | Max 4h |
| **Medium Gap (1-24h)** | Gap > 1h | Seasonal/weekday profile + noise | Max 24h |
| **Long Gap (> 24h)** | Gap > 24h | Flag for manual review; use proxy (satellite, neighbor) | Flag + alert |
| **Meter Swap/Replacement** | Serial number change | Auto-detect via serial change; link old→new | Require calibration cert |

**Imputation Audit Trail:**
```json
{
  "original": null,
  "imputed_value": 1250.5,
  "method": "seasonal_weekday_avg",
  "reference_window_days": 28,
  "confidence": 0.92,
  "imputed_at": "2025-01-15T10:30:00Z",
  "imputed_by": "pipeline.imputer.v3"
}
```

### 15.3.1.2 Verification Scheduling & Workflow Automation

**Verification Trigger Logic:**
```python
class VerificationScheduler:
    def schedule_verification(project):
        # Rule: Annual for RE; Bi-annual for Forestry; Quarterly for Industrial
        freq = project.methodology.verification_frequency
        last_ver = project.last_verification_date
        next_due = last_ver + freq
        
        # Buffer: schedule 60 days before due
        schedule_date = next_due - timedelta(days=60)
        
        # Auto-assign VVB based on: sector, region, capacity, accreditation
        vvb = self.match_vvb(project)
        
        return VerificationSchedule(
            project_id=project.id,
            scheduled_date=schedule_date,
            vvb_id=vvb.id,
            vintage=next_vintage,
            status="SCHEDULED"
        )
```

**Verification Workflow Automation:**
```
VERIFICATION DUE (T-60 days)
    ↓
VVB ASSIGNED (auto-matched)
    ↓
VVB ACCEPTS/DECLINES (48h SLA)
    ↓
SITE VISIT SCHEDULED (T-30 to T-14)
    ↓
MR SUBMITTED (by proponent, T-7)
    ↓
VVB REVIEW (T-7 to T+14)
    ├── Document review
    ├── Data audit (sample recalc)
    ├── Site visit (if required)
    └── Findings (CAR/CL/OBS)
    ↓
FINDINGS RESOLUTION (T+14 to T+30)
    ↓
VERIFICATION OPINION ISSUED
    ↓
ISSUANCE TRIGGERED (auto)
```

**VVB Matching Algorithm:**
```python
def match_vvb(project):
    candidates = VVB.objects.filter(
        accredited_for=project.methodology,
        sector_experience=project.sector,
        region_coverage__contains=project.region,
        capacity_available__gte=project.estimated_ers,
        status="ACTIVE"
    ).annotate(
        score=(
            Case(When(accredited_for=project.methodology, then=30)) +
            Case(When(sector_experience=project.sector, then=20)) +
            Case(When(region_coverage__contains=project.region, then=15)) +
            Case(When(capacity__gte=project.estimated_ers, then=10)) +
            Case(When(avg_turnaround_days__lte=30, then=10)) +
            Case(When(rating__gte=4.5, then=5))
        )
    ).order_by('-score')
    return candidates.first()
```

### 15.3.1.3 Issuance Automation — From Verification to Registry

**Issuance Trigger Conditions:**
```python
def can_issue_credits(project):
    conditions = [
        Check("verification_opinion_positive", project.latest_verification.opinion == "POSITIVE"),
        Check("findings_resolved", project.open_findings == 0),
        Check("monitoring_period_closed", project.current_monitoring_period.end < now()),
        Check("er_calculation_verified", project.latest_verification.er_quantity == project.calculated_ers),
        Check("vvb_approval", project.latest_verification.vvb_approved),
        Check("standard_body_approved", project.standard_body_status == "APPROVED"),
    )
    return all(c.passed for c in conditions)
```

**Issuance Pipeline (Automated):**
```
VERIFICATION OPINION: POSITIVE
       ↓
ISSUANCE REQUEST CREATED (auto)
    ├── Project ID, Vintage, Quantity, Serial Range Requested
    ├── Verification Report Attached
    └── Standard Body Approval Status: APPROVED
         ↓
REGISTRY ISSUANCE REQUEST (API)
    ├── Project ID, Vintage, Quantity, Serial Range Start
    ├── Verification Report ID
    └── Standard Body Approval Ref
         ↓
REGISTRY PROCESSING (async)
    ├── Validates: project active, vintage valid, quantity ≤ verified ERs
    ├── Allocates Serial Numbers: PREFIX-PROJECT-VINTAGE-START-END
    ├── Creates Credit Batches in Project Account
    ├── Updates Project Account Balance
    ↓
WEBHOOK: issuance.completed
    ├── Project ID, Issuance ID, Serial Ranges, Quantities
    ├── Credit Batches Created (batch_id, serial_range, qty, vintage, status)
    ↓
NOTIFICATIONS (webhook, email, in-app)
    → Proponent, VVB, Standard Body, Registry
```

**Serial Number Allocation Strategy:**
```python
def allocate_serials(project, vintage, quantity, methodology):
    # Format: PREFIX-PROJECTID-VINTAGE-SEQSTART-SEQEND
    # Example: VCU-1234-2024-000001-180000
    prefix = methodology.serial_prefix  # "VCU" / "GS" / "CCC"
    project_code = project.registry_code  # e.g., "1234"
    vintage_str = str(vintage)
    
    last_seq = SerialAllocation.objects.filter(
        project=project, vintage=vintage
    ).aggregate(Max('sequence_end'))['sequence_end__max'] or 0
    
    start = last_seq + 1
    end = start + quantity - 1
    
    SerialAllocation.objects.create(
        project=project, vintage=vintage,
        sequence_start=start, sequence_end=end,
        quantity=quantity, methodology=methodology
    )
    return f"{prefix}-{project_code}-{vintage_str}-{start:06d}-{end:06d}"
```

### 15.3.1.3 Professional Judgement Points
- **Idempotency is king:** Every issuance request must be idempotent (idempotency key = project_id + vintage + monitoring_period)
- **Serial allocation is sacred:** Never reuse serials; gaps are fine, overlaps are fatal
- **Vintage integrity:** Credits must carry correct vintage; vintage ≠ issuance year
- **Audit trail:** Every serial allocation logged with user, timestamp, request hash
- **Rollback plan:** If issuance fails post-deposit, have reversal procedure (rare but needed)

### 15.3.1.4 Practical Exercise: Pipeline Failure Recovery
*Scenario:* The issuance pipeline fails at "Registry Deposit" step for a 50 MW wind project (180k VCUs). Registry returns "SERIAL_RANGE_CONFLICT". Pipeline retries 3x, then dead-letters.
*Tasks:*
1. Diagnose root cause (serial overlap, duplicate request, registry bug)
2. Design recovery procedure (manual intervention steps)
3. Design prevention (idempotency, pre-flight checks, circuit breaker)
4. Design alerting & runbook for on-call
*Time:* 40 min
*Deliverable:* Incident response runbook + prevention checklist
*Time:* 35 min
*Rubric:* Root cause analysis (40%), recovery procedure (30%), prevention design (30%)

**Knowledge Check:**
1. What is the idempotency key for an issuance request? (project_id + vintage + monitoring_period)
2. Why must serial allocation be gap-tolerant but overlap-intolerant?
3. What happens if registry issues credits but webhook delivery fails? (Reconciliation job reconciles)
4. What is "vintage integrity" and why does it matter?

**Sources:**
1. Verra Registry API v2.0 — Issuance Endpoint
2. Gold Standard Registry API — Credit Issuance
3. ICMS (CCTS) — Issuance API Spec
4. Verra Registry API v2.0 — Serial Allocation
5. BEE CCTS — CCC Issuance Process

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC (Pipeline tech evolving) | Regulatory Review: Quarterly*

---

### Lesson 15.3.2: Settlement, Reconciliation & Financial Operations
**Lesson Code:** C15.3.2
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** professional

**Learning Objectives:**
1. Build the settlement engine: DvP, escrow, multi-currency, multi-registry (Bloom: Create)
2. Implement reconciliation: daily, exception-driven, audit-ready (Bloom: Apply)
3. Design financial operations: invoicing, payouts, tax, audit trail (Bloom: Create)

**Prerequisites:** C15.3.1, C14.2.1, C14.2.2

**Why This Matters:**
Settlement is where carbon credits become cash flow. A robust settlement engine ensures sellers get paid, buyers get credits, and the platform stays compliant. Reconciliation is the control that catches errors before they become losses. Financial operations turn transactions into auditable records.

**Core Concept: Settlement = Cash + Credits + Certainty = Trust**

### 15.3.2.1 Settlement Engine — DvP, Multi-Currency, Multi-Registry

**Settlement Models:**
| Model | Description | Use Case | Settlement |
|--------|-------------|----------|------------|
| **DvP (Delivery vs Payment)** | Atomic: Credit transfer ⇔ Funds transfer | Spot trades, OTC | T+1 |
| **Pre-Payment / Forward** | Buyer pays upfront; credits delivered later | Project finance, pre-sale | Payment T+0; Delivery T+future |
| **Tolling / Offtake** | Project delivers; Buyer markets; Rev share | Project finance | Per delivery |
| **Streaming / Royalty** | Upfront payment for % of future credits | Expansion capex | Per issuance |
| **Carbon-Linked Loan** | Loan repaid in credits | Early stage; no debt capacity | Per issuance |

**DvP Settlement Engine (Atomic):**
```python
class SettlementEngine:
    async def settle_dvp(self, transfer_request: TransferRequest) -> SettlementResult:
        """
        Atomic: Registry Transfer ⇔ Funds Transfer
        Either both succeed or both rollback.
        """
        async with self.distributed_transaction() as tx:
            # 1. Reserve credits (freeze in registry)
            freeze = await self.registry.freeze(
                account=transfer_request.from_account,
                serial_ranges=transfer_request.serial_ranges,
                reason=f"DvP settlement for trade {trade_id}"
            )
            
            # 2. Initiate payment (escrow or direct)
            payment = await self.payment_gateway.initiate(
                amount=trade.price * trade.quantity,
                currency=trade.currency,
                from_account=trade.buyer_account,
                to_account=trade.seller_account,
                idempotency_key=f"trade-{trade_id}-payment"
            )
            
            # 3. Wait for payment confirmation (async callback or polling)
            payment_result = await payment.wait_for_completion(timeout=300)
            
            if not payment_result.success:
                await self.registry.unfreeze(freeze.freeze_id)
                raise SettlementError("Payment failed")
            
            # 4. Execute registry transfer (atomic with payment)
            transfer = await self.registry.transfer(
                freeze_id=freeze.freeze_id,
                to_account=trade.buyer_account,
                serial_ranges=trade.serial_ranges
            )
            
            # 4. Confirm & Record
            await tx.commit()
            return SettlementResult(
                trade_id=trade_id,
                settlement_id=uuid4(),
                credits_transferred=trade.quantity,
                funds_transferred=trade.price * trade.quantity,
                settlement_time=datetime.utcnow(),
                registry_txn_id=transfer.txn_id,
                payment_txn_id=payment_result.txn_id
            )
```

### 15.3.2.2 Multi-Currency & Multi-Registry Settlement

**Multi-Currency Settlement:**
| Currency | Payment Rail | Settlement Time | FX Handling |
|----------|--------------|-----------------|-------------|
| **INR** | IMPS/RTGS/UPI (India) | T+0 / T+1 | RBI reference rate |
| **USD** | SWIFT / Fedwire / RTP | T+1 | Bloomberg/Refinitiv spot + spread |
| **EUR** | SEPA Instant / TARGET2 | T+0/T+1 | ECB ref rate |
| **Stablecoin (USDC/USDT)** | Polygon/Ethereum/Mainnet | Near-instant | On-chain oracle (Chainlink) |

**FX Risk Management:**
- **Pre-agreed FX Rate:** Lock at trade execution (spot + agreed spread)
- **FX Buffer:** 1-2% buffer on carbon price for FX volatility
- **Settlement Currency:** Default INR for domestic; USD for cross-border

### 15.3.2.2 Multi-Registry Settlement — The Bridge Layer

**Cross-Registry Settlement (Bridge-Aware):**
```python
async def settle_cross_registry(trade):
    # 1. Determine if cross-registry bridge needed
    if trade.seller_registry != trade.buyer_registry:
        return await settle_via_bridge(trade)
    
    # 2. Same registry → direct DvP
    return await settle_direct_dvp(trade)

async def settle_via_bridge(trade):
    # 1. Freeze in Source Registry
    freeze = await source_registry.freeze(
        account=trade.seller_account,
        serial_ranges=trade.serial_ranges,
        reason=f"Bridge transfer to {trade.buyer_registry}"
    )
    
    # 2. Mint in Destination Registry (Bridge Service)
    mint = await bridge_service.mint(
        freeze_id=freeze.freeze_id,
        dest_registry=trade.buyer_registry,
        dest_account=trade.buyer_account,
        serial_ranges=trade.serial_ranges
    )
    
    # 3. DvP: Payment ↔ Mint
    payment = await initiate_payment(trade)
    await payment.wait()
    
    # 4. Transfer in Dest Registry
    transfer = await dest_registry.transfer(
        from_account=bridge_service.bridge_account,
        to_account=trade.buyer_account,
        serial_ranges=trade.serial_ranges
    )
    
    # 5. Burn Source (Complete the Loop)
    await source_registry.burn(freeze.freeze_id, confirmation=mint.confirmation)
    
    return SettlementResult(...)
```

### 15.3.2.2 Reconciliation — The Daily Discipline

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
async def daily_reconciliation(account, registry):
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
        elif reg['quantity'] != loc['quantity']: 
            discrepancies.append({'type': 'QUANTITY_MISMATCH', 'diff': loc['quantity'] - reg['quantity']})
        elif reg['state'] != loc['state']: discrepancies.append({'type': 'STATE_MISMATCH', ...})
    
    # 5. CLASSIFY & AUTO-RESOLVE
    for d in discrepancies:
        if d['type'] in ['MISSING_IN_REGISTRY', 'MISSING_IN_LOCAL']:
            pending = await get_pending_transactions(account_id, d['key'])
            if pending:
                d['classification'] = 'TIMING'
                d['auto_resolve'] = True
            else:
                d['classification'] = 'UNEXPLAINED'
                d['auto_resolve'] = False
        elif d['type'] == 'QUANTITY_MISMATCH':
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

### 15.3.2.3 Financial Operations — Invoicing, Payouts, Tax, Audit

**Invoicing & Billing Automation:**
```python
class BillingEngine:
    async def generate_invoices(self, period: Period) -> List[Invoice]:
        # 1. Collect billable events
        events = await self.collect_billable_events(period)
        #   - Trade fees (buyer/seller)
        #   - Registry fees (issuance, transfer, retirement)
        #   - Bridge fees (cross-registry)
        #   - Verification fees (VVB pass-through)
        #   - Subscription/Platform fees
        
        # 2. Apply pricing rules (tiered, volume discounts, enterprise)
        # 3. Generate invoice (PDF + structured JSON)
        # 4. Send via email + portal + webhook
        # 5. Track payment status (Due, Paid, Overdue, Written-off)
```

**Payout Engine (Seller Payouts):**
```python
class PayoutEngine:
    async def process_payouts(self, period: Period) -> PayoutBatch:
        # 1. Aggregate net receivables per seller (sales - fees - refunds)
        # 2. Validate: KYC complete, bank details verified, tax docs (GSTIN, PAN)
        # 3. Generate payout instructions (bank transfer / UPI / SWIFT)
        # 4. Batch payouts (daily/weekly per seller preference)
        # 5. Update ledger: Receivable → Cash
        # 6. Send remittance advice (email + portal)
```

**Tax Compliance (India Context):**
| Tax | Rate | Applicability | Compliance |
|-------|------|--------------|------------|
| **GST** | Exempt (Notification 12/2017) | Carbon credits | Confirm exemption certificate |
| **TCS (Sec 206C(1H))** | 1% on sale > ₹50L | Buyer deducts; Project collects | Form 26Q/27Q |
| **TDS (Sec 194O)** | 1% on e-commerce | Platform fees/commission | Form 26Q |
| **WHT (Foreign Buyer)** | 20% + surcharge or DTAA | Cross-border payments | Gross-up clause in ERPA |
| **FEMA/RBI** | Export of service | RBI reporting; AD Bank cert | Annual return |

**Audit Trail Requirements (Immutable):**
| Log Type | Retention | Storage | Access |
|----------|-----------|---------|--------|
| **Trade Logs** | 10 years | Immutable (append-only) | Audit, Legal |
| **Settlement Records** | 10 years | Immutable | Finance, Audit |
| **Tax Records** | 10 years (Income Tax Act) | Immutable | Tax Audit |
| **KYC/AML** | 5 years post-relationship | Encrypted | Compliance |
| **Communication** | 7 years | Immutable | Dispute resolution |

### 15.3.2.3 Professional Judgement Points
- **DvP is non-negotiable:** Atomic credit-payment swap or escrow
- **Reconciliation is not optional:** It's the control that catches everything else
- **Automate 95%:** Manual reconciliation doesn't scale; build the pipeline
- **Unresolved breaks = Risk:** Age breaks; escalate at 24h, 48h, 72h
- **Audit trail is everything:** Every break must have resolution evidence (not just "fixed")

### 15.3.2.3 Practical Exercise: Reconciliation Investigation
*Scenario:* Daily reconciliation for Trading Account TA-001 (Verra) shows:
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
**Time:** 30 min
**Rubric:** Classification accuracy (30%), investigation design (40%), resolution practicality (30%)

**Knowledge Check:**
1. What is the difference between "timing difference" and "failed transaction" in reconciliation?
2. Why is batch-level reconciliation superior to account-level?
3. When should you escalate a discrepancy to the standard body vs the registry?
4. What evidence is needed to prove a bridge discrepancy vs a registry discrepancy?

**Sources:**
1. Verra Registry — Reconciliation Guidelines
2. Gold Standard Registry — Dispute Resolution
3. BEE CCTS — ICMS Dispute Mechanism (2023)
4. ISO 20022 — Securities Reconciliation
5. EtherTrack Bridge Protocol — Reconciliation Spec
6. ISDA — Operational Reconciliation Best Practices

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC (Settlement tech evolving) | Regulatory Review: Quarterly*