# C15: EtherTrack Platform & Workflows
## Module 15.1: Platform Architecture & Data Flows (3 lessons × 40min = 2h)

### Lesson 15.1.1: Platform Architecture — Microservices, Event-Driven & Data Mesh
**Lesson Code:** C15.1.1
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** india_ether_track

**Learning Objectives:**
1. Describe the EtherTrack platform architecture: microservices, event-driven, data mesh (Bloom: Understand)
2. Map the core data flows: ingestion → processing → storage → serving (Bloom: Apply)
3. Evaluate architectural trade-offs: consistency vs availability, sync vs async (Bloom: Evaluate)

**Prerequisites:** C15.1.1 (Platform Overview), C08.3.1 (MRV Design)

**Why This Matters:**
EtherTrack is the central nervous system of the carbon academy and marketplace. Its architecture determines how reliably data flows, how fast insights are generated, and how well the platform scales. Understanding the architecture lets you design features that fit, debug issues faster, and make informed technology choices.

**Core Concept: Architecture as a Product — Design for Operability, Not Just Features**

### 15.1.1.1 High-Level Architecture — Microservices + Event-Driven + Data Mesh

**Logical Architecture:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER                                       │
│  Web App (React)  │  Mobile App (React Native)  │  Partner API (REST/GraphQL)│
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           API GATEWAY (Kong/Envoy)                           │
│  Auth (OAuth2/OIDC)  │  Rate Limit  │  Routing  │  Transformation  │  Cache │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
┌───────────────┐         ┌─────────────────┐         ┌─────────────────┐
│  CORE SERVICES │         │  PLATFORM SERVICES │         │  DATA SERVICES  │
├───────────────┤         ├─────────────────┤         ├─────────────────┤
│ • User Mgmt   │         │ • Course Engine  │         │ • PostgreSQL    │
│ • AuthZ/AuthN │         │ • Marketplace    │         │ • TimescaleDB   │
│ • Org/Team    │         │ • Registry Bridge│         │ • Redis         │
│ • Billing     │         │ • Settlement     │         │ • Kafka         │
│ • Notifications│        │ • Compliance     │         │ • S3/MinIO      │
└───────────────┘         └─────────────────┘         └─────────────────┘
        │                           │                           │
        └───────────────────────────┼───────────────────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         OBSERVABILITY & GOVERNANCE                          │
│  Metrics (Prometheus)  │  Logs (Loki/ELK)  │  Traces (Tempo/Jaeger)        │
│  Alerting (Alertmanager)  │  Audit Log (Immutable)  │  SLO/SLI Dashboards   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 15.1.1.2 Core Services — Responsibilities & Contracts

| Service | Responsibility | Key APIs | Data Stores | SLA |
|---------|---------------|----------|-------------|-----|
| **User Service** | AuthN/AuthZ, profiles, roles, SSO | `/auth/*`, `/users/*`, `/orgs/*` | PostgreSQL | 99.9% |
| **AuthZ Service** | RBAC, ABAC, resource policies | `/authz/*` | PostgreSQL + OPA | 99.9% |
| **Course Service** | Curriculum, lessons, progress, certs | `/courses/*`, `/progress/*` | PostgreSQL + ES | 99.9% |
| **Marketplace Service** | Listings, orders, settlements | `/market/*` | PostgreSQL + Kafka | 99.9% |
| **Registry Bridge** | Verra/GS/ICMS/ICMS sync | `/bridge/*` | Kafka + Redis | 99.5% |
| **Settlement Engine** | DvP, escrow, payouts | `/settlement/*` | PostgreSQL + Kafka | 99.9% |
| **Analytics Service** | Dashboards, reports, exports | `/analytics/*` | ClickHouse + Redis | 99.9% |
| **Notification Service** | Email, push, webhook, in-app | `/notif/*` | Redis + Kafka | 99.9% |

**Inter-Service Communication:**
- **Sync:** REST (OpenAPI 3.0) for queries/commands needing immediate consistency
- **Async:** Kafka (Avro schemas) for events, workflows, eventual consistency
- **Service Mesh:** Istio (mTLS, retries, timeouts, circuit breakers)

### 15.1.1.3 Data Mesh Principles — Domain-Oriented Ownership

**Data Domains & Ownership:**
| Domain | Owner Team | Data Products | Consumers |
|--------|------------|---------------|-----------|
| **User & Identity** | Platform Team | User profiles, roles, sessions | All services |
| **Course & Learning** | Education Team | Curriculum, progress, certificates | Learners, Admins |
| **Carbon Credits** | Carbon Team | Projects, credits, issuance, retirement | Marketplace, Registry Bridge |
| **Market Data** | Market Team | Trades, prices, order book, indices | Traders, Analytics |
| **Registry & Credits** | Registry Team | Accounts, balances, transfers, lifecycle | Compliance, Finance |
| **Financial** | Finance Team | Invoices, payouts, revenue recognition | Finance, Audit |
| **Compliance & Audit** | Compliance Team | Audit logs, verification records, regulatory reports | Auditors, Regulators |

**Data Contracts (Schema Registry):**
- All events/schemas in Confluent Schema Registry (Avro)
- Backward/forward compatibility enforced in CI/CD
- Schema evolution: ADD fields optional; REMOVE/RENAME require migration

### 15.1.1.4 Event-Driven Architecture — Kafka as Backbone

**Event Taxonomy:**
| Event Category | Topics (Examples) | Consumers |
|----------------|-------------------|-----------|
| **User Events** | `user.created`, `user.role_changed`, `org.created` | AuthZ, Notification, Analytics |
| **Course Events** | `course.published`, `lesson.completed`, `certificate.issued` | Progress, Certificate, Notification |
| **Market Events** | `credit.issued`, `credit.transferred`, `credit.retired`, `order.placed`, `trade.executed` | Marketplace, Settlement, Registry Bridge, Analytics |
| **Registry Events** | `credit.issued`, `credit.transferred`, `credit.retired`, `account.created` | Registry Bridge, Settlement, Compliance |
| **Financial Events** | `invoice.created`, `payment.received`, `payout.initiated` | Finance, Settlement |
| **Compliance Events** | `verification.completed`, `issuance.approved`, `retirement.recorded` | Compliance, Audit, Reporting |

**Event Contract (Avro Example):**
```json
{
  "type": "record",
  "name": "CreditTransferred",
  "namespace": "com.ethertrack.events",
  "fields": [
    {"name": "eventId", "type": "string"},
    {"name": "eventTime", "type": "long", "logicalType": "timestamp-millis"},
    {"name": "creditId", "type": "string"},
    {"name": "serialRange", "type": {"type": "record", "name": "SerialRange", "fields": [{"name": "start", "type": "string"}, {"name": "end", "type": "string"}]}},
    {"name": "vintage": "int"},
    {"name": "methodology": "string"},
    {"name": "standard": "string"},
    {"name": "fromAccount": "string"},
    {"name": "toAccount", "string"},
    {"name": "quantity": "long"},
    {"name": "price", "type": ["null", "double"]},
    {"name": "transactionId", "type": "string"}
  ]
}
```

### 15.1.1.5 Data Storage Strategy — Polyglot Persistence

| Data Type | Technology | Rationale |
|-----------|------------|-----------|
| **Transactional (ACID)** | PostgreSQL (Aurora) | Users, courses, orders, accounts, financial |
| **Time-Series** | TimescaleDB (PostgreSQL extension) | Metrics, meter readings, price ticks, sensor data |
| **Time-Series Analytics** | ClickHouse | Aggregations, OLAP, dashboards, ML features |
| **Event Streaming** | Apache Kafka (Confluent Cloud) | Event sourcing, audit log, async workflows |
| **Cache/Session** | Redis Cluster | Sessions, rate limits, caching, distributed locks |
| **Search/Log** | OpenSearch (OpenSearch) | Full-text search, log aggregation, audit trails |
| **Object Storage** | S3/MinIO | Documents, certificates, reports, media |
| **Graph** | Neo4j (optional) | Ownership graphs, supply chain, relationships |

### 15.1.1.5 Professional Judgement Points
- **Consistency vs Availability:** Financial data = strong consistency (PostgreSQL); Analytics = eventual OK (ClickHouse)
- **Schema Evolution:** Never break consumers; use schema registry + compatibility checks
- **Eventual Consistency Window:** Define max lag (e.g., <5s for credit balances); alert on breach
- **Data Ownership:** Each domain owns its data; no direct DB access across domains
- **Schema Registry:** Mandatory; Avro + compatibility checks in CI/CD

### 15.1.1.5 Practical Exercise: Architecture Decision Record (ADR)
*Scenario:* The Marketplace team wants to add a new "Carbon Futures" product requiring real-time margin calculations across 50k+ positions.
*Tasks:*
1. Identify which services need changes (Marketplace, Settlement, Analytics, Registry Bridge)
2. Design the event flow for real-time margin updates
3. Identify consistency boundaries (what must be strongly consistent vs eventually consistent)
4. Draft ADR template with: Context, Decision, Consequences, Alternatives Considered
*Time:* 40 min
*Deliverable:* ADR document (1-2 pages)
*Time:* 40 min
*Rubric:* Architectural reasoning (40%), trade-off clarity (30%), implementation feasibility (30%)

**Knowledge Check:**
1. Why use Kafka for events but REST for commands?
2. What is the "data mesh" and why does it matter at scale?
3. How do you handle schema evolution without breaking consumers?
4. When would you choose ClickHouse over PostgreSQL?

**Sources:**
1. Martin Fowler — Microservices Patterns
2. Confluent — Building Event-Driven Systems
3. Thoughtworks — Data Mesh Principles
4. Confluent — Schema Registry Best Practices
5. CNCF — Cloud Native Observability

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC (Architecture evolving) | Regulatory Review: Quarterly*

---

### Lesson 15.1.2: Data Flows — Ingestion, Processing & Serving
**Lesson Code:** C15.1.2
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** professional

**Learning Objectives:**
1. Trace end-to-end data flows: sources → ingestion → processing → storage → serving (Bloom: Understand)
2. Design idempotent, exactly-once processing pipelines (Bloom: Apply)
3. Build observability into data pipelines: lineage, quality, SLAs (Bloom: Create)

**Prerequisites:** C15.1.1

**Why This Matters:**
Data is the lifeblood of EtherTrack. If the pipeline breaks, the marketplace stalls, compliance reports fail, and trust erodes. This lesson teaches you to build pipelines that are reliable, observable, and maintainable — not just "working."

**Core Concept: Pipeline Reliability = Business Reliability**

### 15.1.2.1 End-to-End Data Flow — Source to Serving

**Major Data Flows:**
```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│   SOURCES   │────▶│  INGESTION   │────▶│  PROCESSING  │────▶│   STORAGE   │────▶│   SERVING   │
└─────────────┘     └──────────────┘     └──────────────┘     └─────────────┘     └──────────────┘
  • Registry APIs       • Kafka Connect      • Kafka Streams      • TimescaleDB      │  REST API
  • Exchange WebSocket  │   • Kafka          │   • Flink/KSQL     │  (TimescaleDB)  │  (REST/GraphQL)
  • Exchange REST       │   • Debezium CDC   │   • dbt/DBT        │  • ClickHouse    │  • GraphQL
  • ERP/Accounting      │   • Custom Workers │   • Spark (batch)  │  • PostgreSQL   │  • WebSocket
  • IoT/Sensors         │   • Schema Registry│   • dbt (transform)│  • Redis        │  • Webhook
  • Manual Upload       │   • Schema Registry│   • ML Features    │  • S3/MinIO     │  • Webhook
  • User Input (Web)    │   • Dead Letter Q  │   • ML Scoring     │  • PostgreSQL   │
└─────────────┘     └──────────────┘     └──────────────┘     └─────────────┘     └──────────────┘
```

**Key Data Flows (Critical Paths):**

| Flow | Source | Throughput | Latency SLA | Criticality |
|------|--------|------------|-------------|-------------|
| **Market Trade → Settlement** | Exchange WS → Kafka → Settlement Svc → Registry | ~500 trades/min | < 5 sec (T+1) | P0 |
| **Registry Issuance → Marketplace** | Registry Webhook → Kafka → Marketplace Service | ~100 credits/min | < 10 sec | P0 |
| **Meter Data → Emissions Calc** | IoT Gateway → Kafka → Flink → TimescaleDB | 10k msgs/sec | < 30 sec | P0 |
| **Verification → Issuance** | VVB Portal → Kafka → Issuance Worker → Registry | ~50/day | < 5 min | P0 |
| **Retirement → Claim** | User Action → API → Retirement Svc → Registry | ~100/day | < 5 sec | P0 |
| **Analytics ETL** | PostgreSQL → dbt → ClickHouse | Hourly/Daily | < 1 hr | P1 |

### 15.1.2.2 Ingestion Layer — Reliable, Scalable, Observable

**Ingestion Patterns:**
| Source | Protocol | Ingestion Method | Throughput | Ordering |
|--------|----------|------------------|------------|----------|
| **Exchange WS** | WebSocket | Kafka Connect (WS Source) | 10k msg/s | Per partition |
| **Exchange REST** | HTTPS | Kafka Connect HTTP Source | 1k req/s | Per symbol |
| **Registry Webhook** | HTTPS | API Gateway → Kafka | 10k req/s | Per account |
| **IoT/Sensor** | MQTT/CoAP | Kafka Connect MQTT | 100k msgs/s | Per device |
| **ERP/Accounting** | SFTP/REST | Airbyte/Fivetran | Batch (hourly) | N/A |
| **Manual Upload** | Web Upload | API → Kafka | Ad-hoc | Per upload |

**Quality Gates at Ingestion:**
```yaml
# Ingestion Pipeline Quality Gates
validations:
  - schema_validation: strict (Avro schema registry)
  - required_fields: [event_id, timestamp, source, payload]
  - semantic_checks:
      - price > 0
      - quantity > 0
      - vintage in valid_range
      - serial_range_format
  - deduplication: event_id unique within 24h window
  - enrichment:
      - account_lookup (cache)
      - methodology_resolution
      - vintage_validation
  - dead_letter_queue: for failed validations (retry 3x, then DLQ)
```

**Dead Letter Queue (DLQ) Strategy:**
- Max 3 retries with exponential backoff
- DLQ partitioned by error type (schema, semantic, downstream)
- Alert on DLQ depth > 100
- Manual replay tool with replay-id tracking

### 15.1.2.2 Processing Layer — Stream & Batch

**Stream Processing (Flink/KSQL):**
```sql
-- Real-time Carbon Position Aggregation
CREATE TABLE carbon_position AS
SELECT 
  account_id,
  vintage,
  methodology,
  SUM(CASE WHEN event_type = 'ISSUED' THEN quantity
           WHEN event_type = 'TRANSFER_IN' THEN quantity
           WHEN event_type = 'TRANSFER_OUT' THEN -quantity
           WHEN event_type = 'RETIRED' THEN -quantity
           WHEN event_type = 'SURRENDERED' THEN -quantity
           ELSE 0 END) AS net_quantity
FROM credit_events
GROUP BY account_id, vintage, methodology
EMIT CHANGES;
```

**Batch Processing (Spark/dbt):**
- **Daily:** Position snapshots, P&L, risk metrics
- **Hourly:** Market indices, vintage curves, liquidity scores
- **Daily:** Reconciliation reports, compliance checks
- **Weekly:** Model retraining, feature store refresh

**Exactly-Once Semantics:**
- Kafka transactions (producer: `enable.idempotence=true`, `transactional.id`)
- Exactly-once sinks: Transactional DB writes (PostgreSQL) + Kafka commit
- Idempotent consumers: `event_id` dedup window (24h)

### 15.1.2.3 Data Quality & Observability — The Reliability Stack

**Data Quality Dimensions (DQ Dimensions):**
| Dimension | Metric | Target | Alert Threshold |
|-----------|--------|--------|-----------------|
| **Completeness** | % non-null required fields | 100% | < 99.9% |
| **Validity** | % records passing schema | 100% | < 99.99% |
| **Accuracy** | Reconciliation error rate | 0% | > 0.1% |
| **Timeliness** | End-to-end latency (p99) | < 30 sec | > 60 sec |
| **Consistency** | Cross-system reconciliation breaks | 0 | > 0 |
| **Uniqueness** | Duplicate event_id rate | 0 | > 0 |

**Data Lineage (OpenLineage / Atlas):**
- Track: Source → Transformations → Destination
- Column-level lineage for regulatory fields (price, quantity, vintage)
- Impact analysis: "What breaks if I change this column?"

**Pipeline Observability (Golden Signals + Data):**
| Signal | Metric | Target |
|--------|--------|--------|
| **Latency** | p50/p95/p99 e2e latency | p99 < 30s |
| **Traffic** | Events/sec (ingest, process, serve) | Baseline ± 20% |
| **Errors** | Error rate (5xx, validation failures) | < 0.1% |
| **Saturation** | Kafka lag, CPU, memory, disk | < 70% |
| **Data Freshness** | Max data age per table | < 5 min (operational) |

### 15.1.2.3 Professional Judgement Points
- **Exactly-once > At-least-once:** For financial data, exactly-once is worth the complexity
- **Schema first:** Never send data without a registered schema
- **Backpressure is a feature:** Apply backpressure at source; don't let queues explode
- **Test failure modes:** Kill a broker, kill a consumer, corrupt a message — verify behavior
- **Data contracts are contracts:** Treat schemas like APIs — version, deprecate, communicate

### 15.1.2.3 Practical Exercise: Pipeline Design Review
*Scenario:* Design the ingestion pipeline for a new "Carbon Insurance" product requiring real-time premium calculation based on project risk scores updated daily from 5 external APIs.
*Tasks:*
1. Design ingestion topology (sources, protocols, frequency)
2. Define quality gates and DLQ handling
3. Design exactly-once processing for premium calculation
3. Define SLOs, alerts, and runbook for on-call
*Time:* 45 min
*Deliverable:* Pipeline architecture diagram + quality gate config + runbook outline
*Time:* 45 min
*Rubric:* Architecture soundness (40%), quality gates (30%), operational readiness (30%)

**Knowledge Check:**
1. Why use Kafka transactions for exactly-once?
2. How do you handle late-arriving data in windowed aggregations?
3. What is the "idempotency key" pattern and why does it matter?
4. When would you choose batch over stream processing?

**Sources:**
1. Confluent — Building Data Pipelines with Kafka
2. Martin Kleppmann — Designing Data-Intensive Applications
3. Google — Data Quality: The Hidden Ingredient
4. Uber — Building Reliable Data Pipelines
5. Netflix — Data Quality at Scale

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC (Pipeline tech evolving) | Regulatory Review: Quarterly*

---

### Lesson 15.1.3: Serving Layer — APIs, Caching, Real-Time & Governance
**Lesson Code:** C15.1.3
**Duration:** 40 minutes
**Lesson Type:** document
**Tier:** professional

**Learning Objectives:**
1. Design the serving layer: REST, GraphQL, WebSocket, Webhooks (Bloom: Create)
2. Implement caching, rate limiting, and API governance (Bloom: Apply)
3. Implement data governance: access control, lineage, privacy, retention (Bloom: Analyze)

**Prerequisites:** C15.1.1, C15.1.2

**Why This Matters:**
The serving layer is the face of your platform — every user, partner, and internal system touches it. Performance, reliability, and security here define the user experience and regulatory posture. This lesson teaches you to build a serving layer that's fast, safe, and governable.

**Core Concept: Serving Layer = Contract + Performance + Trust**

### 15.1.3.1 API Layer — REST, GraphQL, WebSocket, Webhook

**API Gateway (Kong/Envoy) — The Front Door:**
| Capability | Implementation |
|------------|----------------|
| **AuthN/AuthZ** | OAuth2/OIDC (Keycloak/Auth0); JWT validation; mTLS for service-to-service |
| **Rate Limiting** | Token bucket (per client, per endpoint); Redis-backed |
| **Routing** | Path/Host/Header based; canary/blue-green via headers |
| **Transformation** | Request/response rewrite; protocol translation (gRPC ↔ REST) |
| **Caching** | Response caching (Vary headers); cache keys from query params |
| **Observability** | Request/Response logging; latency histograms; distributed tracing (W3C TraceContext) |

**API Styles — When to Use What:**
| Style | Best For | EtherTrack Usage |
|-------|----------|------------------|
| **REST (OpenAPI 3.0)** | CRUD, resources, broad compatibility | Core CRUD: Users, Courses, Credits, Orders |
| **GraphQL** | Flexible queries, nested data, mobile | Dashboard, Portfolio, Analytics |
| **WebSocket** | Real-time pushes, live updates | Market data, order book, notifications |
| **Webhook** | Async notifications, external integrations | Registry callbacks, settlement confirmations |
| **gRPC** | Service-to-service, high throughput | Inter-service: Settlement ↔ Registry Bridge |

**API Governance:**
| Practice | Implementation |
|----------|----------------|
| **Schema-First** | OpenAPI 3.1 (REST) / GraphQL SDL / Protobuf (gRPC) in Git; CI validation |
| **Versioning** | URL versioning (`/v1/`, `/v2/`); header-based for GraphQL |
| **Deprecation Policy** | 6-month notice; `Deprecation` header; sunset header |
| **Contract Testing** | Pact (consumer-driven) in CI/CD |
| **Documentation** | Auto-generated (Redoc/Scalar); embedded examples |

### 15.1.3.2 Caching Strategy — Speed Without Staleness

**Cache Layers:**
| Layer | Technology | TTL | Invalidation | Use Case |
|---------|------------|-----|--------------|----------|
| **CDN/Edge** | Cloudflare/Fastly | 60s-5m | Purge API | Static assets, public price index |
| **API Gateway** | Kong/Envoy (Redis) | 1-60s | Key-based purge | Hot endpoints (price, balance) |
| **Service-Level** | Redis Cluster | 1s-1hr | Event-driven (cache-aside) | Computed views, aggregations |
| **Database** | PostgreSQL (pgpool) | N/A | N/A | ACID writes |

**Cache Invalidation Strategies:**
| Strategy | Trigger | Latency | Complexity |
|----------|---------|---------|------------|
| **Write-Through** | On write, update cache | Low | Medium |
| **Write-Behind** | Async write-back | Lowest | High (consistency risk) |
| **Cache-Aside (Lazy)** | On read miss | Low | Low |
| **Event-Driven Invalidation** | On data change event | Low | Medium (Kafka consumer) |

**Cache Key Design:**
```
Pattern: {domain}:{entity}:{id}:{view}:{version}
Example: carbon:credit:VCU-1234-2023:summary:v2
```

### 15.1.3.2 Real-Time — WebSocket, SSE, Webhook

**WebSocket (Market Data, Notifications):**
```yaml
# Connection Lifecycle
connect → auth (JWT) → subscribe(topics) → ack → stream events
# Topics: market.ticks.{vintage}.{methodology}, credit.balance.{account}, notifications.{user}
# Heartbeat: ping/pong (30s); Reconnect: exponential backoff (1s, 2s, 4s, max 30s)
# Auth: JWT in query param or cookie; re-auth on reconnect
```

**Webhook Delivery (Reliable, Ordered):**
```yaml
delivery:
  retry: 3x (immediate, 5min, 30min)
  timeout: 10s
  signature: HMAC-SHA256 (verify authenticity)
  idempotency: event_id + delivery_attempt
  ordering: per-target FIFO queue
  dead_letter: after 3 failures → DLQ + alert
```

### 15.1.3.3 API Governance — Security, Versioning, Lifecycle

**Security:**
| Control | Implementation |
|---------|----------------|
| **AuthN** | OAuth2/OIDC (Authorization Code + PKCE); mTLS for service-to-service |
| **AuthZ** | RBAC + ABAC (OPA); Resource-level permissions |
| **Rate Limiting** | Token bucket (per client, per endpoint); Distributed (Redis) |
| **Input Validation** | Schema validation (JSON Schema); Sanitization; Size limits |
| **Audit Log** | All mutating requests; Immutable (append-only); 7-yr retention |

**Versioning & Lifecycle:**
| Phase | Criteria | Duration |
|---------|----------|----------|
| **Alpha** | Internal only | 2-4 weeks |
| **Beta** | Limited external (opt-in) | 4-8 weeks |
| **GA (vN)** | Public; SLA commitment | Indefinite |
| **Deprecated** | 6-month notice; `Deprecation` header | 6 months |
| **Sunset** | No new consumers; existing migrated | 12 months |

### 15.1.3.3 Data Governance — Privacy, Lineage, Retention

**Data Classification & Handling:**
| Classification | Examples | Encryption | Access Control | Retention |
|--------------|----------|------------|----------------|-----------|
| **Public** | Price index, public project info | At-rest + Transit | Public read | Indefinite |
| **Internal** | Internal metrics, configs | At-rest + Transit | Role-based | 7 years |
| **Confidential** | Prices, positions, strategies | At-rest + Transit + CMEK | Need-to-know | 7 years |
| **Restricted (PII/PHI)** | User KYC, KYB, banking | At-rest + Transit + CMEK + HSM | Strict need-to-know | 7 years (legal hold) |
| **Regulatory** | Compliance reports, audit logs | Immutable (WORM) | Auditors only | 10+ years |

**Data Lineage (OpenLineage):**
- Track: Source → Transformations → Destination
- Column-level lineage for regulatory fields (price, quantity, vintage)
- Impact analysis: "What breaks if I change this column?"

**Retention & Disposal:**
| Data Type | Retention | Disposal Method |
|-----------|-----------|-----------------|
| **Audit Logs** | 7 years | Cryptographic shred |
| **Financial Records** | 10 years (regulatory) | Cryptographic shred |
| **User Activity** | 3 years (anonymized after 1yr) | Anonymization + deletion |
| **System Logs** | 90 days (hot) / 1 year (cold) | Deletion |

### 15.1.3.3 Professional Judgement Points
- **API is a product:** Design for consumers, not for your database schema
- **Cache is a distributed system:** Plan for inconsistency, staleness, invalidation storms
- **Webhooks are unreliable:** Build for retry, ordering, idempotency, dead-letter
- **Governance is continuous:** Schema checks in CI/CD; policy as code (OPA)
- **Observability > Monitoring:** Know *why* it's slow, not just *that* it's slow

### 15.1.3.3 Practical Exercise: API Design Review
*Scenario:* Design the public API for "Carbon Portfolio Analytics" — exposing position, P&L, risk metrics, and vintage breakdown for a trading desk managing 500k credits across 5 registries.
*Tasks:*
1. Design REST + GraphQL endpoints (paths, params, response shapes)
2. Define caching strategy (what, where, TTL, invalidation)
3. Define rate limits, auth, error codes, pagination
4. Write one OpenAPI 3.1 snippet for the core endpoint
*Time:* 40 min
*Deliverable:* API spec (OpenAPI 3.1 snippet) + caching strategy + governance checklist
*Time:* 40 min
*Rubric:* API design (40%), caching strategy (30%), governance (30%)

**Knowledge Check:**
1. Why use GraphQL for portfolio analytics but REST for credit transfers?
2. How do you invalidate cache when a credit is retired?
3. What is the "Deprecation" header and when do you use it?
4. How do you handle PII in API logs?

**Sources:**
1. Google — API Improvement Proposals
2. Stripe — API Design Guide
3. GraphQL — Best Practices
3. Kong/Envoy — API Gateway Patterns
4. OPA — Policy as Code
4. OpenLineage — Data Lineage Standard

---
*Lesson Version: 1.0 | Author: [Author] | Reviewer: [Reviewer] | Last Verified: 2026-01-25 | Content Risk: DYNAMIC (API patterns evolving) | Regulatory Review: Quarterly*