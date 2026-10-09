const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.INTERNAL_OPS_DATABASE_URL });

async function main() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 1. Delete inactive departments
    console.log('1. Deleting inactive departments...');
    const { rowCount: deletedDepts } = await client.query(
      `DELETE FROM departments WHERE status = 'inactive'`
    );
    console.log(`   Deleted ${deletedDepts} inactive departments`);
    
    // 2. Show current active departments
    const { rows: activeDepts } = await client.query(
      `SELECT id, name, code FROM departments WHERE status = 'active' ORDER BY name`
    );
    console.log('   Active departments:', activeDepts.map(d => d.name).join(', '));
    
    // 3. Reset org_hierarchy_tiers to 4-tier structure
    console.log('\n2. Resetting org hierarchy tiers to 4-level structure...');
    await client.query(`UPDATE employees SET designation_id = NULL`);
    await client.query(`DELETE FROM designations`);
    await client.query(`DELETE FROM org_hierarchy_tiers`);
    
    const { rows: newTiers } = await client.query(`
      INSERT INTO org_hierarchy_tiers (name, display_order, description, color, is_system) VALUES
        ('Founder / Managing Director / Director', 0, 'Top leadership - Founder, MD, Directors', '#7c3aed', TRUE),
        ('CEO', 10, 'Chief Executive Officer', '#5b21b6', TRUE),
        ('HOD (Head of Department)', 20, 'Department Head - admin access to their department', '#3730a3', TRUE),
        ('Employee', 30, 'Individual contributor - department-level access', '#166534', TRUE)
      RETURNING *
    `);
    console.log('   Created tiers:');
    newTiers.forEach(t => console.log(`     ${t.display_order}: ${t.name} (${t.id})`));
    
    // 4. Get tier IDs
    const tier0 = newTiers.find(t => t.display_order === 0).id; // Founder/MD/Director
    const tier1 = newTiers.find(t => t.display_order === 10).id; // CEO
    const tier2 = newTiers.find(t => t.display_order === 20).id; // HOD
    const tier3 = newTiers.find(t => t.display_order === 30).id; // Employee
    
    // 5. Reset designations for active departments (let DB auto-generate UUID IDs)
    console.log('\n3. Resetting designations...');
    
    // Create top leadership designations (no department)
    await client.query(`
      INSERT INTO designations (title, department_id, tier_id, level) VALUES
        ('Founder', NULL, $1, 0),
        ('Managing Director', NULL, $1, 0),
        ('Director', NULL, $1, 0)
    `, [tier0]);
    
    // CEO designation
    await client.query(`
      INSERT INTO designations (title, department_id, tier_id, level) VALUES
        ('CEO', NULL, $1, 10)
    `, [tier1]);
    
    // HOD designations per department
    for (const dept of activeDepts) {
      await client.query(`
        INSERT INTO designations (title, department_id, tier_id, level) VALUES
          ($1, $2, $3, 20)
      `, [`HOD - ${dept.name}`, dept.id, tier2]);
    }
    console.log(`   Created ${activeDepts.length} HOD designations`);
    
    // Employee designations per department
    for (const dept of activeDepts) {
      await client.query(`
        INSERT INTO designations (title, department_id, tier_id, level) VALUES
          ($1, $2, $3, 30)
      `, [`${dept.name} Employee`, dept.id, tier3]);
    }
    console.log(`   Created ${activeDepts.length} Employee designations`);
    
    // Fetch all designation IDs by title for assignments
    const { rows: allDesignations } = await client.query(`
      SELECT id, title, department_id FROM designations
    `);
    const desigByTitle = {};
    allDesignations.forEach(d => desigByTitle[d.title] = d.id);
    console.log('   Designation IDs:', JSON.stringify(desigByTitle, null, 2));
    
    // 6. Assign top leadership designations to employees
    console.log('\n4. Assigning leadership designations...');
    
    // Varun = Founder
    await client.query(`
      UPDATE employees SET designation_id = $1 
      WHERE employee_code = 'ET-EMP-0001'
    `, [desigByTitle['Founder']]);
    console.log('   Varun (ET-EMP-0001) -> Founder');
    
    // Girish = Managing Director
    await client.query(`
      UPDATE employees SET designation_id = $1 
      WHERE employee_code = 'ET-EMP-0002'
    `, [desigByTitle['Managing Director']]);
    console.log('   Girish (ET-EMP-0002) -> Managing Director');
    
    // Archana, Sharvari, Tejas = Directors
    await client.query(`
      UPDATE employees SET designation_id = $1 
      WHERE employee_code IN ('ET-EMP-0003', 'ET-EMP-0004', 'ET-EMP-0005')
    `, [desigByTitle['Director']]);
    console.log('   Archana, Sharvari, Tejas -> Directors');
    
    // 7. Assign HODs to departments
    console.log('\n5. Assigning HODs to departments...');
    const hodAssignments = [
      { empCode: 'ET-EMP-0003', deptCode: 'FIN', designationTitle: 'HOD - Finance' },     // Archana -> Finance
      { empCode: 'ET-EMP-0004', deptCode: 'MKT', designationTitle: 'HOD - Marketing' },      // Sharvari -> Marketing
      { empCode: 'ET-EMP-0005', deptCode: 'PENG', designationTitle: 'HOD - Product & Engineering' },    // Tejas -> Product & Engineering
      { empCode: 'ET-EMP-0002', deptCode: 'OPS', designationTitle: 'HOD - Operations' },      // Girish -> Operations
    ];
    
    for (const { empCode, deptCode, designationTitle } of hodAssignments) {
      const { rows: [emp] } = await client.query(`SELECT id FROM employees WHERE employee_code = $1`, [empCode]);
      const { rows: [dept] } = await client.query(`SELECT id FROM departments WHERE code = $1`, [deptCode]);
      
      if (emp && dept) {
        await client.query(`UPDATE departments SET head_employee_id = $1 WHERE id = $2`, [emp.id, dept.id]);
        await client.query(`UPDATE employees SET designation_id = $1 WHERE id = $2`, [desigByTitle[designationTitle], emp.id]);
        console.log(`   ${empCode} -> HOD of ${deptCode} (${designationTitle})`);
      } else {
        console.log(`   WARNING: Could not find employee ${empCode} or department ${deptCode}`);
      }
    }
    
    // 8. Assign remaining employees to Employee tier (if they have department but no designation)
    console.log('\n6. Assigning Employee tier to department employees...');
    const { rows: deptEmployees } = await client.query(`
      SELECT e.id, e.employee_code, e.full_name, e.department_id, d.code as dept_code, d.name as dept_name
      FROM employees e
      JOIN departments d ON d.id = e.department_id
      WHERE e.status != 'exited' 
        AND e.designation_id IS NULL
        AND d.status = 'active'
    `);
    
    for (const emp of deptEmployees) {
      const designationTitle = `${emp.dept_name} Employee`;
      await client.query(`UPDATE employees SET designation_id = $1 WHERE id = $2`, [desigByTitle[designationTitle], emp.id]);
      console.log(`   ${emp.employee_code} (${emp.full_name}) -> ${designationTitle}`);
    }
    
    await client.query('COMMIT');
    console.log('\n✅ Done!');
    
    // Verify
    console.log('\n=== VERIFICATION ===');
    const { rows: verify } = await client.query(`
      SELECT e.employee_code, e.full_name, des.title as designation, t.name as tier, t.display_order
      FROM employees e
      LEFT JOIN designations des ON des.id = e.designation_id
      LEFT JOIN org_hierarchy_tiers t ON t.id = des.tier_id
      WHERE e.status != 'exited'
      ORDER BY t.display_order, e.full_name
    `);
    verify.forEach(v => console.log(`  ${v.employee_code} | ${v.full_name} | ${v.designation} | ${v.tier} (${v.display_order})`));
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();