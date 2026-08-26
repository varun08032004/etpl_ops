'use strict';

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { safeQuery, withTransaction } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const { logAction } = require('../services/auditLog');
const {
  createContentVersion,
  logTrainingAction,
  recalculateProgress,
  checkAndIssueCertificate,
  ACTIONS,
  ENTITY_TYPES,
} = require('../services/trainingEngine');
const storage = require('../services/storage');

router.use(authenticate);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

// ============ HELPER FUNCTIONS ============

function isFounder(req) {
  return req.staff.role === 'owner';
}

function isFounderOrHR(req) {
  return ['owner', 'admin', 'hr'].includes(req.staff.role);
}

function canManageContent(req) {
  return req.staff.role === 'owner';
}

function canAssignTraining(req) {
  return ['owner', 'admin', 'hr'].includes(req.staff.role);
}

function canViewAllProgress(req) {
  return ['owner', 'admin', 'hr'].includes(req.staff.role);
}

async function getEmployeeDepartment(req) {
  const { rows } = await safeQuery(
    `SELECT department_id FROM employees WHERE id = $1`,
    [req.staff.employee_id]
  );
  return rows[0]?.department_id;
}

// ============ CARBON ACADEMY CURRICULUM ============

router.get('/carbon-academy', async (req, res) => {
  try {
    const { rows: [programme] } = await safeQuery(
      `SELECT * FROM training_programmes WHERE code = 'CA-2026'`
    );
    if (!programme) return res.status(404).json({ error: 'Carbon Academy programme not found' });

    const { rows: courses } = await safeQuery(
      `SELECT c.*, 
              (SELECT COUNT(*) FROM training_modules WHERE course_id = c.id) as module_count,
              (SELECT COUNT(*) FROM training_assessments WHERE course_id = c.id) as assessment_count
       FROM training_courses c
       WHERE c.programme_id = $1
       ORDER BY c.display_order`,
      [programme.id]
    );

    const courseIds = courses.map(c => c.id);
    if (courseIds.length === 0) {
      return res.json({ programme, courses: [], tiers: {} });
    }

    const placeholders = courseIds.map((_, i) => `$${i + 1}`).join(',');
    const { rows: modules } = await safeQuery(
      `SELECT m.*, c.code as course_code, c.tier as course_tier
       FROM training_modules m
       JOIN training_courses c ON c.id = m.course_id
       WHERE m.course_id IN (${placeholders})
       ORDER BY c.display_order, m.display_order`,
      courseIds
    );

    const moduleIds = modules.map(m => m.id);
    if (moduleIds.length === 0) {
      return res.json({ programme, courses, modules: [], tiers: {} });
    }

    const modulePlaceholders = moduleIds.map((_, i) => `$${i + 1}`).join(',');
    const { rows: lessons } = await safeQuery(
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
      const { rows: contentVersions } = await safeQuery(
        `SELECT entity_id, content_version_status FROM training_content_versions 
         WHERE entity_type = 'lesson' AND entity_id IN (${lessonPlaceholders})
         ORDER BY created_at DESC`,
        lessonIds
      );
      contentStatusMap = {};
      contentVersions.forEach(cv => {
        if (!contentStatusMap[cv.entity_id]) {
          contentStatusMap[cv.entity_id] = cv.status;
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

    const tierOrder = ['foundation', 'professional', 'india_ether_track', 'capstone'];
    const tierLabels = {
      foundation: 'Foundation Core',
      professional: 'Professional Carbon Core',
      india_ether_track: 'India + EtherTrack Core',
      capstone: 'Capstone'
    };

    const tiers = {};
    tierOrder.forEach(tier => {
      const tierCourses = courses.filter(c => c.tier === tier);
      if (tierCourses.length > 0) {
        tiers[tier] = {
          label: tierLabels[tier],
          courses: tierCourses.map(course => {
            const courseModules = modules.filter(m => m.course_id === course.id);
            const courseLessons = lessonsWithStatus.filter(l => courseModules.some(m => m.id === l.module_id));
            
            const authoredLessons = courseLessons.filter(l => l.content_status !== 'NOT_AUTHORED').length;
            const publishedLessons = courseLessons.filter(l => l.content_status === 'PUBLISHED').length;
            const totalLessons = courseLessons.length;

            return {
              ...course,
              modules: courseModules.map(module => {
                const moduleLessons = lessonsWithStatus.filter(l => l.module_id === module.id);
                const moduleAuthored = moduleLessons.filter(l => l.content_status !== 'NOT_AUTHORED').length;
                const modulePublished = moduleLessons.filter(l => l.content_status === 'PUBLISHED').length;
                const moduleTotal = moduleLessons.length;

                return {
                  ...module,
                  lessons: moduleLessons,
                  content_summary: {
                    total: moduleTotal,
                    authored: moduleAuthored,
                    published: modulePublished,
                    not_authored: moduleTotal - moduleAuthored
                  }
                };
              }),
              content_summary: {
                total: totalLessons,
                authored: authoredLessons,
                published: publishedLessons,
                not_authored: totalLessons - authoredLessons
              }
            };
          })
        };
      }
    });

    res.json({ programme, tiers });
  } catch (err) {
    console.error('[training:carbon-academy]', err);
    res.status(500).json({ error: 'Failed to fetch Carbon Academy curriculum' });
  }
});

// ============ PROGRAMMES ============

router.get('/programmes', async (req, res) => {
  try {
    const { status, include_archived } = req.query;
    const conditions = [];
    const params = [];

    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }
    if (include_archived !== 'true') {
      conditions.push(`status != 'archived'`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await safeQuery(
      `SELECT p.*, sa.email AS created_by_email,
              (SELECT COUNT(*) FROM training_courses WHERE programme_id = p.id) as course_count,
              (SELECT COUNT(*) FROM training_assignments WHERE programme_id = p.id) as assignment_count
       FROM training_programmes p
       LEFT JOIN staff_accounts sa ON sa.id = p.created_by
       ${where}
       ORDER BY p.created_at DESC`,
      params
    );
    res.json({ programmes: rows });
  } catch (err) {
    console.error('[training:programmes:list]', err);
    res.status(500).json({ error: 'Failed to fetch programmes' });
  }
});

router.get('/programmes/:id', async (req, res) => {
  try {
    const { rows: [programme] } = await safeQuery(
      `SELECT p.*, sa.email AS created_by_email, ua.email AS updated_by_email
       FROM training_programmes p
       LEFT JOIN staff_accounts sa ON sa.id = p.created_by
       LEFT JOIN staff_accounts ua ON ua.id = p.updated_by
       WHERE p.id = $1`,
      [req.params.id]
    );
    if (!programme) return res.status(404).json({ error: 'Programme not found' });

    const { rows: courses } = await safeQuery(
      `SELECT c.*, 
              (SELECT COUNT(*) FROM training_modules WHERE course_id = c.id) as module_count,
              (SELECT COUNT(*) FROM training_assessments WHERE course_id = c.id) as assessment_count
       FROM training_courses c
       WHERE c.programme_id = $1
       ORDER BY c.display_order`,
      [req.params.id]
    );

    res.json({ programme, courses });
  } catch (err) {
    console.error('[training:programmes:get]', err);
    res.status(500).json({ error: 'Failed to fetch programme' });
  }
});

router.post('/programmes', requireRole('owner'), async (req, res) => {
  try {
    const { title, code, description, duration_weeks, total_estimated_hours, passing_score_pct, certificate_template_id } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });

    const { rows: [programme] } = await safeQuery(
      `INSERT INTO training_programmes (title, code, description, duration_weeks, total_estimated_hours, passing_score_pct, certificate_template_id, created_by, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'placeholder') RETURNING *`,
      [title, code || null, description || null, duration_weeks || null, total_estimated_hours || null, passing_score_pct || null, certificate_template_id || null, req.staff.id]
    );

    await createContentVersion(ENTITY_TYPES.PROGRAMME, programme.id, '1.0', title, { ...programme }, 'Initial creation', req.staff.id);
    await logTrainingAction({ staffId: req.staff.id, action: ACTIONS.PROGRAMME_CREATED, entityType: ENTITY_TYPES.PROGRAMME, entityId: programme.id, newValue: { title, code, status: 'placeholder' } });
    await logAction({ staffId: req.staff.id, action: 'training_programme.created', entity: 'training_programmes', entityId: programme.id, newValue: { title, code } });

    res.status(201).json({ programme });
  } catch (err) {
    console.error('[training:programmes:create]', err);
    if (err.code === '23505') return res.status(409).json({ error: 'Programme code already exists' });
    res.status(500).json({ error: 'Failed to create programme' });
  }
});

router.put('/programmes/:id', requireRole('owner'), async (req, res) => {
  try {
    const allowed = ['title', 'code', 'description', 'duration_weeks', 'total_estimated_hours', 'passing_score_pct', 'certificate_template_id', 'status'];
    const sets = [];
    const params = [];
    const oldValues = {};

    const { rows: [current] } = await safeQuery(`SELECT * FROM training_programmes WHERE id = $1`, [req.params.id]);
    if (!current) return res.status(404).json({ error: 'Programme not found' });

    for (const key of allowed) {
      if (key in req.body) {
        let value = req.body[key];
        if (value === '') value = null;
        params.push(value);
        sets.push(`${key} = $${params.length}`);
        oldValues[key] = current[key];
      }
    }
    if (!sets.length) return res.status(400).json({ error: 'No valid fields to update' });

    params.push(req.staff.id);
    sets.push(`updated_by = $${params.length}`);
    params.push(req.params.id);

    const { rows: [programme] } = await safeQuery(
      `UPDATE training_programmes SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );

    await createContentVersion(ENTITY_TYPES.PROGRAMME, programme.id, programme.version, programme.title, { ...programme }, `Updated: ${Object.keys(oldValues).join(', ')}`, req.staff.id);
    await logTrainingAction({ staffId: req.staff.id, action: ACTIONS.PROGRAMME_UPDATED, entityType: ENTITY_TYPES.PROGRAMME, entityId: programme.id, oldValue: oldValues, newValue: req.body });
    await logAction({ staffId: req.staff.id, action: 'training_programme.updated', entity: 'training_programmes', entityId: programme.id, oldValue, newValue: req.body });

    res.json({ programme });
  } catch (err) {
    console.error('[training:programmes:update]', err);
    if (err.code === '23505') return res.status(409).json({ error: 'Programme code already exists' });
    res.status(500).json({ error: 'Failed to update programme' });
  }
});

router.post('/programmes/:id/archive', requireRole('owner'), async (req, res) => {
  try {
    const { rows: [programme] } = await safeQuery(
      `UPDATE training_programmes SET status = 'archived', archived_at = NOW(), archived_by = $1 WHERE id = $2 RETURNING *`,
      [req.staff.id, req.params.id]
    );
    if (!programme) return res.status(404).json({ error: 'Programme not found' });

    await logTrainingAction({ staffId: req.staff.id, action: ACTIONS.PROGRAMME_ARCHIVED, entityType: ENTITY_TYPES.PROGRAMME, entityId: programme.id, newValue: { status: 'archived' } });
    await logAction({ staffId: req.staff.id, action: 'training_programme.archived', entity: 'training_programmes', entityId: programme.id });

    res.json({ programme });
  } catch (err) {
    console.error('[training:programmes:archive]', err);
    res.status(500).json({ error: 'Failed to archive programme' });
  }
});

// ============ COURSES ============

router.get('/programmes/:programmeId/courses', async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `SELECT c.*, 
              (SELECT COUNT(*) FROM training_modules WHERE course_id = c.id) as module_count,
              (SELECT COUNT(*) FROM training_assessments WHERE course_id = c.id) as assessment_count
       FROM training_courses c
       WHERE c.programme_id = $1
       ORDER BY c.display_order`,
      [req.params.programmeId]
    );
    res.json({ courses: rows });
  } catch (err) {
    console.error('[training:courses:list]', err);
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
});

router.post('/programmes/:programmeId/courses', requireRole('owner'), async (req, res) => {
  try {
    const { title, code, description, duration_hours, passing_score_pct, is_mandatory } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });

    const { rows: [maxOrder] } = await safeQuery(
      `SELECT COALESCE(MAX(display_order), -1) + 1 as next_order FROM training_courses WHERE programme_id = $1`,
      [req.params.programmeId]
    );

    const { rows: [course] } = await safeQuery(
      `INSERT INTO training_courses (programme_id, title, code, description, duration_hours, passing_score_pct, is_mandatory, display_order, created_by, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'placeholder') RETURNING *`,
      [req.params.programmeId, title, code || null, description || null, duration_hours || null, passing_score_pct || null, is_mandatory !== false, maxOrder.next_order, req.staff.id]
    );

    await createContentVersion(ENTITY_TYPES.COURSE, course.id, '1.0', title, { ...course }, 'Initial creation', req.staff.id);
    await logTrainingAction({ staffId: req.staff.id, action: ACTIONS.COURSE_CREATED, entityType: ENTITY_TYPES.COURSE, entityId: course.id, newValue: { title, code, programme_id: req.params.programmeId, status: 'placeholder' } });

    res.status(201).json({ course });
  } catch (err) {
    console.error('[training:courses:create]', err);
    if (err.code === '23505') return res.status(409).json({ error: 'Course code already exists in this programme' });
    res.status(500).json({ error: 'Failed to create course' });
  }
});

router.put('/courses/:id', requireRole('owner'), async (req, res) => {
  try {
    const allowed = ['title', 'code', 'description', 'duration_hours', 'passing_score_pct', 'is_mandatory', 'display_order', 'status'];
    const sets = [];
    const params = [];
    const oldValues = {};

    const { rows: [current] } = await safeQuery(`SELECT * FROM training_courses WHERE id = $1`, [req.params.id]);
    if (!current) return res.status(404).json({ error: 'Course not found' });

    for (const key of allowed) {
      if (key in req.body) {
        let value = req.body[key];
        if (value === '') value = null;
        params.push(value);
        sets.push(`${key} = $${params.length}`);
        oldValues[key] = current[key];
      }
    }
    if (!sets.length) return res.status(400).json({ error: 'No valid fields to update' });

    params.push(req.staff.id);
    sets.push(`updated_by = $${params.length}`);
    params.push(req.params.id);

    const { rows: [course] } = await safeQuery(
      `UPDATE training_courses SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );

    await createContentVersion(ENTITY_TYPES.COURSE, course.id, course.version, course.title, { ...course }, `Updated: ${Object.keys(oldValues).join(', ')}`, req.staff.id);
    await logTrainingAction({ staffId: req.staff.id, action: ACTIONS.COURSE_UPDATED, entityType: ENTITY_TYPES.COURSE, entityId: course.id, oldValue: oldValues, newValue: req.body });

    res.json({ course });
  } catch (err) {
    console.error('[training:courses:update]', err);
    res.status(500).json({ error: 'Failed to update course' });
  }
});

router.post('/courses/:id/reorder', requireRole('owner'), async (req, res) => {
  try {
    const { new_order } = req.body;
    if (typeof new_order !== 'number') return res.status(400).json({ error: 'new_order is required' });

    await safeQuery(
      `UPDATE training_courses SET display_order = $1 WHERE id = $2`,
      [new_order, req.params.id]
    );

    await logAction({ staffId: req.staff.id, action: 'training_course.reordered', entity: 'training_courses', entityId: req.params.id, newValue: { display_order: new_order } });

    res.json({ success: true });
  } catch (err) {
    console.error('[training:courses:reorder]', err);
    res.status(500).json({ error: 'Failed to reorder course' });
  }
});

// ============ MODULES ============

router.get('/courses/:courseId/modules', async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `SELECT m.*, 
              (SELECT COUNT(*) FROM training_lessons WHERE module_id = m.id) as lesson_count
       FROM training_modules m
       WHERE m.course_id = $1
       ORDER BY m.display_order`,
      [req.params.courseId]
    );
    res.json({ modules: rows });
  } catch (err) {
    console.error('[training:modules:list]', err);
    res.status(500).json({ error: 'Failed to fetch modules' });
  }
});

router.post('/courses/:courseId/modules', requireRole('owner'), async (req, res) => {
  try {
    const { title, description, duration_hours } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });

    const { rows: [maxOrder] } = await safeQuery(
      `SELECT COALESCE(MAX(display_order), -1) + 1 as next_order FROM training_modules WHERE course_id = $1`,
      [req.params.courseId]
    );

    const { rows: [module] } = await safeQuery(
      `INSERT INTO training_modules (course_id, title, description, duration_hours, display_order, created_by, status)
       VALUES ($1,$2,$3,$4,$5,$6,'draft') RETURNING *`,
      [req.params.courseId, title, description || null, duration_hours || null, maxOrder.next_order, req.staff.id]
    );

    await createContentVersion(ENTITY_TYPES.MODULE, module.id, '1.0', title, { ...module }, 'Initial creation', req.staff.id);

    res.status(201).json({ module });
  } catch (err) {
    console.error('[training:modules:create]', err);
    res.status(500).json({ error: 'Failed to create module' });
  }
});

router.put('/modules/:id', requireRole('owner'), async (req, res) => {
  try {
    const allowed = ['title', 'description', 'duration_hours', 'display_order', 'status'];
    const sets = [];
    const params = [];

    const { rows: [current] } = await safeQuery(`SELECT * FROM training_modules WHERE id = $1`, [req.params.id]);
    if (!current) return res.status(404).json({ error: 'Module not found' });

    for (const key of allowed) {
      if (key in req.body) {
        let value = req.body[key];
        if (value === '') value = null;
        params.push(value);
        sets.push(`${key} = $${params.length}`);
      }
    }
    if (!sets.length) return res.status(400).json({ error: 'No valid fields to update' });

    params.push(req.staff.id);
    sets.push(`updated_by = $${params.length}`);
    params.push(req.params.id);

    const { rows: [module] } = await safeQuery(
      `UPDATE training_modules SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );

    await createContentVersion(ENTITY_TYPES.MODULE, module.id, module.version, module.title, { ...module }, `Updated`, req.staff.id);
    await logTrainingAction({ staffId: req.staff.id, action: ACTIONS.CONTENT_UPDATED, entityType: ENTITY_TYPES.MODULE, entityId: module.id, newValue: req.body });

    res.json({ module });
  } catch (err) {
    console.error('[training:modules:update]', err);
    res.status(500).json({ error: 'Failed to update module' });
  }
});

// ============ LESSONS ============

router.get('/modules/:moduleId/lessons', async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `SELECT l.*, l.content,
              (SELECT COUNT(*) FROM training_materials WHERE lesson_id = l.id) as material_count,
              (SELECT COUNT(*) FROM training_exercises WHERE lesson_id = l.id) as exercise_count
         FROM training_lessons l
         WHERE l.module_id = $1
         ORDER BY l.display_order`,
      [req.params.moduleId]
    );
    res.json({ lessons: rows });
  } catch (err) {
    console.error('[training:lessons:list]', err);
    res.status(500).json({ error: 'Failed to fetch lessons' });
  }
});

router.post('/modules/:moduleId/lessons', requireRole('owner'), async (req, res) => {
  try {
    const { title, description, lesson_type, duration_minutes, is_required, content } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });

    const { rows: [maxOrder] } = await safeQuery(
      `SELECT COALESCE(MAX(display_order), -1) + 1 as next_order FROM training_lessons WHERE module_id = $1`,
      [req.params.moduleId]
    );

    const { rows: [lesson] } = await safeQuery(
      `INSERT INTO training_lessons (module_id, title, description, lesson_type, duration_minutes, is_required, content, display_order, created_by, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'draft') RETURNING *`,
      [req.params.moduleId, title, description || null, lesson_type || 'document', duration_minutes || null, is_required !== false, content || null, maxOrder.next_order, req.staff.id]
    );

    await createContentVersion(ENTITY_TYPES.LESSON, lesson.id, '1.0', title, { ...lesson }, 'Initial creation', req.staff.id);

    res.status(201).json({ lesson });
  } catch (err) {
    console.error('[training:lessons:create]', err);
    res.status(500).json({ error: 'Failed to create lesson' });
  }
});

router.put('/lessons/:id', requireRole('owner'), async (req, res) => {
  try {
    const allowed = ['title', 'description', 'lesson_type', 'duration_minutes', 'is_required', 'content', 'display_order', 'status'];
    const sets = [];
    const params = [];

    const { rows: [current] } = await safeQuery(`SELECT * FROM training_lessons WHERE id = $1`, [req.params.id]);
    if (!current) return res.status(404).json({ error: 'Lesson not found' });

    for (const key of allowed) {
      if (key in req.body) {
        let value = req.body[key];
        if (value === '') value = null;
        params.push(value);
        sets.push(`${key} = $${params.length}`);
      }
    }
    if (!sets.length) return res.status(400).json({ error: 'No valid fields to update' });

    params.push(req.staff.id);
    sets.push(`updated_by = $${params.length}`);
    params.push(req.params.id);

    const { rows: [lesson] } = await safeQuery(
      `UPDATE training_lessons SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );

    await createContentVersion(ENTITY_TYPES.LESSON, lesson.id, lesson.version, lesson.title, { ...lesson }, `Updated`, req.staff.id);
    await logTrainingAction({ staffId: req.staff.id, action: ACTIONS.CONTENT_UPDATED, entityType: ENTITY_TYPES.LESSON, entityId: lesson.id, newValue: req.body });

    res.json({ lesson });
  } catch (err) {
    console.error('[training:lessons:update]', err);
    res.status(500).json({ error: 'Failed to update lesson' });
  }
});

// ============ LESSON MATERIALS ============

router.get('/lessons/:lessonId/materials', async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `SELECT * FROM training_materials WHERE lesson_id = $1 ORDER BY display_order`,
      [req.params.lessonId]
    );
    res.json({ materials: rows });
  } catch (err) {
    console.error('[training:materials:list]', err);
    res.status(500).json({ error: 'Failed to fetch materials' });
  }
});

router.post('/lessons/:lessonId/materials', requireRole('owner'), upload.single('file'), async (req, res) => {
  try {
    const { title, material_type, external_url, is_downloadable, description } = req.body;
    if (!title || !material_type) return res.status(400).json({ error: 'title and material_type are required' });

    let file_url = null, file_size_bytes = null, mime_type = null;

    if (req.file) {
      const timestamp = Date.now();
      const cleanName = req.file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
      const storagePath = `training/${req.params.lessonId}/${timestamp}-${cleanName}`;
      await storage.uploadFile(storagePath, req.file.buffer, req.file.mimetype);
      file_url = storagePath;
      file_size_bytes = req.file.size;
      mime_type = req.file.mimetype;
    }

    const { rows: [maxOrder] } = await safeQuery(
      `SELECT COALESCE(MAX(display_order), -1) + 1 as next_order FROM training_materials WHERE lesson_id = $1`,
      [req.params.lessonId]
    );

    const { rows: [material] } = await safeQuery(
      `INSERT INTO training_materials (lesson_id, title, material_type, file_url, external_url, file_size_bytes, mime_type, is_downloadable, description, display_order, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [req.params.lessonId, title, material_type, file_url, external_url || null, file_size_bytes, mime_type, is_downloadable !== 'false', description || null, maxOrder.next_order, req.staff.id]
    );

    res.status(201).json({ material });
  } catch (err) {
    console.error('[training:materials:create]', err);
    res.status(500).json({ error: err.message || 'Failed to upload material' });
  }
});

router.delete('/materials/:id', requireRole('owner'), async (req, res) => {
  try {
    const { rows: [material] } = await safeQuery(`SELECT * FROM training_materials WHERE id = $1`, [req.params.id]);
    if (!material) return res.status(404).json({ error: 'Material not found' });

    if (material.file_url) {
      await storage.deleteFile(material.file_url).catch(() => {});
    }

    await safeQuery(`DELETE FROM training_materials WHERE id = $1`, [req.params.id]);
    res.json({ deleted: true });
  } catch (err) {
    console.error('[training:materials:delete]', err);
    res.status(500).json({ error: 'Failed to delete material' });
  }
});

// ============ LESSON EXERCISES ============

router.get('/lessons/:lessonId/exercises', async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `SELECT * FROM training_exercises WHERE lesson_id = $1 ORDER BY created_at`,
      [req.params.lessonId]
    );
    res.json({ exercises: rows });
  } catch (err) {
    console.error('[training:exercises:list]', err);
    res.status(500).json({ error: 'Failed to fetch exercises' });
  }
});

router.post('/lessons/:lessonId/exercises', requireRole('owner'), async (req, res) => {
  try {
    const { title, instructions, exercise_type, estimated_hours, submission_type, max_file_size_mb, allowed_file_types, rubric, is_graded } = req.body;
    if (!title || !instructions || !exercise_type) return res.status(400).json({ error: 'title, instructions, and exercise_type are required' });

    const { rows: [exercise] } = await safeQuery(
      `INSERT INTO training_exercises (lesson_id, title, instructions, exercise_type, estimated_hours, submission_type, max_file_size_mb, allowed_file_types, rubric, is_graded, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [req.params.lessonId, title, instructions, exercise_type, estimated_hours || null, submission_type || 'file', max_file_size_mb || 50, allowed_file_types || null, rubric || null, is_graded || false, req.staff.id]
    );

    res.status(201).json({ exercise });
  } catch (err) {
    console.error('[training:exercises:create]', err);
    res.status(500).json({ error: 'Failed to create exercise' });
  }
});

// ============ ASSESSMENTS ============

router.get('/courses/:courseId/assessments', async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `SELECT a.*, 
              (SELECT COUNT(*) FROM training_questions WHERE assessment_id = a.id) as question_count
       FROM training_assessments a
       WHERE a.course_id = $1
       ORDER BY a.created_at`,
      [req.params.courseId]
    );
    res.json({ assessments: rows });
  } catch (err) {
    console.error('[training:assessments:list]', err);
    res.status(500).json({ error: 'Failed to fetch assessments' });
  }
});

router.get('/modules/:moduleId/assessments', async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `SELECT a.*, (SELECT COUNT(*) FROM training_questions WHERE assessment_id = a.id) as question_count
       FROM training_assessments a WHERE a.module_id = $1`,
      [req.params.moduleId]
    );
    res.json({ assessments: rows });
  } catch (err) {
    console.error('[training:assessments:list:module]', err);
    res.status(500).json({ error: 'Failed to fetch assessments' });
  }
});

router.get('/programmes/:programmeId/final-assessment', async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `SELECT a.*, (SELECT COUNT(*) FROM training_questions WHERE assessment_id = a.id) as question_count
       FROM training_assessments a WHERE a.programme_id = $1`,
      [req.params.programmeId]
    );
    res.json({ assessments: rows });
  } catch (err) {
    console.error('[training:assessments:final]', err);
    res.status(500).json({ error: 'Failed to fetch final assessment' });
  }
});

router.post('/courses/:courseId/assessments', requireRole('owner'), async (req, res) => {
  try {
    const { title, description, passing_score_pct, max_attempts, time_limit_minutes, randomize_questions, randomize_options, show_correct_answers, show_explanations } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });

    const { rows: [assessment] } = await safeQuery(
      `INSERT INTO training_assessments (course_id, title, description, passing_score_pct, max_attempts, time_limit_minutes, randomize_questions, randomize_options, show_correct_answers, show_explanations, created_by, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'draft') RETURNING *`,
      [req.params.courseId, title, description || null, passing_score_pct || null, max_attempts || 3, time_limit_minutes || null, randomize_questions !== false, randomize_options !== false, show_correct_answers || false, show_explanations || false, req.staff.id]
    );

    await createContentVersion(ENTITY_TYPES.ASSESSMENT, assessment.id, '1.0', title, { ...assessment }, 'Initial creation', req.staff.id);
    await logTrainingAction({ staffId: req.staff.id, action: ACTIONS.ASSESSMENT_CREATED, entityType: ENTITY_TYPES.ASSESSMENT, entityId: assessment.id, newValue: { title, course_id: req.params.courseId } });

    res.status(201).json({ assessment });
  } catch (err) {
    console.error('[training:assessments:create]', err);
    res.status(500).json({ error: 'Failed to create assessment' });
  }
});

router.post('/modules/:moduleId/assessments', requireRole('owner'), async (req, res) => {
  try {
    const { title, description, passing_score_pct, max_attempts, time_limit_minutes, randomize_questions, randomize_options, show_correct_answers, show_explanations } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });

    const { rows: [assessment] } = await safeQuery(
      `INSERT INTO training_assessments (module_id, title, description, passing_score_pct, max_attempts, time_limit_minutes, randomize_questions, randomize_options, show_correct_answers, show_explanations, created_by, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'draft') RETURNING *`,
      [req.params.moduleId, title, description || null, passing_score_pct || null, max_attempts || 3, time_limit_minutes || null, randomize_questions !== false, randomize_options !== false, show_correct_answers || false, show_explanations || false, req.staff.id]
    );

    await createContentVersion(ENTITY_TYPES.ASSESSMENT, assessment.id, '1.0', title, { ...assessment }, 'Initial creation', req.staff.id);
    await logTrainingAction({ staffId: req.staff.id, action: ACTIONS.ASSESSMENT_CREATED, entityType: ENTITY_TYPES.ASSESSMENT, entityId: assessment.id, newValue: { title, module_id: req.params.moduleId } });

    res.status(201).json({ assessment });
  } catch (err) {
    console.error('[training:assessments:create:module]', err);
    res.status(500).json({ error: 'Failed to create assessment' });
  }
});

router.post('/programmes/:programmeId/final-assessment', requireRole('owner'), async (req, res) => {
  try {
    const { title, description, passing_score_pct, max_attempts, time_limit_minutes, randomize_questions, randomize_options, show_correct_answers, show_explanations } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });

    const { rows: [existing] } = await safeQuery(
      `SELECT id FROM training_assessments WHERE programme_id = $1`,
      [req.params.programmeId]
    );
    if (existing.length) return res.status(409).json({ error: 'Final assessment already exists for this programme' });

    const { rows: [assessment] } = await safeQuery(
      `INSERT INTO training_assessments (programme_id, title, description, passing_score_pct, max_attempts, time_limit_minutes, randomize_questions, randomize_options, show_correct_answers, show_explanations, created_by, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'draft') RETURNING *`,
      [req.params.programmeId, title, description || null, passing_score_pct || null, max_attempts || 3, time_limit_minutes || null, randomize_questions !== false, randomize_options !== false, show_correct_answers || false, show_explanations || false, req.staff.id]
    );

    await createContentVersion(ENTITY_TYPES.ASSESSMENT, assessment.id, '1.0', title, { ...assessment }, 'Initial creation', req.staff.id);
    await logTrainingAction({ staffId: req.staff.id, action: ACTIONS.ASSESSMENT_CREATED, entityType: ENTITY_TYPES.ASSESSMENT, entityId: assessment.id, newValue: { title, programme_id: req.params.programmeId, is_final: true } });

    res.status(201).json({ assessment });
  } catch (err) {
    console.error('[training:assessments:create:final]', err);
    res.status(500).json({ error: 'Failed to create final assessment' });
  }
});

router.put('/assessments/:id', requireRole('owner'), async (req, res) => {
  try {
    const allowed = ['title', 'description', 'passing_score_pct', 'max_attempts', 'time_limit_minutes', 'randomize_questions', 'randomize_options', 'show_correct_answers', 'show_explanations', 'status'];
    const sets = [];
    const params = [];

    const { rows: [current] } = await safeQuery(`SELECT * FROM training_assessments WHERE id = $1`, [req.params.id]);
    if (!current) return res.status(404).json({ error: 'Assessment not found' });

    for (const key of allowed) {
      if (key in req.body) {
        let value = req.body[key];
        if (value === '') value = null;
        params.push(value);
        sets.push(`${key} = $${params.length}`);
      }
    }
    if (!sets.length) return res.status(400).json({ error: 'No valid fields to update' });

    params.push(req.staff.id);
    sets.push(`updated_by = $${params.length}`);
    params.push(req.params.id);

    const { rows: [assessment] } = await safeQuery(
      `UPDATE training_assessments SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );

    await createContentVersion(ENTITY_TYPES.ASSESSMENT, assessment.id, assessment.version, assessment.title, { ...assessment }, `Updated`, req.staff.id);
    await logTrainingAction({ staffId: req.staff.id, action: ACTIONS.ASSESSMENT_UPDATED, entityType: ENTITY_TYPES.ASSESSMENT, entityId: assessment.id, newValue: req.body });

    res.json({ assessment });
  } catch (err) {
    console.error('[training:assessments:update]', err);
    res.status(500).json({ error: 'Failed to update assessment' });
  }
});

// ============ QUESTIONS ============

router.get('/assessments/:assessmentId/questions', async (req, res) => {
  try {
    const { rows: questions } = await safeQuery(
      `SELECT q.*, 
              (SELECT json_agg(o ORDER BY o.display_order) FROM training_question_options o WHERE o.question_id = q.id) as options
       FROM training_questions q
       WHERE q.assessment_id = $1 AND q.is_active = true
       ORDER BY q.display_order`,
      [req.params.assessmentId]
    );
    res.json({ questions });
  } catch (err) {
    console.error('[training:questions:list]', err);
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

router.post('/assessments/:assessmentId/questions', requireRole('owner'), async (req, res) => {
  try {
    const { question_text, question_type, marks, explanation } = req.body;
    if (!question_text || !question_type) return res.status(400).json({ error: 'question_text and question_type are required' });

    const { rows: [maxOrder] } = await safeQuery(
      `SELECT COALESCE(MAX(display_order), -1) + 1 as next_order FROM training_questions WHERE assessment_id = $1`,
      [req.params.assessmentId]
    );

    const { rows: [question] } = await safeQuery(
      `INSERT INTO training_questions (assessment_id, question_text, question_type, marks, explanation, display_order, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.params.assessmentId, question_text, question_type, marks || 1, explanation || null, maxOrder.next_order, req.staff.id]
    );

    res.status(201).json({ question });
  } catch (err) {
    console.error('[training:questions:create]', err);
    res.status(500).json({ error: 'Failed to create question' });
  }
});

router.post('/questions/:questionId/options', requireRole('owner'), async (req, res) => {
  try {
    const { option_text, is_correct, feedback } = req.body;
    if (!option_text) return res.status(400).json({ error: 'option_text is required' });

    const { rows: [maxOrder] } = await safeQuery(
      `SELECT COALESCE(MAX(display_order), -1) + 1 as next_order FROM training_question_options WHERE question_id = $1`,
      [req.params.questionId]
    );

    const { rows: [option] } = await safeQuery(
      `INSERT INTO training_question_options (question_id, option_text, is_correct, feedback, display_order)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.params.questionId, option_text, is_correct || false, feedback || null, maxOrder.next_order]
    );

    res.status(201).json({ option });
  } catch (err) {
    console.error('[training:options:create]', err);
    res.status(500).json({ error: 'Failed to create option' });
  }
});

router.delete('/questions/:id', requireRole('owner'), async (req, res) => {
  try {
    await safeQuery(`DELETE FROM training_questions WHERE id = $1`, [req.params.id]);
    res.json({ deleted: true });
  } catch (err) {
    console.error('[training:questions:delete]', err);
    res.status(500).json({ error: 'Failed to delete question' });
  }
});

// ============ ASSIGNMENTS ============

router.get('/assignments', async (req, res) => {
  try {
    const { programme_id, course_id, employee_id, status, department_id } = req.query;
    const conditions = [];
    const params = [];

    if (programme_id) { params.push(programme_id); conditions.push(`ta.programme_id = $${params.length}`); }
    if (course_id) { params.push(course_id); conditions.push(`ta.course_id = $${params.length}`); }
    if (employee_id) { params.push(employee_id); conditions.push(`ta.employee_id = $${params.length}`); }
    if (status) { params.push(status); conditions.push(`ta.status = $${params.length}`); }

    // Non-privileged users only see their own assignments
    if (!canViewAllProgress(req)) {
      if (!req.staff.employee_id) return res.status(403).json({ error: 'No employee record linked' });
      params.push(req.staff.employee_id);
      conditions.push(`ta.employee_id = $${params.length}`);
    } else if (department_id) {
      params.push(department_id);
      conditions.push(`e.department_id = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await safeQuery(
      `SELECT ta.*, 
              e.full_name AS employee_name, e.employee_code, e.work_email, e.department_id,
              d.name AS department_name,
              p.title AS programme_title,
              c.title AS course_title,
              sa.email AS assigned_by_email
       FROM training_assignments ta
       JOIN employees e ON e.id = ta.employee_id
       LEFT JOIN departments d ON d.id = e.department_id
       LEFT JOIN training_programmes p ON p.id = ta.programme_id
       LEFT JOIN training_courses c ON c.id = ta.course_id
       LEFT JOIN staff_accounts sa ON sa.id = ta.assigned_by
       ${where}
       ORDER BY ta.assigned_at DESC`,
      params
    );
    res.json({ assignments: rows });
  } catch (err) {
    console.error('[training:assignments:list]', err);
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
});

router.post('/assignments', requireRole('owner', 'admin', 'hr'), async (req, res) => {
  try {
    const { programme_id, course_id, employee_id, department_id, role_id, start_date, due_date } = req.body;

    if (!programme_id && !course_id) return res.status(400).json({ error: 'programme_id or course_id is required' });
    if (programme_id && course_id) return res.status(400).json({ error: 'Provide either programme_id or course_id, not both' });

    let targetEmployees = [];

    if (employee_id) {
      const { rows } = await safeQuery(`SELECT id FROM employees WHERE id = $1 AND status = 'active'`, [employee_id]);
      if (!rows.length) return res.status(404).json({ error: 'Employee not found or not active' });
      targetEmployees = rows.map(r => r.id);
    } else if (department_id) {
      const { rows } = await safeQuery(`SELECT id FROM employees WHERE department_id = $1 AND status = 'active'`, [department_id]);
      targetEmployees = rows.map(r => r.id);
    } else if (role_id) {
      const { rows } = await safeQuery(
        `SELECT e.id FROM employees e
         JOIN designations des ON des.id = e.designation_id
         WHERE des.id = $1 AND e.status = 'active'`,
        [role_id]
      );
      targetEmployees = rows.map(r => r.id);
    } else {
      return res.status(400).json({ error: 'employee_id, department_id, or role_id is required' });
    }

    if (!targetEmployees.length) return res.status(400).json({ error: 'No eligible employees found for assignment' });

    const assignments = [];
    for (const empId of targetEmployees) {
      const { rows: [existing] } = await safeQuery(
        `SELECT id FROM training_assignments WHERE employee_id = $1 AND ${programme_id ? 'programme_id' : 'course_id'} = $2 AND status NOT IN ('cancelled', 'completed')`,
        [empId, programme_id || course_id]
      );
      if (existing.length) continue;

      const { rows: [assignment] } = await safeQuery(
        `INSERT INTO training_assignments (programme_id, course_id, employee_id, assigned_by, start_date, due_date, status)
         VALUES ($1,$2,$3,$4,$5,$6,'assigned') RETURNING *`,
        [programme_id || null, course_id || null, empId, req.staff.id, start_date || null, due_date || null]
      );

      await recalculateProgress(assignment.id);

      await logTrainingAction({
        staffId: req.staff.id,
        action: ACTIONS.ASSIGNED,
        entityType: ENTITY_TYPES.ASSIGNMENT,
        entityId: assignment.id,
        newValue: { employee_id: empId, programme_id, course_id, start_date, due_date }
      });

      const { rows: [emp] } = await safeQuery(`SELECT full_name, work_email FROM employees WHERE id = $1`, [empId]);
      fireEvent('training.assigned', {
        assignmentId: assignment.id,
        employeeId: empId,
        employeeName: emp?.full_name,
        employeeEmail: emp?.work_email,
        programmeId: programme_id,
        courseId: course_id,
        dueDate: due_date,
      });

      assignments.push(assignment);
    }

    res.status(201).json({ assignments, count: assignments.length });
  } catch (err) {
    console.error('[training:assignments:create]', err);
    res.status(500).json({ error: 'Failed to create assignments' });
  }
});

router.put('/assignments/:id', requireRole('owner', 'admin', 'hr'), async (req, res) => {
  try {
    const { due_date, start_date } = req.body;
    const allowed = ['due_date', 'start_date'];
    const sets = [];
    const params = [];
    const oldValues = {};

    const { rows: [current] } = await safeQuery(`SELECT * FROM training_assignments WHERE id = $1`, [req.params.id]);
    if (!current) return res.status(404).json({ error: 'Assignment not found' });

    for (const key of allowed) {
      if (key in req.body) {
        let value = req.body[key];
        if (value === '') value = null;
        params.push(value);
        sets.push(`${key} = $${params.length}`);
        oldValues[key] = current[key];
      }
    }
    if (!sets.length) return res.status(400).json({ error: 'No valid fields to update' });

    params.push(req.params.id);
    const { rows: [assignment] } = await safeQuery(
      `UPDATE training_assignments SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );

    await recalculateProgress(assignment.id);
    await logTrainingAction({ staffId: req.staff.id, action: ACTIONS.DEADLINE_CHANGED, entityType: ENTITY_TYPES.ASSIGNMENT, entityId: assignment.id, oldValue: oldValues, newValue: req.body });

    res.json({ assignment });
  } catch (err) {
    console.error('[training:assignments:update]', err);
    res.status(500).json({ error: 'Failed to update assignment' });
  }
});

router.post('/assignments/:id/cancel', requireRole('owner', 'admin', 'hr'), async (req, res) => {
  try {
    const { reason } = req.body;
    const { rows: [assignment] } = await safeQuery(
      `UPDATE training_assignments SET status = 'cancelled', cancelled_at = NOW(), cancelled_by = $1, cancel_reason = $2 WHERE id = $3 RETURNING *`,
      [req.staff.id, reason || null, req.params.id]
    );
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });

    await logTrainingAction({ staffId: req.staff.id, action: ACTIONS.REASSIGNED, entityType: ENTITY_TYPES.ASSIGNMENT, entityId: assignment.id, newValue: { status: 'cancelled', reason } });

    res.json({ assignment });
  } catch (err) {
    console.error('[training:assignments:cancel]', err);
    res.status(500).json({ error: 'Failed to cancel assignment' });
  }
});

// ============ EMPLOYEE PROGRESS (Employee view) ============

router.get('/my-training', async (req, res) => {
  try {
    if (!req.staff.employee_id) return res.status(404).json({ error: 'No employee record linked to this account' });

    const { rows: assignments } = await safeQuery(
      `SELECT ta.*, 
              p.title AS programme_title, p.code AS programme_code, p.version AS programme_version,
              c.title AS course_title, c.code AS course_code,
              tp.progress_pct, tp.lessons_completed, tp.lessons_total, tp.assessments_completed, tp.assessments_total, tp.average_score_pct,
              tp.started_at, tp.completed_at
       FROM training_assignments ta
       LEFT JOIN training_programmes p ON p.id = ta.programme_id
       LEFT JOIN training_courses c ON c.id = ta.course_id
       LEFT JOIN training_progress tp ON tp.assignment_id = ta.id AND tp.programme_id = ta.programme_id
       WHERE ta.employee_id = $1 AND ta.status != 'cancelled'
       ORDER BY ta.assigned_at DESC`,
      [req.staff.employee_id]
    );

    for (const a of assignments) {
      const { rows: nextLesson } = await safeQuery(
        `SELECT l.id, l.title, l.module_id, m.title as module_title, lp.status, lp.progress_pct
         FROM training_lessons l
         JOIN training_modules m ON m.id = l.module_id
         JOIN training_courses c ON c.id = m.course_id
         LEFT JOIN training_lesson_progress lp ON lp.lesson_id = l.id AND lp.assignment_id = $1
         WHERE a.programme_id IS NOT NULL AND c.programme_id = a.programme_id
            AND l.is_required = true
            AND (lp.status IS NULL OR lp.status != 'completed')
         ORDER BY m.display_order, l.display_order
         LIMIT 1`,
        [a.id]
      );
      a.next_lesson = nextLesson[0] || null;

      const { rows: upcomingAssessments } = await safeQuery(
        `SELECT a.id, a.title, a.time_limit_minutes, a.max_attempts,
                (SELECT COUNT(*) FROM training_assessment_attempts WHERE assignment_id = $1 AND assessment_id = a.id) as attempts_used
         FROM training_assessments a
         JOIN training_courses c ON c.id = a.course_id
         WHERE a.programme_id IS NOT NULL AND c.programme_id = a.programme_id
            AND a.status IN ('published', 'active')
         ORDER BY a.created_at`,
        [a.id]
      );
      a.upcoming_assessments = upcomingAssessments;
    }

    const { rows: certificates } = await safeQuery(
      `SELECT tc.*, tp.title as programme_title
       FROM training_certificates tc
       JOIN training_programmes tp ON tp.id = tc.programme_id
       WHERE tc.employee_id = $1 AND tc.status = 'issued'
       ORDER BY tc.issued_at DESC`,
      [req.staff.employee_id]
    );

    res.json({ assignments, certificates });
  } catch (err) {
    console.error('[training:my-training]', err);
    res.status(500).json({ error: 'Failed to fetch training' });
  }
});

router.get('/my-training/continue', async (req, res) => {
  try {
    if (!req.staff.employee_id) return res.status(404).json({ error: 'No employee record linked' });

    const { rows: [inProgress] } = await safeQuery(
      `SELECT ta.*, p.title as programme_title, c.title as course_title, m.title as module_title, l.title as lesson_title, l.lesson_type, l.content, l.duration_minutes
       FROM training_assignments ta
       LEFT JOIN training_programmes p ON p.id = ta.programme_id
       LEFT JOIN training_courses c ON c.id = ta.course_id
       LEFT JOIN training_lesson_progress lp ON lp.assignment_id = ta.id
       LEFT JOIN training_lessons l ON l.id = lp.lesson_id
       LEFT JOIN training_modules m ON m.id = l.module_id
       WHERE ta.employee_id = $1 AND ta.status IN ('assigned', 'in_progress')
         AND (lp.status = 'in_progress' OR (lp.status IS NULL AND l.is_required = true))
       ORDER BY ta.assigned_at DESC, m.display_order, l.display_order
       LIMIT 1`,
      [req.staff.employee_id]
    );

    if (!inProgress) return res.json({ lesson: null });

    const { rows: materials } = await safeQuery(
      `SELECT * FROM training_materials WHERE lesson_id = $1 ORDER BY display_order`,
      [inProgress.lesson_id]
    );

    const { rows: exercises } = await safeQuery(
      `SELECT * FROM training_exercises WHERE lesson_id = $1`,
      [inProgress.lesson_id]
    );

    res.json({ lesson: inProgress, materials, exercises });
  } catch (err) {
    console.error('[training:my-training:continue]', err);
    res.status(500).json({ error: 'Failed to fetch continue learning' });
  }
});

// ============ LESSON PROGRESS ============

router.post('/lessons/:lessonId/start', async (req, res) => {
  try {
    if (!req.staff.employee_id) return res.status(404).json({ error: 'No employee record linked' });

    const { rows: [assignment] } = await safeQuery(
      `SELECT ta.* FROM training_assignments ta
       JOIN training_lessons l ON l.id = $1
       JOIN training_modules m ON m.id = l.module_id
       JOIN training_courses c ON c.id = m.course_id
       WHERE ta.employee_id = $2 AND ta.status IN ('assigned', 'in_progress')
         AND (ta.programme_id = c.programme_id OR ta.course_id = c.id)
       LIMIT 1`,
      [req.params.lessonId, req.staff.employee_id]
    );
    if (!assignment) return res.status(403).json({ error: 'This lesson is not part of your assigned training' });

    const { rows: [progress] } = await safeQuery(
      `INSERT INTO training_lesson_progress (assignment_id, lesson_id, status, started_at, progress_pct)
       VALUES ($1,$2,'in_progress',NOW(),0)
       ON CONFLICT (assignment_id, lesson_id) DO UPDATE SET status = 'in_progress', started_at = COALESCE(training_lesson_progress.started_at, NOW())
       RETURNING *`,
      [assignment.id, req.params.lessonId]
    );

    await safeQuery(
      `UPDATE training_assignments SET status = 'in_progress', last_activity_at = NOW() WHERE id = $1 AND status = 'assigned'`,
      [assignment.id]
    );

    await recalculateProgress(assignment.id);

    res.json({ progress });
  } catch (err) {
    console.error('[training:lesson:start]', err);
    res.status(500).json({ error: 'Failed to start lesson' });
  }
});

router.post('/lessons/:lessonId/complete', async (req, res) => {
  try {
    if (!req.staff.employee_id) return res.status(404).json({ error: 'No employee record linked' });

    const { time_spent_seconds, last_position } = req.body;

    const { rows: [progress] } = await safeQuery(
      `SELECT lp.*, ta.id as assignment_id FROM training_lesson_progress lp
       JOIN training_assignments ta ON ta.id = lp.assignment_id
       WHERE lp.lesson_id = $1 AND ta.employee_id = $2`,
      [req.params.lessonId, req.staff.employee_id]
    );
    if (!progress) return res.status(404).json({ error: 'Lesson progress not found' });

    await safeQuery(
      `UPDATE training_lesson_progress SET status = 'completed', progress_pct = 100, completed_at = NOW(), time_spent_seconds = COALESCE(time_spent_seconds, 0) + COALESCE($1, 0), last_position = $2 WHERE id = $3`,
      [time_spent_seconds || 0, last_position ? JSON.stringify(last_position) : null, progress.id]
    );

    await recalculateProgress(progress.assignment_id);
    await checkAndIssueCertificate(progress.assignment_id);

    res.json({ success: true });
  } catch (err) {
    console.error('[training:lesson:complete]', err);
    res.status(500).json({ error: 'Failed to complete lesson' });
  }
});

router.put('/lessons/:lessonId/progress', async (req, res) => {
  try {
    if (!req.staff.employee_id) return res.status(404).json({ error: 'No employee record linked' });

    const { progress_pct, time_spent_seconds, last_position } = req.body;

    const { rows: [progress] } = await safeQuery(
      `SELECT lp.*, ta.id as assignment_id FROM training_lesson_progress lp
       JOIN training_assignments ta ON ta.id = lp.assignment_id
       WHERE lp.lesson_id = $1 AND ta.employee_id = $2`,
      [req.params.lessonId, req.staff.employee_id]
    );
    if (!progress) return res.status(404).json({ error: 'Lesson progress not found' });

    await safeQuery(
      `UPDATE training_lesson_progress SET progress_pct = $1, time_spent_seconds = COALESCE(time_spent_seconds, 0) + COALESCE($2, 0), last_position = $3 WHERE id = $4`,
      [progress_pct || 0, time_spent_seconds || 0, last_position ? JSON.stringify(last_position) : null, progress.id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('[training:lesson:progress]', err);
    res.status(500).json({ error: 'Failed to update lesson progress' });
  }
});

// ============ ASSESSMENT ATTEMPTS ============

router.get('/assessments/:assessmentId/attempts', async (req, res) => {
  try {
    if (!req.staff.employee_id) return res.status(404).json({ error: 'No employee record linked' });

    const { rows: [assignment] } = await safeQuery(
      `SELECT ta.* FROM training_assignments ta
       JOIN training_assessments a ON a.id = $1
       JOIN training_courses c ON c.id = a.course_id
       WHERE ta.employee_id = $2 AND ta.status != 'cancelled'
         AND (ta.programme_id = c.programme_id OR ta.course_id = c.id)
       LIMIT 1`,
      [req.params.assessmentId, req.staff.employee_id]
    );
    if (!assignment) return res.status(403).json({ error: 'This assessment is not part of your assigned training' });

    const { rows: attempts } = await safeQuery(
      `SELECT * FROM training_assessment_attempts WHERE assignment_id = $1 AND assessment_id = $2 ORDER BY attempt_number`,
      [assignment.id, req.params.assessmentId]
    );

    res.json({ attempts, assignmentId: assignment.id, maxAttempts: assignment.max_attempts });
  } catch (err) {
    console.error('[training:assessment:attempts]', err);
    res.status(500).json({ error: 'Failed to fetch attempts' });
  }
});

router.post('/assessments/:assessmentId/start', async (req, res) => {
  try {
    if (!req.staff.employee_id) return res.status(404).json({ error: 'No employee record linked' });

    const { rows: [assessment] } = await safeQuery(`SELECT * FROM training_assessments WHERE id = $1`, [req.params.assessmentId]);
    if (!assessment) return res.status(404).json({ error: 'Assessment not found' });
    if (assessment.status !== 'active' && assessment.status !== 'published') return res.status(400).json({ error: 'Assessment is not available' });

    const { rows: [assignment] } = await safeQuery(
      `SELECT ta.* FROM training_assignments ta
       WHERE ta.employee_id = $1 AND ta.status IN ('assigned', 'in_progress')
         AND (ta.programme_id = (SELECT programme_id FROM training_courses WHERE id = (SELECT course_id FROM training_assessments WHERE id = $2))
          OR ta.course_id = (SELECT course_id FROM training_assessments WHERE id = $2))
       LIMIT 1`,
      [req.staff.employee_id, req.params.assessmentId]
    );
    if (!assignment) return res.status(403).json({ error: 'This assessment is not part of your assigned training' });

    const { rows: attempts } = await safeQuery(
      `SELECT attempt_number FROM training_assessment_attempts WHERE assignment_id = $1 AND assessment_id = $2 ORDER BY attempt_number DESC LIMIT 1`,
      [assignment.id, req.params.assessmentId]
    );

    const nextAttempt = (attempts[0]?.attempt_number || 0) + 1;
    if (assessment.max_attempts && nextAttempt > assessment.max_attempts) {
      return res.status(400).json({ error: 'Maximum attempts reached' });
    }

    const { rows: questions } = await safeQuery(
      `SELECT q.id, q.question_text, q.question_type, q.marks, q.explanation,
              (SELECT json_agg(json_build_object('id', o.id, 'text', o.option_text, 'order', o.display_order) ORDER BY o.display_order)
               FROM training_question_options o WHERE o.question_id = q.id) as options
       FROM training_questions q
       WHERE q.assessment_id = $1 AND q.is_active = true
       ORDER BY q.display_order`,
      [req.params.assessmentId]
    );

    if (!questions.length) return res.status(400).json({ error: 'Assessment has no questions yet' });

    const { rows: [attempt] } = await safeQuery(
      `INSERT INTO training_assessment_attempts (assignment_id, assessment_id, attempt_number, status, answers, started_at)
       VALUES ($1,$2,$3,'in_progress','{}',NOW()) RETURNING *`,
      [assignment.id, req.params.assessmentId, nextAttempt]
    );

    const questionData = questions.map(q => ({
      id: q.id,
      question_text: q.question_text,
      question_type: q.question_type,
      marks: q.marks,
      options: q.options || [],
    }));

    res.json({ attempt, questions: questionData, timeLimitMinutes: assessment.time_limit_minutes });
  } catch (err) {
    console.error('[training:assessment:start]', err);
    res.status(500).json({ error: 'Failed to start assessment' });
  }
});

router.post('/assessment-attempts/:attemptId/submit', async (req, res) => {
  try {
    if (!req.staff.employee_id) return res.status(404).json({ error: 'No employee record linked' });

    const { answers, time_spent_seconds } = req.body;

    const { rows: [attempt] } = await safeQuery(
      `SELECT aa.*, ta.employee_id, a.passing_score_pct, a.show_correct_answers, a.show_explanations
       FROM training_assessment_attempts aa
       JOIN training_assignments ta ON ta.id = aa.assignment_id
       JOIN training_assessments a ON a.id = aa.assessment_id
       WHERE aa.id = $1`,
      [req.params.attemptId]
    );
    if (!attempt) return res.status(404).json({ error: 'Attempt not found' });
    if (attempt.employee_id !== req.staff.employee_id) return res.status(403).json({ error: 'Not your attempt' });
    if (attempt.status !== 'in_progress') return res.status(400).json({ error: 'Attempt already submitted' });

    const { rows: questions } = await safeQuery(
      `SELECT q.id, q.question_type, q.marks, q.explanation,
              (SELECT json_agg(json_build_object('id', o.id, 'is_correct', o.is_correct) ORDER BY o.display_order)
               FROM training_question_options o WHERE o.question_id = q.id) as options
       FROM training_questions q WHERE q.assessment_id = $1 AND q.is_active = true`,
      [attempt.assessment_id]
    );

    let totalMarks = 0, earnedMarks = 0;
    const gradedAnswers = {};

    for (const q of questions) {
      const answer = answers[q.id];
      totalMarks += parseFloat(q.marks);

      if (q.question_type === 'single_choice' || q.question_type === 'multiple_choice') {
        const correctOptions = q.options?.filter(o => o.is_correct).map(o => o.id) || [];
        const selectedOptions = Array.isArray(answer) ? answer : [answer].filter(Boolean);
        const isCorrect = correctOptions.length === selectedOptions.length && correctOptions.every(o => selectedOptions.includes(o));
        if (isCorrect) earnedMarks += parseFloat(q.marks);
        gradedAnswers[q.id] = { correct: isCorrect, explanation: q.explanation, correctOptions: attempt.show_correct_answers ? correctOptions : undefined };
      } else if (q.question_type === 'true_false') {
        const correctOption = q.options?.find(o => o.is_correct);
        const isCorrect = correctOption && answer === correctOption.id;
        if (isCorrect) earnedMarks += parseFloat(q.marks);
        gradedAnswers[q.id] = { correct: isCorrect, explanation: q.explanation };
      } else {
        gradedAnswers[q.id] = { correct: null, explanation: q.explanation, requiresManualGrading: true };
      }
    }

    const scorePct = totalMarks > 0 ? (earnedMarks / totalMarks) * 100 : 0;
    const passed = attempt.passing_score_pct ? scorePct >= parseFloat(attempt.passing_score_pct) : earnedMarks === totalMarks;

    await safeQuery(
      `UPDATE training_assessment_attempts SET status = 'submitted', submitted_at = NOW(), score_pct = $1, total_marks = $2, earned_marks = $3, passed = $4, answers = $5, time_spent_seconds = $6 WHERE id = $7`,
      [scorePct, totalMarks, earnedMarks, passed, JSON.stringify({ ...answers, graded: gradedAnswers }), time_spent_seconds || 0, req.params.attemptId]
    );

    await recalculateProgress(attempt.assignment_id);
    await checkAndIssueCertificate(attempt.assignment_id);

    const { rows: [updated] } = await safeQuery(`SELECT * FROM training_assessment_attempts WHERE id = $1`, [req.params.attemptId]);

    const response = {
      attempt: updated,
      score_pct: scorePct,
      passed,
      total_marks: totalMarks,
      earned_marks: earnedMarks,
      passing_score_pct: attempt.passing_score_pct,
    };

    if (attempt.show_correct_answers || attempt.show_explanations) {
      response.graded_answers = gradedAnswers;
    }

    fireEvent('assessment.result', {
      attemptId: attempt.id,
      employeeId: req.staff.employee_id,
      assessmentId: attempt.assessment_id,
      scorePct,
      passed,
    });

    res.json(response);
  } catch (err) {
    console.error('[training:assessment:submit]', err);
    res.status(500).json({ error: 'Failed to submit assessment' });
  }
});

// ============ EMPLOYEE DETAIL (Founder/HR view) ============

router.get('/employees/:employeeId/progress', async (req, res) => {
  try {
    if (!canViewAllProgress(req)) return res.status(403).json({ error: 'Insufficient permissions' });

    const { rows: assignments } = await safeQuery(
      `SELECT ta.*, 
              p.title AS programme_title, p.code AS programme_code,
              c.title AS course_title,
              tp.progress_pct, tp.lessons_completed, tp.lessons_total, tp.assessments_completed, tp.assessments_total, tp.average_score_pct,
              tp.started_at, tp.completed_at
       FROM training_assignments ta
       LEFT JOIN training_programmes p ON p.id = ta.programme_id
       LEFT JOIN training_courses c ON c.id = ta.course_id
       LEFT JOIN training_progress tp ON tp.assignment_id = ta.id AND (tp.programme_id = ta.programme_id OR tp.course_id = ta.course_id)
       WHERE ta.employee_id = $1
       ORDER BY ta.assigned_at DESC`,
      [req.params.employeeId]
    );

    for (const a of assignments) {
      const { rows: lessonProg } = await safeQuery(
        `SELECT lp.*, l.title, m.title as module_title, c.title as course_title
         FROM training_lesson_progress lp
         JOIN training_lessons l ON l.id = lp.lesson_id
         JOIN training_modules m ON m.id = l.module_id
         LEFT JOIN training_courses c ON c.id = m.course_id
         WHERE lp.assignment_id = $1
         ORDER BY c.title, m.display_order, l.display_order`,
        [a.id]
      );
      a.lessons = lessonProg;

      const { rows: attempts } = await safeQuery(
        `SELECT aa.*, a.title as assessment_title
         FROM training_assessment_attempts aa
         JOIN training_assessments a ON a.id = aa.assessment_id
         WHERE aa.assignment_id = $1
         ORDER BY aa.assessment_id, aa.attempt_number`,
        [a.id]
      );
      a.assessments = attempts;
    }

    const { rows: certificates } = await safeQuery(
      `SELECT tc.*, tp.title as programme_title
       FROM training_certificates tc
       JOIN training_programmes tp ON tp.id = tc.programme_id
       WHERE tc.employee_id = $1
       ORDER BY tc.issued_at DESC`,
      [req.params.employeeId]
    );

    res.json({ assignments, certificates });
  } catch (err) {
    console.error('[training:employee:progress]', err);
    res.status(500).json({ error: 'Failed to fetch employee progress' });
  }
});

// ============ CERTIFICATES ============

router.get('/certificates', async (req, res) => {
  try {
    const { employee_id, programme_id, status } = req.query;
    const conditions = [];
    const params = [];

    if (employee_id) { params.push(employee_id); conditions.push(`tc.employee_id = $${params.length}`); }
    if (programme_id) { params.push(programme_id); conditions.push(`tc.programme_id = $${params.length}`); }
    if (status) { params.push(status); conditions.push(`tc.status = $${params.length}`); }

    if (!canViewAllProgress(req)) {
      if (!req.staff.employee_id) return res.status(403).json({ error: 'No employee record linked' });
      params.push(req.staff.employee_id);
      conditions.push(`tc.employee_id = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await safeQuery(
      `SELECT tc.*, e.full_name as employee_name, e.employee_code, p.title as programme_title, sa.email as issued_by_email
       FROM training_certificates tc
       JOIN employees e ON e.id = tc.employee_id
       JOIN training_programmes p ON p.id = tc.programme_id
       LEFT JOIN staff_accounts sa ON sa.id = tc.issued_by
       ${where}
       ORDER BY tc.issued_at DESC`,
      params
    );
    res.json({ certificates: rows });
  } catch (err) {
    console.error('[training:certificates:list]', err);
    res.status(500).json({ error: 'Failed to fetch certificates' });
  }
});

router.post('/certificates/:id/revoke', requireRole('owner'), async (req, res) => {
  try {
    const { reason } = req.body;
    const { rows: [cert] } = await safeQuery(
      `UPDATE training_certificates SET status = 'revoked', revoked_at = NOW(), revoked_by = $1, revoke_reason = $2 WHERE id = $3 RETURNING *`,
      [req.staff.id, reason || null, req.params.id]
    );
    if (!cert) return res.status(404).json({ error: 'Certificate not found' });

    await logTrainingAction({ staffId: req.staff.id, action: ACTIONS.CERTIFICATE_REVOKED, entityType: ENTITY_TYPES.CERTIFICATE, entityId: cert.id, newValue: { status: 'revoked', reason } });

    res.json({ certificate: cert });
  } catch (err) {
    console.error('[training:certificates:revoke]', err);
    res.status(500).json({ error: 'Failed to revoke certificate' });
  }
});

// ============ REPORTS ============

router.get('/reports/overview', requireRole('owner', 'admin', 'hr'), async (req, res) => {
  try {
    const { rows: [stats] } = await safeQuery(`
      SELECT 
        (SELECT COUNT(*) FROM employees WHERE status = 'active') as total_employees,
        (SELECT COUNT(DISTINCT employee_id) FROM training_assignments WHERE status IN ('assigned', 'in_progress', 'completed')) as employees_in_training,
        (SELECT ROUND(AVG(progress_pct)::numeric, 2) FROM training_progress WHERE progress_pct > 0) as avg_completion_pct,
        (SELECT COUNT(*) FROM training_assignments WHERE status = 'completed') as completed_programmes,
        (SELECT COUNT(*) FROM training_assignments WHERE status = 'overdue') as overdue_count,
        (SELECT COUNT(*) FROM training_assignments WHERE status = 'in_progress' AND due_date < NOW()) as at_risk_count,
        (SELECT ROUND(AVG(score_pct)::numeric, 2) FROM training_assessment_attempts WHERE status = 'submitted') as avg_assessment_score
    `);

    const { rows: programmeStats } = await safeQuery(`
      SELECT p.title, p.code,
             COUNT(DISTINCT ta.employee_id) as assigned,
             COUNT(DISTINCT ta.employee_id) FILTER (WHERE ta.status = 'completed') as completed,
             ROUND(AVG(tp.progress_pct)::numeric, 2) as avg_progress,
             ROUND(AVG(aa.score_pct)::numeric, 2) as avg_score
      FROM training_programmes p
      LEFT JOIN training_assignments ta ON ta.programme_id = p.id
      LEFT JOIN training_progress tp ON tp.assignment_id = ta.id AND tp.programme_id = p.id
      LEFT JOIN training_assessment_attempts aa ON aa.assignment_id = ta.id
      WHERE p.status IN ('published', 'active')
      GROUP BY p.id
      ORDER BY assigned DESC
    `);

    const { rows: deptStats } = await safeQuery(`
      SELECT d.name as department,
             COUNT(DISTINCT e.id) as total_employees,
             COUNT(DISTINCT ta.employee_id) FILTER (WHERE ta.status = 'completed') as completed,
             ROUND(AVG(tp.progress_pct)::numeric, 2) as avg_progress,
             ROUND(AVG(aa.score_pct)::numeric, 2) as avg_score,
             COUNT(DISTINCT ta.employee_id) FILTER (WHERE ta.status = 'overdue') as overdue
      FROM departments d
      JOIN employees e ON e.department_id = d.id AND e.status = 'active'
      LEFT JOIN training_assignments ta ON ta.employee_id = e.id
      LEFT JOIN training_progress tp ON tp.assignment_id = ta.id
      LEFT JOIN training_assessment_attempts aa ON aa.assignment_id = ta.id
      GROUP BY d.id
      ORDER BY total_employees DESC
    `);

    res.json({ overview: stats, programmes: programmeStats, departments: deptStats });
  } catch (err) {
    console.error('[training:reports:overview]', err);
    res.status(500).json({ error: 'Failed to generate overview report' });
  }
});

router.get('/reports/employee/:employeeId', requireRole('owner', 'admin', 'hr'), async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `SELECT ta.*, p.title as programme_title, c.title as course_title, tp.progress_pct, tp.average_score_pct
       FROM training_assignments ta
       LEFT JOIN training_programmes p ON p.id = ta.programme_id
       LEFT JOIN training_courses c ON c.id = ta.course_id
       LEFT JOIN training_progress tp ON tp.assignment_id = ta.id
       WHERE ta.employee_id = $1
       ORDER BY ta.assigned_at DESC`,
      [req.params.employeeId]
    );
    res.json({ assignments: rows });
  } catch (err) {
    console.error('[training:reports:employee]', err);
    res.status(500).json({ error: 'Failed to generate employee report' });
  }
});

router.get('/reports/overdue', requireRole('owner', 'admin', 'hr'), async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `SELECT ta.*, e.full_name, e.employee_code, e.work_email, d.name as department, p.title as programme_title, c.title as course_title
       FROM training_assignments ta
       JOIN employees e ON e.id = ta.employee_id
       LEFT JOIN departments d ON d.id = e.department_id
       LEFT JOIN training_programmes p ON p.id = ta.programme_id
       LEFT JOIN training_courses c ON c.id = ta.course_id
       WHERE ta.status IN ('assigned', 'in_progress', 'overdue')
         AND ta.due_date < NOW()
       ORDER BY ta.due_date ASC`
    );
    res.json({ overdue: rows });
  } catch (err) {
    console.error('[training:reports:overdue]', err);
    res.status(500).json({ error: 'Failed to fetch overdue report' });
  }
});

// ============ AUDIT LOGS ============

router.get('/audit-logs', requireRole('owner'), async (req, res) => {
  try {
    const { entity_type, entity_id, action, limit = 100, offset = 0 } = req.query;
    const conditions = [];
    const params = [];

    if (entity_type) { params.push(entity_type); conditions.push(`entity_type = $${params.length}`); }
    if (entity_id) { params.push(entity_id); conditions.push(`entity_id = $${params.length}`); }
    if (action) { params.push(action); conditions.push(`action = $${params.length}`); }

    params.push(limit);
    params.push(offset);

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await safeQuery(
      `SELECT tal.*, sa.email as staff_email FROM training_audit_logs tal
       LEFT JOIN staff_accounts sa ON sa.id = tal.staff_id
       ${where}
       ORDER BY tal.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({ logs: rows });
  } catch (err) {
    console.error('[training:audit:list]', err);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// ============ CONTENT VERSIONING ============

router.get('/content-versions/:entityType/:entityId', requireRole('owner'), async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `SELECT * FROM training_content_versions WHERE entity_type = $1 AND entity_id = $2 ORDER BY created_at DESC`,
      [req.params.entityType, req.params.entityId]
    );
    res.json({ versions: rows });
  } catch (err) {
    console.error('[training:versions:list]', err);
    res.status(500).json({ error: 'Failed to fetch content versions' });
  }
});

module.exports = router;