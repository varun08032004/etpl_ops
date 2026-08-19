require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { safeQuery } = require('../db/pool');

(async () => {
  // Check all bills and their JEs
  const { rows } = await safeQuery(`
    SELECT b.*, p.name as vendor_name,
           je.id as je_id, je.entry_date as je_date, je.narration as je_narration
    FROM bills b
    LEFT JOIN parties p ON p.id = b.vendor_id
    LEFT JOIN journal_entries je ON je.id = b.journal_entry_id
    WHERE b.bill_date BETWEEN '2026-05-01' AND '2026-07-31'
    ORDER BY b.bill_date
  `);
  
  console.log('=== Bills with JE Status ===\n');
  
  for (const b of rows) {
    const hasJE = b.je_id ? '✅ HAS JE' : '❌ NO JE';
    console.log(`  ${b.bill_date} | ${b.bill_number} | ₹${b.total_amount} | ${b.vendor_name} | ${hasJE}`);
    if (b.je_id) {
      console.log(`    JE: ${b.je_id} (${b.je_date}) | ${b.je_narration?.substring(0, 60)}`);
    }
    console.log('');
  }
  
  process.exit(0);
})();