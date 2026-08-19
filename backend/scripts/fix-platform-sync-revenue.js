#!/usr/bin/env node
/**
 * Fix Platform Sync Subscription Revenue - Convert to Deferred Revenue
 * For the 143,999 growth annual subscription from platform_sync (July 30, 2026)
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { safeQuery, withTransaction } = require('../db/pool');
const ledger = require('../services/ledger');

async function fixPlatformSyncSubscription(dryRun = true) {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  FIX PLATFORM SYNC SUBSCRIPTION REVENUE - Deferred Revenue');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Mode: ${dryRun ? 'DRY RUN (use --execute to actually fix)' : 'EXECUTE MODE'}\n`);
  
  const jeId = 'e1d31879-dc3d-4429-bd66-efcd0787efec';
  
  const { rows: [je] } = await safeQuery(`SELECT * FROM journal_entries WHERE id = $1`, [jeId]);
  if (!je) {
    console.error('Journal entry not found');
    return;
  }
  
  console.log(`Found JE: ${je.id} (${je.entry_date})`);
  console.log(`Source: ${je.source}/${je.source_type}`);
  console.log(`Narration: ${je.narration}`);
  
  const { rows: lines } = await safeQuery(
    `SELECT jl.*, coa.code, coa.name, coa.account_type
     FROM journal_lines jl
     JOIN chart_of_accounts coa ON coa.id = jl.account_id
     WHERE jl.journal_entry_id = $1
     ORDER BY jl.debit DESC NULLS LAST`,
    [jeId]
  );
  
  console.log('\nCurrent JE Lines:');
  for (const line of lines) {
    const side = line.debit > 0 ? `Dr ${line.debit}` : `Cr ${line.credit}`;
    console.log(`  ${line.code} ${line.name}: ${side} (${line.account_type})`);
  }
  
  // Check if it posted to income directly (wrong) or deferred revenue (correct)
  const incomeLine = lines.find(l => l.account_type === 'income' && l.credit > 0);
  const deferredLine = lines.find(l => l.code === '2700' && l.credit > 0);
  const arLine = lines.find(l => (l.code === '1200' || l.code === '1120') && l.debit > 0);
  
  if (incomeLine && !deferredLine && arLine) {
    console.log('\n❌ PROBLEM: Posted directly to Income (4100) instead of Deferred Revenue (2700)');
    console.log('   Need to:');
    console.log('   1. Reverse current JE');
    console.log('   2. Post new JE: Dr Platform Settlement (1120) / Cr Deferred Revenue (2700) + GST lines');
    console.log('   3. Create revenue recognition schedule for 12 months');
    
    if (!dryRun) {
      console.log('\n🔄 Executing fix...');
      
      const { rows: [admin] } = await safeQuery(
        `SELECT id FROM staff_accounts WHERE role IN ('owner', 'admin') LIMIT 1`
      );
      
      // 1. Reverse the original JE
      const reversal = await ledger.reverseJournalEntry(jeId, {
        reason: 'Convert platform sync annual subscription to deferred revenue recognition',
        createdBy: admin.id
      });
      console.log(`✅ Reversed original JE: ${reversal.id}`);
      
      // 2. Post new JE to Deferred Revenue
      const { rows: [settlementAcct] } = await safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '1120'`);
      const { rows: [deferredAcct] } = await safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '2700'`);
      const { rows: [cgstAcct] } = await safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '2210'`);
      const { rows: [sgstAcct] } = await safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '2220'`);
      const { rows: [igstAcct] } = await safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '2230'`);
      
      // Find GST lines from original
      const cgstLine = lines.find(l => l.code === '2210');
      const sgstLine = lines.find(l => l.code === '2220');
      const igstLine = lines.find(l => l.code === '2230');
      
      // Calculate subtotal (amount before GST)
      const subtotal = Number(arLine.debit) - (Number(cgstLine?.credit || 0) + Number(sgstLine?.credit || 0) + Number(igstLine?.credit || 0));
      
      const newLines = [
        { accountId: settlementAcct.id, debit: arLine.debit, partyId: arLine.party_id, description: `Platform sync subscription (deferred)` },
        { accountId: deferredAcct.id, credit: subtotal, description: `Deferred revenue for annual subscription` },
      ];
      
      if (cgstLine) newLines.push({ accountId: cgstAcct.id, credit: cgstLine.credit, description: 'CGST output' });
      if (sgstLine) newLines.push({ accountId: sgstAcct.id, credit: sgstLine.credit, description: 'SGST output' });
      if (igstLine) newLines.push({ accountId: igstAcct.id, credit: igstLine.credit, description: 'IGST output' });
      
      const newJE = await ledger.postJournalEntry({
        entryDate: je.entry_date,
        source: 'platform_sync',
        sourceType: 'subscription',
        sourceId: je.source_id || je.id,
        narration: `Platform sync: Annual subscription (growth) - deferred revenue`,
        createdBy: admin.id,
        lines: newLines,
      });
      console.log(`✅ Posted new JE to Deferred Revenue: ${newJE.id}`);
      
      // 3. Create revenue recognition schedule (12 months)
      const { rows: [sched] } = await safeQuery(
        `INSERT INTO revenue_recognition_schedules (invoice_id, total_amount, start_date, end_date, next_recognition_date, frequency)
         VALUES ($1, $2, $3, $4, $5, 'monthly') RETURNING *`,
        [jeId, subtotal, je.entry_date, new Date(new Date(je.entry_date).setFullYear(new Date(je.entry_date).getFullYear() + 1)).toISOString().slice(0,10), je.entry_date]
      );
      console.log(`✅ Created revenue recognition schedule (12 months): ${sched.id}`);
      console.log(`   Monthly amount: ₹${(subtotal / 12).toFixed(2)}`);
      console.log(`   Period: ${je.entry_date} to ${sched.end_date}`);
      
      console.log('\n✅ Fix completed! Monthly revenue recognition will now process 1/12th each month.');
    }
  } else if (deferredLine) {
    console.log('\n✅ Already correctly posted to Deferred Revenue');
  } else {
    console.log('\n⚠️  Unexpected JE structure - manual review needed');
    console.log('   AR Line (1200/1120):', arLine ? `Found (${arLine.code})` : 'NOT FOUND');
    console.log('   Income Line (4100):', incomeLine ? 'Found' : 'NOT FOUND');
    console.log('   Deferred Line (2700):', deferredLine ? 'Found' : 'NOT FOUND');
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--execute');
  await fixPlatformSyncSubscription(dryRun);
  
  if (dryRun) {
    console.log('\n💡 Run with --execute to perform actual fix');
  }
  console.log('\n═══════════════════════════════════════════════════════════════');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});