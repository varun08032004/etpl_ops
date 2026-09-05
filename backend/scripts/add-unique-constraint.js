const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ 
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL, 
  ssl: { rejectUnauthorized: false } 
});

async function addUniqueConstraint() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      ALTER TABLE carbon_academy_role_tracks 
      ADD CONSTRAINT carbon_academy_role_tracks_role_name_department_key 
      UNIQUE (role_name, department)
    `);
    await client.query('COMMIT');
    console.log('✅ Unique constraint added successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Failed:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

addUniqueConstraint();