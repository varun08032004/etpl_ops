'use strict';
// services/complianceRules.js
//
// Maps each one-time registration to the recurring filings it triggers.
// Sourced from GSTN, EPFO/ESIC and MCA public due-date schedules (checked July 2026).
// Statutory due dates can shift with government notifications — review this
// file at least once a year, or whenever a compliance owner flags a mismatch.
//
// 2026-07 update: professional_tax no longer uses one generic placeholder.
// getRulesForSlug() is now ASYNC — when called with 'professional_tax', it
// queries YOUR pt_slabs table (see services/payrollCompliance.js) for the
// distinct states you've actually configured, and generates one recurring
// filing per state using STATE_PT_DUE_DATES below. States found in pt_slabs
// but not in that lookup still fall back to a flagged placeholder, rather
// than silently guessing.
//
// PT due dates sourced from public guidance current as of mid-2026 —
// confirm against each state's PT portal, since these can and do change
// (e.g. Maharashtra's PTRC due date moved from end-of-month to the 15th
// effective March 2026).

const { safeQuery } = require('../db/pool');

const RECURRING_RULES = {
  incorporation: [
    { key: 'aoc4', title: 'AOC-4 — Filing of Financial Statements', category: 'roc', interval: 'annual', dueRule: { type: 'fixed_annual', month: 10, day: 30 }, note: 'Due 30 days after AGM; assumes AGM held by 30 Sep.' },
    { key: 'mgt7', title: 'MGT-7 — Annual Return', category: 'roc', interval: 'annual', dueRule: { type: 'fixed_annual', month: 11, day: 29 }, note: 'Due 60 days after AGM.' },
    { key: 'dir3kyc', title: 'DIR-3 KYC — Director KYC', category: 'roc', interval: 'annual', dueRule: { type: 'fixed_annual', month: 9, day: 30 } },
    { key: 'dpt3', title: 'DPT-3 — Return of Deposits', category: 'roc', interval: 'annual', dueRule: { type: 'fixed_annual', month: 6, day: 30 } },
    { key: 'msme1_h1', title: 'MSME-1 — Half-Yearly Return (Oct–Mar)', category: 'roc', interval: 'half_yearly', dueRule: { type: 'fixed_annual', month: 4, day: 30 } },
    { key: 'msme1_h2', title: 'MSME-1 — Half-Yearly Return (Apr–Sep)', category: 'roc', interval: 'half_yearly', dueRule: { type: 'fixed_annual', month: 10, day: 31 } },
  ],
  gst: [
    { key: 'gstr3b', title: 'GSTR-3B', category: 'gst', interval: 'monthly', dueRule: { type: 'day_of_next_month', day: 20 } },
    { key: 'gstr1', title: 'GSTR-1', category: 'gst', interval: 'monthly', dueRule: { type: 'day_of_next_month', day: 11 } },
    { key: 'gstr9', title: 'GSTR-9 — Annual Return', category: 'gst', interval: 'annual', dueRule: { type: 'fixed_annual', month: 12, day: 31 }, note: 'Mandatory only above ₹2cr turnover — mark not-applicable if below.' },
  ],
  shram_suvidha: [
    { key: 'epf_ecr', title: 'EPF ECR — Monthly PF Return & Payment', category: 'pf', interval: 'monthly', dueRule: { type: 'day_of_next_month', day: 15 } },
    { key: 'esi_contribution', title: 'ESI Monthly Contribution', category: 'esic', interval: 'monthly', dueRule: { type: 'day_of_next_month', day: 15 } },
    { key: 'esi_half_yearly_1', title: 'ESI Half-Yearly Return (Apr–Sep)', category: 'esic', interval: 'half_yearly', dueRule: { type: 'fixed_annual', month: 11, day: 11 } },
    { key: 'esi_half_yearly_2', title: 'ESI Half-Yearly Return (Oct–Mar)', category: 'esic', interval: 'half_yearly', dueRule: { type: 'fixed_annual', month: 5, day: 12 } },
  ],
  income_tax_portal: [
    { key: 'itr6', title: 'ITR-6 — Company Income Tax Return', category: 'tds', interval: 'annual', dueRule: { type: 'fixed_annual', month: 10, day: 31 }, note: 'Applies where a tax audit is required; 30 Sep otherwise.' },
    { key: 'tds_q1', title: 'TDS Return — Q1 (Apr–Jun)', category: 'tds', interval: 'quarterly', dueRule: { type: 'fixed_annual', month: 7, day: 31 } },
    { key: 'tds_q2', title: 'TDS Return — Q2 (Jul–Sep)', category: 'tds', interval: 'quarterly', dueRule: { type: 'fixed_annual', month: 10, day: 31 } },
    { key: 'tds_q3', title: 'TDS Return — Q3 (Oct–Dec)', category: 'tds', interval: 'quarterly', dueRule: { type: 'fixed_annual', month: 1, day: 31 } },
    { key: 'tds_q4', title: 'TDS Return — Q4 (Jan–Mar)', category: 'tds', interval: 'quarterly', dueRule: { type: 'fixed_annual', month: 5, day: 31 } },
    { key: 'advance_tax_q1', title: 'Advance Tax — 1st Installment (15%)', category: 'tds', interval: 'annual', dueRule: { type: 'fixed_annual', month: 6, day: 15 } },
    { key: 'advance_tax_q2', title: 'Advance Tax — 2nd Installment (45% cumulative)', category: 'tds', interval: 'annual', dueRule: { type: 'fixed_annual', month: 9, day: 15 } },
    { key: 'advance_tax_q3', title: 'Advance Tax — 3rd Installment (75% cumulative)', category: 'tds', interval: 'annual', dueRule: { type: 'fixed_annual', month: 12, day: 15 } },
    { key: 'advance_tax_q4', title: 'Advance Tax — 4th Installment (100% cumulative)', category: 'tds', interval: 'annual', dueRule: { type: 'fixed_annual', month: 3, day: 15 } },
  ],
  dpiit: [],
  udyam: [],
  epan: [],
  trademark: [],

  shops_establishment: [
    { key: 'shops_est_renewal', title: 'Shops & Establishment — Renewal (verify your state\'s cycle)', category: 'labour', interval: 'annual', dueRule: { type: 'fixed_annual', month: 3, day: 31 }, note: 'NEEDS_STATE_INPUT: placeholder due date — confirm actual renewal cycle for your state; some states are multi-year, not annual.' },
  ],

  iec: [
    { key: 'iec_annual_update', title: 'IEC Annual Update (DGFT)', category: 'other', interval: 'annual', dueRule: { type: 'fixed_annual', month: 6, day: 30 }, note: 'Mandatory annual confirmation/update of IEC details on the DGFT portal between April–June, even with no changes.' },
  ],

  contract_labour_license: [
    { key: 'cll_renewal', title: 'Contract Labour License — Renewal (confirm issue-date anniversary)', category: 'labour', interval: 'annual', dueRule: { type: 'fixed_annual', month: 3, day: 31 }, note: 'Placeholder date — renewal is typically due before expiry, tied to your license\'s original issue date. Adjust once known.' },
  ],

  // professional_tax is intentionally NOT a static array here — see
  // getProfessionalTaxRules() below, which builds it dynamically per state.
};

// ── per-state PT return due dates ───────────────────────────────────────
// Sourced from public guidance current as of mid-2026. Frequency and dates
// vary by state and DO change — verify against the state's own PT portal.
// State names below must match exactly what's stored in pt_slabs.state.
const STATE_PT_DUE_DATES = {
  'Maharashtra':   { interval: 'monthly', dueRule: { type: 'day_of_next_month', day: 15 }, note: 'PTRC payment due date moved from end-of-month to the 15th, effective March 2026 — reconfirm if this changes again.' },
  'Karnataka':      { interval: 'monthly', dueRule: { type: 'day_of_next_month', day: 20 } },
  'West Bengal':    { interval: 'annual',  dueRule: { type: 'fixed_annual', month: 7, day: 31 }, note: 'Paid once per FY, not monthly, despite being a "monthly slab" state — confirm current GRIPS portal guidance.' },
  'Telangana':      { interval: 'monthly', dueRule: { type: 'day_of_next_month', day: 10 } },
  'Andhra Pradesh': { interval: 'monthly', dueRule: { type: 'day_of_next_month', day: 10 } },
  'Gujarat':        { interval: 'annual',  dueRule: { type: 'fixed_annual', month: 3, day: 31 } },
  'Madhya Pradesh': { interval: 'monthly', dueRule: { type: 'day_of_next_month', day: 10 } },
  'Odisha':         { interval: 'annual',  dueRule: { type: 'fixed_annual', month: 3, day: 31 } },
  'Bihar':          { interval: 'annual',  dueRule: { type: 'fixed_annual', month: 3, day: 31 } },
  'Tamil Nadu':     { interval: 'half_yearly', dueRule: { type: 'fixed_annual', month: 10, day: 31 }, note: 'Half-yearly: Apr–Sep due 31 Oct, Oct–Mar due 30 Apr. Only the first cycle is auto-spawned; the second half-year cycle follows automatically once this one is filed.' },
  'Kerala':         { interval: 'half_yearly', dueRule: { type: 'fixed_annual', month: 8, day: 31 }, note: 'Half-yearly: due 31 Aug and 28 Feb.' },
};

// ── due-date computation ────────────────────────────────────────────────
function computeFirstDueDate(dueRule, fromDate = new Date()) {
  const d = new Date(fromDate);
  if (dueRule.type === 'day_of_next_month') {
    return new Date(d.getFullYear(), d.getMonth() + 1, dueRule.day);
  }
  if (dueRule.type === 'fixed_annual') {
    const year = d.getFullYear();
    const candidate = new Date(year, dueRule.month - 1, dueRule.day);
    if (candidate < d) candidate.setFullYear(year + 1);
    return candidate;
  }
  throw new Error(`Unknown dueRule type: ${dueRule.type}`);
}

function toISODate(date) {
  return date.toISOString().slice(0, 10);
}

// Builds recurring PT filing rules dynamically from whichever states you
// actually have pt_slabs rows for — one filing per state, using a known
// due date where available, or a flagged placeholder if not.
async function getProfessionalTaxRules() {
  const { rows } = await safeQuery(`SELECT DISTINCT state FROM pt_slabs ORDER BY state`);
  if (!rows.length) {
    // No pt_slabs configured at all yet — fall back to one generic reminder
    // so nothing silently disappears, but flag it clearly.
    return [{
      key: 'pt_return_unconfigured',
      title: 'Professional Tax Return (no pt_slabs configured yet)',
      category: 'other',
      interval: 'monthly',
      dueRule: { type: 'day_of_next_month', day: 20 },
      note: 'NEEDS_STATE_INPUT: no rows in pt_slabs yet — add your state(s) there, then re-mark this registration to regenerate accurate per-state filings.',
    }];
  }

  return rows.map(({ state }) => {
    const known = STATE_PT_DUE_DATES[state];
    if (known) {
      return {
        key: `pt_return_${state.toLowerCase().replace(/\s+/g, '_')}`,
        title: `Professional Tax Return — ${state}`,
        category: 'other',
        interval: known.interval,
        dueRule: known.dueRule,
        note: known.note || null,
      };
    }
    // State has pt_slabs configured but isn't in our verified lookup yet.
    return {
      key: `pt_return_${state.toLowerCase().replace(/\s+/g, '_')}`,
      title: `Professional Tax Return — ${state} (verify due date)`,
      category: 'other',
      interval: 'monthly',
      dueRule: { type: 'day_of_next_month', day: 20 },
      note: `NEEDS_STATE_INPUT: "${state}" isn't in the verified STATE_PT_DUE_DATES lookup — confirm the actual filing frequency/due date and add it to services/complianceRules.js.`,
    };
  });
}

// getRulesForSlug is now ASYNC. Callers must `await` it.
async function getRulesForSlug(slug) {
  if (slug === 'professional_tax') {
    return getProfessionalTaxRules();
  }
  return RECURRING_RULES[slug] || [];
}

module.exports = { RECURRING_RULES, STATE_PT_DUE_DATES, computeFirstDueDate, toISODate, getRulesForSlug };