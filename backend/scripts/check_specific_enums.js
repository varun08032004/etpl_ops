const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
    host: 'aws-0-ap-southeast-1.pooler.supabase.com',
    port: 5432,
    database: 'postgres',
    user: 'postgres.hybufntjrxikcpkwonei',
    password: 'C8InvJEpLjkP7vNI',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 60000,
});

async function run() {
    try {
        await client.connect();
        console.log('Connected!');
        
        // Check if types exist in pg_type
        const res1 = await client.query("SELECT typname FROM pg_type WHERE typname IN ('permission_type', 'jira_link_type')");
        console.log('Types in pg_type:', res1.rows.map(r => r.typname));
        
        // Check pg_enum for these types
        const res2 = await client.query("SELECT t.typname, e.enumlabel FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid WHERE t.typname IN ('permission_type', 'jira_link_type') ORDER BY t.typname, e.enumsortorder");
        console.log('Enum labels:', res2.rows);
        
    } catch (err) {
        console.error('Error:', err.code, err.message);
    } finally {
        await client.end();
    }
}

run();