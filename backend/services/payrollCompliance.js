// ─────────────────────────────────────────────────────────────────────────
// services/payrollCompliance.js
//
// Implements the statutory logic from Ethertrack's payroll compliance
// blueprint: TDS (Section 192 monthly projection method, dual regime),
// EPF, ESIC, Professional Tax, the 50% wage-cap rule, and Full & Final
// settlement math.
//
// IMPORTANT: this is a computational framework built to match the rules as
// documented. Tax law has genuine edge cases (surcharge marginal relief,
// HRA exemption calculation specifics, multi-employer TDS, arrears relief
// under 89(1), etc.) that a general-purpose engine like this simplifies.
// Have your CA review this against a real payroll run before trusting it
// for actual statutory filings.
//
// 2026-07 fix: calculateEPF and calculatePT used to silently return a ₹0
// contribution/deduction when their required config (epf_wage_ceiling /
// a matching pt_slabs row) was missing, instead of erroring like
// computeAnnualTax already does for missing tax slabs. That meant a
// misconfigured org could run payroll "successfully" while quietly
// deducting no PF or no PT for real employees — a compliance violation
// that would accumulate silently. Both now throw, matching the existing
// computeAnnualTax pattern. Callers (the payroll run job/UI) MUST catch
// and surface these as blocking errors, not swallow them.
// ─────────────────────────────────────────────────────────────────────────
'use strict';

const { safeQuery } = require('../db/pool');

function apply50PercentWageCapRule({ basic, da = 0, otherAllowances }) {
  const grossFull = basic + da + otherAllowances;
  const minRequiredBasicDA = grossFull * 0.5;
  const actualBasicDA = basic + da;

  if (actualBasicDA >= minRequiredBasicDA) {
    return { adjustedBasic: basic, adjustedDA: da, adjustedOtherAllowances: otherAllowances, wasAdjusted: false };
  }

  const shortfall = minRequiredBasicDA - actualBasicDA;
  const adjustedBasic = basic + shortfall;
  const adjustedOtherAllowances = otherAllowances - shortfall;

  return {
    adjustedBasic: Math.round(adjustedBasic * 100) / 100,
    adjustedDA: da,
    adjustedOtherAllowances: Math.round(Math.max(0, adjustedOtherAllowances) * 100) / 100,
    wasAdjusted: true,
  };
}

async function getComplianceSetting(key) {
  const { rows: [row] } = await safeQuery(`SELECT value FROM compliance_settings WHERE key = $1`, [key]);
  return row ? Number(row.value) : null;
}

async function isEPFMandatoryOrgWide() {
  const threshold = await getComplianceSetting('epf_mandatory_headcount');
  const { rows: [{ count }] } = await safeQuery(
    `SELECT COUNT(*) FROM employees WHERE status IN ('active','on_leave','notice_period')`
  );
  return Number(count) > threshold;
}

async function calculateEPF({ basicPlusDA, pfApplicable }) {
  if (!pfApplicable) return { employeeContribution: 0, employerContribution: 0, wageBase: 0 };

  const ceiling = await getComplianceSetting('epf_wage_ceiling');
  if (ceiling == null) {
    // Previously: Math.min(basicPlusDA, null) silently coerced to 0, so PF
    // came out ₹0 for everyone with no error. That's a compliance violation
    // hiding as a successful payroll run — fail loudly instead.
    throw new Error('epf_wage_ceiling is not configured in compliance_settings — cannot compute EPF safely. Set it before running payroll.');
  }

  const wageBase = Math.min(basicPlusDA, ceiling);
  const employeeContribution = Math.round(wageBase * 0.12 * 100) / 100;
  const employerContribution = Math.round(wageBase * 0.12 * 100) / 100;
  return { employeeContribution, employerContribution, wageBase };
}

async function isESICApplicable({ grossMonthly, employeeOverride }) {
  if (employeeOverride === true || employeeOverride === false) return employeeOverride;

  const headcountThreshold = await getComplianceSetting('esic_mandatory_headcount');
  const wageCeiling = await getComplianceSetting('esic_wage_ceiling');

  const { rows: [{ count }] } = await safeQuery(
    `SELECT COUNT(*) FROM employees WHERE status IN ('active','on_leave','notice_period')`
  );
  const orgQualifies = Number(count) > headcountThreshold;

  return orgQualifies && grossMonthly <= wageCeiling;
}

function calculateESIC({ grossMonthly, applicable }) {
  if (!applicable) return { employeeDeduction: 0, employerContribution: 0 };
  return {
    employeeDeduction: Math.round(grossMonthly * 0.0075 * 100) / 100,
    employerContribution: Math.round(grossMonthly * 0.0325 * 100) / 100,
  };
}

async function calculatePT({ grossMonthly, state, month }) {
  const { rows } = await safeQuery(
    `SELECT * FROM pt_slabs WHERE state = $1 AND gross_from <= $2 AND (gross_to IS NULL OR gross_to > $2)
     ORDER BY gross_from DESC LIMIT 1`,
    [state, grossMonthly]
  );
  if (!rows.length) {
    // Previously: returned { amount: 0, note: '...' } — silent unless the
    // caller specifically checks `note`. An employee in an unconfigured
    // state got ₹0 PT deducted every month indefinitely, with nothing
    // forcing anyone to notice. Fail loudly instead, matching computeAnnualTax.
    throw new Error(`No PT slab configured for state "${state}" at gross ₹${grossMonthly} — add a row to pt_slabs before running payroll for this employee, or explicitly mark them PT-exempt if that's correct.`);
  }

  const slab = rows[0];
  const amount = (month === 2 && slab.applies_in_february_override != null) ? Number(slab.applies_in_february_override) : Number(slab.monthly_amount);
  return { amount, note: null };
}

function fyMonthNumber(calendarMonth) {
  return calendarMonth >= 4 ? calendarMonth - 3 : calendarMonth + 9;
}

function currentFiscalYearLabel(calendarMonth, calendarYear) {
  const fyStartYear = calendarMonth >= 4 ? calendarYear : calendarYear - 1;
  return `FY${fyStartYear}-${String((fyStartYear + 1) % 100).padStart(2, '0')}`;
}

async function computeAnnualTax(taxableIncome, regime, fiscalYear) {
  const { rows: slabs } = await safeQuery(
    `SELECT * FROM tax_slabs WHERE regime = $1 AND fiscal_year = $2 ORDER BY income_from ASC`,
    [regime, fiscalYear]
  );
  if (!slabs.length) throw new Error(`No tax slabs configured for ${regime} regime, ${fiscalYear} — run seed_tax_pt_slabs.sql or add manually`);

  let tax = 0;
  for (const slab of slabs) {
    const from = Number(slab.income_from);
    const to = slab.income_to != null ? Number(slab.income_to) : Infinity;
    if (taxableIncome <= from) continue;
    const taxableInThisSlab = Math.min(taxableIncome, to) - from;
    tax += taxableInThisSlab * (Number(slab.rate_percent) / 100);
  }

  const rebateThreshold = regime === 'new' ? 1200000 : 500000;
  const rebateCap = regime === 'new' ? 60000 : 12500;
  if (taxableIncome <= rebateThreshold) {
    tax = Math.max(0, tax - Math.min(tax, rebateCap));
  }

  let surchargeRate = 0;
  if (taxableIncome > 20000000) surchargeRate = 0.25;
  else if (taxableIncome > 10000000) surchargeRate = 0.15;
  else if (taxableIncome > 5000000) surchargeRate = 0.10;
  const surcharge = tax * surchargeRate;

  const cess = (tax + surcharge) * 0.04;
  return Math.round((tax + surcharge + cess) * 100) / 100;
}

async function projectMonthlyTDS({ employee, currentMonthGross, ytdGrossThisFY, ytdTDSThisFY, calendarMonth, calendarYear }) {
  const regime = employee.tax_regime || 'new';
  const fiscalYear = currentFiscalYearLabel(calendarMonth, calendarYear);
  const monthNum = fyMonthNumber(calendarMonth);
  const monthsRemaining = 12 - monthNum + 1;

  const projectedAnnualGross = ytdGrossThisFY + (currentMonthGross * monthsRemaining);

  let taxableIncome = projectedAnnualGross;

  if (regime === 'old') {
    const declared = employee.declared_deductions || {};
    const section80C = Math.min(Number(declared.section_80c || 0), 150000);
    const section80D = Math.min(Number(declared.section_80d || 0), 100000);
    const hraExemption = Number(declared.hra_exemption_annual || 0);
    taxableIncome -= (section80C + section80D + hraExemption);
  }

  const { rows: [slabCheck] } = await safeQuery(`SELECT standard_deduction FROM tax_slabs WHERE regime = $1 AND fiscal_year = $2 LIMIT 1`, [regime, fiscalYear]);
  const standardDeduction = slabCheck ? Number(slabCheck.standard_deduction) : (regime === 'new' ? 75000 : 50000);
  taxableIncome = Math.max(0, taxableIncome - standardDeduction);

  const annualTaxLiability = await computeAnnualTax(taxableIncome, regime, fiscalYear);

  const remainingTaxToCollect = Math.max(0, annualTaxLiability - ytdTDSThisFY);
  const monthlyTDS = monthsRemaining > 0 ? Math.round((remainingTaxToCollect / monthsRemaining) * 100) / 100 : 0;

  return { monthlyTDS, projectedAnnualGross, taxableIncome, annualTaxLiability, fiscalYear };
}

function addWorkingDays(startDate, days) {
  const date = new Date(startDate);
  let added = 0;
  while (added < days) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return date;
}

async function computeFinalSettlementDeadline(exitDate) {
  const days = await getComplianceSetting('ff_settlement_days');
  return addWorkingDays(exitDate, days || 2);
}

module.exports = {
  apply50PercentWageCapRule,
  calculateEPF,
  isEPFMandatoryOrgWide,
  isESICApplicable,
  calculateESIC,
  calculatePT,
  projectMonthlyTDS,
  computeAnnualTax,
  computeFinalSettlementDeadline,
  currentFiscalYearLabel,
  fyMonthNumber,
};