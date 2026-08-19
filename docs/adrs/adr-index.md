# ADR 001: Technology Stack Selection

## Status
Accepted

## Context
Need to select core technologies for the EtherTrack Internal Ops ERP system.

## Decision
- **Backend**: Node.js 20+ with Express.js
- **Frontend**: React 18+ with Vite
- **Database**: PostgreSQL (Supabase managed)
- **Cache/Session**: Redis
- **AI/LLM**: Ollama (self-hosted) with llama3.1 + nomic-embed-text
- **Authentication**: JWT (access + refresh tokens) with HTTP-only cookies
- **2FA**: TOTP (RFC 6238) with backup codes
- **Containerization**: Docker multi-stage builds
- **CI/CD**: GitHub Actions
- **Hosting**: Render (backend + frontend)
- **Reverse Proxy**: Nginx (in Docker)

## Consequences
**Positive**:
- JavaScript/TypeScript across stack reduces context switching
- Supabase provides managed Postgres with RLS, auth helpers
- Ollama keeps AI data local (no external API calls)
- Render simplifies deployment with auto-scaling
- Strong ecosystem for all chosen technologies

**Negative**:
- Node.js single-threaded (mitigated by clustering/pm2)
- Self-hosted Ollama requires GPU resources
- Render less flexible than raw Kubernetes

## Alternatives Considered
- Python/FastAPI: Rejected - team stronger in JS
- PostgreSQL self-hosted: Rejected - operational burden
- OpenAI API: Rejected - data privacy concerns
- Kubernetes: Rejected - overkill for current scale

---

# ADR 002: Authentication Architecture

## Status
Accepted

## Context
Design authentication system for multi-role ERP with security requirements.

## Decision
- **Access Tokens**: JWT, 15-min expiry, RS256 (or HS256 with 256-bit secret)
- **Refresh Tokens**: JWT, 7-day expiry, stored in DB with rotation
- **Storage**: HTTP-only, Secure, SameSite=Strict cookies
- **2FA**: TOTP (Google Authenticator compatible) + 8 backup codes
- **Device Tracking**: Fingerprint + IP allowlist per user
- **Session Management**: Redis-backed with TTL matching refresh token

## Token Flow
```
Login → Verify credentials → Check 2FA → Issue access + refresh cookies
       ↓
Access token in memory (React) + HttpOnly cookie (auto-sent)
       ↓
Refresh: POST /api/auth/refresh (cookie) → New access token
```

## Consequences
**Positive**:
- HttpOnly cookies prevent XSS token theft
- Short access token limits exposure
- Refresh rotation detects token reuse
- Device tracking enables anomaly detection

**Negative**:
- Cookie-based CSRF risk (mitigated by SameSite=Strict)
- Mobile/app clients need cookie handling
- Refresh token DB storage adds latency

## Alternatives Considered
- LocalStorage tokens: Rejected - XSS vulnerable
- Long-lived JWT only: Rejected - no revocation
- OAuth2/OIDC provider: Rejected - added complexity

---

# ADR 003: Database Row-Level Security (RLS)

## Status
Accepted

## Context
Multi-tenant ERP requires data isolation by department/role without application-level filtering bugs.

## Decision
- Enable RLS on all tenant-isolated tables
- Use `current_setting('app.current_user_id')` and `app.current_user_role` session variables
- Set variables via `SET LOCAL` in transaction middleware
- Policies:
  - Employees: See own dept + sub-depts (hierarchy)
  - Finance: See all finance data (role-based)
  - Sales: See own team's deals
  - Admin: See all

## Implementation
```sql
-- Example policy
CREATE POLICY employee_dept_isolation ON employees
  FOR SELECT USING (
    department_id IN (
      SELECT get_subdepartment_ids(current_setting('app.current_user_dept')::uuid)
    )
  );
```

## Consequences
**Positive**:
- Defense in depth (DB enforces even if app bugs)
- No forgotten WHERE clauses
- Audit trail via policies

**Negative**:
- Debugging harder (queries return 0 rows silently)
- Migration complexity (policy management)
- Performance overhead (negligible with indexes)

## Alternatives Considered
- Application-level filtering only: Rejected - human error risk
- Views per role: Rejected - maintenance burden
- Separate schemas: Rejected - over-engineering

---

# ADR 004: Financial Correctness - Idempotency & Locking

## Status
Accepted

## Context
Financial operations (expense claims, invoices, payroll) must be exactly-once and race-condition free.

## Decision
- **Idempotency Keys**: Client-generated UUID, required on all mutating financial endpoints
- **Storage**: `idempotency_keys` table with unique constraint + 24h TTL
- **Row Locking**: `SELECT ... FOR UPDATE` on parent records during decisions
- **Transactions**: All financial writes in single DB transaction
- **Closed Periods**: Hard block on mutations for locked periods

## Flow
```
POST /expense-claims {idempotencyKey: "uuid", ...}
  → BEGIN TRANSACTION
  → INSERT INTO idempotency_keys (key, response) ON CONFLICT DO NOTHING
  → IF conflict: RETURN cached response
  → SELECT * FROM expense_claims WHERE id = ? FOR UPDATE (if updating)
  → INSERT/UPDATE claim
  → COMMIT
  → Store response in idempotency_keys
```

## Consequences
**Positive**:
- Safe retries (network failures, double-clicks)
- No duplicate payments/claims
- Audit trail of all attempts

**Negative**:
- Client must generate/store keys
- 24h TTL may be short for some flows
- Extra DB round-trip

## Alternatives Considered
- Optimistic locking (version column): Rejected - doesn't prevent duplicates
- Distributed locks (Redis): Rejected - DB locks sufficient

---

# ADR 005: AI Assistant Architecture

## Status
Accepted

## Context
Natural language interface for ERP operations with safety guarantees.

## Decision
- **Pipeline**: User query → Intent classification → Parameter extraction → Confirmation (if mutating) → Execution
- **Models**: 
  - Embedding: nomic-embed-text (local, via Ollama)
  - Chat: llama3.1 (local, via Ollama)
- **RAG**: Supabase pgvector for document retrieval
- **Safety**:
  - Prompt injection detection (heuristic + ML)
  - Parameter validation via Zod schemas
  - Confirmation required for all mutating tools
  - Rate limiting per user
- **Tools**: Whitelisted functions with strict schemas

## Tool Execution Flow
```
Query → Classify intent → Extract params (Zod) → 
  If mutating: Create confirmation record → Return confirmationId
  If read-only: Execute → Return answer
Confirmation: User approves → Execute tool → Return result
```

## Consequences
**Positive**:
- No unintended mutations
- Audit trail of all AI actions
- Local models = data privacy
- Extensible tool system

**Negative**:
- Latency (local LLM inference)
- GPU required for reasonable speed
- Model quality lower than GPT-4

## Alternatives Considered
- OpenAI function calling: Rejected - data leaves infrastructure
- LangChain: Rejected - abstraction overhead
- No confirmation: Rejected - safety risk

---

# ADR 006: Secret Management & Rotation

## Status
Accepted

## Context
Manage secrets (JWT keys, encryption keys, DB passwords) securely with rotation capability.

## Decision
- **Storage**: Environment variables (Render) + `.env` (local only)
- **Rotation**: CLI script (`scripts/rotate-secret.js`) with key versioning
- **Encryption Keys**: Versioned (KEY_VERSION env), old versions retained for decryption
- **JWT Secrets**: Rotated weekly via cron, old secret valid for 24h overlap
- **Audit**: `scripts/validate-secrets.js` runs at startup
- **Procedures**: Documented in `SECRET_ROTATION_PROCEDURES.md`

## Key Hierarchy
```
MASTER_KEY (rotate annually)
  → ENCRYPTION_KEY_v1, ENCRYPTION_KEY_v2... (rotate quarterly)
  → JWT_SECRET, JWT_REFRESH_SECRET (rotate weekly)
  → INTERNAL_OPS_REFRESH_SECRET (rotate weekly)
```

## Consequences
**Positive**:
- Automated rotation reduces human error
- Versioning enables zero-downtime rotation
- Startup validation catches misconfiguration early
- Clear incident response procedure

**Negative**:
- Multiple key versions increase complexity
- Clock sync required for JWT validation
- Secret rotation requires coordinated deploy

## Alternatives Considered
- HashiCorp Vault: Rejected - operational overhead
- AWS Secrets Manager: Rejected - vendor lock-in
- Manual rotation: Rejected - error-prone

---

# ADR 007: API Design - REST + Webhooks

## Status
Accepted

## Context
Design API for frontend consumption and external integrations.

## Decision
- **Style**: RESTful with JSON
- **Versioning**: URL path (`/api/v1/`)
- **Pagination**: Cursor-based for lists
- **Errors**: RFC 7807 Problem Details format
- **Request IDs**: `X-Request-ID` header for tracing
- **Rate Limiting**: 500 req/15min global, stricter on auth
- **Webhooks**: For async events (payroll, approvals) with signature verification

## Conventions
- Plural nouns: `/api/employees`, `/api/expense-claims`
- Nested for ownership: `/api/employees/:id/claims`
- Actions as sub-resources: `/api/expense-claims/:id/approve`
- Query params for filtering: `?status=pending&dept=finance`

## Consequences
**Positive**:
- Familiar to frontend developers
- Cacheable GET requests
- Good tooling support

**Negative**:
- Over-fetching/under-fetching (mitigated by sparse fieldsets)
- Chatty for complex UIs
- Versioning in URL can be brittle

## Alternatives Considered
- GraphQL: Rejected - caching complexity, N+1 risks
- gRPC: Rejected - browser support, debugging harder
- tRPC: Rejected - ties frontend to backend types

---

# ADR 008: Deployment Strategy

## Status
Accepted

## Context
Choose deployment model balancing operational simplicity and reliability.

## Decision
- **Platform**: Render (managed PaaS)
- **Backend**: Docker container, auto-scaling (1-3 instances)
- **Frontend**: Static site on Render CDN
- **Database**: Supabase (managed Postgres)
- **Cache**: Redis on Render
- **AI**: Ollama on dedicated GPU instance (or Render GPU)
- **CI/CD**: GitHub Actions → Render auto-deploy on main
- **Rollback**: Render one-click rollback to previous deploy

## Environments
- **Production**: `main` branch
- **Staging**: `staging` branch (separate Render services)
- **Local**: Docker Compose

## Consequences
**Positive**:
- Zero infrastructure management
- Automatic SSL, DDoS protection
- Easy rollbacks
- Cost-effective for current scale

**Negative**:
- Less control than Kubernetes
- Vendor lock-in
- Cold starts on free tier
- GPU availability for Ollama

## Alternatives Considered
- Kubernetes (EKS/GKE): Rejected - team lacks expertise
- Vercel + Railway: Rejected - fragmented
- Self-hosted VMs: Rejected - operational burden

---

# ADR 009: Frontend Architecture

## Status
Accepted

## Context
Design React application structure for maintainability.

## Decision
- **Framework**: React 18 + Vite + TypeScript
- **State**: React Query (server state) + Zustand (client state)
- **Routing**: React Router v6
- **Forms**: React Hook Form + Zod (shared with backend)
- **UI**: Headless UI + Tailwind CSS
- **Auth**: Context + custom hooks, token in memory + cookie
- **Code Splitting**: Route-based lazy loading

## Folder Structure
```
src/
  features/        # Feature modules (auth, finance, sales, ai)
    auth/
      components/
      hooks/
      api.ts
      types.ts
  shared/          # Cross-cutting
    components/    # Button, Table, Modal, Form
    hooks/         # useAuth, useApi, useDebounce
    utils/
    types/
  pages/           # Route components
  App.tsx
  main.tsx
```

## Consequences
**Positive**:
- Feature-based organization scales well
- Shared Zod schemas = type safety across stack
- React Query handles caching, retries, loading states
- Tailwind enables rapid UI iteration

**Negative**:
- Feature boundaries can blur
- Tailwind classes in JSX can be verbose
- React Query learning curve

## Alternatives Considered
- Next.js: Rejected - SSR not needed, adds complexity
- Redux Toolkit: Rejected - overkill for server-state-heavy app
- Chakra UI: Rejected - bundle size, less customizable

---

# ADR 010: Testing Strategy

## Status
Accepted

## Context
Define testing approach for confidence without slowing development.

## Decision
- **Unit Tests**: Vitest for pure functions, utilities, Zod schemas
- **Integration Tests**: Supertest for API routes (DB transactions rolled back)
- **E2E Tests**: Playwright for critical user flows (login, expense submit, AI query)
- **Contract Tests**: OpenAPI spec validation in CI
- **Security Tests**: npm audit, Snyk in CI
- **Load Tests**: Custom script (`scripts/load-test.js`) for baselines

## Coverage Targets
- Unit: ≥ 80% on business logic
- Integration: All financial + auth endpoints
- E2E: 5 critical paths

## CI Pipeline
```
1. Lint (ESLint) + TypeCheck (tsc)
2. Unit Tests
3. Integration Tests (test DB)
4. Build (frontend + backend)
5. Security Scan
6. Deploy to Staging
7. E2E Tests (staging)
8. Deploy to Production (manual approval)
```

## Consequences
**Positive**:
- Fast feedback (unit < 30s, integration < 2min)
- Real DB in integration tests catches schema issues
- Contract tests prevent breaking API changes

**Negative**:
- Test DB setup adds CI time
- E2E tests flaky (mitigated by retry)
- Load test not in CI (run manually)

## Alternatives Considered
- Jest: Rejected - Vitest faster, Vite-native
- Cypress: Rejected - Playwright better cross-browser
- No integration tests: Rejected - too risky for financial code