#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { safeQuery } = require('../db/pool');

(async () => {
  // Check all eMudhra and Hostinger bills
  const { rows } = await safeQuery(`
    SELECT b.*, p.name as vendor_name, je.id as je_id, je.entry_date
    FROM bills b
    LEFT JOIN parties p ON p.id = b.vendor_id
    LEFT JOIN journal_entries je ON je.id = b.journal_entry_id
    WHERE p.name ILIKE '%emudhra%' OR p.name ILIKE '%hostinger%' OR b.notes ILIKE '%domain%'
    ORDER BY b.bill_date
  `);
  
  console.log('=== eMudhra / Hostinger / Domain Bills ===\n');
  
  for (const b of rows) {
    console.log(`Bill: ${b.bill_number}`);
    console.log(`  Vendor: ${b.vendor_name}`);
    console.log(`  Date: ${b.bill_date} | Amount: ₹${b.total_amount}`);
    console.log(`  Category: ${b.category_id} | Prepaid: ${b.is_prepaid} | End: ${b.prepaid_end_date}`);
    console.log(`  Description: ${b.description}`);
    console.log(`  JE: ${b.je_id} | JE Date: ${b.entry_date}`);
    console.log(`  Status: ${b.status} | Amount Paid: ${b.amount_paid}`);
    console.log('');
  }
  
  // Also check the prepaid schedule for domain
  const { rows: sched } = await safeQuery(`
    SELECT * FROM prepaid_expense_schedules pes
    JOIN bills b ON b.id = pes.bill_id
    LEFT JOIN parties p ON p.id = b.vendor_id
    WHERE p.name ILIKE '%hostinger%' OR b.notes ILIKE '%domain%'
  `);
  
  console.log('=== Prepaid Schedules for Domain ===');
  for (const s of sched) {
    console.log(`  Amount: ${s.total_amount} | Expensed: ${s.expensed_amount}`);
    console.log(`  Start: ${s.start_date} | End: ${s.end_date} | Next: ${s.next_expense_date}`);
    console.log(`  Frequency: ${s.frequency} | Complete: ${s.is_complete}`);
  }
  
  process.exit(0);
})();