'use strict';
require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function assignTraining() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Get programme ID
    const { rows: [programme] } = await client.query(`
      SELECT id FROM training_programmes WHERE code = 'CA-2026'
    `);
    const programmeId = programme.id;
    console.log('Programme ID:', programmeId);
    
    // Get owner employee ID and staff ID
    const { rows: [owner] } = await client.query(`
      SELECT e.id as employee_id, s.id as staff_id 
      FROM employees e
      JOIN staff_accounts s ON s.employee_id = e.id
      WHERE s.role = 'owner' AND s.email = 'tejas@ethertrack.in'
    `);
    const employeeId = owner.employee_id;
    const staffId = owner.staff_id;
    console.log('Employee ID:', employeeId, 'Staff ID:', staffId);
    
    // Check if assignment already exists
    const { rows: [existing] } = await client.query(`
      SELECT * FROM training_assignments 
      WHERE employee_id = $1 AND programme_id = $2
    `, [owner.id, programmeId]);
    
    if (existing) {
      console.log('Assignment already exists:', existing);
    } else {
// Create assignment
      const { rows: [assignment] } = await client.query(`
        INSERT INTO training_assignments (employee_id, programme_id, status, assigned_at, due_date, assigned_by)
        VALUES ($1, $2, 'assigned', NOW(), NOW() + interval '16 weeks', $3)
        RETURNING *
      `, [employeeId, programmeId, staffId]);
      console.log('Assignment created:', assignment);
    }
    
    await client.query('COMMIT');
    console.log('✅ Assignment complete!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

assignTraining().catch(() => process.exit(1));