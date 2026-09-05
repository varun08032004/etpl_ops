const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.INTERNAL_OPS_DATABASE_URL, ssl: { rejectUnauthorized: false } });

const courseCompetencyMap = {
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
  'C16': ['project_development', 'additionality_baselines', 'methodologies_mrv', 'validation_verification', 'credit_quality_dd', 'project_economics'],
};

async function main() {
  const { rows: competencies } = await pool.query('SELECT id, code FROM training_competencies');
  const compMap = {};
  competencies.forEach(c => compMap[c.code] = c.id);

  // Map competencies to assessments
  for (const [courseCode, compCodes] of Object.entries(courseCompetencyMap)) {
    const { rows: assessments } = await pool.query(
      `SELECT a.id FROM training_assessments a JOIN training_courses c ON c.id = a.course_id WHERE c.code = $1`,
      [courseCode]
    );

    for (const assessment of assessments) {
      for (const compCode of compCodes) {
        if (compMap[compCode]) {
          await pool.query(
            `INSERT INTO training_competency_mapping (competency_id, assessment_id, weight) VALUES ($1, $2, 1.0) ON CONFLICT DO NOTHING`,
            [compMap[compCode], assessment.id]
          );
        }
      }
      console.log('Mapped ' + compCodes.length + ' competencies to assessment for ' + courseCode);
    }
  }

  // Map competencies to final assessment
  const { rows: finalAssessments } = await pool.query(
    `SELECT id FROM training_assessments WHERE programme_id = (SELECT id FROM training_programmes WHERE code = 'CA-2026')`
  );

  for (const assessment of finalAssessments) {
    for (const compCode of courseCompetencyMap['C16']) {
      if (compMap[compCode]) {
        await pool.query(
          `INSERT INTO training_competency_mapping (competency_id, assessment_id, weight) VALUES ($1, $2, 1.0) ON CONFLICT DO NOTHING`,
          [compMap[compCode], assessment.id]
        );
      }
    }
    console.log('Mapped ' + courseCompetencyMap['C16'].length + ' competencies to final assessment');
  }

  // Map competencies to exercises
  const { rows: exercises } = await pool.query(
    `SELECT e.id, c.code as course_code FROM training_exercises e
     JOIN training_lessons l ON l.id = e.lesson_id
     JOIN training_modules m ON m.id = l.module_id
     JOIN training_courses c ON c.id = m.course_id
     WHERE c.programme_id = (SELECT id FROM training_programmes WHERE code = 'CA-2026')`
  );

  for (const exercise of exercises) {
    const compCodes = courseCompetencyMap[exercise.course_code] || [];
    for (const compCode of compCodes) {
      if (compMap[compCode]) {
        await pool.query(
          `INSERT INTO training_competency_mapping (competency_id, exercise_id, weight) VALUES ($1, $2, 1.0) ON CONFLICT DO NOTHING`,
          [compMap[compCode], exercise.id]
        );
      }
    }
    console.log('Mapped ' + compCodes.length + ' competencies to exercise ' + exercise.id);
  }

  console.log('All competency mappings created!');
  pool.end();
}

main().catch(err => {
  console.error('Error:', err);
  pool.end();
});