#!/usr/bin/env node
/**
 * Data Cleanup Script - Fix duplicate bills and invalid reversals
 * Run ONCE after reviewing the output
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { safeQuery, withTransaction } = require('../db/pool');
const ledger = require('../services/ledger');

async function findDuplicates() {
  console.log('🔍 Finding duplicate bills...\n');
  
  const { rows } = await safeQuery(`
    SELECT vendor_id, bill_date, total_amount, notes, COUNT(*) as cnt, 
           array_agg(id ORDER BY created_at) as ids,
           array_agg(bill_number ORDER BY created_at) as bill_numbers,
           array_agg(created_at ORDER BY created_at) as created_dates
    FROM bills
    GROUP BY vendor_id, bill_date, total_amount, notes
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC
  `);
  
console.log(`Found ${rows.length} groups with duplicates:\n`);
    
    for (const group of rows) {
      console.log(`  Vendor: ${group.vendor_id} | Date: ${group.bill_date} | Amount: ${group.total_amount}`);
      console.log(`  Notes: ${group.notes?.substring(0, 80)}...`);
      console.log(`  Count: ${group.cnt}`);
      group.ids.forEach((id, i) => {
        const keep = i === 0 ? ' ✅ KEEP' : ' ❌ DELETE';
        console.log(`    ${group.bill_numbers[i]} (${id})${keep}`);
      });
      console.log('');
    }
  
  return rows;
}

async function findReversalsInAugust() {
  console.log('\n🔍 Finding reversal entries in August 2026...\n');
  
  const { rows } = await safeQuery(`
    SELECT je.id, je.entry_date, je.narration, je.source, je.source_type,
           COUNT(jl.id) as line_count,
           SUM(CASE WHEN jl.debit > 0 THEN jl.debit ELSE 0 END) as total_debit,
           SUM(CASE WHEN jl.credit > 0 THEN jl.credit ELSE 0 END) as total_credit
    FROM journal_entries je
    JOIN journal_lines jl ON jl.journal_entry_id = je.id
    WHERE je.entry_date BETWEEN '2026-08-01' AND '2026-08-31'
      AND je.narration ILIKE '%reversal%'
    GROUP BY je.id, je.entry_date, je.narration, je.source, je.source_type
    ORDER BY je.entry_date
  `);
  
  console.log(`Found ${rows.length} reversal entries in August 2026:\n`);
  
  let totalReversalDebit = 0, totalReversalCredit = 0;
  for (const rev of rows) {
    console.log(`  ${rev.id} | ${rev.entry_date} | ${rev.source}/${rev.source_type}`);
    console.log(`    ${rev.narration}`);
    console.log(`    Debit: ${rev.total_debit} | Credit: ${rev.total_credit} | Lines: ${rev.line_count}`);
    totalReversalDebit += Number(rev.total_debit || 0);
    totalReversalCredit += Number(rev.total_credit || 0);
    console.log('');
  }
  
  console.log(`Total Reversal Debit: ₹${totalReversalDebit}`);
  console.log(`Total Reversal Credit: ₹${totalReversalCredit}`);
  
  return rows;
}

async function findBillsWithoutReceipts() {
  console.log('\n🔍 Finding bills without receipts (candidates for cleanup)...\n');
  
  const { rows } = await safeQuery(`
    SELECT b.id, b.bill_number, b.bill_date, b.total_amount, b.vendor_id, 
           p.name as vendor_name, b.receipt_document_id, b.journal_entry_id,
           b.status, b.created_at
    FROM bills b
    LEFT JOIN parties p ON p.id = b.vendor_id
    WHERE b.receipt_document_id IS NULL
      AND b.created_at < '2026-08-01'
    ORDER BY b.bill_date DESC
  `);
  
  console.log(`Found ${rows.length} bills without receipts (created before Aug 2026):\n`);
  
  for (const bill of rows) {
    const hasJE = bill.journal_entry_id ? '✅ Has JE' : '❌ No JE';
    console.log(`  ${bill.bill_number} | ${bill.bill_date} | ₹${bill.total_amount} | ${bill.vendor_name} | ${hasJE}`);
  }
  
  return rows;
}

async function cleanupDuplicates(dryRun = true) {
  console.log(`\n🧹 ${dryRun ? 'DRY RUN: ' : ''}Cleaning up duplicate bills...\n`);
  
  const { rows: duplicates } = await safeQuery(`
    SELECT vendor_id, bill_date, total_amount, notes, 
           array_agg(id ORDER BY created_at) as ids,
           array_agg(journal_entry_id ORDER BY created_at) as je_ids
    FROM bills
    GROUP BY vendor_id, bill_date, total_amount, notes
    HAVING COUNT(*) > 1
  `);
  
  let deletedCount = 0;
  let reversedJECount = 0;
  
  for (const group of duplicates) {
    // Keep first (oldest), delete rest
    const toDelete = group.ids.slice(1);
    const toDeleteJEs = group.je_ids.slice(1).filter(Boolean);
    
    for (let i = 0; i < toDelete.length; i++) {
      const billId = toDelete[i];
      const jeId = toDeleteJEs[i];
      
      console.log(`  ${dryRun ? 'Would delete' : 'Deleting'} bill ${billId} (JE: ${jeId || 'none'})`);
      
      if (!dryRun) {
        // Reverse journal entry if exists
        if (jeId) {
          try {
            await ledger.reverseJournalEntry(jeId, { 
              reason: 'Duplicate bill cleanup - auto-reversed', 
              createdBy: (await safeQuery(`SELECT id FROM staff_accounts WHERE role IN ('owner','admin') LIMIT 1`)).rows[0]?.id 
            });
            reversedJECount++;
            console.log(`    ✅ Reversed JE ${jeId}`);
          } catch (e) {
            console.error(`    ❌ Failed to reverse JE ${jeId}:`, e.message);
          }
        }
        
        // Delete bill
        await safeQuery(`DELETE FROM bills WHERE id = $1`, [billId]);
        deletedCount++;
      }
    }
  }
  
  console.log(`\n${dryRun ? 'DRY RUN' : 'COMPLETED'}: ${deletedCount} bills deleted, ${reversedJECount} JEs reversed`);
  return { deletedCount, reversedJECount };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--execute');
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  DATA CLEANUP - Duplicate Bills & Reversal Analysis');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Mode: ${dryRun ? 'DRY RUN (use --execute to actually delete)' : 'EXECUTE MODE'}\n`);
  
  await findDuplicates();
  await findReversalsInAugust();
  await findBillsWithoutReceipts();
  
  if (!dryRun) {
    console.log('\n⚠️  This will DELETE duplicate bills and REVERSE their journal entries!');
    console.log('    Make sure you have a database backup before proceeding.\n');
    await cleanupDuplicates(false);
  } else {
    console.log('\n💡 Run with --execute to perform actual cleanup');
  }
  
  console.log('\n═══════════════════════════════════════════════════════════════');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});