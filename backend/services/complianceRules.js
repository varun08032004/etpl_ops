'use strict';
// services/complianceRules.js
//
// Maps each one-time registration to the recurring filings it triggers.
// Sourced from GSTN, EPFO/ESIC and MCA public due-date schedules (checked July 2026).
// Statutory due dates can shift with government notifications — review this
// file at least once a year, or whenever a compliance owner flags a mismatch.

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
  ],
  dpiit: [], // No recurring statutory filing tied to DPIIT recognition itself.
  udyam: [], // Udyam has no renewal/recurring filing by itself.
  epan: [],  // PAN is permanent, no recurring filing.
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