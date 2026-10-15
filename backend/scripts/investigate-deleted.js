require('dotenv').config();
const {Pool} = require('pg');
const pool = new Pool({
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL,
  ssl: {rejectUnauthorized: false}
});

async function investigate() {
  try {
    // Check if tables exist
    const tables = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('bills', 'audit_log', 'schema_migrations')
    `);
    console.log('Tables exist:', tables.rows);

    // Check bills table
    const bills = await pool.query(`SELECT COUNT(*) FROM bills`);
    console.log('Bills count:', bills.rows);

    // Check audit_log table
    const audit = await pool.query(`SELECT COUNT(*) FROM audit_log`);
    console.log('Audit log count:', audit.rows);

    // Check schema_migrations
    const migrations = await pool.query(`SELECT COUNT(*) FROM schema_migrations`);
    console.log('Migration registry count:', migrations.rows);

    // Check journal_entries count
    const je = await pool.query(`SELECT COUNT(*) FROM journal_entries`);
    console.log('Journal entries count:', je.rows);

  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    pool.end();
  }
}
investigate();