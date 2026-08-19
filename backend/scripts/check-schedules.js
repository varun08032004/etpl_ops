#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { safeQuery } = require('../db/pool');

(async () => {
  // Check revenue recognition schedules
  const { rows } = await safeQuery(`
    SELECT * FROM revenue_recognition_schedules
  `);
  console.log('Revenue recognition schedules:');
  for (const r of rows) {
    console.log(`  ${r.id} | Invoice: ${r.invoice_id} | Amount: ${r.total_amount} | Recognized: ${r.recognized_amount}`);
    console.log(`  Start: ${r.start_date} | End: ${r.end_date} | Next: ${r.next_recognition_date} | Complete: ${r.is_complete} | Freq: ${r.frequency}`);
  }
  
  // Check prepaid expense schedules
  const { rows: prepaid } = await safeQuery(`
    SELECT * FROM prepaid_expense_schedules
  `);
  console.log('\nPrepaid expense schedules:');
  for (const r of prepaid) {
    console.log(`  ${r.id} | Bill: ${r.bill_id} | Amount: ${r.total_amount} | Expensed: ${r.expensed_amount}`);
    console.log(`  Start: ${r.start_date} | End: ${r.end_date} | Next: ${r.next_expense_date} | Complete: ${r.is_complete} | Freq: ${r.frequency}`);
  }
  
  process.exit(0);
})();