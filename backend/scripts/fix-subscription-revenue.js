#!/usr/bin/env node
/**
 * Fix Yearly Subscription Revenue - Convert to Deferred Revenue
 * For the 143,999 demo subscription posted in July 2026
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { safeQuery, withTransaction } = require('../db/pool');
const ledger = require('../services/ledger');
const { createRevenueRecognitionSchedule } = require('../services/accrualService');

async function findSubscriptionInvoice() {
  console.log('🔍 Finding subscription invoice (143,999 in July 2026)...\n');
  
  const { rows } = await safeQuery(`
    SELECT i.*, p.name as party_name, p.email as party_email
    FROM invoices i
    JOIN parties p ON p.id = i.party_id
    WHERE i.total_amount = 143999
      AND i.invoice_date BETWEEN '2026-07-01' AND '2026-07-31'
      AND i.status != 'void'
    ORDER BY i.created_at DESC
  `);
  
  if (rows.length === 0) {
    console.log('❌ No invoice found matching 143,999 in July 2026');
    return null;
  }
  
  for (const inv of rows) {
    console.log(`Found: ${inv.invoice_number} | ${inv.invoice_date} | ₹${inv.total_amount}`);
    console.log(`  Party: ${inv.party_name} (${inv.party_email})`);
    console.log(`  Status: ${inv.status} | Type: ${inv.invoice_type || 'one_time (default)'}`);
    console.log(`  JE: ${inv.journal_entry_id || 'none'}`);
    console.log(`  Due Date: ${inv.due_date}`);
    console.log('');
  }
  
  return rows;
}

async function fixSubscriptionRevenue(invoiceId, dryRun = true) {
  console.log(`\n🔧 ${dryRun ? 'DRY RUN: ' : ''}Fixing subscription revenue for invoice ${invoiceId}...\n`);
  
  const { rows: [invoice] } = await safeQuery(`SELECT * FROM invoices WHERE id = $1`, [invoiceId]);
  if (!invoice) {
    console.error('Invoice not found');
    return;
  }
  
  if (invoice.invoice_type === 'subscription') {
    console.log('Already marked as subscription');
    return;
  }
  
  const { rows: [je] } = await safeQuery(
    `SELECT * FROM journal_entries WHERE id = $1`, [invoice.journal_entry_id]
  );
  
  if (!je) {
    console.error('No journal entry found for this invoice');
    return;
  }
  
  console.log(`Current JE: ${je.id} (${je.entry_date})`);
  console.log(`Narration: ${je.narration}`);
  
  // Get the journal lines
  const { rows: lines } = await safeQuery(
    `SELECT jl.*, coa.code, coa.name, coa.account_type
     FROM journal_lines jl
     JOIN chart_of_accounts coa ON coa.id = jl.account_id
     WHERE jl.journal_entry_id = $1
     ORDER BY jl.debit DESC NULLS LAST`,
    [je.id]
  );
  
  console.log('\nCurrent JE Lines:');
  for (const line of lines) {
    const side = line.debit > 0 ? `Dr ${line.debit}` : `Cr ${line.credit}`;
    console.log(`  ${line.code} ${line.name}: ${side} (${line.account_type})`);
  }
  
  // Check if it posted to income directly (wrong) or deferred revenue (correct)
  const incomeLine = lines.find(l => l.account_type === 'income' && l.credit > 0);
  const deferredLine = lines.find(l => l.code === '2700' && l.credit > 0);
  
  if (incomeLine && !deferredLine) {
    console.log('\n❌ PROBLEM: Posted directly to Income (should be Deferred Revenue)');
    console.log('   Need to:');
    console.log('   1. Reverse current JE');
    console.log('   2. Post new JE: Dr AR / Cr Deferred Revenue (2700)');
    console.log('   3. Create revenue recognition schedule for 12 months');
    console.log('   4. Mark invoice as subscription type');
    
    if (!dryRun) {
      console.log('\n🔄 Executing fix...');
      
      // 1. Reverse the original JE
      const { rows: [admin] } = await safeQuery(
        `SELECT id FROM staff_accounts WHERE role IN ('owner', 'admin') LIMIT 1`
      );
      
      const reversal = await ledger.reverseJournalEntry(je.id, {
        reason: 'Convert yearly subscription to deferred revenue recognition',
        createdBy: admin.id
      });
      console.log(`✅ Reversed original JE: ${reversal.id}`);
      
      // 2. Post new JE to Deferred Revenue
      const { rows: [arAcct] } = await safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '1200'`);
      const { rows: [deferredAcct] } = await safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '2700'`);
      const { rows: [cgstAcct] } = await safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '2210'`);
      const { rows: [sgstAcct] } = await safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '2220'`);
      const { rows: [igstAcct] } = await safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '2230'`);
      
      // Find GST lines from original
      const cgstLine = lines.find(l => l.code === '2210');
      const sgstLine = lines.find(l => l.code === '2220');
      const igstLine = lines.find(l => l.code === '2230');
      
      const newLines = [
        { accountId: arAcct.id, debit: invoice.total_amount, partyId: invoice.party_id, description: `Invoice ${invoice.invoice_number} (deferred)` },
        { accountId: deferredAcct.id, credit: invoice.subtotal, description: `Deferred revenue for ${invoice.invoice_number}` },
      ];
      
      if (cgstLine) newLines.push({ accountId: cgstAcct.id, credit: cgstLine.credit, description: 'CGST output' });
      if (sgstLine) newLines.push({ accountId: sgstAcct.id, credit: sgstLine.credit, description: 'SGST output' });
      if (igstLine) newLines.push({ accountId: igstAcct.id, credit: igstLine.credit, description: 'IGST output' });
      
      const newJE = await ledger.postJournalEntry({
        entryDate: invoice.invoice_date,
        source: 'invoice',
        sourceType: 'subscription_invoice',
        sourceId: invoice.id,
        narration: `Subscription invoice ${invoice.invoice_number} to ${invoice.party_name} - deferred revenue`,
        createdBy: admin.id,
        lines: newLines,
      });
      console.log(`✅ Posted new JE to Deferred Revenue: ${newJE.id}`);
      
      // 3. Create revenue recognition schedule
      await createRevenueRecognitionSchedule(invoice.id, admin.id);
      console.log(`✅ Created revenue recognition schedule (12 months)`);
      
      // 4. Update invoice
      await safeQuery(
        `UPDATE invoices SET invoice_type = 'subscription', journal_entry_id = $1 WHERE id = $2`,
        [newJE.id, invoice.id]
      );
      console.log(`✅ Updated invoice type to 'subscription'`);
      
      console.log('\n✅ Fix completed! Monthly revenue recognition will now process 1/12th each month.');
      console.log(`   Monthly amount: ₹${(invoice.subtotal / 12).toFixed(2)}`);
    }
  } else if (deferredLine) {
    console.log('\n✅ Already correctly posted to Deferred Revenue');
  } else {
    console.log('\n⚠️  Unexpected JE structure - manual review needed');
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--execute');
  const invoiceId = args.find(a => !a.startsWith('--'));
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  FIX YEARLY SUBSCRIPTION REVENUE - Deferred Revenue Conversion');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Mode: ${dryRun ? 'DRY RUN (use --execute to actually fix)' : 'EXECUTE MODE'}\n`);
  
  const invoices = await findSubscriptionInvoice();
  
  if (invoices && invoices.length > 0) {
    const targetId = invoiceId || invoices[0].id;
    await fixSubscriptionRevenue(targetId, dryRun);
  }
  
  if (dryRun) {
    console.log('\n💡 Run with --execute to perform actual fix');
  }
  
  console.log('\n═══════════════════════════════════════════════════════════════');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});