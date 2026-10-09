const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.INTERNAL_OPS_DATABASE_URL });

async function main() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 1. Clear all department heads
    console.log('1. Clearing all department heads...');
    await client.query(`UPDATE departments SET head_employee_id = NULL`);
    console.log('   All department heads set to NULL');
    
    // 2. Reset directors back to Director tier (not HOD)
    console.log('\n2. Resetting directors to Director tier...');
    const { rows: directorDesig } = await client.query(`SELECT id FROM designations WHERE title = 'Director'`);
    if (directorDesig.length > 0) {
      await client.query(`
        UPDATE employees SET designation_id = $1 
        WHERE employee_code IN ('ET-EMP-0003', 'ET-EMP-0004', 'ET-EMP-0005')
      `, [directorDesig[0].id]);
      console.log('   Archana, Sharvari, Tejas -> Director');
    }
    
    // 3. Reset Girish back to Managing Director (not HOD)
    console.log('\n3. Resetting Girish to Managing Director...');
    const { rows: mdDesig } = await client.query(`SELECT id FROM designations WHERE title = 'Managing Director'`);
    if (mdDesig.length > 0) {
      await client.query(`
        UPDATE employees SET designation_id = $1 
        WHERE employee_code = 'ET-EMP-0002'
      `, [mdDesig[0].id]);
      console.log('   Girish (ET-EMP-0002) -> Managing Director');
    }
    
    // 4. Varun stays Founder
    console.log('\n4. Varun remains Founder');
    const { rows: founderDesig } = await client.query(`SELECT id FROM designations WHERE title = 'Founder'`);
    if (founderDesig.length > 0) {
      await client.query(`
        UPDATE employees SET designation_id = $1 
        WHERE employee_code = 'ET-EMP-0001'
      `, [founderDesig[0].id]);
    }
    
    // 5. CEO position exists but unassigned (can be assigned later)
    console.log('\n5. CEO position available (unassigned)');
    
    await client.query('COMMIT');
    console.log('\n✅ Done!');
    
    // Verify
    console.log('\n=== VERIFICATION ===');
    const { rows: depts } = await client.query(`
      SELECT d.name, d.code, d.head_employee_id, e.full_name as head_name
      FROM departments d
      LEFT JOIN employees e ON e.id = d.head_employee_id
      WHERE d.status = 'active'
      ORDER BY d.name
    `);
    console.log('DEPARTMENTS:');
    depts.forEach(d => console.log(`  ${d.name} (${d.code}) | head: ${d.head_name || 'NULL'}`));
    
    const { rows: emps } = await client.query(`
      SELECT e.employee_code, e.full_name, des.title as designation, t.name as tier, t.display_order
      FROM employees e
      LEFT JOIN designations des ON des.id = e.designation_id
      LEFT JOIN org_hierarchy_tiers t ON t.id = des.tier_id
      WHERE e.status != 'exited'
      ORDER BY t.display_order, e.full_name
    `);
    console.log('\nEMPLOYEES BY TIER:');
    emps.forEach(e => console.log(`  ${e.employee_code} | ${e.full_name} | ${e.designation} | ${e.tier} (${e.display_order})`));
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();