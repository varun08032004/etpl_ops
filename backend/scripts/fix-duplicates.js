require('dotenv').config();
const {Pool} = require('pg');
const pool = new Pool({
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL,
  ssl: {rejectUnauthorized: false}
});

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // First, find the duplicate IDs to keep and delete
    const duplicates = await client.query(`
      SELECT id, source_type, source_id, 
        ROW_NUMBER() OVER (PARTITION BY source_type, source_id ORDER BY created_at) as rn
      FROM journal_entries
      WHERE source_type IS NOT NULL AND source_id IS NOT NULL
    `);
    
    const toDelete = duplicates.rows.filter(r => r.rn > 1).map(r => r.id);
    
    if (toDelete.length > 0) {
      // Update bills to reference the kept journal entry
      for (const dupId of toDelete) {
        // Find the kept entry for this source_type/source_id
        const kept = await client.query(`
          SELECT id FROM journal_entries 
          WHERE source_type = (SELECT source_type FROM journal_entries WHERE id = $1)
          AND source_id = (SELECT source_id FROM journal_entries WHERE id = $1)
          AND id != $1
          ORDER BY created_at LIMIT 1
        `, [dupId]);
        
        if (kept.rows.length > 0) {
          await client.query(`
            UPDATE bills SET journal_entry_id = $1 WHERE journal_entry_id = $2
          `, [kept.rows[0].id, dupId]);
        }
      }
      
      // Now delete the duplicates
      const result = await client.query(`
        DELETE FROM journal_entries WHERE id = ANY($1)
      `, [toDelete]);
      
      console.log(`Deleted ${result.rowCount} duplicate entries`);
    }
    
    // Now add the unique index
    await client.query(`
      CREATE UNIQUE INDEX uq_journal_entries_source_type_source_id 
      ON journal_entries (source_type, source_id) 
      WHERE source_type IS NOT NULL AND source_id IS NOT NULL
    `);
    
    await client.query('COMMIT');
    console.log('Unique index created successfully');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Failed:', e.message);
  } finally {
    client.release();
    pool.end();
  }
}
run();