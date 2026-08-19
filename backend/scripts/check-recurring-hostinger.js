require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { safeQuery } = require('../db/pool');

(async () => {
  // Check recurring expenses for Hostinger
  const { rows } = await safeQuery(`
    SELECT re.*, p.name as vendor_name
    FROM recurring_expenses re
    LEFT JOIN parties p ON p.id = re.vendor_id
    WHERE p.name ILIKE '%hostinger%' OR re.name ILIKE '%hostinger%' OR re.name ILIKE '%domain%'
    ORDER BY re.start_date
  `);
  
  console.log('=== Recurring Expenses for Hostinger/Domain ===\n');
  
  for (const r of rows) {
    console.log(`  ${r.name} | Vendor: ${r.vendor_name}`);
    console.log(`    Amount: ${r.testnet_amount}/${r.prod_amount} ${r.currency} | Freq: ${r.frequency}`);
    console.log(`    Start: ${r.start_date} | End: ${r.end_date} | Next Due: ${r.next_due_date}`);
    console.log(`    Status: ${r.approval_status} | Active: ${r.is_active}`);
    console.log(`    Auto-create bill: ${r.auto_create_bill}`);
    console.log('');
  }
  
  // Check recurring expense occurrences
  const { rows: occ } = await safeQuery(`
    SELECT o.*, re.name, p.name as vendor_name
    FROM recurring_expense_occurrences o
    JOIN recurring_expenses re ON re.id = o.recurring_expense_id
    LEFT JOIN parties p ON p.id = re.vendor_id
    WHERE p.name ILIKE '%hostinger%' OR re.name ILIKE '%hostinger%' OR re.name ILIKE '%domain%'
    ORDER BY o.due_date
  `);
  
  console.log('\n=== Recurring Expense Occurrences ===\n');
  
  for (const o of occ) {
    console.log(`  ${o.due_date} | ₹${o.amount} | ${o.name} | Status: ${o.status}`);
  }
  
  process.exit(0);
})();