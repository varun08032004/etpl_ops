#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { safeQuery } = require('../db/pool');
const { processRevenueRecognition, processPrepaidExpenseAmortization } = require('../services/accrualService');

async function catchUpAccrual() {
  const { rows: [admin] } = await safeQuery(
    `SELECT id FROM staff_accounts WHERE role IN ('owner', 'admin') LIMIT 1`
  );
  
  if (!admin) {
    console.error('❌ No admin user found');
    process.exit(1);
  }
  
  // Process prepaid expenses for all overdue months (catch up)
  // Run until no more schedules are due
  let totalPrepaidProcessed = 0;
  let totalPrepaidAmount = 0;
  let iteration = 0;
  
  console.log('🔄 Catching up prepaid expense amortization...');
  
  while (iteration < 12) { // Max 12 iterations safety
    iteration++;
    const periodEnd = '2026-08-31';
    
    const result = await processPrepaidExpenseAmortization('2026-01-01', periodEnd, admin.id);
    
    if (result.processed === 0) {
      console.log(`  Iteration ${iteration}: No more schedules due`);
      break;
    }
    
    totalPrepaidProcessed += result.processed;
    totalPrepaidAmount += result.totalAmount;
    console.log(`  Iteration ${iteration}: Processed ${result.processed} schedules, ₹${result.totalAmount.toFixed(2)}`);
    
    if (result.journalEntryIds.length > 0) {
      console.log(`    JEs: ${result.journalEntryIds.join(', ')}`);
    }
  }
  
  console.log(`\n✅ Prepaid catch-up complete: ${totalPrepaidProcessed} schedules, ₹${totalPrepaidAmount.toFixed(2)}`);
  
  // Also process revenue recognition for overdue months
  let totalRevenueProcessed = 0;
  let totalRevenueAmount = 0;
  iteration = 0;
  
  console.log('\n🔄 Catching up revenue recognition...');
  
  while (iteration < 12) {
    iteration++;
    const periodEnd = '2026-08-31';
    
    const result = await processRevenueRecognition('2026-01-01', periodEnd, admin.id);
    
    if (result.processed === 0) {
      console.log(`  Iteration ${iteration}: No more schedules due`);
      break;
    }
    
    totalRevenueProcessed += result.processed;
    totalRevenueAmount += result.totalAmount;
    console.log(`  Iteration ${iteration}: Processed ${result.processed} schedules, ₹${result.totalAmount.toFixed(2)}`);
    
    if (result.journalEntryIds.length > 0) {
      console.log(`    JEs: ${result.journalEntryIds.join(', ')}`);
    }
  }
  
  console.log(`\n✅ Revenue catch-up complete: ${totalRevenueProcessed} schedules, ₹${totalRevenueAmount.toFixed(2)}`);
  
  process.exit(0);
}

catchUpAccrual().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});