'use strict';

const express = require('express');
const router = express.Router();
const { safeQuery } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const { notifyStaff, notifyMany } = require('../services/notifications');
const { getRules, summarizeProductivity, computeProductivityScore } = require('../services/productivity');
const { canViewAllMonitoring } = require('../services/monitoringAccess');

router.use(authenticate);

async function staffIdForEmployee(employeeId) {
  const { rows: [s] } = await safeQuery(`SELECT id FROM staff_accounts WHERE employee_id = $1 AND is_active = true`, [employeeId]);
  return s?.id || null;
}

// Fetch monitoring scores for a review cycle period
async function fetchMonitoringScoresForCycle(cycleId, employeeIds) {
  const { rows: [cycle] } = await safeQuery(`SELECT start_date, end_date FROM review_cycles WHERE id = $1`, [cycleId]);
  if (!cycle) return {};

  const { rows: sessionRows } = await safeQuery(
    `SELECT employee_id, 
      SUM(active_seconds)::int AS active_seconds, 
      SUM(idle_seconds)::int AS idle_seconds, 
      COUNT(DISTINCT work_date)::int AS days_tracked,
      jsonb_object_agg(work_mode, cnt) as work_mode_distribution,
      AVG(CASE WHEN work_mode = 'office' THEN 1 ELSE 0 END) as office_pct
    FROM agent_sessions 
    WHERE employee_id = ANY($1) AND work_date BETWEEN $2 AND $3
    GROUP BY employee_id`,
    [employeeIds, cycle.start_date, cycle.end_date]
  );

  const { rows: appRows } = await safeQuery(
    `SELECT s.employee_id, a.app_name, SUM(a.duration_seconds)::int AS duration_seconds
     FROM app_usage_segments a JOIN agent_sessions s ON s.id = a.session_id
     WHERE s.employee_id = ANY($1) AND s.work_date BETWEEN $2 AND $3
     GROUP BY s.employee_id, a.app_name`,
    [employeeIds, cycle.start_date, cycle.end_date]
  );

  const { rows: siteRows } = await safeQuery(
    `SELECT s.employee_id, w.domain, SUM(w.duration_seconds)::int AS duration_seconds
     FROM website_usage_segments w JOIN agent_sessions s ON s.id = w.session_id
     WHERE s.employee_id = ANY($1) AND s.work_date BETWEEN $2 AND $3
     GROUP BY s.employee_id, w.domain`,
    [employeeIds, cycle.start_date, cycle.end_date]
  );

  const rules = await getRules();
  const { rows: [settings] } = await safeQuery(`SELECT expected_daily_hours FROM monitoring_settings WHERE id = 1`);

  const appsByEmployee = new Map();
  for (const row of appRows) {
    if (!appsByEmployee.has(row.employee_id)) appsByEmployee.set(row.employee_id, []);
    appsByEmployee.get(row.employee_id).push(row);
  }
  const sitesByEmployee = new Map();
  for (const row of siteRows) {
    if (!sitesByEmployee.has(row.employee_id)) sitesByEmployee.set(row.employee_id, []);
    sitesByEmployee.get(row.employee_id).push(row);
  }

  const scores = {};
  for (const s of sessionRows) {
    const productivity = summarizeProductivity(rules, appsByEmployee.get(s.employee_id) || [], sitesByEmployee.get(s.employee_id) || []);
    const expectedHoursForPeriod = (settings?.expected_daily_hours || 8) * Math.max(s.days_tracked, 1);
    const score = computeProductivityScore({
      totals: productivity.totals, activeSeconds: s.active_seconds, idleSeconds: s.idle_seconds,
      expectedDailyHours: expectedHoursForPeriod,
    });
    
    // Add work mode info
    score.work_mode_distribution = s.work_mode_distribution || {};
    score.office_pct = Math.round((s.office_pct || 0) * 100);
    score.work_mode = s.office_pct > 0.5 ? 'office' : (s.office_pct < 0.1 ? 'wfh' : 'hybrid');
    
    scores[s.employee_id] = score;
  }
  return scores;
}

// Compute goals completion percentage for an employee in a cycle
async function computeGoalsCompletion(employeeId, cycleId) {
  const { rows: goals } = await safeQuery(
    `SELECT weight_percent, progress_percent, status FROM goals WHERE employee_id = $1 AND review_cycle_id = $2`,
    [employeeId, cycleId]
  );
  if (goals.length === 0) return 100; // No goals = 100% completion
  
  let totalWeight = 0;
  let weightedProgress = 0;
  for (const g of goals) {
    const weight = g.weight_percent || 1;
    totalWeight += weight;
    const progress = g.progress_percent || (g.status === 'completed' ? 100 : 0);
    weightedProgress += weight * progress;
  }
  return totalWeight > 0 ? Math.round(weightedProgress / totalWeight) : 100;
}

// Compute composite score: 30% monitoring + 50% manager_rating + 20% goals
function computeCompositeScore({ monitoringScore, managerRating, goalsCompletion }) {
  const monitoring = monitoringScore?.score || 0;
  const manager = (managerRating || 0) * 20; // Convert 1-5 to 0-100
  const goals = goalsCompletion || 0;
  
  return Math.round(0.30 * monitoring + 0.50 * manager + 0.20 * goals);
}

// Create anomaly flags from heartbeat_anomaly_log + monitoring scores
async function createAnomalyFlags(cycleId) {
  // 1. Heartbeat anomalies
  const { rows: anomalies } = await safeQuery(`
    SELECT DISTINCT ON (employee_id, anomaly_type) 
      employee_id, anomaly_type, severity, details, created_at
    FROM heartbeat_anomaly_log
    WHERE anomaly_type IN ('impossible_travel', 'fingerprint_mismatch', 'ip_mismatch', 'screenshot_hash_mismatch', 'extension_missing', 'config_tamper')
      AND severity IN ('warning', 'critical')
      AND created_at > NOW() - INTERVAL '90 days'
  `);
  
  for (const a of anomalies) {
    await safeQuery(`
      UPDATE performance_reviews 
      SET monitoring_flags = jsonb_set(
        COALESCE(monitoring_flags, '[]'), 
        '{0}', 
        to_jsonb(
          (COALESCE(monitoring_flags, '[]')::jsonb || jsonb_build_object(
            'type', $2, 'severity', $3, 'details', $4, 'date', $5
          ))::jsonb
        )
      )
      WHERE review_cycle_id = $1 AND employee_id = $6
    `, [cycleId, a.anomaly_type, a.severity, a.details, a.created_at, a.employee_id]);
  }

  // 2. Low focus score flag (focus_score < 40)
  const { rows: lowFocus } = await safeQuery(`
    SELECT pr.employee_id, pr.monitoring_score
    FROM performance_reviews pr
    JOIN review_cycles rc ON rc.id = pr.review_cycle_id
    WHERE pr.review_cycle_id = $1
      AND pr.monitoring_score IS NOT NULL
      AND (pr.monitoring_score->'breakdown'->>'focus')::int < 40
  `, [cycleId]);

  for (const lf of lowFocus) {
    const focusScore = (lf.monitoring_score?.breakdown?.focus) || 0;
    await safeQuery(`
      UPDATE performance_reviews 
      SET monitoring_flags = jsonb_set(
        COALESCE(monitoring_flags, '[]'), 
        '{0}', 
        to_jsonb(
          (COALESCE(monitoring_flags, '[]')::jsonb || jsonb_build_object(
            'type', 'low_focus_score',
            'severity', 'warning',
            'details', jsonb_build_object('focus_score', $2),
            'date', NOW()
          ))::jsonb
        )
      )
      WHERE review_cycle_id = $1 AND employee_id = $3
    `, [cycleId, focusScore, lf.employee_id]);
  }

  // 3. VM detected flag
  const { rows: vmDetected } = await safeQuery(`
    SELECT DISTINCT s.employee_id
    FROM agent_sessions s
    JOIN performance_reviews pr ON pr.employee_id = s.employee_id
    WHERE pr.review_cycle_id = $1
      AND s.work_date BETWEEN (SELECT start_date FROM review_cycles WHERE id = $1) AND (SELECT end_date FROM review_cycles WHERE id = $1)
      AND s.vm_detected = true
  `, [cycleId]);

  for (const vm of vmDetected) {
    await safeQuery(`
      UPDATE performance_reviews 
      SET monitoring_flags = jsonb_set(
        COALESCE(monitoring_flags, '[]'), 
        '{0}', 
        to_jsonb(
          (COALESCE(monitoring_flags, '[]')::jsonb || jsonb_build_object(
            'type', 'vm_detected',
            'severity', 'critical',
            'details', jsonb_build_object({}),
            'date', NOW()
          ))::jsonb
        )
      )
      WHERE review_cycle_id = $1 AND employee_id = $2
    `, [cycleId, vm.employee_id]);
  }
}

// ═══════════════════════ REVIEW CYCLES ═══════════════════════

router.get('/cycles', async (req, res) => {
  try {
    const { rows } = await safeQuery(`SELECT * FROM review_cycles ORDER BY start_date DESC`);
    res.json({ cycles: rows });
  } catch (err) {
    console.error('[performance:cycles:list]', err);
    res.status(500).json({ error: 'Failed to fetch review cycles' });
  }
});

router.post('/cycles', requireRole('hr'), async (req, res) => {
  try {
    const { name, start_date, end_date } = req.body;
    if (!name || !start_date || !end_date) return res.status(400).json({ error: 'name, start_date, end_date are required' });
    const { rows: [cycle] } = await safeQuery(
      `INSERT INTO review_cycles (name, start_date, end_date) VALUES ($1,$2,$3) RETURNING *`,
      [name, start_date, end_date]
    );
    res.status(201).json({ cycle });
  } catch (err) {
    console.error('[performance:cycles:create]', err);
    res.status(500).json({ error: 'Failed to create review cycle' });
  }
});

// Activating a cycle opens a performance_reviews row for every active
// employee, so both employee and manager immediately see something to fill
// in — nobody has to remember to "start" their own review.
// Also fetches monitoring scores and populates monitoring_score + composite_score.
router.post('/cycles/:id/activate', requireRole('hr'), async (req, res) => {
  try {
    const { rows: [cycle] } = await safeQuery(`UPDATE review_cycles SET status = 'active' WHERE id = $1 RETURNING *`, [req.params.id]);
    if (!cycle) return res.status(404).json({ error: 'Review cycle not found' });

    const { rows: employees } = await safeQuery(`SELECT id, full_name FROM employees WHERE status IN ('active','on_leave','notice_period')`);
    const employeeIds = employees.map(e => e.id);
    const staffIdsToNotify = [];

    // Fetch monitoring scores for all employees in this cycle
    const monitoringScores = await fetchMonitoringScoresForCycle(cycle.id, employeeIds);

    for (const emp of employees) {
      const monitoringScore = monitoringScores[emp.id] || {};
      const goalsCompletion = await computeGoalsCompletion(emp.id, cycle.id);
      const compositeScore = computeCompositeScore({ 
        monitoringScore, 
        managerRating: null, // Not set yet
        goalsCompletion 
      });

      const { rows: [review] } = await safeQuery(
        `INSERT INTO performance_reviews (review_cycle_id, employee_id, monitoring_score, composite_score, goals_completion_pct)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (review_cycle_id, employee_id) DO UPDATE SET
           monitoring_score = EXCLUDED.monitoring_score,
           composite_score = EXCLUDED.composite_score,
           goals_completion_pct = EXCLUDED.goals_completion_pct
         RETURNING *`,
        [cycle.id, emp.id, JSON.stringify(monitoringScore), compositeScore, goalsCompletion]
      );
      if (review) {
        const sid = await staffIdForEmployee(emp.id);
        if (sid) staffIdsToNotify.push(sid);
      }
    }

    // Create anomaly flags from heartbeat_anomaly_log
    await createAnomalyFlags(cycle.id);

    await notifyMany(staffIdsToNotify, {
      type: 'review_cycle.activated', title: `"${cycle.name}" review cycle is open`,
      body: 'Submit your self-assessment when ready.', link: '/performance',
    });

    res.json({ cycle, initializedReviews: staffIdsToNotify.length });
  } catch (err) {
    console.error('[performance:cycles:activate]', err);
    res.status(500).json({ error: 'Failed to activate review cycle' });
  }
});

router.post('/cycles/:id/close', requireRole('hr'), async (req, res) => {
  try {
    // Closing finalizes ratings: final_rating defaults to manager_rating wherever it wasn't explicitly set.
    // Also recalculate composite scores with final ratings
    const { rows: reviews } = await safeQuery(
      `SELECT id, employee_id, manager_rating, monitoring_score, goals_completion_pct FROM performance_reviews WHERE review_cycle_id = $1`,
      [req.params.id]
    );

    for (const r of reviews) {
      const monitoringScore = r.monitoring_score || {};
      const compositeScore = computeCompositeScore({
        monitoringScore,
        managerRating: r.manager_rating,
        goalsCompletion: r.goals_completion_pct
      });
      await safeQuery(
        `UPDATE performance_reviews SET 
           final_rating = COALESCE(final_rating, manager_rating),
           composite_score = $2,
           status = 'closed'
         WHERE id = $1`,
        [r.id, compositeScore]
      );
    }

    const { rows: [cycle] } = await safeQuery(`UPDATE review_cycles SET status = 'closed' WHERE id = $1 RETURNING *`, [req.params.id]);
    if (!cycle) return res.status(404).json({ error: 'Review cycle not found' });
    res.json({ cycle });
  } catch (err) {
    console.error('[performance:cycles:close]', err);
    res.status(500).json({ error: 'Failed to close review cycle' });
  }
});

// ═══════════════════════ GOALS ═══════════════════════

router.get('/goals', async (req, res) => {
  try {
    const { employee_id, review_cycle_id } = req.query;
    const conditions = [];
    const params = [];
    if (employee_id) { params.push(employee_id); conditions.push(`employee_id = $${params.length}`); }
    if (review_cycle_id) { params.push(review_cycle_id); conditions.push(`review_cycle_id = $${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await safeQuery(`SELECT * FROM goals ${where} ORDER BY created_at DESC`, params);
    res.json({ goals: rows });
  } catch (err) {
    console.error('[performance:goals:list]', err);
    res.status(500).json({ error: 'Failed to fetch goals' });
  }
});

// Either the employee themself, their manager, or hr/admin/owner can set goals.
router.post('/goals', async (req, res) => {
  try {
    const { employee_id, review_cycle_id, title, description, weight_percent } = req.body;
    if (!employee_id || !title) return res.status(400).json({ error: 'employee_id and title are required' });

    const isSelf = req.staff.employee_id === employee_id;
    if (!isSelf && !['owner', 'admin', 'hr', 'manager'].includes(req.staff.role)) {
      return res.status(403).json({ error: 'Not authorized to set goals for this employee' });
    }

    const { rows: [goal] } = await safeQuery(
      `INSERT INTO goals (employee_id, review_cycle_id, title, description, weight_percent) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [employee_id, review_cycle_id || null, title, description || null, weight_percent || 0]
    );
    res.status(201).json({ goal });
  } catch (err) {
    console.error('[performance:goals:create]', err);
    res.status(500).json({ error: 'Failed to create goal' });
  }
});

router.put('/goals/:id', async (req, res) => {
  try {
    const { rows: [existing] } = await safeQuery(`SELECT employee_id FROM goals WHERE id = $1`, [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Goal not found' });

    const isSelf = req.staff.employee_id === existing.employee_id;
    if (!isSelf && !['owner', 'admin', 'hr', 'manager'].includes(req.staff.role)) {
      return res.status(403).json({ error: 'Not authorized to update this goal' });
    }

    const allowed = ['title', 'description', 'weight_percent', 'status', 'progress_percent'];
    const sets = [];
    const params = [];
    for (const key of allowed) {
      if (key in req.body) { params.push(req.body[key]); sets.push(`${key} = $${params.length}`); }
    }
    if (!sets.length) return res.status(400).json({ error: 'No valid fields to update' });
    sets.push(`updated_at = NOW()`);
    params.push(req.params.id);

    const { rows } = await safeQuery(`UPDATE goals SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params);
    res.json({ goal: rows[0] });
  } catch (err) {
    console.error('[performance:goals:update]', err);
    res.status(500).json({ error: 'Failed to update goal' });
  }
});

// ═══════════════════════ REVIEWS ═══════════════════════

router.get('/reviews', async (req, res) => {
  try {
    const { employee_id, review_cycle_id } = req.query;
    const conditions = [];
    const params = [];
    if (employee_id) { params.push(employee_id); conditions.push(`pr.employee_id = $${params.length}`); }
    if (review_cycle_id) { params.push(review_cycle_id); conditions.push(`pr.review_cycle_id = $${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await safeQuery(
      `SELECT pr.*, e.full_name, e.manager_id, rc.name AS cycle_name
       FROM performance_reviews pr
       JOIN employees e ON e.id = pr.employee_id
       JOIN review_cycles rc ON rc.id = pr.review_cycle_id
       ${where} ORDER BY pr.created_at DESC`,
      params
    );
    res.json({ reviews: rows });
  } catch (err) {
    console.error('[performance:reviews:list]', err);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

router.get('/reviews/:id', async (req, res) => {
  try {
    const { rows: [review] } = await safeQuery(
      `SELECT pr.*, e.full_name, e.manager_id, rc.name AS cycle_name
       FROM performance_reviews pr JOIN employees e ON e.id = pr.employee_id JOIN review_cycles rc ON rc.id = pr.review_cycle_id
       WHERE pr.id = $1`,
      [req.params.id]
    );
    if (!review) return res.status(404).json({ error: 'Review not found' });
    res.json({ review });
  } catch (err) {
    console.error('[performance:reviews:get]', err);
    res.status(500).json({ error: 'Failed to fetch review' });
  }
});

// Employee submits their own self-assessment.
router.put('/reviews/:id/self', async (req, res) => {
  try {
    const { self_assessment, self_rating } = req.body;
    const { rows: [existing] } = await safeQuery(`SELECT employee_id FROM performance_reviews WHERE id = $1`, [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Review not found' });
    if (req.staff.employee_id !== existing.employee_id) return res.status(403).json({ error: 'You can only submit your own self-assessment' });

    const { rows: [review] } = await safeQuery(
      `UPDATE performance_reviews SET self_assessment = $1, self_rating = $2, submitted_self_at = NOW(),
         status = CASE WHEN status = 'pending_self' THEN 'pending_manager' ELSE status END
       WHERE id = $3 RETURNING *`,
      [self_assessment || null, self_rating || null, req.params.id]
    );

    // Notify the manager it's their turn.
    const { rows: [emp] } = await safeQuery(`SELECT manager_id, full_name FROM employees WHERE id = $1`, [existing.employee_id]);
    if (emp?.manager_id) {
      const managerStaffId = await staffIdForEmployee(emp.manager_id);
      if (managerStaffId) {
        await notifyStaff({
          staffId: managerStaffId, type: 'review.self_submitted',
          title: `${emp.full_name} submitted their self-assessment`, link: `/performance/reviews/${review.id}`,
        });
      }
    }

    res.json({ review });
  } catch (err) {
    console.error('[performance:reviews:self]', err);
    res.status(500).json({ error: 'Failed to submit self-assessment' });
  }
});

// Manager (or hr/admin/owner) submits their assessment + rating.
router.put('/reviews/:id/manager', async (req, res) => {
  try {
    const { manager_assessment, manager_rating } = req.body;
    const { rows: [existing] } = await safeQuery(`SELECT employee_id, monitoring_score, goals_completion_pct FROM performance_reviews WHERE id = $1`, [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Review not found' });

    const { rows: [emp] } = await safeQuery(`SELECT manager_id, full_name FROM employees WHERE id = $1`, [existing.employee_id]);
    const isManager = req.staff.employee_id === emp?.manager_id;
    if (!isManager && !['owner', 'admin', 'hr'].includes(req.staff.role)) {
      return res.status(403).json({ error: "Only this employee's manager (or HR/Admin/Founder) can submit the manager assessment" });
    }

    const monitoringScore = existing.monitoring_score || {};
    const goalsCompletion = existing.goals_completion_pct || 100;
    const compositeScore = computeCompositeScore({
      monitoringScore,
      managerRating: manager_rating,
      goalsCompletion
    });

    const { rows: [review] } = await safeQuery(
      `UPDATE performance_reviews SET manager_assessment = $1, manager_rating = $2, composite_score = $3, submitted_manager_at = NOW(),
         status = 'pending_acknowledgement'
       WHERE id = $4 RETURNING *`,
      [manager_assessment || null, manager_rating || null, compositeScore, req.params.id]
    );

    const employeeStaffId = await staffIdForEmployee(existing.employee_id);
    if (employeeStaffId) {
      await notifyStaff({
        staffId: employeeStaffId, type: 'review.manager_submitted',
        title: `Your manager submitted their review — please acknowledge`, link: `/performance/reviews/${review.id}`,
      });
    }

    res.json({ review });
  } catch (err) {
    console.error('[performance:reviews:manager]', err);
    res.status(500).json({ error: 'Failed to submit manager assessment' });
  }
});

// Employee acknowledges the final rating — closes the loop, doesn't change the score.
router.post('/reviews/:id/acknowledge', async (req, res) => {
  try {
    const { rows: [existing] } = await safeQuery(`SELECT employee_id FROM performance_reviews WHERE id = $1`, [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Review not found' });
    if (req.staff.employee_id !== existing.employee_id) return res.status(403).json({ error: 'You can only acknowledge your own review' });

    const { rows: [review] } = await safeQuery(
      `UPDATE performance_reviews SET acknowledged_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    res.json({ review });
  } catch (err) {
    console.error('[performance:reviews:acknowledge]', err);
    res.status(500).json({ error: 'Failed to acknowledge review' });
  }
});

// Refresh monitoring scores for a review cycle (HR can call this to update scores)
router.post('/cycles/:id/refresh-monitoring', requireRole('hr'), async (req, res) => {
  try {
    const { rows: [cycle] } = await safeQuery(`SELECT * FROM review_cycles WHERE id = $1`, [req.params.id]);
    if (!cycle) return res.status(404).json({ error: 'Review cycle not found' });

    const { rows: employees } = await safeQuery(`SELECT id FROM employees WHERE status IN ('active','on_leave','notice_period')`);
    const employeeIds = employees.map(e => e.id);

    // Fetch fresh monitoring scores
    const monitoringScores = await fetchMonitoringScoresForCycle(cycle.id, employeeIds);

    let updated = 0;
    for (const emp of employees) {
      const monitoringScore = monitoringScores[emp.id] || {};
      const { rows: [review] } = await safeQuery(
        `SELECT manager_rating, goals_completion_pct FROM performance_reviews WHERE review_cycle_id = $1 AND employee_id = $2`,
        [cycle.id, emp.id]
      );
      if (!review) continue;

      const goalsCompletion = review?.goals_completion_pct || 100;
      const compositeScore = computeCompositeScore({
        monitoringScore,
        managerRating: review?.manager_rating,
        goalsCompletion
      });

      await safeQuery(
        `UPDATE performance_reviews SET monitoring_score = $1, composite_score = $2 WHERE review_cycle_id = $3 AND employee_id = $4`,
        [JSON.stringify(monitoringScore), compositeScore, cycle.id, emp.id]
      );
      updated++;
    }

    // Refresh anomaly flags
    await createAnomalyFlags(cycle.id);

    res.json({ cycle, updatedReviews: updated });
  } catch (err) {
    console.error('[performance:cycles:refresh-monitoring]', err);
    res.status(500).json({ error: 'Failed to refresh monitoring scores' });
  }
});

// Get unified performance + monitoring summary for an employee
router.get('/employee-summary/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { cycle_id } = req.query;

    const isSelf = req.staff.employee_id === employeeId;
    if (!isSelf && !['owner', 'admin', 'hr', 'manager'].includes(req.staff.role)) {
      return res.status(403).json({ error: 'Not authorized to view this summary' });
    }

    // Get employee info
    const { rows: [emp] } = await safeQuery(
      `SELECT e.*, d.name as department, m.full_name as manager_name 
       FROM employees e 
       LEFT JOIN departments d ON d.id = e.department_id 
       LEFT JOIN employees m ON m.id = e.manager_id 
       WHERE e.id = $1`,
      [employeeId]
    );
    if (!emp) return res.status(404).json({ error: 'Employee not found' });

    // Get latest review cycle or specified one
    let cycle;
    if (cycle_id) {
      const { rows } = await safeQuery(`SELECT * FROM review_cycles WHERE id = $1`, [cycle_id]);
      cycle = rows[0];
    } else {
      const { rows } = await safeQuery(`SELECT * FROM review_cycles WHERE status IN ('active','closed') ORDER BY start_date DESC LIMIT 1`);
      cycle = rows[0];
    }

    // Get performance review
    let review = null;
    if (cycle) {
      const { rows } = await safeQuery(
        `SELECT * FROM performance_reviews WHERE review_cycle_id = $1 AND employee_id = $2`,
        [cycle.id, employeeId]
      );
      review = rows[0];
    }

    // Get goals progress
    const goals = cycle ? await safeQuery(
      `SELECT * FROM goals WHERE employee_id = $1 AND review_cycle_id = $2 ORDER BY created_at`,
      [employeeId, cycle.id]
    ) : { rows: [] };

    // Get monitoring data for the cycle period
    let monitoring = null;
    if (cycle) {
      const scores = await fetchMonitoringScoresForCycle(cycle.id, [employeeId]);
      monitoring = scores[employeeId] || null;
    }

    // Get anomalies
    const anomalies = cycle ? await safeQuery(
      `SELECT * FROM heartbeat_anomaly_log 
       WHERE employee_id = $1 AND created_at BETWEEN $2 AND $3
       ORDER BY created_at DESC`,
      [employeeId, cycle.start_date, cycle.end_date]
    ) : { rows: [] };

    // Compute composite if review exists
    let compositeScore = review?.composite_score;
    if (review && !compositeScore && review.manager_rating) {
      const monitoringScore = review.monitoring_score || {};
      const goalsCompletion = review.goals_completion_pct || 100;
      compositeScore = computeCompositeScore({ monitoringScore, managerRating: review.manager_rating, goalsCompletion });
    }

    res.json({ 
      employee: emp, 
      cycle, 
      review, 
      monitoring, 
      goals: goals.rows, 
      anomalies: anomalies.rows,
      compositeScore,
      workMode: monitoring?.work_mode || 'unknown',
      officePct: monitoring?.office_pct || 0
    });
  } catch (err) {
    console.error('[performance:employee-summary]', err);
    res.status(500).json({ error: 'Failed to fetch employee summary' });
  }
});

// WFH vs Office productivity correlation (HR only)
router.get('/productivity-by-location', async (req, res) => {
  try {
    if (!(await canViewAllMonitoring(req.staff))) return res.status(403).json({ error: 'Insufficient permissions' });
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'from and to dates required' });

    const { rows } = await safeQuery(`
      SELECT 
        e.id, e.full_name, e.employee_code, d.name as department,
        COUNT(DISTINCT s.work_date) as days_tracked,
        SUM(s.active_seconds)/3600 as total_hours,
        AVG(CASE WHEN s.work_mode = 'office' THEN 1 ELSE 0 END) as office_pct,
        jsonb_object_agg(s.work_mode, mode_cnt) as work_mode_distribution,
        COALESCE(SUM(CASE WHEN r.category = 'productive' THEN a.duration_seconds ELSE 0 END), 0) as productive_secs,
        COALESCE(SUM(CASE WHEN r.category = 'unproductive' THEN a.duration_seconds ELSE 0 END), 0) as unproductive_secs,
        COALESCE(SUM(a.duration_seconds) + SUM(w.duration_seconds), 0) as total_tracked_secs
      FROM employees e
      JOIN departments d ON d.id = e.department_id
      LEFT JOIN agent_sessions s ON s.employee_id = e.id AND s.work_date BETWEEN $1 AND $2
      LEFT JOIN app_usage_segments a ON a.session_id = s.id
      LEFT JOIN productivity_rules r ON r.match_type = 'app' AND r.pattern = a.app_name
      LEFT JOIN website_usage_segments w ON w.session_id = s.id
      WHERE e.status = 'active'
      GROUP BY e.id, e.full_name, e.employee_code, d.name
      ORDER BY total_hours DESC
    `, [from, to]);

    res.json({ data: rows, period: { from, to } });
  } catch (err) {
    console.error('[performance:productivity-by-location]', err);
    res.status(500).json({ error: 'Failed to fetch productivity by location' });
  }
});

module.exports = router;