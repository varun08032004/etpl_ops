const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.INTERNAL_OPS_DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const creatorId = 'd0d7237c-1555-4860-876a-9d13b0ccf7ea'; // founder
  const programmeId = '87d0e5e3-47e6-464d-82af-ffb76ca81c29'; // CA-2026
  
  // Get all courses in the programme
  const { rows: courses } = await pool.query(`
    SELECT id, code, title, tier FROM training_courses 
    WHERE programme_id = $1 AND status IN ('published', 'active', 'draft')
    ORDER BY display_order
  `, [programmeId]);
  
  console.log(`Found ${courses.length} courses`);
  
  // Create assessments for each course
  for (const course of courses) {
    // Create course-level assessment
    const { rows: [assessment] } = await pool.query(`
      INSERT INTO training_assessments (course_id, title, description, passing_score_pct, max_attempts, time_limit_minutes, randomize_questions, randomize_options, show_correct_answers, show_explanations, created_by, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'active') RETURNING *
    `, [
      course.id,
      `${course.code} Assessment`,
      `Assessment for ${course.title} course`,
      70,
      3,
      60,
      true,
      true,
      true,
      true,
      creatorId
    ]);
    console.log(`Created assessment for ${course.code}: ${assessment.id}`);
    
    // Create questions for this assessment
    await createQuestions(pool, assessment.id, course.code, creatorId);
  }
  
  // Create final programme assessment
  const { rows: [finalAssessment] } = await pool.query(`
    INSERT INTO training_assessments (programme_id, title, description, passing_score_pct, max_attempts, time_limit_minutes, randomize_questions, randomize_options, show_correct_answers, show_explanations, created_by, status)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'active') RETURNING *
  `, [
    programmeId,
    'CA-2026 Final Assessment',
    'Final assessment for the complete EtherTrack Carbon Academy programme',
    75,
    2,
    120,
    true,
    true,
    true,
    true,
    creatorId
  ]);
  console.log(`Created final programme assessment: ${finalAssessment.id}`);
  await createQuestions(pool, finalAssessment.id, 'CA-2026 Final', creatorId);
  
  // Create exercises for each lesson
  const { rows: lessons } = await pool.query(`
    SELECT l.id, l.code, l.title, l.lesson_type, l.module_id, m.code as module_code, c.code as course_code
    FROM training_lessons l
    JOIN training_modules m ON m.id = l.module_id
    JOIN training_courses c ON c.id = m.course_id
    WHERE c.programme_id = $1
    ORDER BY c.display_order, m.display_order, l.display_order
  `, [programmeId]);
  
  console.log(`\nCreating exercises for ${lessons.length} lessons...`);
  
  for (const lesson of lessons) {
    // Create 1-2 exercises per lesson based on lesson type
    const exerciseCount = lesson.lesson_type === 'practical_exercise' ? 2 : 1;
    
    for (let i = 0; i < exerciseCount; i++) {
      const exerciseType = i === 0 ? 'practical_exercise' : 'knowledge_check';
      const { rows: [exercise] } = await pool.query(`
        INSERT INTO training_exercises (lesson_id, title, instructions, exercise_type, estimated_hours, submission_type, is_graded, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
      `, [
        lesson.id,
        `${lesson.code} ${i === 0 ? 'Practical Exercise' : 'Knowledge Check'}`,
        getExerciseInstructions(lesson, i),
        exerciseType,
        0.5,
        'text',
        exerciseType === 'practical_exercise',
        creatorId
      ]);
      console.log(`Created exercise for ${lesson.code}: ${exercise.title} (${exercise.id})`);
    }
  }
  
  console.log('\n✅ All assessments and exercises created!');
  pool.end();
}

async function createQuestions(pool, assessmentId, courseCode, creatorId) {
  // Create 5 questions per assessment
  const questions = [
    { text: `What is the primary objective of ${courseCode}?`, type: 'single_choice', marks: 2 },
    { text: `Which of the following is a key concept in ${courseCode}?`, type: 'single_choice', marks: 2 },
    { text: `Calculate the result for the given scenario in ${courseCode}.`, type: 'short_answer', marks: 3 },
    { text: `True or False: ${courseCode} requires practical application.`, type: 'true_false', marks: 1 },
    { text: `Explain the key principles of ${courseCode} in your own words.`, type: 'essay', marks: 2 },
  ];
  
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const { rows: [question] } = await pool.query(`
      INSERT INTO training_questions (assessment_id, question_text, question_type, marks, explanation, display_order, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
    `, [assessmentId, q.text, q.type, q.marks, `Explanation for ${q.text}`, i + 1, creatorId]);
    
    // Create options for multiple choice questions
    if (q.type === 'single_choice') {
      const options = [
        { text: 'Option A', correct: i % 2 === 0 },
        { text: 'Option B', correct: i % 2 === 1 },
        { text: 'Option C', correct: false },
        { text: 'Option D', correct: false },
      ];
      for (let j = 0; j < options.length; j++) {
        await pool.query(`
          INSERT INTO training_question_options (question_id, option_text, is_correct, display_order)
          VALUES ($1,$2,$3,$4)
        `, [question.id, options[j].text, options[j].correct, j + 1]);
      }
    } else if (q.type === 'true_false') {
      await pool.query(`
        INSERT INTO training_question_options (question_id, option_text, is_correct, display_order)
        VALUES ($1,'True',true,1), ($1,'False',false,2)
      `, [question.id]);
    }
  }
}

function getExerciseInstructions(lesson, index) {
  const types = {
    'video': 'Watch the video and summarize the key concepts.',
    'document': 'Read the document and answer the comprehension questions.',
    'practical_exercise': 'Complete the practical exercise as described in the lesson.',
    'assessment': 'Complete the assessment questions.',
    'external_resource': 'Review the external resource and summarize findings.',
  };
  return types[lesson.lesson_type] || `Complete the ${index === 0 ? 'practical exercise' : 'knowledge check'} for ${lesson.title}.`;
}

main().catch(err => {
  console.error('Error:', err);
  pool.end();
});