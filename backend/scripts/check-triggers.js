require('dotenv').config();
const {Pool} = require('pg');
const pool = new Pool({
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL,
  ssl: {rejectUnauthorized: false}
});

async function check() {
  try {
    const r = await pool.query("SELECT * FROM pg_trigger WHERE tgrelid = 'schema_migrations'::regclass");
    console.log('Triggers on schema_migrations:');
    console.table(r.rows);
    
    const t = await pool.query("SELECT * FROM pg_class WHERE relname = 'schema_migrations'");
    console.log('Table info:');
    console.table(t.rows);
  } catch (e) {
    console.log('Error:', e.message);
  }
  pool.end();
}
check();