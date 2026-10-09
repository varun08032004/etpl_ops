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
  const res = await client.query(`
    INSERT INTO documents (title, doc_type, entity_type, entity_id, storage_path, file_name, file_size_bytes, mime_type, uploaded_by)
    VALUES ('Test Document', 'resume', 'employee', '9da028a3-696a-44d8-a07b-1b5af38613c9', '/fake/test.pdf', 'test.pdf', 1024, 'application/pdf', '394c52b0-ac5d-45fc-9d1a-9274ae126973')
    RETURNING id
  `);
  console.log('Created doc:', res.rows[0].id);
  await client.end();
});