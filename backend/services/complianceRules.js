'use strict';
// services/complianceRules.js
//
// Maps each one-time registration to the recurring filings it triggers.
// Sourced from GSTN, EPFO/ESIC and MCA public due-date schedules (checked July 2026).
// Statutory due dates can shift with government notifications — review this
// file at least once a year, or whenever a compliance owner flags a mismatch.
//
// 2026-07 update: added trademark, shops_establishment, professional_tax,
// iec, contract_labour_license as available one-time registration slugs
// (see migration for seed rows). professional_tax and shops_establishment
// due dates are STATE-DEPENDENT — the rules below use commonly-seen
// defaults and are flagged NEEDS_STATE_INPUT. Confirm against your actual
// state's rules before relying on the auto-generated due date.

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
  dpiit: [], // No recurring statutory filing tied to DPIIT recognition itself.
  udyam: [], // Udyam has no renewal/recurring filing by itself.
  epan: [],  // PAN is permanent, no recurring filing.

  // ── added 2026-07 ──────────────────────────────────────────────────────
  trademark: [], // No recurring filing until renewal — that's a single 10-year-out event,
                  // not a fit for monthly/quarterly/half_yearly/annual. Track renewal manually.

  shops_establishment: [
    // NEEDS_STATE_INPUT: renewal cycle and due date vary by state (some annual,
    // some multi-year depending on establishment size). Defaulting to an
    // annual reminder on the registration's own anniversary is NOT implemented
    // here since it needs the actual registration date, which the one-time
    // registration record already stores — confirm your state's actual cycle
    // and adjust this rule (or the spawned item's due date) accordingly.
    { key: 'shops_est_renewal', title: 'Shops & Establishment — Renewal (verify your state\'s cycle)', category: 'labour', interval: 'annual', dueRule: { type: 'fixed_annual', month: 3, day: 31 }, note: 'NEEDS_STATE_INPUT: placeholder due date — confirm actual renewal cycle for your state; some states are multi-year, not annual.' },
  ],

  professional_tax: [
    // NEEDS_STATE_INPUT: PT return frequency and due date vary significantly
    // by state (e.g. Maharashtra: monthly by end of month; Karnataka: monthly
    // by 20th; some states: annual). Using a generic monthly-by-20th default —
    // CONFIRM against your actual state's PT rules before relying on this.
    { key: 'pt_return', title: 'Professional Tax Return (verify your state\'s frequency)', category: 'other', interval: 'monthly', dueRule: { type: 'day_of_next_month', day: 20 }, note: 'NEEDS_STATE_INPUT: placeholder — PT return frequency/due date varies by state.' },
  ],

  iec: [
    { key: 'iec_annual_update', title: 'IEC Annual Update (DGFT)', category: 'other', interval: 'annual', dueRule: { type: 'fixed_annual', month: 6, day: 30 }, note: 'Mandatory annual confirmation/update of IEC details on the DGFT portal between April–June, even with no changes.' },
  ],

  contract_labour_license: [
    // Renewal date depends on original issue date, not a fixed calendar date —
    // placeholder annual reminder; adjust to your license's actual issue anniversary.
    { key: 'cll_renewal', title: 'Contract Labour License — Renewal (confirm issue-date anniversary)', category: 'labour', interval: 'annual', dueRule: { type: 'fixed_annual', month: 3, day: 31 }, note: 'Placeholder date — renewal is typically due before expiry, tied to your license\'s original issue date. Adjust once known.' },
  ],
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
    if (candidate < d) candidate.setFullYear(year + 1); // roll to next occurrence if this year's date already passed
    return candidate;
  }
  throw new Error(`Unknown dueRule type: ${dueRule.type}`);
}

function toISODate(date) {
  return date.toISOString().slice(0, 10);
}

function getRulesForSlug(slug) {
  return RECURRING_RULES[slug] || [];
}

module.exports = { RECURRING_RULES, computeFirstDueDate, toISODate, getRulesForSlug };