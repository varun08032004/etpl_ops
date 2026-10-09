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
  const res = await client.query('SELECT id, full_name, date_of_joining FROM employees WHERE id = $1', ['9da028a3-696a-44d8-a07b-1b5af38613c9']);
  console.log('Employee:', res.rows[0]);
  await client.end();
});