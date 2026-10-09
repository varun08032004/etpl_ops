const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.INTERNAL_OPS_DATABASE_URL });

async function main() {
  const { rows: depts } = await pool.query(`
    SELECT d.id, d.name, d.code, d.status, d.head_employee_id, e.full_name as head_name
    FROM departments d
    LEFT JOIN employees e ON e.id = d.head_employee_id
    WHERE d.status = 'active'
    ORDER BY d.name
  `);
  console.log('ACTIVE DEPARTMENTS:');
  depts.forEach(d => console.log(' ', d.name, '(' + d.code + ')', '| head:', d.head_name || 'none'));
  
  const { rows: emps } = await pool.query(`
    SELECT e.employee_code, e.full_name, e.department_id, d.name as dept_name, 
           des.title as designation, t.name as tier, t.display_order
    FROM employees e
    LEFT JOIN departments d ON d.id = e.department_id
    LEFT JOIN designations des ON des.id = e.designation_id
    LEFT JOIN org_hierarchy_tiers t ON t.id = des.tier_id
    WHERE e.status != 'exited'
    ORDER BY t.display_order, e.full_name
  `);
  console.log('\nALL EMPLOYEES BY TIER:');
  emps.forEach(e => console.log(' ', e.employee_code, '|', e.full_name, '| dept:', e.dept_name || 'none', '| desig:', e.designation, '| tier:', e.tier, '(' + e.display_order + ')'));
  
  const { rows: tiers } = await pool.query('SELECT * FROM org_hierarchy_tiers ORDER BY display_order');
  console.log('\nTIERS:');
  tiers.forEach(t => console.log(' ', t.name, '| order:', t.display_order, '| system:', t.is_system));
  
  await pool.end();
}
main().catch(console.error);