#!/usr/bin/env node
/**
 * Monthly Accrual Job - Run on 1st of each month at 2 AM
 * Processes revenue recognition and prepaid expense amortization
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { safeQuery } = require('../db/pool');
const { runMonthlyAccrual } = require('../services/accrualService');

async function main() {
  console.log('🕐 Starting monthly accrual job...');
  console.log(`   Time: ${new Date().toISOString()}`);
  
  // Use system user or first admin for createdBy
  const { rows: [admin] } = await safeQuery(
    `SELECT id FROM staff_accounts WHERE role IN ('owner', 'admin') ORDER BY created_at LIMIT 1`
  );
  
  if (!admin) {
    console.error('❌ No admin user found for accrual job');
    process.exit(1);
  }

  try {
    const result = await runMonthlyAccrual(admin.id);
    
    console.log('\n✅ Monthly accrual completed:');
    console.log(`   Period: ${result.period.start} to ${result.period.end}`);
    console.log(`   Revenue Recognition: ${result.revenueRecognition.processed} schedules, ₹${result.revenueRecognition.totalAmount}`);
    console.log(`   Prepaid Expense: ${result.prepaidExpense.processed} schedules, ₹${result.prepaidExpense.totalAmount}`);
    
    if (result.revenueRecognition.journalEntryIds.length > 0) {
      console.log(`   Revenue JEs: ${result.revenueRecognition.journalEntryIds.join(', ')}`);
    }
    if (result.prepaidExpense.journalEntryIds.length > 0) {
      console.log(`   Prepaid JEs: ${result.prepaidExpense.journalEntryIds.join(', ')}`);
    }
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Monthly accrual failed:', err);
    process.exit(1);
  }
}

main();