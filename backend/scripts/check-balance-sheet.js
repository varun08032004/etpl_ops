require('dotenv').config();
const {Pool} = require('pg');
const pool = new Pool({
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL,
  ssl: {rejectUnauthorized: false}
});

async function check() {
  // Check the actual entry_date values as stored
  const result = await pool.query("SELECT id, entry_number, entry_date, pg_typeof(entry_date) FROM journal_entries ORDER BY entry_date");
  console.log('Entry dates:', result.rows);
  
  // Test the balance sheet query manually
  const bs = await pool.query(`
    SELECT coa.id, coa.code, coa.name, coa.account_type,
            COALESCE(SUM(jl.debit),0) AS total_debit,
            COALESCE(SUM(jl.credit),0) AS total_credit
     FROM chart_of_accounts coa
     LEFT JOIN journal_lines jl ON jl.account_id = coa.id
     LEFT JOIN journal_entries je ON je.id = jl.journal_entry_id
       AND je.entry_date <= '2024-01-20'::date
     WHERE coa.account_type IN ('asset','liability','equity') AND coa.is_group = false AND coa.is_active = true
     GROUP BY coa.id, coa.code, coa.name, coa.account_type
     ORDER BY coa.code
  `);
  console.log('Balance sheet as of 2024-01-20:', bs.rows);
  
  pool.end();
}
check();