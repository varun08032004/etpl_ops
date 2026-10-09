const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.INTERNAL_OPS_DATABASE_URL });

async function main() {
  const { rows } = await pool.query(`
    SELECT 
      sa.id as staff_id, sa.email, sa.role as staff_role, sa.employee_id,
      e.employee_code, e.full_name,
      des.title as designation, des.tier_id,
      t.name as tier, t.display_order
    FROM staff_accounts sa
    LEFT JOIN employees e ON e.id = sa.employee_id
    LEFT JOIN designations des ON des.id = e.designation_id
    LEFT JOIN org_hierarchy_tiers t ON t.id = des.tier_id
    WHERE sa.is_active = true
    ORDER BY t.display_order, e.full_name
  `);
  console.log('STAFF -> EMPLOYEE -> DESIGNATION -> TIER:');
  rows.forEach(r => console.log(`  ${r.email} | staff_role=${r.staff_role} | ${r.employee_code} | ${r.full_name} | desig="${r.designation}" | tier="${r.tier}" (order=${r.display_order})`));
  
  await pool.end();
}
main().catch(console.error);