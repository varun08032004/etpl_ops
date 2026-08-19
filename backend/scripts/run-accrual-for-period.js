#!/usr/bin/env node
/**
 * Monthly Accrual Job - Run for a specific period (defaults to previous month)
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { safeQuery } = require('../db/pool');
const { runMonthlyAccrual, processRevenueRecognition, processPrepaidExpenseAmortization } = require('../services/accrualService');

async function main() {
  const args = process.argv.slice(2);
  
  // Parse period from args or default to previous month
  let periodStart, periodEnd;
  if (args.includes('--period')) {
    const idx = args.indexOf('--period');
    if (args[idx + 1]) {
      // Format: YYYY-MM
      const [year, month] = args[idx + 1].split('-').map(Number);
      periodStart = new Date(year, month - 1, 1).toISOString().slice(0, 10);
      periodEnd = new Date(year, month, 0).toISOString().slice(0, 10);
    }
  } else {
    // Default: previous month
    const now = new Date();
    periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
    periodEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
  }
  
  console.log('🕐 Starting monthly accrual job...');
  console.log(`   Period: ${periodStart} to ${periodEnd}`);
  
  const { rows: [admin] } = await safeQuery(
    `SELECT id FROM staff_accounts WHERE role IN ('owner', 'admin') LIMIT 1`
  );
  
  if (!admin) {
    console.error('❌ No admin user found');
    process.exit(1);
  }

  try {
    const revenueResult = await processRevenueRecognition(periodStart, periodEnd, admin.id);
    const prepaidResult = await processPrepaidExpenseAmortization(periodStart, periodEnd, admin.id);
    
    console.log('\n✅ Monthly accrual completed:');
    console.log(`   Revenue Recognition: ${revenueResult.processed} schedules, ₹${revenueResult.totalAmount.toFixed(2)}`);
    console.log(`   Prepaid Expense: ${prepaidResult.processed} schedules, ₹${prepaidResult.totalAmount.toFixed(2)}`);
    
    if (revenueResult.journalEntryIds.length > 0) {
      console.log(`   Revenue JEs: ${revenueResult.journalEntryIds.join(', ')}`);
    }
    if (prepaidResult.journalEntryIds.length > 0) {
      console.log(`   Prepaid JEs: ${prepaidResult.journalEntryIds.join(', ')}`);
    }
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Monthly accrual failed:', err);
    process.exit(1);
  }
}

main();