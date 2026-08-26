const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.INTERNAL_OPS_DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function testAPI() {
  const client = await pool.connect();
  try {
    // Simulate the carbon-academy endpoint query
    const { rows: [programme] } = await client.query("SELECT * FROM training_programmes WHERE code = 'CA-2026'");
    if (!programme) return console.log('Programme not found');

    const { rows: courses } = await client.query(
      `SELECT c.*, 
              (SELECT COUNT(*) FROM training_modules WHERE course_id = c.id) as module_count,
              (SELECT COUNT(*) FROM training_assessments WHERE course_id = c.id) as assessment_count
       FROM training_courses c
       WHERE c.programme_id = $1
       ORDER BY c.display_order`,
      [programme.id]
    );

    const courseIds = courses.map(c => c.id);
    const placeholders = courseIds.map((_, i) => `$${i + 1}`).join(',');
    const { rows: modules } = await client.query(
      `SELECT m.*, c.code as course_code, c.tier as course_tier
       FROM training_modules m
       JOIN training_courses c ON c.id = m.course_id
       WHERE m.course_id IN (${placeholders})
       ORDER BY c.display_order, m.display_order`,
      courseIds
    );

    const moduleIds = modules.map(m => m.id);
    const modulePlaceholders = moduleIds.map((_, i) => `$${i + 1}`).join(',');
    const { rows: lessons } = await client.query(
      `SELECT l.*, m.code as module_code, c.code as course_code, c.tier as course_tier
       FROM training_lessons l
       JOIN training_modules m ON m.id = l.module_id
       JOIN training_courses c ON c.id = m.course_id
       WHERE l.module_id IN (${modulePlaceholders})
       ORDER BY c.display_order, m.display_order, l.display_order`,
      moduleIds
    );

    const lessonIds = lessons.map(l => l.id);
    let contentStatusMap = {};
    if (lessonIds.length > 0) {
      const lessonPlaceholders = lessonIds.map((_, i) => `$${i + 1}`).join(',');
      const { rows: contentVersions } = await client.query(
        `SELECT entity_id, content_version_status FROM training_content_versions 
         WHERE entity_type = 'lesson' AND entity_id IN (${lessonPlaceholders})
         ORDER BY created_at DESC`,
        lessonIds
      );
      contentVersions.forEach(cv => {
        if (!contentStatusMap[cv.entity_id]) {
          contentStatusMap[cv.entity_id] = cv.content_version_status;
        }
      });
    }

    const lessonsWithStatus = lessons.map(lesson => {
      let contentStatus = 'NOT_AUTHORED';
      const hasContent = lesson.content && lesson.content.text && lesson.content.text.trim().length > 0;
      const latestVersionStatus = contentStatusMap[lesson.id];
      
      if (hasContent && latestVersionStatus === 'published') {
        contentStatus = 'PUBLISHED';
      } else if (hasContent && latestVersionStatus === 'in_review') {
        contentStatus = 'IN_REVIEW';
      } else if (hasContent && latestVersionStatus === 'draft') {
        contentStatus = 'DRAFT';
      } else if (hasContent) {
        contentStatus = 'AUTHORED';
      }
      
      return { ...lesson, content_status: contentStatus };
    });

    // Count by status
    const statusCounts = {};
    lessonsWithStatus.forEach(l => {
      statusCounts[l.content_status] = (statusCounts[l.content_status] || 0) + 1;
    });
    
    console.log('Content status distribution:', statusCounts);
    console.log('Total lessons:', lessonsWithStatus.length);
    console.log('Lessons with content object:', lessons.filter(l => l.content && typeof l.content === 'object').length);
    console.log('Lessons with text content:', lessons.filter(l => l.content && l.content.text && l.content.text.trim().length > 0).length);
    
    // Check a sample lesson with content
    const withContent = lessonsWithStatus.find(l => l.content && l.content.text);
    if (withContent) {
      console.log('\nSample lesson with content:');
      console.log('  Code:', withContent.code);
      console.log('  Title:', withContent.title);
      console.log('  Content status:', withContent.content_status);
      console.log('  Content text length:', withContent.content.text.length);
      console.log('  Content text preview:', withContent.content.text.substring(0, 200));
    }
    
  } finally {
    client.release();
    await pool.end();
  }
}

testAPI();