'use strict';

const { safeQuery, withTransaction } = require('../../db/pool');
const { logAction } = require('../auditLog');
const { fireEvent } = require('../automationEngine');

const hrTools = [
  {
    name: 'list_job_postings',
    description: 'List job postings',
    category: 'hr',
    readOnly: true,
    requiresConfirmation: false,
    allowedRoles: ['hr'],
    allowedDepartments: [],
    parameters: {
      status: { type: 'string', required: false },
    },
    execute: async (params, user) => {
      const queryParams = [];
      let where = '';
      if (params.status) { queryParams.push(params.status); where = `WHERE jp.status = $1`; }
      const { rows } = await safeQuery(
        `SELECT jp.*, d.name AS department_name, t.name AS team_name, COUNT(ja.id) AS applicant_count
         FROM job_postings jp
         LEFT JOIN departments d ON d.id = jp.department_id
         LEFT JOIN teams t ON t.id = jp.team_id
         LEFT JOIN job_applications ja ON ja.job_posting_id = jp.id
         ${where}
         GROUP BY jp.id, d.name, t.name
         ORDER BY jp.created_at DESC`,
        queryParams
      );
      return { jobs: rows.map((r) => ({ ...r, applicant_count: Number(r.applicant_count) })) };
    },
  },

  {
    name: 'create_job_posting',
    description: 'Create a new job posting',
    category: 'hr',
    readOnly: false,
    requiresConfirmation: false,
    destructive: false,
    allowedRoles: ['hr'],
    allowedDepartments: [],
    parameters: {
      title: { type: 'string', required: true },
      department_id: { type: 'string', required: false },
      team_id: { type: 'string', required: false },
      employment_type: { type: 'string', required: false, enum: ['full_time', 'part_time', 'contract', 'intern'] },
      description: { type: 'string', required: false },
      location: { type: 'string', required: false },
      experience_min_years: { type: 'integer', required: false },
      experience_max_years: { type: 'integer', required: false },
      salary_range_min: { type: 'number', required: false },
      salary_range_max: { type: 'number', required: false },
      openings_count: { type: 'integer', required: false },
      external_links: { type: 'object', required: false },
    },
    execute: async (params, user) => {
      const { rows: [job] } = await safeQuery(
        `INSERT INTO job_postings (title, department_id, team_id, employment_type, description, location,
           experience_min_years, experience_max_years, salary_range_min, salary_range_max, openings_count,
           external_links, posted_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
        [
          params.title, params.department_id || null, params.team_id || null, params.employment_type || 'full_time',
          params.description || null, params.location || null,
          params.experience_min_years || null, params.experience_max_years || null,
          params.salary_range_min || null, params.salary_range_max || null, params.openings_count || 1,
          params.external_links ? JSON.stringify(params.external_links) : null, user.staff.id,
        ]
      );
      return { job, message: `Job posting "${job.title}" created` };
    },
  },

  {
    name: 'list_candidates',
    description: 'List candidates',
    category: 'hr',
    readOnly: true,
    requiresConfirmation: false,
    allowedRoles: ['hr'],
    allowedDepartments: [],
    parameters: {
      search: { type: 'string', required: false },
    },
    execute: async (params, user) => {
      const queryParams = [];
      let where = '';
      if (params.search) { queryParams.push(`%${params.search}%`); where = `WHERE full_name ILIKE $1 OR email ILIKE $1`; }
      const { rows } = await safeQuery(`SELECT * FROM candidates ${where} ORDER BY created_at DESC`, queryParams);
      return { candidates: rows };
    },
  },

  {
    name: 'create_candidate',
    description: 'Create a new candidate',
    category: 'hr',
    readOnly: false,
    requiresConfirmation: false,
    destructive: false,
    allowedRoles: ['hr'],
    allowedDepartments: [],
    parameters: {
      full_name: { type: 'string', required: true },
      email: { type: 'string', required: false },
      phone: { type: 'string', required: false },
      source: { type: 'string', required: false },
      current_company: { type: 'string', required: false },
      current_designation: { type: 'string', required: false },
      total_experience_years: { type: 'number', required: false },
      expected_ctc: { type: 'number', required: false },
      notice_period_days: { type: 'integer', required: false },
      notes: { type: 'string', required: false },
    },
    execute: async (params, user) => {
      const { rows: [candidate] } = await safeQuery(
        `INSERT INTO candidates (full_name, email, phone, source, current_company, current_designation,
           total_experience_years, expected_ctc, notice_period_days, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [
          params.full_name, params.email || null, params.phone || null, params.source || 'other',
          params.current_company || null, params.current_designation || null,
          params.total_experience_years || null, params.expected_ctc || null, params.notice_period_days || null, params.notes || null,
        ]
      );
      return { candidate, message: `Candidate ${candidate.full_name} created` };
    },
  },

  {
    name: 'create_application',
    description: 'Apply a candidate to a job posting',
    category: 'hr',
    readOnly: false,
    requiresConfirmation: false,
    destructive: false,
    allowedRoles: ['hr'],
    allowedDepartments: [],
    parameters: {
      job_posting_id: { type: 'string', required: true },
      candidate_id: { type: 'string', required: false },
      candidate: { type: 'object', required: false, description: 'Candidate object if creating new' },
    },
    execute: async (params, user) => {
      let candidateId = params.candidate_id;
      if (!candidateId && params.candidate?.full_name) {
        const { rows: [newCandidate] } = await safeQuery(
          `INSERT INTO candidates (full_name, email, phone, source, current_company, current_designation,
             total_experience_years, expected_ctc, notice_period_days)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
          [
            params.candidate.full_name, params.candidate.email || null, params.candidate.phone || null, params.candidate.source || 'other',
            params.candidate.current_company || null, params.candidate.current_designation || null,
            params.candidate.total_experience_years || null, params.candidate.expected_ctc || null, params.candidate.notice_period_days || null,
          ]
        );
        candidateId = newCandidate.id;
      }
      if (!candidateId) throw new Error('candidate_id or candidate object required');

      const { rows: [application] } = await safeQuery(
        `INSERT INTO job_applications (job_posting_id, candidate_id) VALUES ($1,$2) RETURNING *`,
        [params.job_posting_id, candidateId]
      );
      return { application, message: 'Application created' };
    },
  },

  {
    name: 'move_application_stage',
    description: 'Move candidate through pipeline',
    category: 'hr',
    readOnly: false,
    requiresConfirmation: false,
    destructive: false,
    allowedRoles: ['hr'],
    allowedDepartments: [],
    parameters: {
      application_id: { type: 'string', required: true },
      stage: { type: 'string', required: true, enum: ['applied', 'screening', 'interview', 'offer', 'hired', 'rejected'] },
      rejection_reason: { type: 'string', required: false },
    },
    execute: async (params, user) => {
      const VALID_STAGES = ['applied', 'screening', 'interview', 'offer', 'hired', 'rejected'];
      if (!VALID_STAGES.includes(params.stage)) throw new Error(`stage must be one of ${VALID_STAGES.join(', ')}`);
      if (params.stage === 'hired') throw new Error('Use hire_candidate tool to mark hired');

      const { rows } = await safeQuery(
        `UPDATE job_applications SET stage = $1, rejection_reason = $2, stage_updated_at = NOW() WHERE id = $3 RETURNING *`,
        [params.stage, params.stage === 'rejected' ? (params.rejection_reason || null) : null, params.application_id]
      );
      if (!rows.length) throw new Error('Application not found');
      return { application: rows[0] };
    },
  },

  {
    name: 'hire_candidate',
    description: 'Convert candidate to employee',
    category: 'hr',
    readOnly: false,
    requiresConfirmation: true,
    destructive: false,
    allowedRoles: ['hr'],
    allowedDepartments: [],
    parameters: {
      application_id: { type: 'string', required: true },
      date_of_joining: { type: 'string', required: true, description: 'YYYY-MM-DD' },
    },
    execute: async (params, user) => {
      const { rows: [app] } = await safeQuery(
        `SELECT ja.*, c.full_name, c.email, c.phone, jp.department_id, jp.team_id, jp.id AS job_id, jp.filled_count, jp.openings_count
         FROM job_applications ja
         JOIN candidates c ON c.id = ja.candidate_id
         JOIN job_postings jp ON jp.id = ja.job_posting_id
         WHERE ja.id = $1`,
        [params.application_id]
      );
      if (!app) throw new Error('Application not found');
      if (app.hired_employee_id) throw new Error('Already hired');

      const { rows: [{ next_code }] } = await safeQuery(
        `SELECT 'ET-EMP-' || LPAD((COALESCE(MAX(SUBSTRING(employee_code FROM '\\d+$')::int), 0) + 1)::text, 4, '0') AS next_code FROM employees`
      );

      const { rows: [employee] } = await safeQuery(
        `INSERT INTO employees (employee_code, full_name, personal_email, work_email, phone, department_id, team_id, employment_type, date_of_joining)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'full_time',$8) RETURNING *`,
        [next_code, app.full_name, app.email || null, app.email || null, app.phone || null, app.department_id, app.team_id, params.date_of_joining]
      );

      await safeQuery(
        `UPDATE job_applications SET stage = 'hired', stage_updated_at = NOW(), hired_employee_id = $1 WHERE id = $2`,
        [employee.id, params.application_id]
      );

      const newFilledCount = app.filled_count + 1;
      await safeQuery(
        `UPDATE job_postings SET filled_count = $1, status = CASE WHEN $1 >= openings_count THEN 'filled' ELSE status END WHERE id = $2`,
        [newFilledCount, app.job_id]
      );

      await logAction({ staffId: user.staff.id, action: 'candidate.hired', entity: 'employees', entityId: employee.id, newValue: { full_name: employee.full_name, from_job: app.job_id } });
      return { employee, message: `Candidate converted to employee — finish profile via Edit` };
    },
  },

  {
    name: 'manage_interviews',
    description: 'Schedule or update interviews for an application',
    category: 'hr',
    readOnly: false,
    requiresConfirmation: false,
    destructive: false,
    allowedRoles: ['hr'],
    allowedDepartments: [],
    parameters: {
      application_id: { type: 'string', required: true },
      round_name: { type: 'string', required: true },
      scheduled_at: { type: 'string', required: false, description: 'ISO timestamp' },
      interviewer_employee_id: { type: 'string', required: false },
      mode: { type: 'string', required: false, enum: ['video', 'in_person', 'phone'] },
      status: { type: 'string', required: false },
      feedback: { type: 'string', required: false },
      rating: { type: 'integer', required: false },
    },
    execute: async (params, user) => {
      const { application_id, ...updates } = params;
      if (!updates.round_name && Object.keys(updates).length === 0) throw new Error('round_name required for create, or provide fields to update');

      if (!updates.scheduled_at) {
        // Create new interview
        const { rows: [interview] } = await safeQuery(
          `INSERT INTO interviews (job_application_id, round_name, scheduled_at, interviewer_employee_id, mode)
           VALUES ($1,$2,$3,$4,$5) RETURNING *`,
          [application_id, updates.round_name, updates.scheduled_at || null, updates.interviewer_employee_id || null, updates.mode || 'video']
        );
        // Notify interviewer
        if (interview.interviewer_employee_id) {
          const { rows: [staffAcct] } = await safeQuery(`SELECT id FROM staff_accounts WHERE employee_id = $1 AND is_active = true`, [interview.interviewer_employee_id]);
          if (staffAcct) {
            await fireEvent({
              staffId: staffAcct.id, type: 'interview.scheduled',
              title: `Interview scheduled: ${interview.round_name}`,
              body: interview.scheduled_at ? `At ${new Date(interview.scheduled_at).toLocaleString()}` : 'Time TBD',
              link: `/recruitment/applications/${application_id}`,
            });
          }
        }
        return { interview, message: 'Interview scheduled' };
      } else {
        // Update existing - need interview_id in params
        throw new Error('To update interview, provide interview_id (not implemented in this tool)');
      }
    },
  },
];

module.exports = hrTools;