# EtherTrack Internal Ops

An internal-only ERP for running EtherTrack itself: HR, GST-compliant bookkeeping/accounting,
payroll disbursal via RazorpayX, recruitment, performance management, and department-scoped
self-service. **Deliberately separate** from the customer-facing platform's database and auth —
internal HR/payroll data should never share a DB with customer carbon-credit data.

## Why it's structured this way

- **Double-entry ledger is the core** (`backend/services/ledger.js`). Every financial event — an
  invoice, a payment, a payroll run, a manual adjustment — posts through `postJournalEntry()`.
  Nothing writes to a balance directly; balances are always derived by summing `journal_lines`.
  This is what makes it auditable and what lets Trial Balance / P&L / Balance Sheet just be
  queries over the same source of truth, instead of three separate things that can drift out
  of sync.
- A DB-level constraint trigger (`trg_journal_balanced`) additionally enforces that no journal
  entry can ever be unbalanced, even if application code has a bug. Belt and suspenders.
- Employees are never hard-deleted (`status = 'exited'`, with a `POST /:id/reinstate` to undo an
  accidental one) so payroll/leave history stays intact.
- **Approvals are a resolved chain, not a fixed role.** Destructive actions (employee exit,
  department/team delete, login deactivation) route through `services/approvalChain.js`: Team
  Head → Department Head → CEO (any admin) → Founder, skipping any stage that isn't actually
  filled by someone other than the requester. Founder is always the guaranteed final stage.
- **Department access is granted, not assigned per person.** A department can "grant" one or
  more functional roles (`finance`, `hr`, `legal_hod`, `compliance_hod`) to everyone who belongs
  to it — set once per department in Org Structure, and every current and future employee there
  inherits it automatically on their next request (`services/departmentAccess.js`, resolved
  inside `authenticate()`). No per-employee permission setup, ever.

## What's built and working

| Area | Status |
|---|---|
| Auth (login, forgot/reset password via email, rate-limited) | Done |
| Employee/HR CRUD, org structure (Departments → Teams → Employees) | Done |
| Leave requests + approval (HR, or the requester's manager/department head) | Done |
| Multi-stage approval chain (exit, department/team delete, login deactivation) | Done |
| Department-granted module access (finance/hr/legal_hod/compliance_hod) | Done |
| Employee self-service portal (profile, payslips, leave, documents, assets, goals/reviews) | Done |
| Assets inventory, linked to employees, assign/return | Done |
| Notifications — in-app bell + email (Resend) | Done |
| Recruitment (job postings, candidate pipeline, interviews, hire → employee conversion) | Done — no LinkedIn/Naukri API integration (needs a paid platform partnership, not code) |
| Performance management (review cycles, goals, self/manager review flow) | Done |
| Chart of accounts + manual journal entries | Done |
| Trial Balance / P&L / Balance Sheet reports | Done |
| GST invoicing (CGST+SGST vs IGST, auto-posts to ledger) | Done |
| Payment recording against invoices | Done |
| Payroll run generation (attendance → LOP days → CTC breakup → EPF/ESIC/PT/TDS) | Done |
| Razorpay(X) payout disbursal + webhook status sync | Done — webhook signature verification still missing, see gaps |
| Platform revenue sync (subscriptions + trade fees, one-click by month) | Done |
| Documents, Sales/CRM, Automation, AI Assistant, Compliance, Admin | Built — frontend + backend routes exist |
| TrackPilot attendance sync | **Stubbed** — field mapping needs their real API docs |
| Vendor bills / expenses (AP) | Status unconfirmed — check `backend/routes/expenses.js` |
| Financial year close / retained earnings roll-forward | Not built |
| Test suite | Not built |

## Setup (Supabase)

1. Create a **new, separate Supabase project** for this — not a schema inside the customer
   platform project. If that DB is ever compromised, you don't want employee PII and payroll
   sitting next to it.
2. Supabase Dashboard → your project → Settings → Database → copy the **Direct connection**
   string (port 5432) into `.env` as `INTERNAL_OPS_DATABASE_URL`.
3. Run the base schema, then every numbered migration **in order**:
   ```bash
   psql "$INTERNAL_OPS_DATABASE_URL" -f backend/db/schema.sql
   psql "$INTERNAL_OPS_DATABASE_URL" -f backend/db/seed_chart_of_accounts.sql
   psql "$INTERNAL_OPS_DATABASE_URL" -f backend/db/002_platform_sync.sql
   psql "$INTERNAL_OPS_DATABASE_URL" -f backend/db/002_add_teams.sql
   psql "$INTERNAL_OPS_DATABASE_URL" -f backend/db/003_assets_approvals_notifications.sql
   psql "$INTERNAL_OPS_DATABASE_URL" -f backend/db/004_recruitment_performance.sql
   psql "$INTERNAL_OPS_DATABASE_URL" -f backend/db/005_department_granted_roles.sql
   psql "$INTERNAL_OPS_DATABASE_URL" -f backend/db/006_password_reset_tokens.sql
   ```
   ⚠️ **Two migrations are both numbered `002`** (`002_platform_sync.sql` and
   `002_add_teams.sql`) — they were written independently and don't conflict with each other
   (different tables), but the shared number is confusing. Worth renumbering one before this
   gets any harder to reason about — e.g. rename `002_add_teams.sql` → `007_add_teams.sql` and
   keep every subsequent file's *content* the same, just the filename.
   Verify anytime with:
   ```sql
   SELECT column_name FROM information_schema.columns WHERE table_name='departments' AND column_name='granted_roles';
   SELECT table_name FROM information_schema.tables WHERE table_name IN ('teams','assets','staff_notifications','job_postings','password_reset_tokens');
   ```
4. Tables created via SQL Editor/psql do **not** have Row Level Security enabled by default,
   and this server connects as the `postgres` role (bypasses RLS anyway) — nothing extra to
   configure there.

```bash
cd backend
cp .env.example .env   # fill in every value below
npm install
ALLOW_BOOTSTRAP=true npm run dev
curl -X POST localhost:5050/api/auth/bootstrap-owner -H 'Content-Type: application/json' \
  -d '{"email":"you@ethertrack.in","password":"a-strong-password"}'
# then set ALLOW_BOOTSTRAP=false and restart
```

### Environment variables

```
INTERNAL_OPS_DATABASE_URL=          # Supabase direct connection string
INTERNAL_OPS_JWT_SECRET=            # required in production — auth throws on boot without it
INTERNAL_OPS_ALLOWED_ORIGIN=        # your frontend origin, for CORS
INTERNAL_OPS_PORT=5050
COMPANY_STATE=                      # your GST-registered state — drives CGST+SGST vs IGST

RESEND_API_KEY=                     # notifications + password reset email
RESEND_FROM_EMAIL=
APP_BASE_URL=                       # used to build links inside emails (e.g. reset-password link)

RAZORPAYX_KEY_ID=
RAZORPAYX_KEY_SECRET=
RAZORPAYX_ACCOUNT_NUMBER=

# document-engine's own outbound email (separate from Resend, see below)
INTERNAL_OPS_SMTP_HOST=
INTERNAL_OPS_SMTP_PORT=
INTERNAL_OPS_SMTP_USER=
INTERNAL_OPS_SMTP_PASS=
INTERNAL_OPS_SMTP_FROM=
```

Note there are **two independent email systems** — `services/email.js` (Resend, for
notifications + password reset) and `services/emailService.js` (SMTP, for the document
engine's auto-email step). They don't conflict; they're just separately configured.

```bash
cd frontend
npm install
npm start   # :3000, proxies /api to :5050
```

## Honest gaps to close next (in priority order)

1. **RazorpayX webhook signature verification** — `backend/routes/payroll.js`'s
   `/webhooks/razorpay-payout` currently just parses the payload without verifying
   `X-Razorpay-Signature`. Anyone who finds that URL can forge a payout status update.
2. **No DB transactions** on multi-step writes (employee create + document upload, exit +
   login deactivation, payroll run creation). A failure partway through leaves a half-done
   state with no rollback.
3. **No structured logging or error tracking** — just `console.error` scattered through routes.
   Add pino/winston + Sentry (or similar) before this is the only way you find out something's
   broken.
4. **No test suite**, especially the money paths (payroll's EPF/ESIC/PT/TDS math in
   `services/payrollCompliance.js`) and the approval chain (a bug there is either a wrongful
   auto-approval or a request stuck with nobody able to act on it).
5. **TrackPilot's real API contract** — `mapTrackPilotPayload()` in `routes/attendance.js` is a
   guess without their actual webhook/REST docs.
6. **No idempotency on webhooks** — a duplicate Razorpay/TrackPilot delivery can double-process
   a payout or attendance record.
7. **Migrations aren't versioned/tracked** — you're running numbered `.sql` files by hand with
   no tool (Knex/Prisma Migrate/Flyway) recording what's already been applied where. Fine solo;
   won't scale past you.
8. **No DB backup/restore strategy** documented anywhere.

## Roadmap — what's left from the original blueprint

Carbon Operations (Scope 1/2/3, registry verification, tokenization, marketplace, blockchain
explorer) is **deliberately excluded** — that's the EtherTrack *product* (the platform repo),
not this internal ops tool.

| Item | Status |
|---|---|
| Vendor bills / AP | Needs confirmation — mirror `routes/invoices.js` crediting Accounts Payable if not already done |
| Financial year close / retained earnings roll-forward | Not started |
| Dedicated modules for departments outside Finance/HR/Legal (Engineering, Marketing, Ops, etc.) | Not started — those departments currently only get self-service, since there's no dedicated page for them to grant access *to* |

## Continuing the build

Claude Code (desktop or terminal) plugged directly into this repo is the natural next step from
here — lets me see how things evolve as you test each piece instead of working from pasted
snippets and re-cloning to check drift.