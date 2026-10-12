const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function checkJobStatus() {
  const client = await pool.connect();
  try {
    console.log('Checking job_postings table status values...');
    const result = await client.query(`
      SELECT DISTINCT status, COUNT(*) as count
      FROM job_postings
      GROUP BY status
      ORDER BY count DESC
    `);
    console.table(result.rows);
    
    // Also check the experience_required column
    const expResult = await client.query(`
      SELECT experience_required, COUNT(*) as count
      FROM job_postings
      GROUP BY experience_required
      ORDER BY count DESC
    `);
    console.log('\nExperience required values:');
    console.table(expResult.rows);
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkJobStatus();