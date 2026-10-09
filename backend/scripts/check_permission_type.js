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
  const query = "SELECT t.typname FROM pg_type t WHERE t.typname = 'permission_type'";
  const res = await client.query(query);
  console.log('permission_type exists:', res.rows.length > 0);
  if (res.rows.length > 0) {
    const labels = await client.query("SELECT e.enumlabel FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'permission_type' ORDER BY e.enumsortorder");
    console.log('permission_type labels:', labels.rows);
  }
  await client.end();
});