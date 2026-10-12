const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function addExperienceRequiredColumn() {
  const client = await pool.connect();
  try {
    console.log('Checking if job_postings table exists...');
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'job_postings'
      )
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('job_postings table does not exist. Creating it...');
      await client.query(`
        CREATE TABLE job_postings (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          title VARCHAR(255) NOT NULL,
          department_id UUID REFERENCES departments(id),
          team_id UUID REFERENCES teams(id),
          employment_type VARCHAR(50) DEFAULT 'full_time',
          description TEXT,
          location VARCHAR(255),
          experience_required VARCHAR(10) DEFAULT 'yes',
          experience_min_years INTEGER,
          experience_max_years INTEGER,
          salary_range_min NUMERIC(14,2),
          salary_range_max NUMERIC(14,2),
          openings_count INTEGER DEFAULT 1,
          filled_count INTEGER DEFAULT 0,
          external_links JSONB,
          posted_by UUID REFERENCES staff_accounts(id),
          status VARCHAR(50) DEFAULT 'open',
          closed_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      console.log('job_postings table created with experience_required column.');
    } else {
      console.log('job_postings table exists. Checking for experience_required column...');
      const columnCheck = await client.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'job_postings' AND column_name = 'experience_required'
        )
      `);
      
      if (!columnCheck.rows[0].exists) {
        console.log('Adding experience_required column...');
        await client.query(`
          ALTER TABLE job_postings 
          ADD COLUMN experience_required VARCHAR(10) DEFAULT 'yes'
        `);
        console.log('experience_required column added successfully.');
      } else {
        console.log('experience_required column already exists.');
      }
    }
    
    console.log('Migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

addExperienceRequiredColumn();