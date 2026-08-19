require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { safeQuery, withTransaction } = require('../db/pool');
const ledger = require('../services/ledger');

async function fixDomainExpenseAccount(dryRun = true) {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  FIX DOMAIN EXPENSE ACCOUNT (5700 → 5300)');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'EXECUTE'}\n`);

  const billId = 'e3b6b903-4669-4026-a543-873b91c0952e'; // BILL-2026-000005
  
  const { rows: [bill] } = await safeQuery(`SELECT * FROM bills WHERE id = $1`, [billId]);
  if (!bill) {
    console.error('Bill not found');
    return;
  }
  
  console.log(`Bill: ${bill.bill_number} | Current expense_account_id: ${bill.expense_account_id}`);
  
  const { rows: [je] } = await safeQuery(`SELECT * FROM journal_entries WHERE id = $1`, [bill.journal_entry_id]);
  if (!je) {
    console.error('No journal entry found');
    return;
  }
  
  const { rows: lines } = await safeQuery(`
    SELECT jl.*, coa.code, coa.name
    FROM journal_lines jl
    JOIN chart_of_accounts coa ON coa.id = jl.account_id
    WHERE jl.journal_entry_id = $1
  `, [je.id]);
  
  console.log('\nCurrent JE Lines:');
  for (const line of lines) {
    const side = line.debit > 0 ? `Dr ${line.debit}` : `Cr ${line.credit}`;
    console.log(`  ${line.code} ${line.name}: ${side} (${line.account_type})`);
  }
  
  const expenseLine = lines.find(l => l.account_type === 'expense' && l.debit > 0);
  const prepaidLine = lines.find(l => l.code === '1500' && l.debit > 0);
  const creditLine = lines.find(l => (l.code === '2150' || l.code === '2100' || l.code === '1110') && l.credit > 0);
  
  if (expenseLine && expenseLine.code === '5700') {
    console.log('\n❌ PROBLEM: Expense account is 5700 (Legal & Professional), should be 5300 (Software & SaaS)');
    console.log('   Need to:');
    console.log('   1. Reverse current JE');
    console.log('   2. Post new JE: Dr 5300 / Cr 2150 (Director Loan)');
    console.log('   3. Update bill expense_account_id to 5300');
    console.log('   4. Update prepaid expense schedule expense_account_id');
    
    if (!dryRun) {
      console.log('\n🔄 Executing fix...');
      
      const { rows: [admin] } = await safeQuery(
        `SELECT id FROM staff_accounts WHERE role IN ('owner', 'admin') LIMIT 1`
      );
      
      // 1. Reverse the current JE
      const reversal = await ledger.reverseJournalEntry(je.id, {
        reason: 'Correct domain expense account from 5700 to 5300',
        createdBy: admin.id
      });
      console.log(`✅ Reversed original JE: ${reversal.id}`);
      
      // 2. Get account IDs
      const { rows: [expenseAcct] } = await safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '5300'`);
      const { rows: [prepaidAcct] } = await safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '1500'`);
      const { rows: [directorAcct] } = await safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '2150'`);
      const { rows: [igstAcct] } = await safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '1430'`);
      
      // 3. Post new JE to Prepaid Expenses with correct expense account
      const newLines = [
        { accountId: prepaidAcct.id, debit: bill.total_amount, description: `Prepaid domain (3 years): ${bill.description || bill.bill_number}` },
        { accountId: directorAcct.id, credit: bill.total_amount, description: `Paid by director — ${bill.bill_number}` },
      ];
      
      // Add IGST line if it existed
      const igstLine = lines.find(l => l.code === '1430');
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
      console.log(`✅ Posted new JE to Prepaid Expenses: ${newJE.id} (₹${bill.total_amount})`);
      
      // 4. Update bill expense_account_id
      await safeQuery(`UPDATE bills SET expense_account_id = $1, journal_entry_id = $2 WHERE id = $3`, 
        [expenseAcct.id, newJE.id, billId]);
      console.log(`✅ Updated bill expense_account_id to 5300`);
      
      // 5. Update prepaid expense schedule expense_account_id
      await safeQuery(`UPDATE prepaid_expense_schedules SET expense_account_id = $1 WHERE bill_id = $2`,
        [expenseAcct.id, billId]);
      console.log(`✅ Updated prepaid expense schedule expense_account_id to 5300`);
      
      console.log('\n✅ Domain expense account corrected!');
      console.log(`   New monthly amortization will hit 5300 (Software & SaaS Tools)`);
    }
  } else if (expenseLine && expenseLine.code === '5300') {
    console.log('\n✅ Already correctly using 5300 (Software & SaaS Tools)');
  } else {
    console.log('\n⚠️  Unexpected expense account:', expenseLine?.code);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--execute');
  await fixDomainExpenseAccount(dryRun);
  
  if (dryRun) {
    console.log('\n💡 Run with --execute to perform actual fix');
  }
  console.log('\n═══════════════════════════════════════════════════════════════');
}

main().catch(err => { console.error(err); process.exit(1); });