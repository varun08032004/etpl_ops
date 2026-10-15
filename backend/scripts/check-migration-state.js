require('dotenv').config();
const {Pool} = require('pg');
const pool = new Pool({
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL,
  ssl: {rejectUnauthorized: false}
});

async function check() {
  try {
    // Check bank_accounts for encrypted columns (080)
    const bankCols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'bank_accounts'");
    console.log('bank_accounts columns:');
    console.table(bankCols.rows.map(r => r.column_name));
    
    // Check employees for PII columns (081)
    const empCols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'employees'");
    console.log('\nemployees columns:');
    console.table(empCols.rows.map(r => r.column_name));
    
    // Check journal_entries for matched_bank_transaction_id (085)
    const jeCols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'journal_entries'");
    console.log('\njournal_entries columns:');
    console.table(jeCols.rows.map(r => r.column_name));
    
    // Check expense_bank_transactions for reconciliation fields (085)
    const ebtCols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'expense_bank_transactions'");
    console.log('\nexpense_bank_transactions columns:');
    console.table(ebtCols.rows.map(r => r.column_name));
    
  } catch (e) {
    console.log('Error:', e.message);
  }
  pool.end();
}
check();