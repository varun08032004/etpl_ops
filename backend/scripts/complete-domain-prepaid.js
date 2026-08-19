#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { safeQuery } = require('../db/pool');
const ledger = require('../services/ledger');

async function completeDomainPrepaid() {
  console.log('Completing domain prepaid fix...');
  
  const billId = 'e3b6b903-4669-4026-a543-873b91c0952e';
  const { rows: [bill] } = await safeQuery(`SELECT * FROM bills WHERE id = $1`, [billId]);
  
  if (!bill) {
    console.error('Bill not found');
    return;
  }
  
  console.log(`Bill: ${bill.bill_number} | Amount: ${bill.total_amount} | is_prepaid: ${bill.is_prepaid}`);
  
  const { rows: [admin] } = await safeQuery(
    `SELECT id FROM staff_accounts WHERE role IN ('owner', 'admin') LIMIT 1`
  );
  
  // Post new JE to Prepaid Expenses
  const { rows: [prepaidAcct] } = await safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '1500'`);
  const { rows: [directorAcct] } = await safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '2150'`);
  const { rows: [cgstAcct] } = await safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '1410'`);
  const { rows: [sgstAcct] } = await safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '1420'`);
  const { rows: [igstAcct] } = await safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '1430'`);
  
  // Get the reversed JE lines to know GST amounts
  const { rows: revLines } = await safeQuery(`
    SELECT jl.*, coa.code
    FROM journal_lines jl
    JOIN chart_of_accounts coa ON coa.id = jl.account_id
    WHERE jl.journal_entry_id = (SELECT id FROM journal_entries WHERE narration LIKE '%domain expense%' AND entry_date = '2026-05-31' ORDER BY id DESC LIMIT 1)
  `);
  
  const cgstLine = revLines.find(l => l.code === '1410');
  const sgstLine = revLines.find(l => l.code === '1420');
  const igstLine = revLines.find(l => l.code === '1430');
  
  // Get expense account from category
  let expenseAccountId = bill.expense_account_id;
  if (!expenseAccountId && bill.category_id) {
    const { rows: [cat] } = await safeQuery(`SELECT expense_account_id FROM expense_categories WHERE id = $1`, [bill.category_id]);
    expenseAccountId = cat?.expense_account_id;
  }
  
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
  
  // Create prepaid expense schedule
  await safeQuery(
    `INSERT INTO prepaid_expense_schedules (bill_id, total_amount, expense_account_id, start_date, end_date, next_expense_date, frequency)
     VALUES ($1, $2, $3, $4, $5, $6, 'monthly')`,
    [billId, bill.total_amount, expenseAccountId, bill.bill_date, '2029-05-31', bill.bill_date]
  );
  console.log(`✅ Created prepaid expense schedule (36 months): ${(bill.total_amount / 36).toFixed(2)} per month`);
  
  // Update bill with new JE ID
  await safeQuery(`UPDATE bills SET journal_entry_id = $1 WHERE id = $2`, [newJE.id, billId]);
  console.log(`✅ Updated bill journal_entry_id`);
  
  console.log('\n✅ Domain prepaid fix completed!');
  process.exit(0);
}

completeDomainPrepaid().catch(e => { console.error(e); process.exit(1); });