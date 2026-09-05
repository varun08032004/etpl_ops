const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ 
  connectionString: process.env.INTERNAL_OPS_DATABASE_URL, 
  ssl: { rejectUnauthorized: false } 
});

async function main() {
  console.log('Creating pilot cohort management tables...');

  // Create training_pilot_cohorts table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS training_pilot_cohorts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      description TEXT,
      programme_id UUID NOT NULL REFERENCES training_programmes(id),
      track VARCHAR(100),
      status VARCHAR(50) DEFAULT 'draft',
      start_date DATE,
      end_date DATE,
      created_by UUID NOT NULL REFERENCES staff_accounts(id),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('✅ training_pilot_cohorts table created');

  // Create training_cohort_members table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS training_cohort_members (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      cohort_id UUID NOT NULL REFERENCES training_pilot_cohorts(id) ON DELETE CASCADE,
      employee_id UUID NOT NULL REFERENCES employees(id),
      assigned_at TIMESTAMP DEFAULT NOW(),
      assigned_by UUID NOT NULL REFERENCES staff_accounts(id),
      status VARCHAR(50) DEFAULT 'active',
      UNIQUE(cohort_id, employee_id)
    )
  `);
  console.log('✅ training_cohort_members table created');

  // Create training_cohort_course_assignments table for assigning specific courses within a cohort
  await pool.query(`
    CREATE TABLE IF NOT EXISTS training_cohort_course_assignments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      cohort_id UUID NOT NULL REFERENCES training_pilot_cohorts(id) ON DELETE CASCADE,
      course_id UUID NOT NULL REFERENCES training_courses(id),
      is_required BOOLEAN DEFAULT true,
      due_date DATE,
      created_by UUID NOT NULL REFERENCES staff_accounts(id),
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(cohort_id, course_id)
    )
  `);
  console.log('✅ training_cohort_course_assignments table created');

  // Add cohort_id to training_assignments for linking
  await pool.query(`
    ALTER TABLE training_assignments 
    ADD COLUMN IF NOT EXISTS cohort_id UUID REFERENCES training_pilot_cohorts(id)
  `);
  console.log('✅ cohort_id column added to training_assignments');

  // Create index for cohort queries
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_training_assignments_cohort_id 
    ON training_assignments(cohort_id)
  `);
  console.log('✅ Index on training_assignments.cohort_id created');

  // Create training_pilot_feedback table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS training_pilot_feedback (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      employee_id UUID NOT NULL REFERENCES employees(id),
      cohort_id UUID REFERENCES training_pilot_cohorts(id),
      programme_id UUID REFERENCES training_programmes(id),
      course_id UUID REFERENCES training_courses(id),
      module_id UUID REFERENCES training_modules(id),
      lesson_id UUID REFERENCES training_lessons(id),
      rating INTEGER CHECK (rating >= 1 AND rating <= 5),
      q1_relevant INTEGER CHECK (q1_relevant >= 1 AND q1_relevant <= 5),
      q2_understandable INTEGER CHECK (q2_understandable >= 1 AND q2_understandable <= 5),
      q3_useful INTEGER CHECK (q3_useful >= 1 AND q3_useful <= 5),
      q4_difficulty INTEGER CHECK (q4_difficulty >= 1 AND q4_difficulty <= 5),
      q5_applicable INTEGER CHECK (q5_applicable >= 1 AND q5_applicable <= 5),
      unclear_text TEXT,
      improvement_text TEXT,
      unnecessary_text TEXT,
      missing_text TEXT,
      submitted_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('✅ training_pilot_feedback table created');

  // Create training_competencies table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS training_competencies (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(100) NOT NULL UNIQUE,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      category VARCHAR(100),
      tier VARCHAR(50),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('✅ training_competencies table created');

  // Create training_competency_evidence table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS training_competency_evidence (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      employee_id UUID NOT NULL REFERENCES employees(id),
      competency_id UUID NOT NULL REFERENCES training_competencies(id),
      assessment_id UUID REFERENCES training_assessments(id),
      exercise_id UUID REFERENCES training_exercises(id),
      score_pct NUMERIC,
      status VARCHAR(50) DEFAULT 'developing', -- developing, competent, advanced
      evaluated_at TIMESTAMP DEFAULT NOW(),
      evaluated_by UUID REFERENCES staff_accounts(id),
      notes TEXT
    )
  `);
  console.log('✅ training_competency_evidence table created');

  // Create training_competency_mapping table (link assessments/exercises to competencies)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS training_competency_mapping (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      competency_id UUID NOT NULL REFERENCES training_competencies(id),
      assessment_id UUID REFERENCES training_assessments(id),
      exercise_id UUID REFERENCES training_exercises(id),
      weight NUMERIC DEFAULT 1.0,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('✅ training_competency_mapping table created');

  // Insert default competencies for Carbon Academy
  const competencies = [
    { code: 'ghg_accounting_fundamentals', name: 'GHG Accounting Fundamentals', category: 'GHG Accounting', tier: 'foundation' },
    { code: 'carbon_markets_basics', name: 'Carbon Markets Basics', category: 'Carbon Markets', tier: 'foundation' },
    { code: 'carbon_credit_lifecycle', name: 'Carbon Credit Lifecycle', category: 'Carbon Credit Lifecycle', tier: 'foundation' },
    { code: 'emissions_calculation', name: 'Emissions Calculation', category: 'Emissions Calculation', tier: 'foundation' },
    { code: 'project_development', name: 'Carbon Project Development', category: 'Project Development', tier: 'professional' },
    { code: 'additionality_baselines', name: 'Additionality & Baselines', category: 'Additionality', tier: 'professional' },
    { code: 'methodologies_mrv', name: 'Methodologies & MRV', category: 'Methodologies', tier: 'professional' },
    { code: 'validation_verification', name: 'Validation & Verification', category: 'Validation', tier: 'professional' },
    { code: 'registries_issuance', name: 'Registries & Credit Issuance', category: 'Registries', tier: 'professional' },
    { code: 'credit_quality_dd', name: 'Credit Quality & Due Diligence', category: 'Credit Quality', tier: 'professional' },
    { code: 'project_economics', name: 'Carbon Project Economics', category: 'Project Economics', tier: 'professional' },
    { code: 'indian_carbon_market', name: 'Indian Carbon Market & CCTS', category: 'Indian Market', tier: 'india_ether_track' },
    { code: 'marketplace_trading', name: 'Marketplace & Trading', category: 'Marketplace', tier: 'india_ether_track' },
    { code: 'etherTrack_workflows', name: 'EtherTrack Platform Workflows', category: 'Platform', tier: 'india_ether_track' },
  ];

  for (const comp of competencies) {
    await pool.query(`
      INSERT INTO training_competencies (code, name, category, tier)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (code) DO UPDATE SET name = $2, category = $3, tier = $4, updated_at = NOW()
    `, [comp.code, comp.name, comp.category, comp.tier]);
  }
  console.log('✅ Default competencies inserted');

  // Map competencies to courses
  const courseCompMap = {
    'C01': ['ghg_accounting_fundamentals'],
    'C02': ['carbon_markets_basics'],
    'C03': ['carbon_credit_lifecycle'],
    'C04': ['ghg_accounting_fundamentals'],
    'C05': ['emissions_calculation'],
    'C06': ['project_development'],
    'C07': ['additionality_baselines'],
    'C08': ['methodologies_mrv'],
    'C09': ['validation_verification'],
    'C10': ['registries_issuance'],
    'C11': ['credit_quality_dd'],
    'C12': ['project_economics'],
    'C13': ['indian_carbon_market'],
    'C14': ['marketplace_trading'],
    'C15': ['etherTrack_workflows'],
  };

  for (const [courseCode, compCodes] of Object.entries(courseCompMap)) {
    const course = await pool.query(`SELECT id FROM training_courses WHERE code = $1`, [courseCode]);
    if (course.rows.length === 0) continue;
    
    const courseId = course.rows[0].id;
    for (const compCode of compCodes) {
      const comp = await pool.query(`SELECT id FROM training_competencies WHERE code = $1`, [compCode]);
      if (comp.rows.length === 0) continue;
      
      const compId = comp.rows[0].id;
      
      // Map all assessments in this course to the competency
      const assessments = await pool.query(`SELECT id FROM training_assessments WHERE course_id = $1`, [courseId]);
      for (const a of assessments.rows) {
        await pool.query(`
          INSERT INTO training_competency_mapping (competency_id, assessment_id, weight)
          VALUES ($1, $2, 1.0)
          ON CONFLICT DO NOTHING
        `, [compId, a.id]);
      }
      
      // Map all exercises in this course to the competency
      const exercises = await pool.query(`
        SELECT e.id FROM training_exercises e
        JOIN training_lessons l ON l.id = e.lesson_id
        JOIN training_modules m ON m.id = l.module_id
        WHERE m.course_id = $1
      `, [courseId]);
      for (const e of exercises.rows) {
        await pool.query(`
          INSERT INTO training_competency_mapping (competency_id, exercise_id, weight)
          VALUES ($1, $2, 1.0)
          ON CONFLICT DO NOTHING
        `, [compId, e.id]);
      }
    }
  }
  console.log('✅ Competency mappings created');

  console.log('\n=== PILOT COHORT MANAGEMENT TABLES CREATED ===');
  await pool.end();
}

main().catch(err => {
  console.error('Error:', err);
  pool.end();
});