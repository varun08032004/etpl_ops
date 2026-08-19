require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { safeQuery, withTransaction } = require('../db/pool');
const ledger = require('../services/ledger');

async function recreateMissingJEs(dryRun = true) {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  RECREATE MISSING JOURNAL ENTRIES FOR BILLS');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'EXECUTE'}\n`);

  const { rows: billsWithoutJE } = await safeQuery(`
    SELECT b.*, p.name as vendor_name
    FROM bills b
    LEFT JOIN parties p ON p.id = b.vendor_id
    WHERE b.journal_entry_id IS NULL
      AND b.bill_date BETWEEN '2026-05-01' AND '2026-07-31'
    ORDER BY b.bill_date
  `);

  console.log(`Found ${billsWithoutJE.length} bills without JEs:\n`);
  
  for (const b of billsWithoutJE) {
    console.log(`  ${b.bill_date} | ${b.bill_number} | ₹${b.total_amount} | ${b.vendor_name}`);
    console.log(`    Category: ${b.category_id} | Payment: ${b.status} | Notes: ${b.notes?.substring(0, 60)}`);
  }

  if (!dryRun && billsWithoutJE.length > 0) {
    const { rows: [admin] } = await safeQuery(
      `SELECT id FROM staff_accounts WHERE role IN ('owner', 'admin') LIMIT 1`
    );

    for (const bill of billsWithoutJE) {
      console.log(`\n🔄 Creating JE for ${bill.bill_number}...`);
      
      // Get expense account
      let expenseAccountId = bill.expense_account_id;
      if (!expenseAccountId && bill.category_id) {
        const { rows: [cat] } = await safeQuery(`SELECT expense_account_id FROM expense_categories WHERE id = $1`, [bill.category_id]);
        expenseAccountId = cat?.expense_account_id;
      }
      
      if (!expenseAccountId) {
        console.log(`    ❌ No expense account found`);
        continue;
      }

      // Determine payment method and credit account
      let creditAccountId, creditDescription;
      if (bill.notes?.includes('paid personally')) {
        const { rows: [dirAcct] } = await safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '2150'`);
        creditAccountId = dirAcct?.id;
        creditDescription = `Paid by director — ${bill.bill_number}`;
      } else if (bill.status === 'paid') {
        // Find bank account from payment
        const { rows: [payment] } = await safeQuery(`
          SELECT ba.ledger_account_id FROM payments_made pm
          JOIN bank_accounts ba ON ba.id = pm.bank_account_id
          WHERE pm.bill_id = $1 ORDER BY pm.payment_date DESC LIMIT 1
        `, [bill.id]);
        creditAccountId = payment?.ledger_account_id;
        creditDescription = `Payment for ${bill.bill_number}`;
      } else {
        const { rows: [apAcct] } = await safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '2100'`);
        creditAccountId = apAcct?.id;
        creditDescription = `Payable — ${bill.bill_number}`;
      }

      if (!creditAccountId) {
        console.log(`    ❌ No credit account found`);
        continue;
      }

      // Calculate GST
      const { rows: [vendor] } = await safeQuery(`SELECT * FROM parties WHERE id = $1`, [bill.vendor_id]);
      const HOME_STATE = process.env.COMPANY_STATE || 'Maharashtra';
      const isInterState = vendor.state && vendor.state.trim().toLowerCase() !== HOME_STATE.trim().toLowerCase();
      
      const sub = Math.round(bill.subtotal * 100) / 100;
      const rate = Number(bill.gst_rate ?? 0);
      const gstAmount = Math.round((sub * rate) / 100 * 100) / 100;
      const cgst = isInterState ? 0 : Math.round(gstAmount / 2 * 100) / 100;
      const sgst = isInterState ? 0 : Math.round(gstAmount / 2 * 100) / 100;
      const igst = isInterState ? gstAmount : 0;

      // Get GST accounts
      const { rows: [cgstAcct] } = await safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '1410'`);
      const { rows: [sgstAcct] } = await safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '1420'`);
      const { rows: [igstAcct] } = await safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '1430'`);

      const lines = [{ accountId: expenseAccountId, debit: sub, description: bill.description || bill.bill_number }];
      if (cgst > 0) lines.push({ accountId: cgstAcct.id, debit: cgst, description: 'Input CGST (ITC)' });
      if (sgst > 0) lines.push({ accountId: sgstAcct.id, debit: sgst, description: 'Input SGST (ITC)' });
      if (igst > 0) lines.push({ accountId: igstAcct.id, debit: igst, description: 'Input IGST (ITC)' });
      lines.push({ accountId: creditAccountId, credit: bill.total_amount, description: creditDescription });

      const je = await ledger.postJournalEntry({
        entryDate: bill.bill_date,
        source: 'bill',
        sourceType: 'bill',
        sourceId: bill.id,
        narration: `Bill ${bill.bill_number} — ${bill.vendor_name}`,
        createdBy: admin.id,
        lines,
      });

      await safeQuery(`UPDATE bills SET journal_entry_id = $1 WHERE id = $2`, [je.id, bill.id]);
      console.log(`    ✅ Created JE: ${je.id} (₹${bill.total_amount})`);
    }
    console.log('\n✅ All missing JEs recreated!');
  } else if (dryRun) {
    console.log('\n💡 Run with --execute to recreate missing JEs');
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  process.exit(0);
}

const args = process.argv.slice(2);
const dryRun = !args.includes('--execute');
recreateMissingJEs(dryRun).catch(err => { console.error(err); process.exit(1); });