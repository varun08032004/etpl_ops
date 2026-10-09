const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.INTERNAL_OPS_DATABASE_URL });

async function main() {
  const depts = await pool.query('SELECT id, name, status, head_employee_id FROM departments ORDER BY name');
  console.log('DEPARTMENTS:');
  depts.rows.forEach(d => console.log(' ', d.id, d.name, d.status, d.head_employee_id || 'no head'));
  
  const emps = await pool.query(`
    SELECT e.employee_code, e.full_name, e.department_id, d.name as dept_name, 
           des.title as designation, t.name as tier, t.display_order
    FROM employees e
    LEFT JOIN departments d ON d.id = e.department_id
    LEFT JOIN designations des ON des.id = e.designation_id
    LEFT JOIN org_hierarchy_tiers t ON t.id = des.tier_id
    WHERE e.status != 'exited'
    ORDER BY t.display_order, e.full_name
  `);
  console.log('\nEMPLOYEES BY TIER:');
  emps.rows.forEach(e => console.log(' ', e.employee_code, '|', e.full_name, '| dept:', e.dept_name || 'none', '| desig:', e.designation, '| tier:', e.tier));
  
  const tiers = await pool.query('SELECT * FROM org_hierarchy_tiers ORDER BY display_order');
  console.log('\nTIERS:');
  tiers.rows.forEach(t => console.log(' ', t.name, '| order:', t.display_order, '| system:', t.is_system, '| id:', t.id));
  
  await pool.end();
}
main().catch(console.error);