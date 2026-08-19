# PRODUCTION READINESS BASELINE
## EtherTrack Technologies Private Limited — Internal ERP / Internal Operations Platform

**Generated:** 2026-08-12
**Commit:** a0a204ad89c4bbe35f67fcc7c889f7033178a244
**Branch:** main (ahead of origin/main by 1 commit)

---

## 1. REPOSITORY STATE

### Git Status
- **Current commit:** a0a204a (message: "7augusteve")
- **Branch:** main
- **Working tree changes:** 15 modified files, 36 untracked files
- **Rollback baseline recorded:** a0a204ad89c4bbe35f67fcc7c889f7033178a244

### Modified Files (Not Committed)
```
backend/.env.example
backend/middleware/auth.js
backend/package.json
backend/routes/ai.js
backend/routes/monitoring.js
backend/server.js
backend/services/aiAssistant.js
etpl_ops_agent/src/incognitoLock.js
etpl_ops_agent/src/main.js
frontend/package.json
frontend/public/index.html
frontend/src/pages/AIAssistant.js
frontend/src/pages/Monitoring.js
frontend/src/pages/MyActivity.js
frontend/src/pages/Performance.js
```

### Untracked Files (Not Committed)
```
backend/check-chunk-count.js
backend/check-chunks.js
backend/check-db.js
backend/check-rag.js
backend/db/007_ai_access.sql
backend/db/008_ai_tools.sql
backend/db/rag_schema.sql
backend/scripts/alter-embedding-dim.js
backend/scripts/alter-source-id.js
backend/scripts/check-chat-log.js
backend/scripts/check-compliance.js
backend/scripts/check-env.js
backend/scripts/check-founder.js
backend/scripts/check-schema.js
backend/scripts/fix-chat-log.js
backend/scripts/rag-ingest.js
backend/scripts/run-migrations.js
backend/scripts/test-ai-health.js
backend/scripts/test-ai.js
backend/scripts/test-embed.js
backend/scripts/test-login.js
backend/scripts/test-ollama-direct.js
backend/scripts/verify-password.js
backend/services/aiOrchestrator.js
backend/services/aiTools/
backend/services/documentEngineUtils.js
backend/services/rag/
backend/test-ai.js
backend/test-payload.json
backend/test-server-5051.js
backend/test-server-ipv4.js
backend/test-server.js
frontend/public/favicon-16x16.png
frontend/src/components/AIActionResult.jsx
frontend/src/components/AIConfirmationDialog.jsx
test-embed.json
test-embedding.json
```

---

## 2. ARCHITECTURE OVERVIEW

### Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| **Frontend** | React (CRA) | react-scripts 5.0.1 (React 18.3.1) |
| **UI Framework** | MUI v6 + Tailwind CSS | @mui/material 6.0.2, tailwindcss 3.4.19 |
| **State/Router** | React Router v6 | 6.26.1 |
| **HTTP Client** | Axios | 1.9.0 |
| **Backend** | Node.js + Express | Node 25.2.1, Express 4.18.2 |
| **Database** | PostgreSQL (Supabase) | pg 8.11.3 |
| **Vector DB** | pgvector (Supabase) | vector extension |
| **Auth** | JWT + HttpOnly Cookies | jsonwebtoken 9.0.2, bcrypt 6.0.0 |
| **2FA** | TOTP (speakeasy) | speakeasy 2.0.0 |
| **AI/Embeddings** | OpenAI-compatible (Ollama dev, NVIDIA NIM prod) | nomic-embed-text (768-dim), Nemotron 3 Ultra / Llama 3.1 |
| **Email** | Resend + SMTP (nodemailer) | nodemailer 9.0.3 |
| **Payments** | RazorpayX | razorpay 2.9.6 |
| **PDF** | pdfkit | 0.15.1 |
| **Scheduling** | node-cron | 4.6.0 |
| **File Upload** | multer | 1.4.5-lts.1 |
| **Rate Limiting** | express-rate-limit | 8.5.2 |
| **Security** | helmet, cors | helmet 7.1.0, cors 2.8.6 |

### Deployment Model
```
Frontend (Vercel)          Backend (Render)              Database (Supabase)
     │                          │                              │
     │  HTTPS + CORS            │                              │
     ├──────────────────────────►│                              │
     │                          │  TLS + pg Pool (max 10)      │
     │                          ├──────────────────────────────►│
     │                          │                              │
     │  Proxy /api → :5060      │  Session/Pooler (port 5432)  │
     │                          │                              │
```
- **Frontend:** Vercel (React SPA, proxies `/api` to backend in dev)
- **Backend:** Render (Node/Express, port 5060, bound to 127.0.0.1)
- **Database:** Supabase PostgreSQL (separate project from customer platform)
- **AI Providers:** Ollama (local dev), NVIDIA NIM / OpenAI-compatible (prod)

### Directory Structure
```
etpl_ops/
├── backend/
│   ├── db/                    # SQL schemas, migrations, seeds
│   ├── middleware/            # auth.js, agentAuth.js, exportGuard.js
│   ├── routes/                # 72 API route groups
│   ├── scripts/               # Migration runner, RAG ingestion, tests
│   ├── services/              # Business logic, AI, RAG, ledger, etc.
│   │   ├── aiTools/           # 6 tool categories (42 tools)
│   │   ├── rag/               # embeddings, retrieval, generation, ingestion
│   │   └── bankFeeds/         # Axis bank adapters
│   ├── server.js              # Express app entry point
│   └── package.json
├── frontend/
│   ├── public/                # index.html, favicon
│   ├── src/
│   │   ├── api/               # axios client
│   │   ├── components/        # Reusable components (AI dialogs, etc.)
│   │   ├── context/           # AuthContext
│   │   ├── pages/             # 60+ page components
│   │   ├── App.js
│   │   └── index.js
│   └── package.json
├── etpl_ops_agent/            # Electron desktop agent (monitoring)
├── browser-extension/         # Browser extension
└── scripts/                   # Seed scripts
```

---

## 3. DATABASE

### Schema Files (in backend/db/)
| File | Size | Purpose |
|------|------|---------|
| schema.sql | 28 KB | Core schema (80 tables, enums, indexes, triggers) |
| rag_schema.sql | 9 KB | RAG tables (rag_documents, rag_chunks, ai_chat_log, rag_ingestion_log) |
| 007_ai_access.sql | 517 B | ai_access_level column on staff_accounts |
| 008_ai_tools.sql | 972 B | ai_tool_execution_log table |
| payroll_compliance_schema.sql | 4 KB | Payroll compliance tables |
| seed_chart_of_accounts.sql | 5 KB | Chart of accounts seed data |
| seed_tax_pt_slabs.sql | 1.8 KB | Tax & PT slabs seed data |
| seed_payroll_compliance_accounts.sql | 230 B | Payroll compliance accounts seed |

### Core Tables (from schema.sql)
- **Auth:** staff_accounts, trusted_devices, login_ip_allowlist, device_approval_requests, two_fa_backup_codes, password_reset_tokens
- **HR:** employees, departments, designations, teams, employee_documents, leave_types, leave_requests, attendance_records
- **Recruitment:** job_postings, candidates, job_applications, interviews
- **Finance/Accounting:** chart_of_accounts, fiscal_periods, journal_entries, journal_lines, parties, invoices, invoice_items, payments_received, bills, payments_made, expense_categories, recurring_expenses, bank_accounts, bank_transactions
- **Payroll:** payroll_runs, payroll_items
- **Sales/CRM:** deals, quotations, deal_tasks, corporate_deals, contacts, party_notes
- **Documents:** documents, document_templates, generated_documents
- **Compliance/Settings:** compliance_settings, tax_slabs, pt_slabs, app_settings, app_settings_numeric, company_profile
- **Assets:** assets, ip_assets, certifications
- **Audit:** audit_log
- **AI/RAG:** rag_documents, rag_chunks, ai_chat_log, rag_ingestion_log, ai_tool_execution_log

### Missing Migration Files (Referenced in README but NOT in db/)
- 002_platform_sync.sql
- 002_add_teams.sql (duplicate numbering)
- 003_assets_approvals_notifications.sql
- 004_recruitment_performance.sql
- 004_document_engine.sql
- 005_department_granted_roles.sql
- 006_password_reset_tokens.sql

### Database Connection Pool (backend/db/pool.js)
- **Pool size:** max 10
- **SSL:** Required (Supabase), rejectUnauthorized: false
- **Idle timeout:** 20s (to handle Supabase pooler)
- **Connection timeout:** 10s
- **Keep-alive:** true
- **DATE parser:** Returns raw string (avoids timezone shift)

---

## 4. MODULES IMPLEMENTED

### Backend Routes (72 mounted in server.js)
| Module | Route Prefix | Status |
|--------|--------------|--------|
| Auth | /api/auth | ✅ Complete |
| Employees | /api/employees | ✅ Complete |
| Parties | /api/parties | ✅ Complete |
| Staff Accounts | /api/staff-accounts | ✅ Complete |
| Approvals | /api/approvals | ✅ Complete |
| Departments | /api/departments | ✅ Complete |
| Teams | /api/teams | ✅ Complete |
| Designations | /api/designations | ✅ Complete |
| Assets | /api/assets | ✅ Complete |
| Notifications | /api/notifications | ✅ Complete |
| Recruitment | /api/recruitment | ✅ Complete |
| Performance | /api/performance | ✅ Complete |
| Import | /api/import | ✅ Complete |
| Documents | /api/documents | ✅ Complete |
| Document Templates | /api/document-templates | ✅ Complete |
| Document Engine | /api/document-engine | ✅ Complete |
| Document Verify | /api/document-verify | ✅ Complete (public) |
| Sales | /api/sales | ✅ Complete |
| Automation | /api/automation | ✅ Complete |
| AI | /api/ai | ⚠️ Partial (param extraction stub) |
| Analytics | /api/analytics | ✅ Complete |
| Expenses | /api/expenses | ✅ Complete |
| Settings | /api/settings | ✅ Complete |
| ESignatures | /api/esignatures | ✅ Complete |
| Admin | /api/admin | ✅ Complete |
| Compliance | /api/compliance | ✅ Complete |
| One-Time Registrations | /api/one-time-registrations | ✅ Complete |
| Certifications | /api/certifications | ✅ Complete |
| IP Assets | /api/ip-assets | ✅ Complete |
| Data Governance | /api/data-governance | ✅ Complete |
| Finance | /api/finance | ✅ Complete |
| Bills | /api/finance/bills | ✅ Complete |
| Purchase Requests | /api/purchase-requests | ✅ Complete |
| Bank Accounts | /api/bank-accounts | ✅ Complete |
| Accounting | /api/accounting | ✅ Complete |
| Platform Sync | /api/platform-sync | ✅ Complete |
| Invoices | /api/invoices | ✅ Complete |
| Payroll | /api/payroll | ✅ Complete (webhook verify missing) |
| Attendance | /api/attendance | ✅ Complete |
| Agent | /api/agent | ✅ Complete |
| Monitoring | /api/monitoring | ✅ Complete |
| Marketing (9 modules) | /api/marketing/* | ✅ Complete |
| Partnerships (2 modules) | /api/partnerships/* | ✅ Complete |
| Product (6 modules) | /api/product/* | ✅ Complete |
| Support Tickets | /api/support-tickets-view | ✅ Complete |

### Frontend Pages (60+ in src/pages/)
Major modules: Dashboard, Employees, HR, Finance, Accounting, Payroll, Sales/CRM, Documents, Recruitment, Performance, Attendance, Compliance, Settings, Admin, Marketing, Product, Partnerships, Monitoring, AI Assistant, etc.

---

## 5. AI / RAG IMPLEMENTATION

### AI Architecture
```
User Query
    ↓
POST /api/ai/query (authenticate + checkAIAccess)
    ↓
aiAssistant.askAssistant() → aiOrchestrator.processQuery()
    ↓
classifyIntent() [LLM-based - VULNERABLE]
    ↓
retrieveContext() [RAG - permission-aware] + selectToolsForIntent() [keyword-based]
    ↓
executeTools() [with confirmation gating]
    ↓
generateAnswerWithCitations() [Nemotron]
    ↓
Response with citations, confirmations, or results
```

### AI Access Control (Server-Side Enforced)
- **AI_DISABLED** (default): No AI access
- **AI_KNOWLEDGE**: Read-only tools, no confirmations
- **AI_AGENT** (owner only): All tools, confirmations required for write/destructive

**Migration 007_ai_access.sql** sets owner → AI_AGENT

### AI Tools Inventory (42 tools in 6 categories)
| Category | Tools | Read | Write | Destructive | Confirmation |
|----------|-------|------|-------|-------------|--------------|
| Employee | 11 | 4 | 7 | 1 (exit_employee) | 4 |
| Finance | 12 | 12 | 0 | 0 | 0 |
| Sales | 11 | 5 | 6 | 0 | 1 (mark_deal_won) |
| Documents | 6 | 3 | 3 | 1 (void_generated_doc) | 2 |
| Settings | 4 | 4 | 0 | 0 | 0 |
| HR/Recruitment | 5 | 2 | 3 | 0 | 1 (hire_candidate) |

### RAG System
- **Embedding Model:** nomic-embed-text (768-dim) via Ollama (dev)
- **Vector Store:** pgvector with IVFFlat index (lists=100)
- **Chunking:** 512 tokens, 50 overlap, Markdown-aware
- **Permission Filtering:** Server-side metadata filter (role, department, public)
- **Ingestion Sources:** document_templates, generated_documents, documents, compliance_settings, app_settings, tax_slabs, pt_slabs, company_profile
- **Current State:** 85 chunks indexed (all skipped on re-run = unchanged)

### Critical AI Issues Identified
1. **C-05:** `extractParameters()` returns `{}` — tools receive no parameters
2. **C-10:** Intent classification uses LLM (prompt injection vulnerable)
3. **C-11:** Confirmation uses in-memory `confirmations[call.name]` — no persistence, no TTL, no replay protection
4. **C-04:** PDF text extraction NOT IMPLEMENTED — documents indexed as metadata only

---

## 6. BACKGROUND JOBS / SCHEDULERS

### In-Process Schedulers (Started in server.js after listen)
| Scheduler | Schedule | Service |
|-----------|----------|---------|
| expenseScheduler | Daily 06:00 | Recurring expense sweep |
| financeScheduler | Daily 07:00 | Budget alert check |
| corporateDealsScheduler | Daily 08:00 | Installment reminders |
| churnAlertScheduler | Daily 09:00 | Paid→free downgrade alerts |
| refundAlertScheduler | Daily 09:30 | Refunds needing ledger reversal |

**Problem:** All run in-process via `require()` — no persistence, no retries, no monitoring, lost on restart.

---

## 7. AUTHENTICATION & AUTHORIZATION

### Authentication (backend/routes/auth.js + middleware/auth.js)
- **JWT:** 8h expiry, HS256, secret from INTERNAL_OPS_JWT_SECRET
- **Cookies:** HttpOnly, Secure (prod), SameSite=none (cross-origin), lax (dev)
- **2FA:** TOTP with encrypted secrets + 8 backup codes (one-time display)
- **Device Lock:** Email OTP approval for new devices
- **IP Allowlist:** Per-account CIDR allowlist
- **Rate Limit:** 20 req/15min on auth endpoints
- **Password Reset:** SHA-256 token hash, 15min expiry, single-use, invalidates all others
- **Bootstrap Owner:** ALLOW_BOOTSTRAP=true required, one-time

### Authorization (middleware/auth.js)
- **requireRole():** Checks role + effectiveRoles (dept-granted) + owner/admin bypass
- **requireDepartmentHead():** Checks departments.head_employee_id
- **effectiveRoles:** Resolved per-request via departmentAccess.getMyDepartmentAccess()
  - Department can grant: finance, hr, legal_hod, compliance_hod
  - Owner/admin bypass all checks

### Critical Auth Issues
1. **Token in localStorage** (frontend/src/api/client.js:17) — duplicate of HttpOnly cookie
2. **No token rotation/refresh** — static 8h JWT
3. **No concurrent session limit**
4. **Wildcard roles:** `allowedRoles: ['*']` in salesTools, documentTools, etc.
5. **effectiveRoles bypass:** Dept-granted roles can leak sensitive data (CTC, bank details)

---

## 8. FINANCIAL OPERATIONS

### Double-Entry Ledger (backend/services/ledger.js)
- **Core:** postJournalEntry() — every financial event posts balanced journal entry
- **Constraint:** DB trigger `trg_journal_balanced` enforces Σdebit = Σcredit (deferred)
- **Reports:** Trial Balance, P&L, Balance Sheet via ledger queries

### Critical Financial Issues
1. **C-01:** Payment recording NOT atomic (separate statements for payments_received + invoices.amount_paid)
2. **C-02:** Bill payment NOT atomic (payments_made + bills.amount_paid)
3. **C-03:** Payroll disbursement NOT fully transactional
4. **C-12:** Closed fiscal periods NOT enforced (is_closed flag exists but no trigger)
5. **No idempotency keys** on payments/webhooks
6. **No SELECT FOR UPDATE** on concurrent financial operations

---

## 9. SECURITY HEADERS & VALIDATION

### Current
- **helmet()** enabled (defaults)
- **CORS:** Origin from INTERNAL_OPS_ALLOWED_ORIGIN, credentials: true
- **Rate Limit:** 500 req/15min global, 20/15min on auth
- **Input Validation:** Manual (`if (!field) return 400`) — inconsistent
- **SQL Injection:** Parameterized queries only (pg driver) — GOOD

### Missing
- **CSP:** Not configured
- **Permissions-Policy:** Not configured
- **HSTS:** Not explicitly configured (helmet default)
- **Schema Validation:** No Zod/Joi — only AI tools have structured validation

---

## 10. OBSERVABILITY

### Current
- **Logging:** console.log / console.error only
- **Request IDs:** None
- **Error Tracking:** None (no Sentry/Datadog)
- **Metrics:** None
- **Health Check:** GET /health → `{ ok: true, service: 'ethertrack-internal-ops' }`

### Missing
- Structured logging (pino/winston)
- Request correlation IDs
- Error tracking
- Metrics (Prometheus/OpenTelemetry)
- Alerting on critical failures

---

## 11. TESTING

### Current State: **EFFECTIVELY ZERO**
- No unit tests
- No integration tests
- No security tests
- No E2E tests
- No load tests
- No AI/RAG tests
- No financial transaction tests

### Test Files Found: Only in node_modules (dependencies)

---

## 12. DEPLOYMENT CONFIGURATION

### Environment Variables (Backend .env.example)
- Database: INTERNAL_OPS_DATABASE_URL (Supabase direct connection)
- Auth: INTERNAL_OPS_JWT_SECRET, INTERNAL_OPS_ALLOWED_ORIGIN, ALLOW_BOOTSTRAP
- Company: COMPANY_STATE
- Payments: RAZORPAYX_KEY_ID, RAZORPAYX_KEY_SECRET, RAZORPAYX_ACCOUNT_NUMBER, RAZORPAYX_WEBHOOK_SECRET
- Email: RESEND_API_KEY, RESEND_FROM_EMAIL, APP_BASE_URL, SMTP settings
- AI: NVIDIA_API_KEY, NVIDIA_EMBED_URL, NVIDIA_CHAT_URL, or OPENAI_* alternatives
- RAG: USE_RAG, RAG_TOP_K, RAG_CHUNK_SIZE, RAG_SIMILARITY_THRESHOLD, EMBED_DIMENSIONS
- Port: INTERNAL_OPS_PORT=5050 (changed to 5060 in running config)

### Frontend .env
- REACT_APP_API_BASE_URL=http://localhost:5060/api

### CI/CD: **NONE** (no GitHub Actions, GitLab CI, etc.)

---

## 13. KNOWN FINDINGS (FROM PRIOR AUDIT + VERIFICATION)

### CRITICAL (Must Fix Before Production)
| ID | Finding | Verified |
|----|---------|----------|
| C-01 | Payment recording not atomic | ✅ Verified in finance.js, bills.js |
| C-02 | Bill payment recording not atomic | ✅ Verified |
| C-03 | Payroll disbursement not fully transactional | ✅ Verified in payroll.js |
| C-04 | PDF text extraction missing from RAG | ✅ Verified in ingestion.js:20 |
| C-05 | AI parameter extraction is stub | ✅ Verified in aiOrchestrator.js:310-313 |
| C-06 | Effective-role authorization bypass | ✅ Verified in middleware/auth.js + departmentAccess.js |
| C-07 | Referenced DB tables missing from schema | ⚠️ Need verification (expense_claims, etc.) |

### HIGH (Must Fix Before Production)
| ID | Finding | Verified |
|----|---------|----------|
| C-08 | Sales AI tools over-permissioned | ✅ allowedRoles: ['*'] in salesTools.js |
| C-09 | Document AI tools over-permissioned | ✅ allowedRoles: ['*'] in documentTools.js |
| C-10 | LLM intent classification prompt injectable | ✅ classifyIntent() uses LLM |
| C-11 | AI confirmation no replay protection | ✅ In-memory only |
| C-12 | Closed fiscal periods not enforced | ✅ is_closed flag exists, no trigger |
| C-13 | 2FA encryption key management | ✅ Single static key in TWO_FA_ENCRYPTION_KEY |
| C-14 | RAG lacks embedding migration strategy | ✅ No versioning in embeddings.js |
| C-15 | JWT token rotation incomplete | ✅ Static 8h JWT |
| C-16 | N+1 queries exist | ✅ Verified in salesTools.js, financeTools.js |
| C-17 | In-process schedulers lack durability | ✅ Started via require() in server.js |
| C-18 | Observability inadequate | ✅ console.log only |
| C-19 | Test coverage effectively zero | ✅ No test files in app code |

---

## 14. DEPLOYMENT PROCESS (CURRENT)

### Manual Steps Required
1. Provision Supabase project (separate from platform)
2. Run schema.sql + seed files + migration files in order (manual psql)
3. Configure .env on Render (backend) and Vercel (frontend)
4. Deploy backend to Render
5. Deploy frontend to Vercel
6. Run RAG ingestion manually (`npm run rag:ingest:full`)
7. Create owner account via bootstrap endpoint

### Rollback Procedure: **NOT DOCUMENTED**

---

## 15. DISASTER RECOVERY

### Current
- Supabase: Automated daily backups, PITR (7 days on Pro)
- No documented RPO/RTO
- No restore test performed
- No migration rollback scripts

---

## 16. EXIT CRITERIA FOR PHASE 0

- [x] Repository understood
- [x] Rollback baseline recorded (commit a0a204a)
- [x] Existing tests identified (NONE in application code)
- [x] Production architecture documented
- [x] All modules, routes, services, database schemas catalogued
- [x] AI/RAG implementation understood
- [x] Background jobs identified
- [x] Authentication/authorization flows traced
- [x] Financial operations traced
- [x] Known findings verified against codebase

---

## 17. NEXT PHASE

**PHASE 1 — DATABASE & DATA INTEGRITY**

Priority tasks:
1. Create missing migration files referenced in README
2. Verify all tables referenced by application code exist in schema
3. Add missing FKs, indexes, constraints
4. Implement RLS defense-in-depth where appropriate
5. Fix embedding dimension mismatch (schema says 768, env says 1024)

**Status:** READY TO BEGIN PHASE 1