const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ 
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL, 
  ssl: { rejectUnauthorized: false } 
});

pool.query(`
  SELECT table_name FROM information_schema.tables 
  WHERE table_schema = 'public' AND table_name LIKE 'carbon_academy%' 
  ORDER BY table_name
`).then(r => { 
  console.log('Carbon Academy tables:'); 
  r.rows.forEach(row => console.log(' -', row.table_name)); 
  pool.end(); 
}).catch(e => { 
  console.error('Error:', e.message); 
  pool.end(); 
});