require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { safeQuery } = require('../db/pool');

(async () => {
  const { rows } = await safeQuery(`
    SELECT je.id, je.entry_number, je.narration, je.entry_date,
           SUM(CASE WHEN jl.account_id = (SELECT id FROM chart_of_accounts WHERE code = '4100') THEN jl.credit - jl.debit ELSE 0 END) as rev_4100
      FROM journal_entries je
      JOIN journal_lines jl ON jl.journal_entry_id = je.id
      JOIN chart_of_accounts coa ON coa.id = jl.account_id
      WHERE coa.code IN ('4100', '2700')
        AND je.entry_date BETWEEN '2026-07-01' AND '2026-08-31'
      GROUP BY je.id, je.entry_number, je.narration, je.entry_date
      ORDER BY je.entry_date
  `);
  for (const r of rows) {
    console.log(r.entry_date, '|', r.entry_number, '|', r.narration, '| 4100:', r.rev_4100);
  }
  process.exit(0);
})();