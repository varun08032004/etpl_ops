'use strict';

const express = require('express');
const router = express.Router();
const { safeQuery } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const { logAction } = require('../services/auditLog');
const { notifyStaff } = require('../services/notifications');

router.use(authenticate);

// ═══════════════════════ JOB POSTINGS ═══════════════════════

router.get('/jobs', async (req, res) => {
  try {
    const { status } = req.query;
    const params = [];
    let where = '';
    if (status) { params.push(status); where = `WHERE jp.status = $1`; }

    const { rows } = await safeQuery(
      `SELECT jp.*, d.name AS department_name, t.name AS team_name,
              COUNT(ja.id) AS applicant_count
       FROM job_postings jp
       LEFT JOIN departments d ON d.id = jp.department_id
       LEFT JOIN teams t ON t.id = jp.team_id
       LEFT JOIN job_applications ja ON ja.job_posting_id = jp.id
       ${where}
       GROUP BY jp.id, d.name, t.name
       ORDER BY jp.created_at DESC`,
      params
    );
    res.json({ jobs: rows.map((r) => ({ ...r, applicant_count: Number(r.applicant_count) })) });
  } catch (err) {
    console.error('[recruitment:jobs:list]', err);
    res.status(500).json({ error: 'Failed to fetch job postings' });
  }
});

router.get('/jobs/:id', async (req, res) => {
  try {
    const { rows: [job] } = await safeQuery(
      `SELECT jp.*, d.name AS department_name, t.name AS team_name
       FROM job_postings jp LEFT JOIN departments d ON d.id = jp.department_id LEFT JOIN teams t ON t.id = jp.team_id
       WHERE jp.id = $1`,
      [req.params.id]
    );
    if (!job) return res.status(404).json({ error: 'Job posting not found' });

    const { rows: applications } = await safeQuery(
      `SELECT ja.*, c.full_name, c.email, c.phone, c.source, c.current_company, c.expected_ctc, c.notice_period_days
       FROM job_applications ja JOIN candidates c ON c.id = ja.candidate_id
       WHERE ja.job_posting_id = $1 ORDER BY ja.created_at DESC`,
      [req.params.id]
    );
    res.json({ job, applications });
  } catch (err) {
    console.error('[recruitment:jobs:get]', err);
    res.status(500).json({ error: 'Failed to fetch job posting' });
  }
});

// Not gated — opening a requisition isn't destructive.
router.post('/jobs', requireRole('hr'), async (req, res) => {
  try {
    const b = req.body;
    if (!b.title || !b.title.trim()) return res.status(400).json({ error: 'title is required' });

    const { rows: [job] } = await safeQuery(
      `INSERT INTO job_postings (title, department_id, team_id, employment_type, description, location,
         experience_min_years, experience_max_years, salary_range_min, salary_range_max, openings_count,
         external_links, posted_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [
        b.title.trim(), b.department_id || null, b.team_id || null, b.employment_type || 'full_time',
        b.description || null, b.location || null,
        b.experience_min_years || null, b.experience_max_years || null,
        b.salary_range_min || null, b.salary_range_max || null, b.openings_count || 1,
        b.external_links ? JSON.stringify(b.external_links) : null, req.staff.id,
      ]
    );
    res.status(201).json({ job });
  } catch (err) {
    console.error('[recruitment:jobs:create]', err);
    res.status(500).json({ error: 'Failed to create job posting' });
  }
});

router.put('/jobs/:id', requireRole('hr'), async (req, res) => {
  try {
    const allowed = [
      'title', 'department_id', 'team_id', 'employment_type', 'description', 'location',
      'experience_min_years', 'experience_max_years', 'salary_range_min', 'salary_range_max',
      'openings_count', 'status', 'external_links',
    ];
    const sets = [];
    const params = [];
    for (const key of allowed) {
      if (key in req.body) {
        let value = req.body[key];
        if (key === 'external_links' && value) value = JSON.stringify(value);
        if (value === '') value = null;
        params.push(value);
        sets.push(`${key} = $${params.length}`);
      }
    }
    if (!sets.length) return res.status(400).json({ error: 'No valid fields to update' });
    params.push(req.params.id);

    const { rows } = await safeQuery(`UPDATE job_postings SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params);
    if (!rows.length) return res.status(404).json({ error: 'Job posting not found' });
    res.json({ job: rows[0] });
  } catch (err) {
    console.error('[recruitment:jobs:update]', err);
    res.status(500).json({ error: 'Failed to update job posting' });
  }
});

router.post('/jobs/:id/close', requireRole('hr'), async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `UPDATE job_postings SET status = 'closed', closed_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Job posting not found' });
    res.json({ job: rows[0] });
  } catch (err) {
    console.error('[recruitment:jobs:close]', err);
    res.status(500).json({ error: 'Failed to close job posting' });
  }
});

// ═══════════════════════ CANDIDATES ═══════════════════════

router.get('/candidates', async (req, res) => {
  try {
    const { search } = req.query;
    const params = [];
    let where = '';
    if (search) { params.push(`%${search}%`); where = `WHERE full_name ILIKE $1 OR email ILIKE $1`; }
    const { rows } = await safeQuery(`SELECT * FROM candidates ${where} ORDER BY created_at DESC`, params);
    res.json({ candidates: rows });
  } catch (err) {
    console.error('[recruitment:candidates:list]', err);
    res.status(500).json({ error: 'Failed to fetch candidates' });
  }
});

router.post('/candidates', requireRole('hr'), async (req, res) => {
  try {
    const b = req.body;
    if (!b.full_name || !b.full_name.trim()) return res.status(400).json({ error: 'full_name is required' });

    const { rows: [candidate] } = await safeQuery(
      `INSERT INTO candidates (full_name, email, phone, source, current_company, current_designation,
         total_experience_years, expected_ctc, notice_period_days, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        b.full_name.trim(), b.email || null, b.phone || null, b.source || 'other',
        b.current_company || null, b.current_designation || null,
        b.total_experience_years || null, b.expected_ctc || null, b.notice_period_days || null, b.notes || null,
      ]
    );
    res.status(201).json({ candidate });
  } catch (err) {
    console.error('[recruitment:candidates:create]', err);
    res.status(500).json({ error: 'Failed to create candidate' });
  }
});

// Attach resume/documents to a candidate the same way employee documents work:
// POST /documents with entity_type='candidate', entity_id=<candidate id> — reuses your existing documents route.

// ═══════════════════════ APPLICATIONS (pipeline) ═══════════════════════

// Apply an existing (or brand-new) candidate to a job posting in one call.
router.post('/jobs/:id/applications', requireRole('hr'), async (req, res) => {
  try {
    const { candidate_id, candidate } = req.body;
    let candidateId = candidate_id;

    if (!candidateId && candidate?.full_name) {
      const { rows: [newCandidate] } = await safeQuery(
        `INSERT INTO candidates (full_name, email, phone, source, current_company, current_designation,
           total_experience_years, expected_ctc, notice_period_days)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [
          candidate.full_name.trim(), candidate.email || null, candidate.phone || null, candidate.source || 'other',
          candidate.current_company || null, candidate.current_designation || null,
          candidate.total_experience_years || null, candidate.expected_ctc || null, candidate.notice_period_days || null,
        ]
      );
      candidateId = newCandidate.id;
    }
    if (!candidateId) return res.status(400).json({ error: 'candidate_id or a candidate object is required' });

    const { rows: [application] } = await safeQuery(
      `INSERT INTO job_applications (job_posting_id, candidate_id) VALUES ($1,$2) RETURNING *`,
      [req.params.id, candidateId]
    );
    res.status(201).json({ application });
  } catch (err) {
    console.error('[recruitment:applications:create]', err);
    if (err.code === '23505') return res.status(409).json({ error: 'This candidate has already applied to this job' });
    res.status(500).json({ error: 'Failed to add application' });
  }
});

const VALID_STAGES = ['applied', 'screening', 'interview', 'offer', 'hired', 'rejected'];

// Move a candidate through the pipeline. 'hired' is blocked here — must go
// through POST /applications/:id/hire so it actually creates the employee record.
router.put('/applications/:id/stage', requireRole('hr'), async (req, res) => {
  try {
    const { stage, rejection_reason } = req.body;
    if (!VALID_STAGES.includes(stage)) return res.status(400).json({ error: `stage must be one of ${VALID_STAGES.join(', ')}` });
    if (stage === 'hired') return res.status(400).json({ error: 'Use POST /applications/:id/hire to mark a candidate hired' });

    const { rows } = await safeQuery(
      `UPDATE job_applications SET stage = $1, rejection_reason = $2, stage_updated_at = NOW() WHERE id = $3 RETURNING *`,
      [stage, stage === 'rejected' ? (rejection_reason || null) : null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Application not found' });
    res.json({ application: rows[0] });
  } catch (err) {
    console.error('[recruitment:applications:stage]', err);
    res.status(500).json({ error: 'Failed to update stage' });
  }
});

// ── hire — converts the candidate into an actual employee record ──────────
// Creates a minimal employee (name/email/phone/department/designation from
// the job posting + candidate) with status 'active' so HR finishes the rest
// (comp, bank details, DOJ) via the normal Edit flow — same as any new joiner.
router.post('/applications/:id/hire', requireRole('hr'), async (req, res) => {
  try {
    const { date_of_joining } = req.body;
    if (!date_of_joining) return res.status(400).json({ error: 'date_of_joining is required' });

    const { rows: [app] } = await safeQuery(
      `SELECT ja.*, c.full_name, c.email, c.phone, jp.department_id, jp.team_id, jp.id AS job_id, jp.filled_count, jp.openings_count
       FROM job_applications ja
       JOIN candidates c ON c.id = ja.candidate_id
       JOIN job_postings jp ON jp.id = ja.job_posting_id
       WHERE ja.id = $1`,
      [req.params.id]
    );
    if (!app) return res.status(404).json({ error: 'Application not found' });
    if (app.hired_employee_id) return res.status(400).json({ error: 'This application has already been converted to an employee' });

    const { rows: [{ next_code }] } = await safeQuery(
      `SELECT 'ET-EMP-' || LPAD((COALESCE(MAX(SUBSTRING(employee_code FROM '\\d+$')::int), 0) + 1)::text, 4, '0') AS next_code FROM employees`
    );

    const { rows: [employee] } = await safeQuery(
      `INSERT INTO employees (employee_code, full_name, personal_email, work_email, phone, department_id, team_id, employment_type, date_of_joining)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'full_time',$8) RETURNING *`,
      [next_code, app.full_name, app.email || null, app.email || null, app.phone || null, app.department_id, app.team_id, date_of_joining]
    );

    await safeQuery(
      `UPDATE job_applications SET stage = 'hired', stage_updated_at = NOW(), hired_employee_id = $1 WHERE id = $2`,
      [employee.id, req.params.id]
    );

    const newFilledCount = app.filled_count + 1;
    await safeQuery(
      `UPDATE job_postings SET filled_count = $1, status = CASE WHEN $1 >= openings_count THEN 'filled' ELSE status END WHERE id = $2`,
      [newFilledCount, app.job_id]
    );

    await logAction({ staffId: req.staff.id, action: 'candidate.hired', entity: 'employees', entityId: employee.id, newValue: { full_name: employee.full_name, from_job: app.job_id } });

    res.status(201).json({ employee, message: 'Candidate converted to employee — finish their profile (compensation, bank details) via Edit.' });
  } catch (err) {
    console.error('[recruitment:applications:hire]', err);
    res.status(500).json({ error: 'Failed to hire candidate' });
  }
});

// ═══════════════════════ INTERVIEWS ═══════════════════════

router.get('/applications/:id/interviews', async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `SELECT i.*, e.full_name AS interviewer_name FROM interviews i
       LEFT JOIN employees e ON e.id = i.interviewer_employee_id
       WHERE i.job_application_id = $1 ORDER BY i.scheduled_at ASC NULLS LAST`,
      [req.params.id]
    );
    res.json({ interviews: rows });
  } catch (err) {
    console.error('[recruitment:interviews:list]', err);
    res.status(500).json({ error: 'Failed to fetch interviews' });
  }
});

router.post('/applications/:id/interviews', requireRole('hr'), async (req, res) => {
  try {
    const { round_name, scheduled_at, interviewer_employee_id, mode } = req.body;
    if (!round_name) return res.status(400).json({ error: 'round_name is required' });

    const { rows: [interview] } = await safeQuery(
      `INSERT INTO interviews (job_application_id, round_name, scheduled_at, interviewer_employee_id, mode)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.params.id, round_name, scheduled_at || null, interviewer_employee_id || null, mode || 'video']
    );

    // Notify the interviewer if they have a login linked to their employee record.
    if (interviewer_employee_id) {
      const { rows: [staffAcct] } = await safeQuery(`SELECT id FROM staff_accounts WHERE employee_id = $1 AND is_active = true`, [interviewer_employee_id]);
      if (staffAcct) {
        await notifyStaff({
          staffId: staffAcct.id, type: 'interview.scheduled',
          title: `Interview scheduled: ${round_name}`,
          body: scheduled_at ? `At ${new Date(scheduled_at).toLocaleString()}` : 'Time TBD',
          link: `/recruitment/applications/${req.params.id}`,
        });
      }
    }

    res.status(201).json({ interview });
  } catch (err) {
    console.error('[recruitment:interviews:create]', err);
    res.status(500).json({ error: 'Failed to schedule interview' });
  }
});

router.put('/interviews/:id', requireRole('hr'), async (req, res) => {
  try {
    const allowed = ['round_name', 'scheduled_at', 'interviewer_employee_id', 'mode', 'status', 'feedback', 'rating'];
    const sets = [];
    const params = [];
    for (const key of allowed) {
      if (key in req.body) { params.push(req.body[key] === '' ? null : req.body[key]); sets.push(`${key} = $${params.length}`); }
    }
    if (!sets.length) return res.status(400).json({ error: 'No valid fields to update' });
    params.push(req.params.id);
    const { rows } = await safeQuery(`UPDATE interviews SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params);
    if (!rows.length) return res.status(404).json({ error: 'Interview not found' });
    res.json({ interview: rows[0] });
  } catch (err) {
    console.error('[recruitment:interviews:update]', err);
    res.status(500).json({ error: 'Failed to update interview' });
  }
});

module.exports = router;