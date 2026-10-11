const { Pool } = require('pg');
const pool = new Pool({ 
  connectionString: 'postgresql://postgres.hybufntjrxikcpkwonei:C8InvJEpLjkP7vNI@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres', 
  ssl: { rejectUnauthorized: false } 
});

// First get the staff_accounts ID for the founder
pool.query('SELECT id FROM staff_accounts WHERE employee_id = $1', ['a88fb6f4-e807-40b6-8142-357400df75b9'])
  .then(r => {
    if (!r.rows.length) throw new Error('Staff account not found');
    const staffId = r.rows[0].id;
    console.log('Staff ID:', staffId);
    
    return pool.query(
      `UPDATE employee_device_bindings 
       SET status = 'active', approved_at = NOW(), approved_by = $1 
       WHERE employee_id = $2 AND device_fingerprint = $3`,
      [staffId, 'a88fb6f4-e807-40b6-8142-357400df75b9', 'test-device-123']
    );
  })
  .then(r => console.log('Approved:', r.rowCount, 'rows'))
  .catch(e => console.error('Error:', e.message))
  .finally(() => pool.end());