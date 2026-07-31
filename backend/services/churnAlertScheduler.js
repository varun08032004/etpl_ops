'use strict';

// Daily churn-event digest — pulls paid→free downgrades from the platform
// and emails Sales/CS a win-back list. Mirrors services/financeScheduler.js's
// / services/corporateDealsScheduler.js's pattern exactly.
//
// Add to your main server file: require('./services/churnAlertScheduler');

const cron = require('node-cron');
const { checkAndAlertChurn } = require('./churnAlerts');

async function runDailyChurnCheck() {
  try {
    const { checked, alerted } = await checkAndAlertChurn();
    console.log(`[churnAlertScheduler] Daily churn check complete: ${checked} event(s) checked, ${alerted} newly alerted.`);
  } catch (err) {
    console.error('[churnAlertScheduler] Daily churn check failed:', err);
  }
}

// Runs every day at 09:00 server time — after the platform's own expiry
// cron (00:30 boot + 24h interval) has had time to actually process
// downgrades for the day.
cron.schedule('0 9 * * *', runDailyChurnCheck);

console.log('[churnAlertScheduler] Scheduled: churn check will run at 09:00 every day.');

module.exports = { runDailyChurnCheck };