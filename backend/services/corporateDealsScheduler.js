'use strict';

// Daily automated installment-due reminders for Corporate deals — without
// this, reminders only go out if someone manually hits
// POST /api/product/corporate-deals/send-reminders. Mirrors
// services/financeScheduler.js's / services/expenseScheduler.js's pattern
// exactly.
//
// Add to your main server file: require('./services/corporateDealsScheduler');

const cron = require('node-cron');
const { sendInstallmentReminders } = require('./corporateDeals');

async function runDailyInstallmentReminders() {
  try {
    const { sent } = await sendInstallmentReminders();
    console.log(`[corporateDealsScheduler] Installment reminder check complete: ${sent} email(s) sent.`);
  } catch (err) {
    console.error('[corporateDealsScheduler] Daily installment reminder check failed:', err);
  }
}

// Runs every day at 08:00 server time.
cron.schedule('0 8 * * *', runDailyInstallmentReminders);

console.log('[corporateDealsScheduler] Scheduled: installment reminder check will run at 08:00 every day.');

module.exports = { runDailyInstallmentReminders };