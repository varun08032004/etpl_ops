const { Client } = require('pg');
const client = new Client({
  host: 'aws-0-ap-southeast-1.pooler.supabase.com',
  port: 5432,
  database: 'postgres',
  user: 'postgres.hybufntjrxikcpkwonei',
  password: 'C8InvJEpLjkP7vNI',
  ssl: { rejectUnauthorized: false }
});

client.connect().then(async () => {
  const query = "SELECT e.enumlabel FROM pg_enum e ORDER BY e.enumlabel";
  const res = await client.query(query);
  console.log('All enum labels in pg_enum:');
  res.rows.forEach(r => console.log('  -', r.enumlabel));
  await client.end();
});