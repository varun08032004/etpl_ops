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
  const res = await client.query("SELECT id, email, role, employee_id FROM staff_accounts WHERE role IN ('admin','owner') LIMIT 1");
  console.log('Admin user:', res.rows[0]);
  await client.end();
});