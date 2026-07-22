'use strict';

// Daily automated check for budget alerts — without this, budget.over_budget
// only fires when someone happens to open the Budgets tab that day. Mirrors
// services/expenseScheduler.js's pattern exactly.
//
// SETUP: npm install node-cron (skip if already installed for expenseScheduler.js)
// Add to your main server file: require('./services/financeScheduler');

const cron = require('node-cron');
const { safeQuery } = require('../db/pool');
const { computeVarianceAndAlert } = require('./budgetVariance');

function currentFiscalYearLabel() {
  const now = new Date();
  const fyStart = now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1;
  return `FY${fyStart}-${String((fyStart + 1) % 100).padStart(2, '0')}`;
}

async function runDailyBudgetCheck() {
  try {
    const fiscalYearLabel = currentFiscalYearLabel();
    const results = await computeVarianceAndAlert(fiscalYearLabel);
    const overBudgetCount = results.filter((r) => r.overBudget).length;
    console.log(`[financeScheduler] Budget check complete for ${fiscalYearLabel}: ${results.length} budget(s) checked, ${overBudgetCount} over budget.`);
  } catch (err) {
    console.error('[financeScheduler] Daily budget check failed:', err);
  }
}

// Runs every day at 07:00 server time — after the 06:00 expense check, so
// recurring-expense payments from today are already reflected.
cron.schedule('0 7 * * *', runDailyBudgetCheck);

console.log('[financeScheduler] Scheduled: budget alert check will run at 07:00 every day.');

module.exports = { runDailyBudgetCheck };