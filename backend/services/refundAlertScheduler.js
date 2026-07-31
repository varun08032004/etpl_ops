'use strict';

// Daily check for refunds needing a reversing journal entry — mirrors
// services/churnAlertScheduler.js's pattern exactly.
//
// Add to your main server file: require('./services/refundAlertScheduler');

const cron = require('node-cron');
const { checkRefundsNeedingReversal } = require('./refundAlerts');

async function runDailyRefundCheck() {
  try {
    const { checked, needsReversal, alerted } = await checkRefundsNeedingReversal();
    console.log(`[refundAlertScheduler] Daily refund check complete: ${checked} checked, ${needsReversal} need reversal, ${alerted || 0} newly alerted.`);
  } catch (err) {
    console.error('[refundAlertScheduler] Daily refund check failed:', err);
  }
}

// Runs every day at 09:30 server time.
cron.schedule('30 9 * * *', runDailyRefundCheck);

console.log('[refundAlertScheduler] Scheduled: refund check will run at 09:30 every day.');

module.exports = { runDailyRefundCheck };