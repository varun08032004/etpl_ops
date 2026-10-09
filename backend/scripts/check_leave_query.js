const { Client } = require('pg');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const client = new Client({
    host: 'aws-0-ap-southeast-1.pooler.supabase.com',
    port: 5432,
    database: 'postgres',
    user: 'postgres.hybufntjrxikcpkwonei',
    password: 'C8InvJEpLjkP7vNI',
    ssl: { rejectUnauthorized: false },
});

client.connect().then(async () => {
  const query = `
    SELECT lr.*, lt.name AS leave_type_name, e.full_name AS employee_name, e.employee_code, e.department_name
    FROM leave_requests lr
    JOIN leave_types lt ON lt.id = lr.leave_type_id
    JOIN employees e ON e.id = lr.employee_id
    WHERE lr.status = 'pending'
    ORDER BY lr.start_date ASC
  `;
  const res = await client.query(query);
  console.log('Query result:', res.rows.length);
  console.log(res.rows);
  await client.end();
});