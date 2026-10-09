const { Pool } = require('pg');
require('dotenv').config();
const fs = require('fs');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({ 
    host: 'aws-0-ap-southeast-1.pooler.supabase.com',
    port: 5432,
    database: 'postgres',
    user: 'postgres.hybufntjrxikcpkwonei',
    password: 'C8InvJEpLjkP7vNI',
    ssl: {
        rejectUnauthorized: false,
    },
    max: 1,
    connectionTimeoutMillis: 30000,
});

async function test() {
    const client = await pool.connect();
    try {
        console.log('Connecting...');
        const start = Date.now();
        const res = await pool.query('SELECT version()');
        console.log('Query done in', Date.now() - start, 'ms');
        console.log('Version:', res.rows[0].version.substring(0, 50));
    } catch (err) {
        console.error('Error:', err.code, err.message);
    } finally {
        await pool.end();
    }
}

test();