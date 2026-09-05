'use strict';
require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function assignToFounder() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Get programme ID
    const { rows: [programme] } = await client.query(`
      SELECT id FROM training_programmes WHERE code = 'CA-2026'
    `);
    const programmeId = programme.id;
    
    // Get founder staff_id
    const { rows: [ownerStaff] } = await client.query(`
      SELECT s.id FROM staff_accounts s
      JOIN employees e ON s.employee_id = e.id
      WHERE s.role = 'owner' AND s.email = 'founder@ethertrack.in'
    `);
    const staffId = ownerStaff.id;
    
    // Get founder employee_id
    const { rows: [owner] } = await client.query(`
      SELECT e.id FROM employees e
      JOIN staff_accounts s ON s.employee_id = e.id
      WHERE s.role = 'owner' AND s.email = 'founder@ethertrack.in'
    `);
    const employeeId = owner.id;
    
    // Check if assignment already exists
    const { rows: [existing] } = await client.query(`
      SELECT * FROM training_assignments 
      WHERE employee_id = $1 AND programme_id = $2
    `, [owner.id, programmeId]);
    
    if (existing) {
      console.log('Assignment already exists:', existing);
    } else {
      const { rows: [assignment] } = await client.query(`
        INSERT INTO training_assignments (employee_id, programme_id, status, assigned_at, due_date, assigned_by)
        VALUES ($1, $2, 'assigned', NOW(), NOW() + interval '16 weeks', $3)
        RETURNING *`, [owner.id, programmeId, ownerStaff.id]);
      console.log('✅ Assignment created:', assignment);
    }
    
    await client.query('COMMIT');
    console.log('✅ Done!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

assignToFounder().catch(() => process.exit(1));