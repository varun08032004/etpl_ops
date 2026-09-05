const express = require('express');
const app = express();
app.use(express.json());
const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.INTERNAL_OPS_DATABASE_URL, ssl: { rejectUnauthorized: false } });

app.get('/api/training/courses/:courseId', async (req, res) => {
  try {
    const { rows: [course] } = await pool.query(
      'SELECT c.*, p.title as programme_title, p.code as programme_code FROM training_courses c LEFT JOIN training_programmes p ON p.id = c.programme_id WHERE c.id = $1',
      [req.params.courseId]
    );
    if (!course) return res.status(404).json({ error: 'Course not found' });

    const { rows: modules } = await pool.query(
      'SELECT m.*, (SELECT json_agg(l ORDER BY l.display_order) FROM training_lessons l WHERE l.module_id = m.id) as lessons FROM training_modules m WHERE m.course_id = $1 ORDER BY m.display_order',
      [req.params.courseId]
    );

    course.modules = modules || [];
    res.json({ course });
  } catch (err) {
    console.error('[training:course:detail]', err);
    res.status(500).json({ error: 'Failed to fetch course' });
  }
});

app.listen(5002, () => console.log('Test server on 5002'));