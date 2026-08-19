#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { safeQuery } = require('../db/pool');

(async () => {
  const { rows } = await safeQuery(`
    SELECT i.*, p.name as party_name
    FROM invoices i
    JOIN parties p ON p.id = i.party_id
    WHERE i.invoice_date BETWEEN '2026-07-01' AND '2026-07-31'
      AND i.total_amount > 100000
    ORDER BY i.total_amount DESC
  `);
  console.log('High value invoices in July 2026:');
  for (const r of rows) {
    console.log(' ', r.invoice_number, r.invoice_date, r.total_amount, r.party_name, r.status);
  }
  process.exit(0);
})();