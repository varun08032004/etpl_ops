#!/usr/bin/env node
/**
 * Fix Domain Bill Amount
 * Current: ₹1,910.54 for 3 years = ₹636.85/year (₹53.07/month)
 * Correct: ₹1,068/year = ₹3,204 for 3 years (₹89/month)
 * 
 * Already expensed 4 months at wrong rate: 4 × ₹53.07 = ₹212.28
 * Should be: 4 months × ₹89 = ₹356
 * Adjustment needed: ₹356 - ₹212.28 = ₹143.72 catch-up
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { safeQuery, withTransaction } = require('../db/pool');
const ledger = require('../services/ledger');

async function fixDomainAmount(dryRun = true) {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  FIX DOMAIN BILL AMOUNT - ₹1,068/year (3 years)');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'EXECUTE'}\n`);
  
  const billId = 'e3b6b903-4669-4026-a543-873b91c0952e'; // BILL-2026-000005
  
  const { rows: [bill] } = await safeQuery(`SELECT * FROM bills WHERE id = $1`, [billId]);
  if (!bill) {
    console.error('Bill not found');
    return;
  }
  
  console.log(`Current Bill: ${bill.bill_number} | Amount: ₹${bill.total_amount} | Prepaid: ${bill.is_prepaid}`);
  
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
    console.log(`  ${line.code} ${line.name}: ${side}`);
  }
  
  // Current prepaid schedule
  const { rows: [sched] } = await safeQuery(`
    SELECT * FROM prepaid_expense_schedules WHERE bill_id = $1
  `, [billId]);
  
  if (sched) {
    console.log(`\nCurrent Schedule: ₹${sched.total_amount} total | ₹${sched.expensed_amount} expensed`);
    console.log(`  Monthly: ₹${(sched.total_amount / 36).toFixed(2)} | Next: ${sched.next_expense_date}`);
  }
  
  // Calculate correct amounts
  const correctAnnual = 1068;
  const correctTotal = correctAnnual * 3; // ₹3,204
  const correctMonthly = correctAnnual / 12; // ₹89
  
  const monthsElapsed = 4; // May, Jun, Jul, Aug
  const alreadyExpensed = Number(sched?.expensed_amount || 0); // ₹206.56 (4 × 53.07)
  const shouldBeExpensed = correctMonthly * monthsElapsed; // ₹356
  const catchUpNeeded = shouldBeExpensed - alreadyExpensed; // ₹149.44
  
  console.log(`\n📊 Calculations:`);
  console.log(`  Correct annual: ₹${correctAnnual}`);
  console.log(`  Correct 3-year total: ₹${correctTotal}`);
  console.log(`  Correct monthly: ₹${correctMonthly}`);
  console.log(`  Months elapsed: ${monthsElapsed}`);
  console.log(`  Already expensed: ₹${alreadyExpensed.toFixed(2)}`);
  console.log(`  Should be expensed: ₹${shouldBeExpensed.toFixed(2)}`);
  console.log(`  Catch-up needed: ₹${catchUpNeeded.toFixed(2)}`);
  
  if (!dryRun) {
    console.log('\n🔄 Executing fix...');
    
    const { rows: [admin] } = await safeQuery(
      `SELECT id FROM staff_accounts WHERE role IN ('owner', 'admin') LIMIT 1`
    );
    
    // 1. Reverse the current bill JE
    const reversal = await ledger.reverseJournalEntry(je.id, {
      reason: 'Correct domain bill amount from ₹1,910.54 to ₹3,204 (₹1,068/year × 3)',
      createdBy: admin.id
    });
    console.log(`✅ Reversed original JE: ${reversal.id}`);
    
    // 2. Update bill amount
    await safeQuery(
      `UPDATE bills SET total_amount = $1, subtotal = $2 WHERE id = $3`,
      [correctTotal, correctTotal, billId] // Assuming no GST for domain
    );
    console.log(`✅ Updated bill amount to ₹${correctTotal}`);
    
    // 3. Post new JE to Prepaid Expenses with correct amount
    const { rows: [prepaidAcct] } = await safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '1500'`);
    const { rows: [directorAcct] } = await safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '2150'`);
    const { rows: [expenseAcct] } = await safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '5300'`); // Software/SaaS
    
    const newLines = [
      { accountId: prepaidAcct.id, debit: correctTotal, description: `Prepaid domain (3 years @ ₹${correctAnnual}/year): ${bill.bill_number}` },
      { accountId: directorAcct.id, credit: correctTotal, description: `Paid by director — ${bill.bill_number}` },
    ];
    
    const newJE = await ledger.postJournalEntry({
      entryDate: bill.bill_date,
      source: 'bill',
      sourceType: 'prepaid_bill',
      sourceId: billId,
      narration: `Prepaid expense: ${bill.bill_number} — Hostinger (3-year domain @ ₹${correctAnnual}/year)`,
      createdBy: admin.id,
      lines: newLines,
    });
    console.log(`✅ Posted new JE to Prepaid Expenses: ${newJE.id} (₹${correctTotal})`);
    
    // 4. Update prepaid schedule with correct total and monthly amount
    // The schedule logic divides total by 36, so we update total_amount
    await safeQuery(
      `UPDATE prepaid_expense_schedules SET total_amount = $1, expensed_amount = $2, next_expense_date = $3 WHERE bill_id = $4`,
      [correctTotal, shouldBeExpensed, '2026-09-30', billId]
    );
    console.log(`✅ Updated schedule: total=₹${correctTotal}, expensed=₹${shouldBeExpensed.toFixed(2)}, next=2026-09-30`);
    
    // 5. Post catch-up adjustment JE (adjustment for past months)
    if (catchUpNeeded > 0) {
      const catchUpJE = await ledger.postJournalEntry({
        entryDate: '2026-08-31',
        source: 'adjustment',
        sourceType: 'prepaid_catchup',
        sourceId: sched.id,
        narration: `Catch-up: Domain prepaid expense correction (4 months @ ₹${correctMonthly} vs ₹${(1910.54/36).toFixed(2)})`,
        createdBy: admin.id,
        lines: [
          { accountId: expenseAcct.id, debit: catchUpNeeded, description: `Domain expense catch-up (May-Aug)` },
          { accountId: prepaidAcct.id, credit: catchUpNeeded, description: `Prepaid expense adjustment` },
        ],
      });
      console.log(`✅ Posted catch-up JE: ${catchUpJE.id} (₹${catchUpNeeded.toFixed(2)})`);
    }
    
    // 6. Update bill with new JE ID
    await safeQuery(`UPDATE bills SET journal_entry_id = $1 WHERE id = $2`, [newJE.id, billId]);
    console.log(`✅ Updated bill journal_entry_id`);
    
    console.log('\n✅ Domain bill amount corrected!');
    console.log(`   New monthly amortization: ₹${correctMonthly}`);
    console.log(`   Total 3-year: ₹${correctTotal}`);
    console.log(`   Catch-up posted for 4 months`);
  }
  
  if (dryRun) {
    console.log('\n💡 Run with --execute to perform actual fix');
  }
  console.log('\n═══════════════════════════════════════════════════════════════');
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--execute');
  await fixDomainAmount(dryRun);
}

main().catch(err => { console.error(err); process.exit(1); });