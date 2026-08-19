require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { safeQuery } = require('../db/pool');

(async () => {
  try {
    const { rows } = await safeQuery(`
      SELECT je.id, je.entry_number, je.narration
      FROM journal_entries je
      JOIN journal_lines jl ON jl.journal_entry_id = je.id
      JOIN chart_of_accounts coa ON coa.id = jl.account_id
      WHERE coa.code = '4100'
        AND je.entry_date BETWEEN '2026-07-01' AND '2026-08-31'
        AND je.id NOT IN ('e1d31879-dc3d-4429-bd66-efcd0787efec', 'af5c64b1-f84d-4a79-a910-c683bc8a839d')
      ORDER BY je.entry_date
    `);
    for (const r of rows) {
      console.log(r.id, r.entry_number, r.narration);
    }
  } catch (e) { console.error('Error:', e.message); }
  process.exit(0);
})();