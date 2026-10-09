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
        
        // Split by semicolon and run each statement
        const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0 && !s.startsWith('--'));
        
        for (let i = 0; i < statements.length; i++) {
            const stmt = statements[i];
            if (!stmt.trim()) continue;
            try {
                console.log(`\n[${i+1}/${statements.length}] Executing...`);
                await client.query(stmt);
                console.log('  OK');
            } catch (err) {
                console.error(`  FAILED: ${err.code} - ${err.message}`);
                console.error(`  Statement: ${stmt.substring(0, 200)}...`);
            }
        }
        
        console.log('\nDone!');
    } catch (err) {
        console.error('Error:', err.code, err.message);
    } finally {
        await client.end();
    }
}

run();