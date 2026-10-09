const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

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
        console.log('Connecting...');
        await client.connect();
        console.log('Connected!');
        
        const migrationPath = path.join(__dirname, '..', 'db', '060_jira_comprehensive.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');
        
        console.log('Running full SQL as single query...');
        try {
            await client.query(sql);
            console.log('Full migration OK!');
        } catch (err) {
            console.error(`FAILED: ${err.code} - ${err.message}`);
            console.error(`Detail: ${err.detail}`);
            console.error(`Hint: ${err.hint}`);
            console.error(`Position: ${err.position}`);
            if (err.position) {
                const start = Math.max(0, err.position - 100);
                const end = Math.min(sql.length, err.position + 100);
                console.error(`Context: ...${sql.substring(start, end)}...`);
            }
        }
        
    } catch (err) {
        console.error('Error:', err.code, err.message);
    } finally {
        await client.end();
    }
}

run();