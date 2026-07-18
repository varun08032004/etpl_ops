'use strict';

const express = require('express');
const router = express.Router();
const { safeQuery } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const { notifyStaff, notifyMany } = require('../services/notifications');

router.use(authenticate);

async function staffIdForEmployee(employeeId) {
  const { rows: [s] } = await safeQuery(`SELECT id FROM staff_accounts WHERE employee_id = $1 AND is_active = true`, [employeeId]);
  return s?.id || null;
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
router.post('/cycles/:id/activate', requireRole('hr'), async (req, res) => {
  try {
    const { rows: [cycle] } = await safeQuery(`UPDATE review_cycles SET status = 'active' WHERE id = $1 RETURNING *`, [req.params.id]);
    if (!cycle) return res.status(404).json({ error: 'Review cycle not found' });

    const { rows: employees } = await safeQuery(`SELECT id, full_name FROM employees WHERE status IN ('active','on_leave','notice_period')`);
    const staffIdsToNotify = [];
    for (const emp of employees) {
      const { rows: [review] } = await safeQuery(
        `INSERT INTO performance_reviews (review_cycle_id, employee_id) VALUES ($1,$2)
         ON CONFLICT (review_cycle_id, employee_id) DO NOTHING RETURNING *`,
        [cycle.id, emp.id]
      );
      if (review) {
        const sid = await staffIdForEmployee(emp.id);
        if (sid) staffIdsToNotify.push(sid);
      }
    }
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
    await safeQuery(
      `UPDATE performance_reviews SET final_rating = COALESCE(final_rating, manager_rating), status = 'closed'
       WHERE review_cycle_id = $1`,
      [req.params.id]
    );
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
    const { rows: [existing] } = await safeQuery(`SELECT employee_id FROM performance_reviews WHERE id = $1`, [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Review not found' });

    const { rows: [emp] } = await safeQuery(`SELECT manager_id, full_name FROM employees WHERE id = $1`, [existing.employee_id]);
    const isManager = req.staff.employee_id === emp?.manager_id;
    if (!isManager && !['owner', 'admin', 'hr'].includes(req.staff.role)) {
      return res.status(403).json({ error: "Only this employee's manager (or HR/Admin/Founder) can submit the manager assessment" });
    }

    const { rows: [review] } = await safeQuery(
      `UPDATE performance_reviews SET manager_assessment = $1, manager_rating = $2, submitted_manager_at = NOW(),
         status = 'pending_acknowledgement'
       WHERE id = $3 RETURNING *`,
      [manager_assessment || null, manager_rating || null, req.params.id]
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

module.exports = router;