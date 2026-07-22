'use strict';
// routes/marketingEvents.js — conferences, webinars, panels, trade shows —
// role attended in, cost, and leads generated.

const express = require('express');
const router = express.Router();
const { safeQuery } = require('../db/pool');
const { authenticate, requireRole, requireDepartmentHead } = require('../middleware/auth');
const { logAction } = require('../services/auditLog');

router.use(authenticate);

const MARKETING_DEPARTMENT_NAME = 'Marketing';
function requireMarketingOrAdmin(req, res, next) {
  if (['owner', 'admin'].includes(req.staff.role)) return next();
  return requireDepartmentHead(MARKETING_DEPARTMENT_NAME)(req, res, next);
}

router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    const params = [];
    let where = '';
    if (status) { params.push(status); where = `WHERE e.status = $1`; }

    const { rows } = await safeQuery(
      `SELECT e.*, emp.full_name AS owner_name
       FROM marketing_events e
       LEFT JOIN employees emp ON emp.id = e.owner_employee_id
       ${where}
       ORDER BY e.start_date ASC NULLS LAST`,
      params
    );
    res.json({ events: rows });
  } catch (err) {
    console.error('[marketing-events:list]', err);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

router.post('/', requireMarketingOrAdmin, async (req, res) => {
  try {
    const {
      name, event_type, role, status, start_date, end_date, location, is_virtual,
      cost, leads_generated, url, owner_employee_id, notes,
    } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const { rows: [event] } = await safeQuery(
      `INSERT INTO marketing_events
        (name, event_type, role, status, start_date, end_date, location, is_virtual, cost, leads_generated, url, owner_employee_id, notes, created_by)
       VALUES ($1,COALESCE($2,'other'),COALESCE($3,'attendee'),COALESCE($4,'planned'),$5,$6,$7,COALESCE($8,false),COALESCE($9,0),COALESCE($10,0),$11,$12,$13,$14)
       RETURNING *`,
      [name, event_type || null, role || null, status || null, start_date || null, end_date || null,
       location || null, is_virtual ?? null, cost ?? null, leads_generated ?? null, url || null,
       owner_employee_id || null, notes || null, req.staff.id]
    );

    await logAction({ staffId: req.staff.id, action: 'marketing_event.created', entity: 'marketing_events', entityId: event.id, newValue: { name: event.name, status: event.status } });

    res.status(201).json({ event });
  } catch (err) {
    console.error('[marketing-events:create]', err);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

router.put('/:id', requireMarketingOrAdmin, async (req, res) => {
  try {
    const allowed = [
      'name', 'event_type', 'role', 'status', 'start_date', 'end_date', 'location', 'is_virtual',
      'cost', 'leads_generated', 'url', 'owner_employee_id', 'notes',
    ];
    const sets = [];
    const params = [];
    for (const key of allowed) {
      if (key in req.body) {
        params.push(req.body[key] === '' ? null : req.body[key]);
        sets.push(`${key} = $${params.length}`);
      }
    }
    if (!sets.length) return res.status(400).json({ error: 'No valid fields to update' });
    sets.push(`updated_at = NOW()`);

    const { rows: [before] } = await safeQuery(`SELECT * FROM marketing_events WHERE id = $1`, [req.params.id]);
    if (!before) return res.status(404).json({ error: 'Event not found' });

    params.push(req.params.id);
    const { rows } = await safeQuery(`UPDATE marketing_events SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params);

    await logAction({ staffId: req.staff.id, action: 'marketing_event.updated', entity: 'marketing_events', entityId: rows[0].id, oldValue: before, newValue: rows[0] });

    res.json({ event: rows[0] });
  } catch (err) {
    console.error('[marketing-events:update]', err);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

router.delete('/:id', requireRole('owner'), async (req, res) => {
  try {
    const { rows: [deleted] } = await safeQuery(`DELETE FROM marketing_events WHERE id = $1 RETURNING id, name`, [req.params.id]);
    if (!deleted) return res.status(404).json({ error: 'Event not found' });
    await logAction({ staffId: req.staff.id, action: 'marketing_event.deleted', entity: 'marketing_events', entityId: deleted.id, oldValue: { name: deleted.name } });
    res.json({ deleted: true });
  } catch (err) {
    console.error('[marketing-events:delete]', err);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

module.exports = router;