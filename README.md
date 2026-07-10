# EtherTrack Internal Ops

An internal-only ERP for running EtherTrack itself: HR, GST-compliant bookkeeping/accounting,
and payroll disbursal via RazorpayX. **Deliberately separate** from the customer-facing
platform's database and auth — internal HR/payroll data should never share a DB with
customer carbon-credit data.

## Why it's structured this way

- **Double-entry ledger is the core** (`backend/services/ledger.js`). Every financial event — an
  invoice, a payment, a payroll run, a manual adjustment — posts through `postJournalEntry()`.
  Nothing writes to a balance directly; balances are always derived by summing `journal_lines`.
  This is what makes it auditable and what lets Trial Balance / P&L / Balance Sheet just be
  queries over the same source of truth, instead of three separate things that can drift out
  of sync (which is how "advanced" homegrown accounting tools usually rot).
- A DB-level constraint trigger (`trg_journal_balanced`) additionally enforces that no journal
  entry can ever be unbalanced, even if application code has a bug. Belt and suspenders.
- Employees are never hard-deleted (`status = 'exited'` instead) so payroll/leave history stays intact.

## What's built and working

| Module | Status |
|---|---|
| Employee/HR CRUD, leave requests + approval | Done |
| Chart of accounts + manual journal entries | Done |
| Trial Balance / P&L / Balance Sheet reports | Done |
| GST invoicing (CGST+SGST vs IGST, auto-posts to ledger) | Done |
| Payment recording against invoices | Done |
| Payroll run generation (from attendance → LOP days → CTC breakup) | Done |
| Razorpay(X) payout disbursal + webhook status sync | Done — **needs your RazorpayX account + real key testing** |
| TrackPilot attendance sync (webhook + pull) | **Stubbed** — field mapping needs their real API docs |
| Vendor bills / expenses (AP) | Not built yet — same pattern as `backend/routes/invoices.js`, mirrored for the payable side |
| Financial year close / retained earnings roll-forward | Not built — flagged as a TODO in `getBalanceSheet()` |
| Frontend (React) | Not built |

## Setup (Supabase)

1. Create a **new, separate Supabase project** for this — not a new schema inside your
   existing platform project. Same reasoning as before: if that DB is ever compromised,
   you don't want employee PII and payroll sitting next to it.
2. Supabase Dashboard → your new project → Settings → Database → copy the **Direct
   connection** string (port 5432). Paste it into `.env` as `INTERNAL_OPS_DATABASE_URL`.
3. Run the schema. Either:
   - `npm run db:migrate && npm run db:seed` (needs `psql` installed locally), or
   - paste the contents of `backend/db/schema.sql` then `backend/db/seed_chart_of_accounts.sql` into
     Supabase's SQL Editor and run them — works exactly the same, no CLI needed.
4. Tables created via SQL Editor/psql do **not** have Row Level Security enabled by
   default, and this server connects as the `postgres` role (bypasses RLS anyway), so
   nothing extra to configure there. If you later add a Supabase-Auth-based admin panel
   that queries the DB directly via `@supabase/supabase-js` with the anon key, you'd need
   RLS policies then — not needed for this Express API.

```bash
cd backend
cp .env.example .env   # fill in Supabase connection string, JWT secret, Razorpay/TrackPilot keys
npm install
npm run db:migrate     # creates all tables
npm run db:seed        # seeds chart of accounts, default bank account, leave types
ALLOW_BOOTSTRAP=true npm run dev
curl -X POST localhost:5050/api/auth/bootstrap-owner -H 'Content-Type: application/json' \
  -d '{"email":"you@ethertrack.in","password":"a-strong-password"}'
# then set ALLOW_BOOTSTRAP=false and restart
```

Before you go live, set `COMPANY_STATE` to your actual GST-registered state — it drives
whether invoices split into CGST+SGST or charge IGST.

## Honest gaps to close next (in priority order)

1. **TrackPilot's real API contract.** I don't have their docs, so `backend/routes/attendance.js` has
   the DB side fully wired but the field mapping in `mapTrackPilotPayload()` is a guess.
   Grab their webhook payload sample or REST docs and it's a 20-line fix.
2. **RazorpayX webhook signature verification** — currently just parses the payload. Your
   existing `/api/subscription/webhook/razorpay` handler in the main repo already has the HMAC
   verification pattern; copy it into `backend/routes/payroll.js`.
3. **Vendor bills (AP)** — mirror `backend/routes/invoices.js` but crediting Accounts Payable instead
   of debiting Accounts Receivable. I'd build this next since bookkeeping is the module you
   said you're currently paying for.
4. **TDS on salaries** — the payroll calc does PF + professional tax but not income-tax TDS,
   which needs slab logic + investment declarations to do properly. At <10 employees most
   founders still run this past a CA once a quarter; automating it fully is real scope, not a
   quick add.
5. **A frontend.** Everything above is API-only right now.

## Frontend

`frontend/` — React (CRA) + MUI, matching the platform's stack. Dark theme with
monospace tabular figures for every currency amount (deliberate — decimals need
to line up when you're scanning a P&L).

```bash
cd frontend
npm install
npm start   # runs on :3000, proxies /api to :5050 (see package.json "proxy")
```

Pages built: Login, Dashboard (revenue/expense overview + 6-month chart), People
(employee list/detail with role-gated compensation visibility), Invoices (GST-aware
creation form), Accounting (Trial Balance / P&L / Balance Sheet tabs), Payroll (runs +
disbursal + per-employee breakdown).

Not built: a UI for adding parties/customers (backend route exists at
`POST /api/parties` — needs a form), vendor bills/AP screens, Documents, Sales.

## Roadmap (re-scoped from the original blueprint)

The original blueprint included CRM, Sales pipeline, and Carbon Operations
(Scope 1/2/3, registry verification, tokenization, marketplace, blockchain explorer).
**Carbon Operations is deliberately excluded here** — that's the EtherTrack *product*
(already in the `EtherTrack` platform repo), not an internal ops tool. Duplicating it
here would mean maintaining carbon-credit logic in two places that drift apart.

| Phase | Scope | Status |
|---|---|---|
| 1a | HR, Accounting/Bookkeeping ledger, GST invoicing, Payroll, Dashboard | Backend done · Frontend done |
| 1b | Documents (contracts, offer letters, NDAs, policies — versioned) | Not started |
| 1c | Sales (lightweight prospect/lead pipeline — stops once a lead becomes a paying customer, since the platform's subscription/billing takes over from there) | Not started |
| 1d | Automation (trigger→action rules on existing data: overdue invoice → reminder, new hire → checklist) | Not started |
| 1e | AI Assistant (natural-language queries over this system's own data via the Anthropic API) | Not started |
| 2+ | Compliance filings, Procurement, Assets, Inventory, Analytics, Admin/RBAC, multi-channel Notifications | Not started (matches original blueprint's own Phase 2/3 split) |

## Continuing the build

This is the kind of thing that's much smoother to keep building inside your actual repo,
with me able to see how things evolve as you test each piece. Claude Code (desktop or
terminal) plugged into your `EtherTrack` repo would be the natural next step for wiring
this in and building out the vendor-bills module + frontend.
