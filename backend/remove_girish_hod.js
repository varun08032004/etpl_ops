const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.INTERNAL_OPS_DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  // Remove Girish as HOD of Operations (MD should not be HOD)
  await pool.query("UPDATE departments SET head_employee_id = NULL WHERE name = 'Operations'");
  console.log('Removed Girish as HOD of Operations');
  
  // Verify
  const { rows: heads } = await pool.query(`
    SELECT d.name as dept, e.full_name as head, des.title as designation
    FROM departments d
    LEFT JOIN employees e ON e.id = d.head_employee_id
    LEFT JOIN designations des ON des.id = e.designation_id
    WHERE d.status = 'active'
    ORDER BY d.name
  `);
  console.log('\nDepartment Heads:');
  heads.forEach(h => console.log('  ', h.dept, '|', h.head || '—', '|', h.designation || '—'));
  
  const { rows: emps } = await pool.query(`
    SELECT e.employee_code, e.full_name, e.department_id, d.name as dept_name, des.title as desig, t.name as tier
    FROM employees e
    LEFT JOIN departments d ON d.id = e.department_id
    LEFT JOIN designations des ON des.id = e.designation_id
    LEFT JOIN org_hierarchy_tiers t ON t.id = des.tier_id
    ORDER BY t.display_order, e.employee_code
  `);
  console.log('\nEmployees:');
  emps.forEach(e => console.log('  ', e.employee_code, '|', e.full_name, '| dept:', e.dept_name || 'NULL', '| desig:', e.desig, '| tier:', e.tier));
  
  await pool.end();
}
run();