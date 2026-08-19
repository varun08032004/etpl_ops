#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { safeQuery } = require('../db/pool');

(async () => {
  // Check all invoices in 2026
  const { rows } = await safeQuery(`
    SELECT i.invoice_number, i.invoice_date, i.due_date, i.total_amount, i.subtotal, 
           i.cgst_amount, i.sgst_amount, i.igst_amount, i.status,
           p.name as party_name
    FROM invoices i
    JOIN parties p ON p.id = i.party_id
    WHERE i.invoice_date >= '2026-01-01'
    ORDER BY i.invoice_date DESC
  `);
  console.log('All invoices in 2026:');
  for (const r of rows) {
    console.log(`  ${r.invoice_number} | ${r.invoice_date} | ${r.due_date} | ₹${r.total_amount} (sub: ${r.subtotal}) | ${r.party_name} | ${r.status} | type: ${r.invoice_type || 'one_time'}`);
  }
  
  // Also check corporate deals for yearly subscriptions
  const { rows: deals } = await safeQuery(`
    SELECT d.*, p.name as party_name
    FROM deals d
    LEFT JOIN parties p ON p.id = d.converted_party_id
    WHERE d.stage = 'won' 
      AND d.deal_type = 'corporate'
      AND d.updated_at >= '2026-01-01'
    ORDER BY d.updated_at DESC
  `);
  console.log('\nCorporate deals won in 2026:');
  for (const d of deals) {
    console.log(`  ${d.company_name} | ${d.deal_value} | ${d.cycle} | ${d.updated_at} | Party: ${d.party_name}`);
  }
  
  process.exit(0);
})();