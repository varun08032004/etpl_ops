const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.INTERNAL_OPS_DATABASE_URL });

pool.query(`
  INSERT INTO compliance_settings (key, value, note) VALUES
  ('gstr1_filing_frequency', 'monthly', 'GSTR-1 filing frequency: monthly or quarterly (QRMP scheme for turnover <=5Cr)')
  ON CONFLICT (key) DO NOTHING
`).then(() => { 
  console.log('Done'); 
  pool.end(); 
}).catch(e => { 
  console.error(e); 
  pool.end(); 
});