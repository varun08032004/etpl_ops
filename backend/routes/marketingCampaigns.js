'use strict';
// routes/marketingCampaigns.js — budget, channel, status, and results for
// each marketing campaign (ads, launches, events, email pushes, etc.)

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
    if (status) { params.push(status); where = `WHERE c.status = $1`; }

    const { rows } = await safeQuery(
      `SELECT c.*, e.full_name AS owner_name
       FROM marketing_campaigns c
       LEFT JOIN employees e ON e.id = c.owner_employee_id
       ${where}
       ORDER BY c.start_date DESC NULLS LAST, c.created_at DESC`,
      params
    );
    res.json({ campaigns: rows });
  } catch (err) {
    console.error('[marketing-campaigns:list]', err);
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows: [campaign] } = await safeQuery(`SELECT * FROM marketing_campaigns WHERE id = $1`, [req.params.id]);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const { rows: content } = await safeQuery(
      `SELECT id, title, content_type, platform, scheduled_date, status FROM marketing_content_calendar WHERE campaign_id = $1 ORDER BY scheduled_date ASC NULLS LAST`,
      [req.params.id]
    );

    res.json({ campaign, content });
  } catch (err) {
    console.error('[marketing-campaigns:get]', err);
    res.status(500).json({ error: 'Failed to fetch campaign' });
  }
});

router.post('/', requireMarketingOrAdmin, async (req, res) => {
  try {
    const {
      name, objective, channel, status, start_date, end_date, budget, amount_spent,
      leads_generated, conversions, owner_employee_id, notes,
    } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const { rows: [campaign] } = await safeQuery(
      `INSERT INTO marketing_campaigns
        (name, objective, channel, status, start_date, end_date, budget, amount_spent, leads_generated, conversions, owner_employee_id, notes, created_by)
       VALUES ($1,$2,$3,COALESCE($4,'planned'),$5,$6,COALESCE($7,0),COALESCE($8,0),COALESCE($9,0),COALESCE($10,0),$11,$12,$13)
       RETURNING *`,
      [name, objective || null, channel || null, status || null, start_date || null, end_date || null,
       budget ?? null, amount_spent ?? null, leads_generated ?? null, conversions ?? null,
       owner_employee_id || null, notes || null, req.staff.id]
    );

    await logAction({ staffId: req.staff.id, action: 'marketing_campaign.created', entity: 'marketing_campaigns', entityId: campaign.id, newValue: { name: campaign.name, status: campaign.status } });

    res.status(201).json({ campaign });
  } catch (err) {
    console.error('[marketing-campaigns:create]', err);
    res.status(500).json({ error: 'Failed to create campaign' });
  }
});

router.put('/:id', requireMarketingOrAdmin, async (req, res) => {
  try {
    const allowed = [
      'name', 'objective', 'channel', 'status', 'start_date', 'end_date', 'budget', 'amount_spent',
      'leads_generated', 'conversions', 'owner_employee_id', 'notes',
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

    const { rows: [before] } = await safeQuery(`SELECT * FROM marketing_campaigns WHERE id = $1`, [req.params.id]);
    if (!before) return res.status(404).json({ error: 'Campaign not found' });

    params.push(req.params.id);
    const { rows } = await safeQuery(
      `UPDATE marketing_campaigns SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );

    await logAction({ staffId: req.staff.id, action: 'marketing_campaign.updated', entity: 'marketing_campaigns', entityId: rows[0].id, oldValue: before, newValue: rows[0] });

    res.json({ campaign: rows[0] });
  } catch (err) {
    console.error('[marketing-campaigns:update]', err);
    res.status(500).json({ error: 'Failed to update campaign' });
  }
});

router.delete('/:id', requireRole('owner'), async (req, res) => {
  try {
    const { rows: [deleted] } = await safeQuery(`DELETE FROM marketing_campaigns WHERE id = $1 RETURNING id, name`, [req.params.id]);
    if (!deleted) return res.status(404).json({ error: 'Campaign not found' });
    await logAction({ staffId: req.staff.id, action: 'marketing_campaign.deleted', entity: 'marketing_campaigns', entityId: deleted.id, oldValue: { name: deleted.name } });
    res.json({ deleted: true });
  } catch (err) {
    console.error('[marketing-campaigns:delete]', err);
    res.status(500).json({ error: 'Failed to delete campaign' });
  }
});

module.exports = router;