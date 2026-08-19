require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { safeQuery } = require('../db/pool');

async function main() {
  try {
    // Check what subscription entries exist
    const { rows } = await safeQuery(`
      SELECT je.id, je.entry_date, je.narration, je.source, je.source_type,
             jl.debit, jl.credit, coa.code, coa.name
      FROM journal_entries je
      JOIN journal_lines jl ON jl.journal_entry_id = je.id
      JOIN chart_of_accounts coa ON coa.id = jl.account_id
      WHERE coa.code IN ('4100', '4200', '2210', '2220', '2230')
        AND je.entry_date BETWEEN '2026-07-01' AND '2026-08-31'
      ORDER BY je.entry_date
    `);
    console.log('All relevant JEs:');
    for (const r of rows) {
      console.log(`  ${r.entry_date} | ${r.source}/${r.source_type} | ${r.code} ${r.name} | Dr: ${r.debit} Cr: ${r.credit} | ${r.narration}`);
    }

    // Test the exact query from the route
    const { rows: accts } = await safeQuery(
      `SELECT code, id FROM chart_of_accounts WHERE code = ANY($1)`,
      [['4100', '4200', '2210', '2220', '2230']]
    );
    const acctMap = Object.fromEntries(accts.map((a) => [a.code, a.id]));
    console.log('\nAccount map:', acctMap);

    const { rows: result } = await safeQuery(
      `SELECT 
         je.id as journal_entry_id,
         je.entry_date,
         je.narration,
         je.source,
         je.source_type,
         COALESCE(SUM(CASE WHEN jl.account_id = $1 THEN jl.credit - jl.debit ELSE 0 END), 0) as subscription_revenue,
         COALESCE(SUM(CASE WHEN jl.account_id = $2 THEN jl.credit - jl.debit ELSE 0 END), 0) as services_revenue,
         COALESCE(SUM(CASE WHEN jl.account_id = $3 THEN jl.credit - jl.debit ELSE 0 END), 0) as cgst,
         COALESCE(SUM(CASE WHEN jl.account_id = $4 THEN jl.credit - jl.debit ELSE 0 END), 0) as sgst,
         COALESCE(SUM(CASE WHEN jl.account_id = $5 THEN jl.credit - jl.debit ELSE 0 END), 0) as igst
       FROM journal_entries je
       JOIN journal_lines jl ON jl.journal_entry_id = je.id
       JOIN chart_of_accounts coa ON coa.id = jl.account_id
       WHERE je.entry_date BETWEEN $6 AND $7
         AND je.source != 'adjustment'
         AND je.source_type != 'reversal'
         AND ($8 = 'all' OR je.source_type = $8 OR je.source = $8)
       GROUP BY je.id, je.entry_date, je.narration, je.source, je.source_type
       ORDER BY je.entry_date`,
      [acctMap['4100'] || null, acctMap['4200'] || null, acctMap['2210'] || null, acctMap['2220'] || null, acctMap['2230'] || null, '2026-07-01', '2026-08-31', 'subscription']
    );
    console.log('\nQuery result for revenue_type=subscription:');
    for (const r of result) {
      console.log(`  ${r.entry_date} | ${r.source}/${r.source_type} | Sub: ${r.subscription_revenue} Svc: ${r.services_revenue} CGST: ${r.cgst} SGST: ${r.sgst} IGST: ${r.igst}`);
    }

    // Also test with 'all'
    const { rows: resultAll } = await safeQuery(
      `SELECT 
         je.id as journal_entry_id,
         je.entry_date,
         je.narration,
         je.source,
         je.source_type,
         COALESCE(SUM(CASE WHEN jl.account_id = $1 THEN jl.credit - jl.debit ELSE 0 END), 0) as subscription_revenue,
         COALESCE(SUM(CASE WHEN jl.account_id = $2 THEN jl.credit - jl.debit ELSE 0 END), 0) as services_revenue,
         COALESCE(SUM(CASE WHEN jl.account_id = $3 THEN jl.credit - jl.debit ELSE 0 END), 0) as cgst,
         COALESCE(SUM(CASE WHEN jl.account_id = $4 THEN jl.credit - jl.debit ELSE 0 END), 0) as sgst,
         COALESCE(SUM(CASE WHEN jl.account_id = $5 THEN jl.credit - jl.debit ELSE 0 END), 0) as igst
       FROM journal_entries je
       JOIN journal_lines jl ON jl.journal_entry_id = je.id
       JOIN chart_of_accounts coa ON coa.id = jl.account_id
       WHERE je.entry_date BETWEEN $6 AND $7
         AND je.source != 'adjustment'
         AND je.source_type != 'reversal'
         AND ($8 = 'all' OR je.source_type = $8 OR je.source = $8)
       GROUP BY je.id, je.entry_date, je.narration, je.source, je.source_type
       ORDER BY je.entry_date`,
      [acctMap['4100'] || null, acctMap['4200'] || null, acctMap['2210'] || null, acctMap['2220'] || null, acctMap['2230'] || null, '2026-07-01', '2026-08-31', 'all']
    );
    console.log('\nQuery result for revenue_type=all:');
    for (const r of resultAll) {
      console.log(`  ${r.entry_date} | ${r.source}/${r.source_type} | Sub: ${r.subscription_revenue} Svc: ${r.services_revenue} CGST: ${r.cgst} SGST: ${r.sgst} IGST: ${r.igst}`);
    }

  } catch (e) {
    console.error('Error:', e.message, e.stack);
  }
}

main();