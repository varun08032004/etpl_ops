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
        
        const res = await client.query("SELECT typname, oid FROM pg_type WHERE typname LIKE '%permission%' OR typname LIKE '%link%' OR typname LIKE '%jira%'");
        console.log('Types found:', res.rows.map(r => r.typname + ' (oid: ' + r.oid + ')'));
        
        // Check permission_type specifically
        const res2 = await client.query("SELECT typname, oid FROM pg_type WHERE typname = 'permission_type'");
        console.log('permission_type exists:', res2.rows.length > 0 ? 'YES (oid: ' + res2.rows[0].oid + ')' : 'NO');
        
        // Check jira_link_type
        const res3 = await client.query("SELECT typname, oid FROM pg_type WHERE typname = 'jira_link_type'");
        console.log('jira_link_type exists:', res3.rows.length > 0 ? 'YES (oid: ' + res3.rows[0].oid + ')' : 'NO');
        
        // Check link_type
        const res4 = await client.query("SELECT typname, oid FROM pg_type WHERE typname = 'link_type'");
        console.log('link_type exists:', res4.rows.length > 0 ? 'YES (oid: ' + res4.rows[0].oid + ')' : 'NO');
        
    } catch (err) {
        console.error('Error:', err.code, err.message);
    } finally {
        await client.end();
    }
}

run();