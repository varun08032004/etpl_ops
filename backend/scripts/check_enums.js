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
  const query = "SELECT t.typname, e.enumlabel FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname IN ('project_type', 'permission_type', 'link_type', 'board_type', 'custom_field_type', 'issue_type', 'issue_priority', 'issue_status_category', 'sprint_status', 'workflow_transition_type') ORDER BY t.typname, e.enumsortorder";
  const res = await client.query(query);
  console.log(JSON.stringify(res.rows, null, 2));
  await client.end();
});