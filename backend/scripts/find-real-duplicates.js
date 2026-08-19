require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { safeQuery } = require('../db/pool');

(async () => {
  // Find duplicate bills by vendor, date, amount (ignoring notes)
  const { rows } = await safeQuery(`
    SELECT vendor_id, bill_date, total_amount, COUNT(*) as cnt,
           array_agg(id ORDER BY created_at) as ids,
           array_agg(bill_number ORDER BY created_at) as bill_numbers,
           array_agg(notes ORDER BY created_at) as notes_list,
           array_agg(created_at ORDER BY created_at) as created_dates
    FROM bills
    GROUP BY vendor_id, bill_date, total_amount
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC
  `);
  
  console.log(`Found ${rows.length} groups with duplicates:\n`);
  
  for (const group of rows) {
    const { rows: [vendor] } = await safeQuery(`SELECT name FROM parties WHERE id = $1`, [group.vendor_id]);
    console.log(`  Vendor: ${vendor?.name} (${group.vendor_id}) | Date: ${group.bill_date} | Amount: ${group.total_amount}`);
    console.log(`  Count: ${group.cnt}`);
    group.ids.forEach((id, i) => {
      const keep = i === 0 ? ' ✅ KEEP' : ' ❌ DELETE';
      console.log(`    ${group.bill_numbers[i]} (${id})${keep}`);
      console.log(`      Notes: ${group.notes_list[i]?.substring(0, 60)}`);
    });
    console.log('');
  }
  
  process.exit(0);
})();