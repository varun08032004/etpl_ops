require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { safeQuery } = require('../db/pool');

async function main() {
  try {
    const { rows } = await safeQuery(`
      SELECT coa.code, coa.name,
             COALESCE(SUM(jl.debit),0) AS dr, COALESCE(SUM(jl.credit),0) AS cr
       FROM chart_of_accounts coa
       LEFT JOIN journal_lines jl ON jl.account_id = coa.id
       LEFT JOIN journal_entries je ON je.id = jl.journal_entry_id
      WHERE coa.code = '2700'
      GROUP BY coa.code, coa.name
    `);
    for (const r of rows) {
      const d = Number(r.dr), c = Number(r.cr);
      console.log('2700:', r.name, 'Dr=', d, 'Cr=', c, 'Bal=', d-c);
    }
  } catch (e) {
    console.error('Error:', e.message, e.stack);
  }
}
main();