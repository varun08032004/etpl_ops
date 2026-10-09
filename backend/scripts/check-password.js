'use strict';

require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function check() {
  const { rows } = await pool.query(
    `SELECT s.email, s.password_hash, s.role, s.is_active, e.full_name
     FROM staff_accounts s
     JOIN employees e ON e.id = s.employee_id
     WHERE s.email = 'founder@ethertrack.in'`
  );
  
  if (rows.length === 0) {
    console.log('Founder account not found');
  } else {
    const staff = rows[0];
    console.log('Founder:', staff.full_name);
    console.log('Email:', staff.email);
    console.log('Role:', staff.role);
    console.log('Active:', staff.is_active);
    console.log('Password hash:', staff.password_hash);
    
    // Test common passwords
    const passwords = ['EtherTrack@123', 'admin1234', 'password', 'admin123', 'EtherTrack123'];
    for (const pwd of passwords) {
      const match = await bcrypt.compare(pwd, staff.password_hash);
      console.log(`  ${pwd}: ${match ? 'MATCH!' : 'no'}`);
    }
  }
  
  await pool.end();
}

check();