require('dotenv').config();
const {Pool} = require('pg');
const pool = new Pool({
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL,
  ssl: {rejectUnauthorized: false}
});

async function check() {
  // Check all journal lines for Equipment account
  const result = await pool.query(`
    SELECT jl.*, je.entry_date, je.entry_number
    FROM journal_lines jl
    JOIN journal_entries je ON je.id = jl.journal_entry_id
    WHERE jl.account_id = '55555555-5555-5555-5555-555555555555'
    ORDER BY je.entry_date
  `);
  console.log('Equipment lines:', result.rows);
  
  pool.end();
}
check();