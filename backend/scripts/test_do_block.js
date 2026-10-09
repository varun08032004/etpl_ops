const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.INTERNAL_OPS_DATABASE_URL,
    max: 1,
});

async function test() {
    const client = await pool.connect();
    try {
        // Test the DO block
        await client.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'test_type_xyz') THEN
                    CREATE TYPE test_type_xyz AS ENUM ('a', 'b');
                END IF;
            END $$;
        `);
        console.log('DO block executed successfully');
        
        // Check if type was created
        const res = await client.query("SELECT typname FROM pg_type WHERE typname = 'test_type_xyz'");
        console.log('Type exists:', res.rows.length > 0);
        
        // Clean up
        await client.query('DROP TYPE test_type_xyz');
        console.log('Test type dropped');
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

test();