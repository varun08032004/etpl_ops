const { Pool } = require('pg');
const pool = new Pool({ 
  connectionString: 'postgresql://postgres.hybufntjrxikcpkwonei:C8InvJEpLjkP7vNI@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres', 
  ssl: { rejectUnauthorized: false } 
});

const sql = `
ALTER TYPE attendance_status ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE attendance_status ADD VALUE IF NOT EXISTS 'late';
ALTER TYPE attendance_status ADD VALUE IF NOT EXISTS 'early_leave';
`;

pool.query(sql)
  .then(r => console.log('Enum values added successfully'))
  .catch(e => console.error('Error:', e.message))
  .finally(() => pool.end());