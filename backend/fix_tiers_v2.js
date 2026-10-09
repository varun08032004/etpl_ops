const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.INTERNAL_OPS_DATABASE_URL });

async function main() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 1. Reset org_hierarchy_tiers to 6-tier structure (separate Founder, MD, Director, CEO)
    console.log('1. Resetting org hierarchy tiers to 6-level structure...');
    await client.query(`UPDATE employees SET designation_id = NULL`);
    await client.query(`DELETE FROM designations`);
    await client.query(`DELETE FROM org_hierarchy_tiers`);
    
    const { rows: newTiers } = await client.query(`
      INSERT INTO org_hierarchy_tiers (name, display_order, description, color, is_system) VALUES
        ('Founder', 0, 'Founder - Top leadership', '#7c3aed', TRUE),
        ('Managing Director', 10, 'Managing Director', '#6d28d9', TRUE),
        ('Director(s)', 20, 'Board-level Directors', '#5b21b6', TRUE),
        ('CEO', 30, 'Chief Executive Officer', '#3730a3', TRUE),
        ('HOD (Head of Department)', 40, 'Department Head', '#1e40af', TRUE),
        ('Employee', 50, 'Individual contributor', '#166534', TRUE)
      RETURNING *
    `);
    console.log('   Created tiers:');
    newTiers.forEach(t => console.log(`     ${t.display_order}: ${t.name} (${t.id})`));
    
    // 2. Get tier IDs
    const tierFounder = newTiers.find(t => t.display_order === 0).id;
    const tierMD = newTiers.find(t => t.display_order === 10).id;
    const tierDirector = newTiers.find(t => t.display_order === 20).id;
    const tierCEO = newTiers.find(t => t.display_order === 30).id;
    const tierHOD = newTiers.find(t => t.display_order === 40).id;
    const tierEmployee = newTiers.find(t => t.display_order === 50).id;
    
    // 3. Get active departments
    const { rows: activeDepts } = await client.query(
      `SELECT id, name, code FROM departments WHERE status = 'active' ORDER BY name`
    );
    
    // 4. Create designations (auto UUID)
    console.log('\n2. Creating designations...');
    
    // Top leadership (no department)
    await client.query(`INSERT INTO designations (title, department_id, tier_id, level) VALUES ('Founder', NULL, $1, 0)`, [tierFounder]);
    await client.query(`INSERT INTO designations (title, department_id, tier_id, level) VALUES ('Managing Director', NULL, $1, 10)`, [tierMD]);
    await client.query(`INSERT INTO designations (title, department_id, tier_id, level) VALUES ('Director', NULL, $1, 20)`, [tierDirector]);
    await client.query(`INSERT INTO designations (title, department_id, tier_id, level) VALUES ('CEO', NULL, $1, 30)`, [tierCEO]);
    
    // HOD per department
    for (const dept of activeDepts) {
      await client.query(`INSERT INTO designations (title, department_id, tier_id, level) VALUES ($1, $2, $3, 40)`, [`HOD - ${dept.name}`, dept.id, tierHOD]);
    }
    
    // Employee per department
    for (const dept of activeDepts) {
      await client.query(`INSERT INTO designations (title, department_id, tier_id, level) VALUES ($1, $2, $3, 50)`, [`${dept.name} Employee`, dept.id, tierEmployee]);
    }
    
    // Fetch designation IDs
    const { rows: allDesignations } = await client.query(`SELECT id, title, department_id FROM designations`);
    const desigByTitle = {};
    allDesignations.forEach(d => desigByTitle[d.title] = d.id);
    
    // 5. Assign leadership
    console.log('\n3. Assigning leadership...');
    
    // Varun = Founder
    await client.query(`UPDATE employees SET designation_id = $1 WHERE employee_code = 'ET-EMP-0001'`, [desigByTitle['Founder']]);
    console.log('   Varun -> Founder');
    
    // Girish = Managing Director
    await client.query(`UPDATE employees SET designation_id = $1 WHERE employee_code = 'ET-EMP-0002'`, [desigByTitle['Managing Director']]);
    console.log('   Girish -> Managing Director');
    
    // Archana, Sharvari, Tejas = Directors
    await client.query(`UPDATE employees SET designation_id = $1 WHERE employee_code IN ('ET-EMP-0003', 'ET-EMP-0004', 'ET-EMP-0005')`, [desigByTitle['Director']]);
    console.log('   Archana, Sharvari, Tejas -> Directors');
    
    // CEO unassigned
    
    // 6. Clear department heads (they're Directors/MD, not HODs)
    await client.query(`UPDATE departments SET head_employee_id = NULL`);
    console.log('\n4. All department heads cleared (Directors/MD are not HODs)');
    
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