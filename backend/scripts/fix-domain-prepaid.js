#!/usr/bin/env node
/**
 * Fix Prepaid Domain Expense - Convert to Proper Amortization
 * Domain: 89 RS paid May 2026, next due 2029 (3 years = 36 months)
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { safeQuery, withTransaction } = require('../db/pool');
const ledger = require('../services/ledger');
const { createPrepaidExpenseSchedule } = require('../services/accrualService');

async function findDomainBill() {
  console.log('🔍 Finding domain bill (Hostinger ~89 RS in May 2026)...\n');
  
  // Look for Hostinger bills around 89 RS in May 2026
  const { rows } = await safeQuery(`
    SELECT b.*, p.name as vendor_name
    FROM bills b
    LEFT JOIN parties p ON p.id = b.vendor_id
    WHERE (p.name ILIKE '%hostinger%' OR b.notes ILIKE '%hostinger%' OR b.notes ILIKE '%domain%')
      AND b.bill_date BETWEEN '2026-05-01' AND '2026-05-31'
      AND b.total_amount BETWEEN 80 AND 100
    ORDER BY b.bill_date
  `);
  
  if (rows.length === 0) {
    console.log('No exact match. Searching broader...');
    const { rows: broader } = await safeQuery(`
      SELECT b.*, p.name as vendor_name
      FROM bills b
      LEFT JOIN parties p ON p.id = b.vendor_id
WHERE (p.name ILIKE '%hostinger%' OR b.notes ILIKE '%hostinger%' OR b.notes ILIKE '%domain%')
        AND b.bill_date BETWEEN '2026-01-01' AND '2026-12-31'
      ORDER BY b.bill_date
    `);
    console.log(`Found ${broader.length} Hostinger/domain bills in 2026:`);
    for (const b of broader) {
      console.log(`  ${b.bill_number} | ${b.bill_date} | ₹${b.total_amount} | ${b.vendor_name} | Prepaid: ${b.is_prepaid}`);
    }
    return broader;
  }
  
  for (const b of rows) {
    console.log(`Found: ${b.bill_number} | ${b.bill_date} | ₹${b.total_amount} | ${b.vendor_name}`);
    console.log(`  Prepaid: ${b.is_prepaid} | End Date: ${b.prepaid_end_date}`);
    console.log(`  JE: ${b.journal_entry_id || 'none'} | Status: ${b.status}`);
    console.log(`  Description: ${b.description}`);
    console.log('');
  }
  
  return rows;
}

async function fixDomainPrepaid(billId, dryRun = true) {
  console.log(`\n🔧 ${dryRun ? 'DRY RUN: ' : ''}Fixing domain bill ${billId} as prepaid expense (3 years)...\n`);
  
  const { rows: [bill] } = await safeQuery(`SELECT * FROM bills WHERE id = $1`, [billId]);
  if (!bill) {
    console.error('Bill not found');
    return;
  }
  
  if (bill.is_prepaid) {
    console.log('Already marked as prepaid');
    return;
  }
  
  const { rows: [je] } = await safeQuery(
    `SELECT * FROM journal_entries WHERE id = $1`, [bill.journal_entry_id]
  );
  
  if (!je) {
    console.error('No journal entry found for this bill');
    return;
  }
  
  console.log(`Current JE: ${je.id} (${je.entry_date})`);
  console.log(`Narration: ${je.narration}`);
  
  // Get the journal lines
  const { rows: lines } = await safeQuery(
    `SELECT jl.*, coa.code, coa.name, coa.account_type
     FROM journal_lines jl
     JOIN chart_of_accounts coa ON coa.id = jl.account_id
     WHERE jl.journal_entry_id = $1
     ORDER BY jl.debit DESC NULLS LAST`,
    [je.id]
  );
  
  console.log('\nCurrent JE Lines:');
  for (const line of lines) {
    const side = line.debit > 0 ? `Dr ${line.debit}` : `Cr ${line.credit}`;
    console.log(`  ${line.code} ${line.name}: ${side} (${line.account_type})`);
  }
  
  // Check if it posted to expense directly (wrong for prepaid) or prepaid asset (correct)
  const expenseLine = lines.find(l => l.account_type === 'expense' && l.debit > 0);
  const prepaidLine = lines.find(l => l.code === '1500' && l.debit > 0);
  
  if (expenseLine && !prepaidLine) {
    console.log('\n❌ PROBLEM: Posted directly to Expense (should be Prepaid Asset for 3-year domain)');
    console.log('   Need to:');
    console.log('   1. Reverse current JE');
    console.log('   2. Post new JE: Dr Prepaid Expenses (1500) / Cr Director Loan (2150) or Bank/AP');
    console.log('   3. Create prepaid expense schedule for 36 months (May 2026 - May 2029)');
    console.log('   4. Mark bill as prepaid with prepaid_end_date = 2029-05-31');
    
    if (!dryRun) {
      console.log('\n🔄 Executing fix...');
      
      const { rows: [admin] } = await safeQuery(
        `SELECT id FROM staff_accounts WHERE role IN ('owner', 'admin') LIMIT 1`
      );
      
      // 1. Reverse the original JE
      const reversal = await ledger.reverseJournalEntry(je.id, {
        reason: 'Convert domain expense to prepaid expense amortization (3 years)',
        createdBy: admin.id
      });
      console.log(`✅ Reversed original JE: ${reversal.id}`);
      
      // 2. Update bill to mark as prepaid
      const prepaidEndDate = '2029-05-31'; // 3 years from May 2026
      await safeQuery(
        `UPDATE bills SET is_prepaid = true, prepaid_end_date = $1 WHERE id = $2`,
        [prepaidEndDate, billId]
      );
      console.log(`✅ Updated bill: is_prepaid=true, prepaid_end_date=${prepaidEndDate}`);
      
      // 3. Create prepaid expense schedule (this posts new JE to Prepaid Expenses)
      const accrualResult = await createPrepaidExpenseSchedule(billId, admin.id);
      if (accrualResult) {
        console.log(`✅ Posted new JE to Prepaid Expenses: ${accrualResult.journalEntry.id}`);
        console.log(`✅ Created prepaid expense schedule (36 months)`);
        console.log(`   Monthly amortization: ₹${(bill.total_amount / 36).toFixed(2)}`);
      }
      
      console.log('\n✅ Fix completed! Monthly amortization will now process 1/36th each month.');
    }
  } else if (prepaidLine) {
    console.log('\n✅ Already correctly posted to Prepaid Expenses');
  } else {
    console.log('\n⚠️  Unexpected JE structure - manual review needed');
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--execute');
  const billId = args.find(a => !a.startsWith('--'));
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  FIX PREPAID DOMAIN EXPENSE - 3-Year Amortization');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Mode: ${dryRun ? 'DRY RUN (use --execute to actually fix)' : 'EXECUTE MODE'}\n`);
  
  const bills = await findDomainBill();
  
  if (bills && bills.length > 0) {
    const targetId = billId || bills[0].id;
    await fixDomainPrepaid(targetId, dryRun);
  }
  
  if (dryRun) {
    console.log('\n💡 Run with --execute to perform actual fix');
  }
  
  console.log('\n═══════════════════════════════════════════════════════════════');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});