'use strict';
// routes/partnershipActivities.js — the call log per firm (cold calls,
// follow-ups, meetings) plus GET /due, which powers "My Follow-ups Today":
// one row per firm showing only its MOST RECENT activity's follow-up date,
// so a firm doesn't show up twice just because it has old logged calls.

const express = require('express');
const router = express.Router();
const { safeQuery } = require('../db/pool');
const { authenticate, requireDepartmentHead } = require('../middleware/auth');
const { logAction } = require('../services/auditLog');

router.use(authenticate);

const PARTNERSHIPS_DEPARTMENT_NAME = 'Partnerships';
function requirePartnershipsOrAdmin(req, res, next) {
  if (['owner', 'admin'].includes(req.staff.role)) return next();
  return requireDepartmentHead(PARTNERSHIPS_DEPARTMENT_NAME)(req, res, next);
}

// ── firms due for a follow-up today or overdue ──────────────────────────────
router.get('/due', async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `SELECT DISTINCT ON (a.firm_id)
              a.id AS last_activity_id, a.firm_id, a.activity_type, a.activity_date,
              a.outcome, a.next_follow_up_date,
              f.firm_name, f.firm_type, f.stage, f.contact_name, f.phone, f.email, f.assigned_bde,
              e.full_name AS bde_name
       FROM partnership_activities a
       JOIN partnership_firms f ON f.id = a.firm_id
       LEFT JOIN employees e ON e.id = f.assigned_bde
       WHERE a.next_follow_up_date IS NOT NULL
         AND a.next_follow_up_date <= CURRENT_DATE
         AND f.stage NOT IN ('active_partner', 'dormant', 'dead')
       ORDER BY a.firm_id, a.activity_date DESC, a.created_at DESC`,
      []
    );
    // sort the deduped set by how overdue it is
    rows.sort((a, b) => new Date(a.next_follow_up_date) - new Date(b.next_follow_up_date));
    res.json({ due: rows });
  } catch (err) {
    console.error('[partnership-activities:due]', err);
    res.status(500).json({ error: 'Failed to fetch follow-ups' });
  }
});

router.get('/', async (req, res) => {
  try {
    const { firm_id } = req.query;
    const params = [];
    let where = '';
    if (firm_id) { params.push(firm_id); where = `WHERE a.firm_id = $1`; }

    const { rows } = await safeQuery(
      `SELECT a.*, f.firm_name, s.email AS logged_by_email
       FROM partnership_activities a
       JOIN partnership_firms f ON f.id = a.firm_id
       LEFT JOIN staff_accounts s ON s.id = a.logged_by
       ${where}
       ORDER BY a.activity_date DESC, a.created_at DESC`,
      params
    );
    res.json({ activities: rows });
  } catch (err) {
    console.error('[partnership-activities:list]', err);
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
});

router.post('/', requirePartnershipsOrAdmin, async (req, res) => {
  try {
    const { firm_id, activity_type, activity_date, outcome, next_follow_up_date } = req.body;
    if (!firm_id) return res.status(400).json({ error: 'firm_id is required' });

    const { rows: [activity] } = await safeQuery(
      `INSERT INTO partnership_activities (firm_id, activity_type, activity_date, outcome, next_follow_up_date, logged_by)
       VALUES ($1,COALESCE($2,'cold_call'),COALESCE($3,CURRENT_DATE),$4,$5,$6)
       RETURNING *`,
      [firm_id, activity_type || null, activity_date || null, outcome || null, next_follow_up_date || null, req.staff.id]
    );

    // touch the firm's updated_at so it surfaces near the top of the firm list too
    await safeQuery(`UPDATE partnership_firms SET updated_at = NOW() WHERE id = $1`, [firm_id]);

    await logAction({ staffId: req.staff.id, action: 'partnership_activity.created', entity: 'partnership_activities', entityId: activity.id, newValue: { firm_id, activity_type: activity.activity_type } });

    res.status(201).json({ activity });
  } catch (err) {
    console.error('[partnership-activities:create]', err);
    res.status(500).json({ error: 'Failed to log activity' });
  }
});

router.put('/:id', requirePartnershipsOrAdmin, async (req, res) => {
  try {
    const allowed = ['activity_type', 'activity_date', 'outcome', 'next_follow_up_date'];
    const sets = [];
    const params = [];
    for (const key of allowed) {
      if (key in req.body) {
        params.push(req.body[key] === '' ? null : req.body[key]);
        sets.push(`${key} = $${params.length}`);
      }
    }
    if (!sets.length) return res.status(400).json({ error: 'No valid fields to update' });

    const { rows: [before] } = await safeQuery(`SELECT * FROM partnership_activities WHERE id = $1`, [req.params.id]);
    if (!before) return res.status(404).json({ error: 'Activity not found' });

    params.push(req.params.id);
    const { rows } = await safeQuery(`UPDATE partnership_activities SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params);

    await logAction({ staffId: req.staff.id, action: 'partnership_activity.updated', entity: 'partnership_activities', entityId: rows[0].id, oldValue: before, newValue: rows[0] });

    res.json({ activity: rows[0] });
  } catch (err) {
    console.error('[partnership-activities:update]', err);
    res.status(500).json({ error: 'Failed to update activity' });
  }
});

router.delete('/:id', requirePartnershipsOrAdmin, async (req, res) => {
  try {
    const { rows: [deleted] } = await safeQuery(`DELETE FROM partnership_activities WHERE id = $1 RETURNING id`, [req.params.id]);
    if (!deleted) return res.status(404).json({ error: 'Activity not found' });
    await logAction({ staffId: req.staff.id, action: 'partnership_activity.deleted', entity: 'partnership_activities', entityId: deleted.id });
    res.json({ deleted: true });
  } catch (err) {
    console.error('[partnership-activities:delete]', err);
    res.status(500).json({ error: 'Failed to delete activity' });
  }
});

module.exports = router;