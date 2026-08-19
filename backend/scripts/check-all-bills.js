require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { safeQuery } = require('../db/pool');

(async () => {
  // Check all bills for Damini, Hostinger, eMudhra, MCA
  const { rows } = await safeQuery(`
    SELECT b.*, p.name as vendor_name
    FROM bills b
    LEFT JOIN parties p ON p.id = b.vendor_id
    WHERE p.name ILIKE '%damini%' 
       OR p.name ILIKE '%hostinger%' 
       OR p.name ILIKE '%emudhra%' 
       OR p.name ILIKE '%corporate affairs%'
       OR p.name ILIKE '%mca%'
    ORDER BY b.bill_date
  `);
  
  console.log('=== Bills for Damini, Hostinger, eMudhra, MCA ===\n');
  
  for (const b of rows) {
    console.log(`  ${b.bill_number} | ${b.bill_date} | ₹${b.total_amount} | ${b.vendor_name}`);
    console.log(`    ID: ${b.id} | Status: ${b.status} | JE: ${b.journal_entry_id}`);
    console.log(`    Notes: ${b.notes?.substring(0, 80)}`);
    console.log('');
  }
  
  // Also check all bills in May, June, July
  const { rows: allBills } = await safeQuery(`
    SELECT b.bill_number, b.bill_date, b.total_amount, p.name as vendor_name, b.notes
    FROM bills b
    LEFT JOIN parties p ON p.id = b.vendor_id
    WHERE b.bill_date BETWEEN '2026-05-01' AND '2026-07-31'
    ORDER BY b.bill_date
  `);
  
  console.log('\n=== ALL Bills May-Jul 2026 ===\n');
  for (const b of allBills) {
    console.log(`  ${b.bill_date} | ${b.bill_number} | ₹${b.total_amount} | ${b.vendor_name}`);
  }
  
  process.exit(0);
})();