const { Pool } = require('pg');
const pool = new Pool({ 
  connectionString: 'postgresql://postgres.hybufntjrxikcpkwonei:C8InvJEpLjkP7vNI@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres', 
  ssl: { rejectUnauthorized: false } 
});

const sql = `
ALTER TABLE attendance_records 
  ADD COLUMN IF NOT EXISTS expected_punch_in TIMESTAMP,
  ADD COLUMN IF NOT EXISTS expected_punch_out TIMESTAMP,
  ADD COLUMN IF NOT EXISTS late_minutes INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS early_leave_minutes INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
`;

pool.query(sql)
  .then(r => console.log('Columns added successfully'))
  .catch(e => console.error('Error:', e.message))
  .finally(() => pool.end());