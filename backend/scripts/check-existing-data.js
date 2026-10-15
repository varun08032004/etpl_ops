require('dotenv').config();
const {Pool} = require('pg');
const pool = new Pool({
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL,
  ssl: {rejectUnauthorized: false}
});

async function check() {
  const entries = await pool.query("SELECT id, entry_number, entry_date, source FROM journal_entries ORDER BY entry_date");
  console.log('Journal Entries:', entries.rows);
  
  const lines = await pool.query("SELECT jl.*, je.entry_date FROM journal_lines jl JOIN journal_entries je ON je.id = jl.journal_entry_id ORDER BY je.entry_date");
  console.log('Journal Lines:', lines.rows);
  
  pool.end();
}
check();