'use strict';

const { safeQuery, withTransaction } = require('../db/pool');
const { logAction } = require('./auditLog');
const { fireEvent } = require('./automationEngine');

const ENTITY_TYPES = {
  PROGRAMME: 'programme',
  COURSE: 'course',
  MODULE: 'module',
  LESSON: 'lesson',
  ASSESSMENT: 'assessment',
  ASSIGNMENT: 'assignment',
  CERTIFICATE: 'certificate',
};

const ACTIONS = {
  PROGRAMME_CREATED: 'TRAINING_PROGRAMME_CREATED',
  PROGRAMME_UPDATED: 'TRAINING_PROGRAMME_UPDATED',
  PROGRAMME_ARCHIVED: 'TRAINING_PROGRAMME_ARCHIVED',
  COURSE_CREATED: 'TRAINING_COURSE_CREATED',
  COURSE_UPDATED: 'TRAINING_COURSE_UPDATED',
  CONTENT_UPDATED: 'TRAINING_CONTENT_UPDATED',
  CONTENT_PUBLISHED: 'TRAINING_CONTENT_PUBLISHED',
  CONTENT_ARCHIVED: 'TRAINING_CONTENT_ARCHIVED',
  ASSIGNED: 'TRAINING_ASSIGNED',
  REASSIGNED: 'TRAINING_REASSIGNED',
  DEADLINE_CHANGED: 'TRAINING_DEADLINE_CHANGED',
  ASSESSMENT_CREATED: 'TRAINING_ASSESSMENT_CREATED',
  ASSESSMENT_UPDATED: 'TRAINING_ASSESSMENT_UPDATED',
  SCORE_CORRECTED: 'TRAINING_SCORE_CORRECTED',
  CERTIFICATE_ISSUED: 'TRAINING_CERTIFICATE_ISSUED',
  CERTIFICATE_REVOKED: 'TRAINING_CERTIFICATE_REVOKED',
};

async function createContentVersion(entityType, entityId, version, title, contentSnapshot, changeSummary, createdBy) {
  await safeQuery(
    `INSERT INTO training_content_versions (entity_type, entity_id, version, title, content_snapshot, change_summary, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [entityType, entityId, version, title, JSON.stringify(contentSnapshot), changeSummary, createdBy]
  );
}

async function logTrainingAction({ staffId, action, entityType, entityId, entityVersion, oldValue, newValue, ipAddress, requestId, metadata }) {
  await safeQuery(
    `INSERT INTO training_audit_logs (staff_id, action, entity_type, entity_id, entity_version, old_value, new_value, ip_address, request_id, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [staffId || null, action, entityType, entityId, entityVersion || null,
     oldValue ? JSON.stringify(oldValue) : null, newValue ? JSON.stringify(newValue) : null,
     ipAddress || null, requestId || null, metadata ? JSON.stringify(metadata) : null]
  );
}

function generateCertificateNumber() {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  return `ET-CA-${year}-${random}`;
}

async function recalculateProgress(assignmentId) {
  const { rows: assignment } = await safeQuery(
    `SELECT * FROM training_assignments WHERE id = $1`,
    [assignmentId]
  );
  if (!assignment.length) return;

  const a = assignment[0];

  if (a.programme_id) {
    const { rows: courses } = await safeQuery(
      `SELECT c.id,
              (SELECT COUNT(*) FROM training_lessons l
               JOIN training_modules m ON m.id = l.module_id
               WHERE m.course_id = c.id AND l.is_required = true) as total_lessons,
              (SELECT COUNT(*) FROM training_assessments WHERE course_id = c.id) as total_assessments
       FROM training_courses c
       WHERE c.programme_id = $1 AND c.status IN ('published', 'active')`,
      [a.programme_id]
    );

    let totalLessons = 0, completedLessons = 0, totalAssessments = 0, completedAssessments = 0, passedAssessments = 0, sumScores = 0, scoreCount = 0;

    for (const course of courses) {
      // Get total required lessons for this course
      const { rows: totalLessonRows } = await safeQuery(
        `SELECT COUNT(*) as total
         FROM training_lessons l
         JOIN training_modules m ON m.id = l.module_id
         WHERE m.course_id = $1 AND l.is_required = true`,
        [course.id]
      );
      const totalLessonsForCourse = parseInt(totalLessonRows[0].total);
      
      // Get completed lessons for this assignment and course
      const { rows: completedLessonRows } = await safeQuery(
        `SELECT COUNT(*) as completed
         FROM training_lesson_progress lp
         JOIN training_lessons l ON l.id = lp.lesson_id
         JOIN training_modules m ON m.id = l.module_id
         WHERE lp.assignment_id = $1 AND m.course_id = $2 AND l.is_required = true AND lp.status = 'completed'`,
        [assignmentId, course.id]
      );
      const completedLessonsForCourse = parseInt(completedLessonRows[0].completed);
      
      totalLessons += totalLessonsForCourse;
      completedLessons += completedLessonsForCourse;

      const { rows: attempts } = await safeQuery(
        `SELECT MAX(score_pct) as best_score, COUNT(*) FILTER (WHERE passed = true) as passed
         FROM training_assessment_attempts
         WHERE assignment_id = $1 AND assessment_id IN (
           SELECT id FROM training_assessments WHERE course_id = $2
         )`,
        [assignmentId, course.id]
      );
      if (attempts[0].best_score !== null) {
        sumScores += parseFloat(attempts[0].best_score);
        scoreCount++;
      }
      totalAssessments += course.total_assessments;
      completedAssessments += parseInt(attempts[0].passed || 0);
      passedAssessments += parseInt(attempts[0].passed || 0);
    }

    const progressPct = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;
    const avgScore = scoreCount > 0 ? sumScores / scoreCount : null;

    await safeQuery(
      `INSERT INTO training_progress (assignment_id, programme_id, progress_pct, lessons_total, lessons_completed, assessments_total, assessments_completed, assessments_passed, average_score_pct, last_activity_at, started_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), COALESCE((SELECT started_at FROM training_progress WHERE assignment_id = $1 AND programme_id = $2), NOW()))
       ON CONFLICT (assignment_id, programme_id) DO UPDATE SET
         progress_pct = $3,
         lessons_total = $4,
         lessons_completed = $5,
         assessments_total = $6,
         assessments_completed = $7,
         assessments_passed = $8,
         average_score_pct = $9,
         last_activity_at = NOW(),
         completed_at = CASE WHEN $10 >= 100 AND training_progress.completed_at IS NULL THEN NOW() ELSE training_progress.completed_at END`,
      [assignmentId, a.programme_id, progressPct, totalLessons, completedLessons, totalAssessments, completedAssessments, passedAssessments, avgScore, progressPct]
    );

    const status = progressPct >= 100 && passedAssessments >= totalAssessments ? 'completed' :
                   a.due_date && new Date(a.due_date) < new Date() && progressPct < 100 ? 'overdue' :
                   progressPct > 0 ? 'in_progress' : 'assigned';

    await safeQuery(
      `UPDATE training_assignments SET progress_pct = $1, status = $2, last_activity_at = NOW() WHERE id = $3`,
      [progressPct, status, assignmentId]
    );
  }

  if (a.course_id) {
    const { rows: modules } = await safeQuery(
      `SELECT m.id,
              (SELECT COUNT(*) FROM training_lessons l WHERE l.module_id = m.id AND l.is_required = true) as total_lessons
       FROM training_modules m
       WHERE m.course_id = $1 AND m.status IN ('published', 'active')`,
      [a.course_id]
    );

    let totalLessons = 0, completedLessons = 0, totalAssessments = 0, passedAssessments = 0, sumScores = 0, scoreCount = 0;

    for (const module of modules) {
      const { rows: lessonProg } = await safeQuery(
        `SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'completed') as completed
         FROM training_lesson_progress
         WHERE assignment_id = $1 AND lesson_id IN (
           SELECT id FROM training_lessons WHERE module_id = $2 AND is_required = true
         )`,
        [assignmentId, module.id]
      );
      totalLessons += parseInt(lessonProg[0].total);
      completedLessons += parseInt(lessonProg[0].completed);
    }

    const { rows: courseAssessments } = await safeQuery(
      `SELECT id FROM training_assessments WHERE course_id = $1`,
      [a.course_id]
    );
    totalAssessments = courseAssessments.length;

    for (const assessment of courseAssessments) {
      const { rows: attempt } = await safeQuery(
        `SELECT MAX(score_pct) as best_score, COUNT(*) FILTER (WHERE passed = true) as passed
         FROM training_assessment_attempts
         WHERE assignment_id = $1 AND assessment_id = $2`,
        [assignmentId, assessment.id]
      );
      if (attempt[0].best_score !== null) {
        sumScores += parseFloat(attempt[0].best_score);
        scoreCount++;
      }
      completedAssessments += parseInt(attempt[0].passed || 0);
      passedAssessments += parseInt(attempt[0].passed || 0);
    }

    const progressPct = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;
    const avgScore = scoreCount > 0 ? sumScores / scoreCount : null;

    await safeQuery(
      `INSERT INTO training_progress (assignment_id, course_id, progress_pct, lessons_total, lessons_completed, assessments_total, assessments_completed, assessments_passed, average_score_pct, last_activity_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
       ON CONFLICT (assignment_id, course_id) DO UPDATE SET
         progress_pct = EXCLUDED.progress_pct,
         lessons_total = EXCLUDED.lessons_total,
         lessons_completed = EXCLUDED.lessons_completed,
         assessments_total = EXCLUDED.assessments_total,
         assessments_completed = EXCLUDED.assessments_completed,
         assessments_passed = EXCLUDED.assessments_passed,
         average_score_pct = EXCLUDED.average_score_pct,
         last_activity_at = EXCLUDED.last_activity_at,
         completed_at = CASE WHEN EXCLUDED.progress_pct >= 100 AND training_progress.completed_at IS NULL THEN NOW() ELSE training_progress.completed_at END`,
      [assignmentId, a.course_id, progressPct, totalLessons, completedLessons, totalAssessments, completedAssessments, passedAssessments, avgScore]
    );
  }
}

async function checkAndIssueCertificate(assignmentId) {
  const { rows: assignment } = await safeQuery(
    `SELECT * FROM training_assignments WHERE id = $1`,
    [assignmentId]
  );
  if (!assignment.length) return;

  const a = assignment[0];
  if (!a.programme_id || a.status !== 'completed') return;

  const { rows: existing } = await safeQuery(
    `SELECT id FROM training_certificates WHERE assignment_id = $1`,
    [assignmentId]
  );
  if (existing.length) return;

  const { rows: programme } = await safeQuery(
    `SELECT * FROM training_programmes WHERE id = $1`,
    [a.programme_id]
  );
  if (!programme.length) return;

  const p = programme[0];
  if (!p.certificate_template_id) return;

  const { rows: employee } = await safeQuery(
    `SELECT * FROM employees WHERE id = $1`,
    [a.employee_id]
  );
  if (!employee.length) return;

  const certNumber = generateCertificateNumber();
  const { rows: [cert] } = await safeQuery(
    `INSERT INTO training_certificates (certificate_number, assignment_id, programme_id, employee_id, programme_version, issued_by, status)
     VALUES ($1,$2,$3,$4,$5,$6,'issued') RETURNING *`,
    [certNumber, assignmentId, a.programme_id, a.employee_id, p.version, a.assigned_by]
  );

  await logTrainingAction({
    staffId: a.assigned_by,
    action: ACTIONS.CERTIFICATE_ISSUED,
    entityType: ENTITY_TYPES.CERTIFICATE,
    entityId: cert.id,
    newValue: { certificate_number: certNumber, employee_id: a.employee_id, programme_id: a.programme_id },
  });

  fireEvent('certificate.issued', {
    certificateId: cert.id,
    certificateNumber: certNumber,
    employeeId: a.employee_id,
    employeeName: employee[0].full_name,
    programmeId: a.programme_id,
    programmeTitle: p.title,
  });

  return cert;
}

module.exports = {
  ENTITY_TYPES,
  ACTIONS,
  createContentVersion,
  logTrainingAction,
  recalculateProgress,
  checkAndIssueCertificate,
  generateCertificateNumber,
};