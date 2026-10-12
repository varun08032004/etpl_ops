'use strict';
require('dotenv').config();
const { pool } = require('./db/pool');

async function addJobs() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Department IDs from DB
    const departments = {
      'Engineering': 'bfa78637-cd0d-48ac-8d0d-aa363c9577e2',
      'Finance': '7321fe5f-2e99-45b2-bc2a-8d424af3f0a5',
      'Accounting': '1a4e421b-e4f9-4e37-8f70-146b60e01cec',
    };

    // Staff ID for posted_by (founder)
    const staffId = 'd0d7237c-1555-4860-876a-9d13b0ccf7ea';

    const jobs = [
      {
        title: 'Accountant',
        department_id: departments['Accounting'],
        team_id: null,
        employment_type: 'full_time',
        description: 'Manage day-to-day accounting operations including accounts payable/receivable, general ledger, bank reconciliations, and monthly closing. Prepare financial statements and assist with audits. Ensure compliance with Indian accounting standards (Ind AS) and GST regulations.',
        location: 'Mumbai / Remote',
        experience_min_years: 2,
        experience_max_years: 5,
        salary_range_min: 600000,
        salary_range_max: 1000000,
        openings_count: 1,
        external_links: JSON.stringify({ linkedin: 'https://linkedin.com', naukri: 'https://naukri.com' }),
        posted_by: staffId,
        pdf_url: 'https://drive.google.com/file/d/1-example-accountant-jd/view'
      },
      {
        title: 'CA Junior - Finance',
        department_id: departments['Finance'],
        team_id: null,
        employment_type: 'full_time',
        description: 'Support finance team with statutory compliance, tax filings (GST, TDS, Income Tax), audit coordination, and financial analysis. Assist in preparation of financial statements, audit schedules, and management reports. Work closely with CFO on budgeting and forecasting.',
        location: 'Mumbai / Remote',
        experience_min_years: 0,
        experience_max_years: 3,
        salary_range_min: 400000,
        salary_range_max: 800000,
        openings_count: 2,
        external_links: JSON.stringify({ linkedin: 'https://linkedin.com', naukri: 'https://naukri.com' }),
        posted_by: staffId,
        pdf_url: 'https://drive.google.com/file/d/1-example-ca-junior-jd/view'
      },
      {
        title: 'Software Engineer - Full Stack',
        department_id: departments['Engineering'],
        team_id: null,
        employment_type: 'full_time',
        description: 'Build and maintain our carbon credit trading platform. Work on React/TypeScript frontend, Node.js/Express backend, PostgreSQL database, and Ethereum smart contract integration. Deploy to Sepolia testnet weekly. Write tests, handle code reviews, and contribute to architecture decisions.',
        location: 'Bengaluru / Remote',
        experience_min_years: 2,
        experience_max_years: 6,
        salary_range_min: 1200000,
        salary_range_max: 2200000,
        openings_count: 2,
        external_links: JSON.stringify({ linkedin: 'https://linkedin.com', naukri: 'https://naukri.com', github: 'https://github.com' }),
        posted_by: staffId,
        pdf_url: 'https://drive.google.com/file/d/1-example-fullstack-jd/view'
      }
    ];

    for (const job of jobs) {
      await client.query(
        `INSERT INTO job_postings (title, department_id, team_id, employment_type, description, location,
           experience_min_years, experience_max_years, salary_range_min, salary_range_max, openings_count,
           external_links, posted_by, pdf_url, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'published') RETURNING *`,
        [
          job.title, job.department_id, job.team_id, job.employment_type, job.description, job.location,
          job.experience_min_years, job.experience_max_years, job.salary_range_min, job.salary_range_max, job.openings_count,
          job.external_links, job.posted_by, job.pdf_url
        ]
      );
    }

    await client.query('COMMIT');
    console.log('✅ 3 jobs added successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Failed to add jobs:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

addJobs().catch(() => process.exit(1));