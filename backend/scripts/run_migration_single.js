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
        await client.connect();
        console.log('Connected!');
        
        const migrationPath = path.join(__dirname, '..', 'db', '070_company_settings_defaults.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');
        
        console.log('Running migration as single query...');
        try {
            await client.query(sql);
            console.log('Migration completed successfully!');
        } catch (err) {
            console.error(`FAILED: ${err.code} - ${err.message}`);
            if (err.detail) console.error('Detail:', err.detail);
            if (err.hint) console.error('Hint:', err.hint);
        }
        
    } catch (err) {
        console.error('Error:', err.code, err.message);
    } finally {
        await client.end();
    }
}

run();