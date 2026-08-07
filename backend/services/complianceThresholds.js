'use strict';
// services/complianceThresholds.js
//
// Companion to services/complianceRules.js. That file maps a DONE one-time
// registration to the recurring filings it spawns. This file answers a
// different question: for a registration that ISN'T done yet, is it even
// legally required right now, or does the threshold that triggers it
// (headcount, turnover) just not apply yet?
//
// Only slugs with a real statutory numeric threshold get an evaluator here.
// Everything else (incorporation, trademark, DPIIT, etc.) has no threshold
// — those are always 'active' the moment the checklist item exists, which
// the migration backfills directly in the DB.
//
// Sources checked against public guidance current as of Aug 2026:
//   - EPF: mandatory at 20+ employees (headcount includes contract/apprentice).
//     "Once covered, always covered" — the obligation does NOT lapse if
//     headcount later drops back below 20.
//   - ESI: mandatory at 10+ employees, but only covers employees earning
//     <= the wage ceiling (compliance_settings.esic_wage_ceiling). Same
//     once-covered-always-covered rule applies at the org level.
//   - GST: mandatory once aggregate turnover (current FY, all supplies,
//     PAN-wide) crosses ₹40L (goods) / ₹20L (services) in normal-category
//     states, or ₹20L / ₹10L in special-category states. Turnover does NOT
//     have a "once crossed always applies" rule the same way EPF/ESI do —
//     businesses can legitimately fall back under the threshold and
//     deregister — but we still don't auto-downgrade an active flag here,
//     since that's a decision for whoever heads Legal & Compliance, not
//     something this job should silently reverse.
//   - Professional Tax: state-specific; applies once you have any active
//     employee in a state where PT is levied (i.e. a pt_slabs row exists
//     for that state).
//
// IMPORTANT: statutory thresholds and special-category state lists do
// change. Review this file at least once a year, same guidance as
// services/complianceRules.js and services/payrollCompliance.js.

const { safeQuery } = require('../db/pool');
const { isEPFMandatoryOrgWide } = require('./payrollCompliance');

const ACTIVE_EMPLOYEE_STATUSES = `('active','on_leave','notice_period')`;

// Special-category states get the lower GST threshold. Verify against the
// current CGST notification if you expand into a new state — this list has
// been stable since the 2019 threshold revision but is not guaranteed.
const GST_SPECIAL_CATEGORY_STATES = new Set([
  'Arunachal Pradesh', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Sikkim', 'Tripura', 'Uttarakhand',
]);

async function getComplianceSettingRow(key) {
  const { rows: [row] } = await safeQuery(`SELECT value, verified_by FROM compliance_settings WHERE key = $1`, [key]);
  return row || null;
}

async function getComplianceSetting(key) {
  const row = await getComplianceSettingRow(key);
  return row ? row.value : null;
}

// A slug's result is only as trustworthy as the settings it reads. Returns
// false the moment ANY dependency is missing or hasn't been signed off via
// POST /settings/compliance/:key/verify — used to render an "(unverified)"
// flag in the UI rather than presenting a web-researched default with the
// same confidence as a CA-confirmed figure.
async function allDependenciesVerified(keys) {
  for (const key of keys) {
    const row = await getComplianceSettingRow(key);
    if (!row || !row.verified_by) return false;
  }
  return true;
}

async function getActiveHeadcount() {
  const { rows: [{ count }] } = await safeQuery(
    `SELECT COUNT(*) FROM employees WHERE status IN ${ACTIVE_EMPLOYEE_STATUSES}`
  );
  return Number(count);
}

function fiscalYearBounds(today = new Date()) {
  const y = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1; // FY starts 1 Apr
  return { from: `${y}-04-01`, to: `${y + 1}-03-31` };
}

// ── EPFO ─────────────────────────────────────────────────────────────────
const EPFO_DEPENDS_ON = ['epf_mandatory_headcount'];
async function evaluateEpfo() {
  const threshold = Number(await getComplianceSetting('epf_mandatory_headcount')) || 20;
  const met = await isEPFMandatoryOrgWide();
  const headcount = await getActiveHeadcount();
  return {
    met,
    note: met
      ? `${headcount} active employees exceeds the EPF threshold of ${threshold} — registration is mandatory (within 30 days of crossing, per the EPF Act).`
      : `${headcount} active employees — EPF becomes mandatory once headcount exceeds ${threshold}.`,
  };
}

// ── ESIC ─────────────────────────────────────────────────────────────────
const ESIC_DEPENDS_ON = ['esic_mandatory_headcount', 'esic_wage_ceiling'];
async function evaluateEsic() {
  const headcountThreshold = Number(await getComplianceSetting('esic_mandatory_headcount')) || 10;
  const wageCeiling = Number(await getComplianceSetting('esic_wage_ceiling')) || 21000;
  const headcount = await getActiveHeadcount();
  const headcountMet = headcount > headcountThreshold;

  if (!headcountMet) {
    return { met: false, note: `${headcount} active employees — ESIC becomes mandatory once headcount exceeds ${headcountThreshold}.` };
  }

  // Headcount alone doesn't confirm anyone is actually ESIC-eligible — check
  // at least one active employee's approximate gross is at/under the ceiling.
  const { rows: [{ count: eligible }] } = await safeQuery(
    `SELECT COUNT(*) FROM employees
     WHERE status IN ${ACTIVE_EMPLOYEE_STATUSES}
       AND COALESCE(basic_monthly,0) + COALESCE(hra_monthly,0) + COALESCE(other_allowances_monthly,0) + COALESCE(da_monthly,0) <= $1`,
    [wageCeiling]
  );
  const met = Number(eligible) > 0;
  return {
    met,
    note: met
      ? `${headcount} active employees (over the ${headcountThreshold} threshold), and ${eligible} earning at/under the ₹${wageCeiling} ESIC wage ceiling — registration is mandatory (within 15 days of crossing, per the ESI Act).`
      : `${headcount} active employees exceeds the ESIC headcount threshold of ${headcountThreshold}, but none currently earn at/under the ₹${wageCeiling} wage ceiling — not yet required, but re-check whenever compensation changes.`,
  };
}

// ── GST ──────────────────────────────────────────────────────────────────
const GST_DEPENDS_ON = ['company_supply_type', 'company_registered_state'];
async function evaluateGst() {
  const supplyType = (await getComplianceSetting('company_supply_type')) || 'services';
  // company_registered_state (CA-verifiable, editable in Settings) takes
  // priority; COMPANY_STATE env var is only a fallback for orgs that
  // haven't run the 2026-08b migration / set it yet.
  const homeState = (await getComplianceSetting('company_registered_state')) || process.env.COMPANY_STATE || 'Maharashtra';
  const isSpecialCategory = GST_SPECIAL_CATEGORY_STATES.has(homeState);

  let threshold;
  if (supplyType === 'goods') threshold = isSpecialCategory ? 2000000 : 4000000;
  else threshold = isSpecialCategory ? 1000000 : 2000000; // 'services' or 'both' — use the lower, conservative figure

  const { from, to } = fiscalYearBounds();
  const { rows: [{ total }] } = await safeQuery(
    `SELECT COALESCE(SUM(subtotal + cgst_amount + sgst_amount + igst_amount), 0) AS total
     FROM invoices
     WHERE status != 'draft' AND status != 'void' AND invoice_date BETWEEN $1 AND $2`,
    [from, to]
  );
  const turnover = Number(total);
  const met = turnover > threshold;
  return {
    met,
    note: met
      ? `FY turnover ₹${turnover.toLocaleString('en-IN')} exceeds the ₹${threshold.toLocaleString('en-IN')} GST threshold (${supplyType}, ${homeState}${isSpecialCategory ? ' — special category' : ''}) — registration is mandatory.`
      : `FY turnover ₹${turnover.toLocaleString('en-IN')} — GST becomes mandatory above ₹${threshold.toLocaleString('en-IN')} (${supplyType}, ${homeState}${isSpecialCategory ? ' — special category' : ''}). Based on invoiced amounts, not full statutory "aggregate turnover" — confirm with your CA near the threshold.`,
  };
}

// ── Professional Tax ────────────────────────────────────────────────────
const PT_DEPENDS_ON = []; // reads pt_slabs directly, no compliance_settings dependency to verify
async function evaluateProfessionalTax() {
  const { rows } = await safeQuery(
    `SELECT DISTINCT e.state FROM employees e
     WHERE e.status IN ${ACTIVE_EMPLOYEE_STATUSES} AND e.state IS NOT NULL`
  );
  const states = rows.map((r) => r.state);
  if (!states.length) return { met: false, note: 'No active employees with a state on file yet.' };

  const { rows: ptRows } = await safeQuery(
    `SELECT DISTINCT state FROM pt_slabs WHERE state = ANY($1)`,
    [states]
  );
  const met = ptRows.length > 0;
  return {
    met,
    note: met
      ? `Active employees in PT-applicable state(s): ${ptRows.map((r) => r.state).join(', ')} — registration is mandatory in each.`
      : `Active employees in: ${states.join(', ')} — none currently configured as PT-applicable in pt_slabs.`,
  };
}

// slug -> { run, dependsOn }. Only registrations with a real statutory
// threshold belong here — everything else stays 'active' unconditionally.
const THRESHOLD_EVALUATORS = {
  epfo_registration: { run: evaluateEpfo, dependsOn: EPFO_DEPENDS_ON },
  esic_registration: { run: evaluateEsic, dependsOn: ESIC_DEPENDS_ON },
  gst: { run: evaluateGst, dependsOn: GST_DEPENDS_ON },
  professional_tax: { run: evaluateProfessionalTax, dependsOn: PT_DEPENDS_ON },
};

/**
 * Runs every evaluator WITHOUT writing anything — safe to call repeatedly
 * while your CA is reviewing configuration, or from a "preview" button in
 * the UI, before trusting it to update real data / send alerts.
 */
async function evaluateAllApplicability() {
  const results = {};
  for (const [slug, { run, dependsOn }] of Object.entries(THRESHOLD_EVALUATORS)) {
    const { met, note } = await run();
    const confidence = dependsOn.length === 0 ? 'verified' : (await allDependenciesVerified(dependsOn)) ? 'verified' : 'unverified';
    results[slug] = { met, note, confidence };
  }
  return results;
}

/**
 * Runs every configured evaluator, PERSISTS the result (status + note +
 * confidence) to one_time_registrations, and returns the list of slugs that
 * just transitioned from not_applicable_yet/unset -> active (i.e. newly,
 * actionably required) so the caller can alert on exactly those.
 */
async function refreshAllApplicability() {
  const { rows: registrations } = await safeQuery(
    `SELECT slug, title, is_done, applicability_status FROM one_time_registrations`
  );
  const bySlug = Object.fromEntries(registrations.map((r) => [r.slug, r]));

  const evaluated = await evaluateAllApplicability();
  const newlyRequired = [];

  for (const [slug, { met, note, confidence }] of Object.entries(evaluated)) {
    const existing = bySlug[slug];
    if (!existing) continue; // slug not in the checklist (shouldn't happen, but don't crash the whole run)

    // Once-active-always-active: never let a threshold evaluator downgrade
    // a registration that's already flagged active back to not-needed-yet.
    // (Matters most for EPF/ESI's "once covered, always covered" rule; for
    // GST it's a deliberate choice to require a human to un-flag it.)
    const newStatus = met || existing.applicability_status === 'active' ? 'active' : 'not_applicable_yet';

    await safeQuery(
      `UPDATE one_time_registrations
       SET applicability_status = $1, applicability_note = $2, applicability_confidence = $3, applicability_checked_at = NOW()
       WHERE slug = $4`,
      [newStatus, note, confidence, slug]
    );

    const justBecameRequired =
      newStatus === 'active' &&
      existing.applicability_status !== 'active' &&
      !existing.is_done;

    if (justBecameRequired) {
      newlyRequired.push({ slug, title: existing.title, note, confidence });
    }
  }

  return newlyRequired;
}

module.exports = { refreshAllApplicability, evaluateAllApplicability, THRESHOLD_EVALUATORS };