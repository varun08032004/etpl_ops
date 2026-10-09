'use strict';

require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const employees = [
  {
    email: 'girish@ethertrack.in',
    employee_code: '0002',
    full_name: 'Girish',
  },
  {
    email: 'archana@ethertrack.in',
    employee_code: '0003',
    full_name: 'Archana',
  },
  {
    email: 'sharvari@ethertrack.in',
    employee_code: '0004',
    full_name: 'Sharvari',
  },
  {
    email: 'tejas@ethertrack.in',
    employee_code: '0005',
    full_name: 'Tejas',
  },
];

async function seedEmployees() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const emp of employees) {
      // Check if employee already exists
      const { rows: existing } = await client.query(
        'SELECT id FROM employees WHERE work_email = $1 OR employee_code = $2',
        [emp.email, `ET-EMP-${emp.employee_code}`]
      );

      if (existing.length > 0) {
        console.log(`Employee ${emp.full_name} (${emp.email}) already exists, skipping...`);
        continue;
      }

      // Insert employee with minimal required fields
      const { rows: [employee] } = await client.query(
        `INSERT INTO employees (
          employee_code, full_name, work_email, personal_email, employment_type, 
          date_of_joining, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, employee_code, full_name, work_email`,
        [
          `ET-EMP-${emp.employee_code}`,
          emp.full_name,
          emp.email,
          emp.email,
          'full_time',
          new Date().toISOString().split('T')[0], // today as date of joining
          'active'
        ]
      );

      console.log(`Created employee: ${employee.full_name} (${employee.employee_code}) - ${employee.work_email}`);

      // Create staff account for each employee
      const passwordHash = await bcrypt.hash('EtherTrack@123', 10);
      const { rows: [staffAccount] } = await client.query(
        `INSERT INTO staff_accounts (email, password_hash, role, employee_id, is_active)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, email, role`,
        [emp.email, passwordHash, 'employee', employee.id, true]
      );

      console.log(`  Created staff account: ${staffAccount.email} (role: ${staffAccount.role})`);
    }

    await client.query('COMMIT');
    console.log('\nAll employees seeded successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error seeding employees:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seedEmployees().catch(() => process.exit(1));