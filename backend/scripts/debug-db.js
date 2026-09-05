const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ 
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL, 
  ssl: { rejectUnauthorized: false } 
});

async function debug() {
  try {
    // Test 1: Check tables
    const { rows: tables } = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name LIKE 'training_%'
      ORDER BY table_name
    `);
    console.log('Tables found:', tables.map(t => t.table_name));
    
    // Test 2: Check primary keys
    const { rows: pks } = await pool.query(`
      SELECT t.table_name, k.column_name
      FROM information_schema.tables t
      LEFT JOIN information_schema.key_column_usage k 
        ON k.table_name = t.table_name AND k.constraint_name LIKE '%pkey%'
      WHERE t.table_schema = 'public' AND t.table_name LIKE 'training_%'
      ORDER BY t.table_name
    `);
    console.log('Primary keys:', pks);
    
    // Test 3: Check foreign keys
    const { rows: fks } = await pool.query(`
      SELECT k.table_name, k.column_name, rk.table_name as ref_table
      FROM information_schema.key_column_usage k
      JOIN information_schema.referential_constraints r 
        ON k.constraint_name = r.constraint_name
      JOIN information_schema.key_column_usage rk
        ON r.unique_constraint_name = rk.constraint_name
      WHERE k.table_name LIKE 'training_%'
      ORDER BY k.table_name
    `);
    console.log('Foreign keys:', fks);
    
    // Test 4: Check check constraints
    const { rows: checks } = await pool.query(`
      SELECT conname, conrelid::regclass as table_name
      FROM pg_constraint
      WHERE contype = 'c' 
        AND conrelid::regclass::text LIKE 'training_%'
      ORDER BY conrelid::regclass::text, conname
    `);
    console.log('Check constraints:', checks);
    
    // Test 5: Check triggers
    const { rows: triggers } = await pool.query(`
      SELECT tgname, tgrelid::regclass as table_name
      FROM pg_trigger
      WHERE tgname LIKE '%updated_at%'
        AND tgrelid::regclass::text LIKE 'training_%'
      ORDER BY tgrelid::regclass::text
    `);
    console.log('Updated_at triggers:', triggers);
    
    // Test 6: Check indexes
    const { rows: indexes } = await pool.query(`
      SELECT indexname, tablename
      FROM pg_indexes
      WHERE schemaname = 'public' 
        AND tablename LIKE 'training_%'
      ORDER BY tablename, indexname
    `);
    console.log('Indexes:', indexes);
    
    // Test 7: Check RLS
    const { rows: rls } = await pool.query(`
      SELECT relname, relrowsecurity
      FROM pg_class
      WHERE relname LIKE 'training_%'
        AND relkind = 'r'
      ORDER BY relname
    `);
    console.log('RLS:', rls);
    
    // Test 8: Check enums
    const { rows: enums } = await pool.query(`
      SELECT typname FROM pg_type WHERE typname LIKE 'training_%' ORDER BY typname
    `);
    console.log('Enums:', enums);
    
  } catch (err) {
    console.error('Error:', err.message, err.stack);
  } finally {
    await pool.end();
  }
}

debug();