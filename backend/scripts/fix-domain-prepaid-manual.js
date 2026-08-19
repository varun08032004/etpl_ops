#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { safeQuery, withTransaction } = require('../db/pool');
const ledger = require('../services/ledger');
const { createPrepaidExpenseSchedule } = require('../services/accrualService');

async function fixDomainPrepaidManual(dryRun = true) {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  FIX PREPAID DOMAIN EXPENSE - Manual (bypass trigger)');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'EXECUTE'}\n`);
  
  const billId = 'e3b6b903-4669-4026-a543-873b91c0952e';
  
  const { rows: [bill] } = await safeQuery(`SELECT * FROM bills WHERE id = $1`, [billId]);
  if (!bill) {
    console.error('Bill not found');
    return;
  }
  
  console.log(`Bill: ${bill.bill_number} | Date: ${bill.bill_date} | Amount: ${bill.total_amount} | Vendor: ${bill.vendor_id}`);
  console.log(`Current: is_prepaid=${bill.is_prepaid}, prepaid_end_date=${bill.prepaid_end_date}`);
  
  const { rows: [je] } = await safeQuery(`SELECT * FROM journal_entries WHERE id = $1`, [bill.journal_entry_id]);
  if (!je) {
    console.error('No journal entry found');
    return;
  }
  
  console.log(`\nJE: ${je.id} (${je.entry_date})`);
  console.log(`Narration: ${je.narration}`);
  
  const { rows: lines } = await safeQuery(`
    SELECT jl.*, coa.code, coa.name, coa.account_type
    FROM journal_lines jl
    JOIN chart_of_accounts coa ON coa.id = jl.account_id
    WHERE jl.journal_entry_id = $1
    ORDER BY jl.debit DESC NULLS LAST
  `, [je.id]);
  
  console.log('\nCurrent JE Lines:');
  for (const line of lines) {
    const side = line.debit > 0 ? `Dr ${line.debit}` : `Cr ${line.credit}`;
    console.log(`  ${line.code} ${line.name}: ${side} (${line.account_type})`);
  }
  
  const expenseLine = lines.find(l => l.account_type === 'expense' && l.debit > 0);
  const prepaidLine = lines.find(l => l.code === '1500' && l.debit > 0);
  const creditLine = lines.find(l => (l.code === '2150' || l.code === '2100' || l.code === '1110') && l.credit > 0);
  
  if (expenseLine && !prepaidLine && creditLine) {
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
      
      // 2. Update bill to mark as prepaid (bypass trigger with direct SQL)
      const prepaidEndDate = '2029-05-31';
      await safeQuery(
        `UPDATE bills SET is_prepaid = true, prepaid_end_date = $1 WHERE id = $2`,
        [prepaidEndDate, billId]
      );
      console.log(`✅ Updated bill: is_prepaid=true, prepaid_end_date=${prepaidEndDate}`);
      
      // 3. Post new JE to Prepaid Expenses
      const { rows: [prepaidAcct] } = await safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '1500'`);
      const { rows: [directorAcct] } = await safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '2150'`);
      const { rows: [cgstAcct] } = await safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '1410'`);
      const { rows: [sgstAcct] } = await safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '1420'`);
      const { rows: [igstAcct] } = await safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '1430'`);
      
      // Find GST lines from original
      const cgstLine = lines.find(l => l.code === '1410');
      const sgstLine = lines.find(l => l.code === '1420');
      const igstLine = lines.find(l => l.code === '1430');
      
      const newLines = [
        { accountId: prepaidAcct.id, debit: bill.total_amount, description: `Prepaid domain (3 years): ${bill.description || bill.bill_number}` },
        { accountId: directorAcct.id, credit: bill.total_amount, description: `Paid by director — ${bill.bill_number}` },
      ];
      
      if (cgstLine) newLines.push({ accountId: cgstAcct.id, debit: cgstLine.debit, description: 'Input CGST (ITC)' });
      if (sgstLine) newLines.push({ accountId: sgstAcct.id, debit: sgstLine.debit, description: 'Input SGST (ITC)' });
      if (igstLine) newLines.push({ accountId: igstAcct.id, debit: igstLine.debit, description: 'Input IGST (ITC)' });
      
      const newJE = await ledger.postJournalEntry({
        entryDate: bill.bill_date,
        source: 'bill',
        sourceType: 'prepaid_bill',
        sourceId: billId,
        narration: `Prepaid expense: ${bill.bill_number} — ${bill.vendor_id} (3-year domain)`,
        createdBy: admin.id,
        lines: newLines,
      });
      console.log(`✅ Posted new JE to Prepaid Expenses: ${newJE.id}`);
      
      // 4. Create prepaid expense schedule
      const expenseAccountId = expenseLine.account_id;
      await safeQuery(
        `INSERT INTO prepaid_expense_schedules (bill_id, total_amount, expense_account_id, start_date, end_date, next_expense_date, frequency)
         VALUES ($1, $2, $3, $4, $5, $6, 'monthly')`,
        [billId, bill.total_amount, expenseAccountId, bill.bill_date, prepaidEndDate, bill.bill_date]
      );
      console.log(`✅ Created prepaid expense schedule (36 months): ${bill.total_amount / 36} per month`);
      console.log(`   Period: ${bill.bill_date} to ${prepaidEndDate}`);
      
      // 5. Update bill with new JE ID
      await safeQuery(`UPDATE bills SET journal_entry_id = $1 WHERE id = $2`, [newJE.id, billId]);
      console.log(`✅ Updated bill journal_entry_id`);
      
      console.log('\n✅ Fix completed! Monthly amortization will now process 1/36th each month.');
    }
  } else if (prepaidLine) {
    console.log('\n✅ Already correctly posted to Prepaid Expenses');
  } else {
    console.log('\n⚠️  Unexpected JE structure');
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--execute');
  await fixDomainPrepaidManual(dryRun);
  
  if (dryRun) {
    console.log('\n💡 Run with --execute to perform actual fix');
  }
  console.log('\n═══════════════════════════════════════════════════════════════');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});