const { Pool } = require('pg');
const pool = new Pool({ 
  connectionString: 'postgresql://postgres.hybufntjrxikcpkwonei:C8InvJEpLjkP7vNI@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres', 
  ssl: { rejectUnauthorized: false } 
});
pool.query('INSERT INTO employee_device_bindings (employee_id, device_fingerprint, device_name, status) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING', ['a88fb6f4-e807-40b6-8142-357400df75b9', 'test-device-123', 'Test Device', 'active'])
  .then(r => console.log('Device registered:', r.rowCount))
  .catch(e => console.error('Error:', e.message))
  .finally(() => pool.end());