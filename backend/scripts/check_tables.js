const { Client } = require('pg');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

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
        
        const res = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name LIKE 'jira_%'
            ORDER BY table_name
        `);
        
        console.log('Jira tables in database:');
        res.rows.forEach(r => console.log('  -', r.table_name));
        
        // Also check for issue_types, issue_statuses, priorities, resolutions
        const res2 = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('jira_issue_types', 'jira_issue_statuses', 'jira_priorities', 'jira_resolutions', 'jira_versions', 'jira_components')
            ORDER BY table_name
        `);
        
        console.log('\nReferenced tables:');
        res2.rows.forEach(r => console.log('  -', r.table_name));
        
    } catch (err) {
        console.error('Error:', err.code, err.message);
    } finally {
        await client.end();
    }
}

run();