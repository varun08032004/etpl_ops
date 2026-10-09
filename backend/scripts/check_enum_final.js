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
        
        const res = await client.query(`
            SELECT t.typname, e.enumlabel 
            FROM pg_enum e 
            JOIN pg_type t ON e.enumtypid = t.oid 
            WHERE t.typname IN ('permission_type', 'jira_link_type', 'link_type') 
            ORDER BY t.typname, e.enumsortorder
        `);
        console.log('Types and labels:', JSON.stringify(res.rows, null, 2));
        
    } catch (err) {
        console.error('Error:', err.code, err.message);
    } finally {
        await client.end();
    }
}

run();