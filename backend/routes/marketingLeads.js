'use strict';
// routes/marketingLeads.js — inbound marketing leads (demo requests, website
// form fills, event sign-ups, etc). POST /:id/convert turns a lead into a
// real CRM `party` (customer) via the existing /api/parties insert, then
// stamps converted_party_id back onto the lead — same idea as a "convert"
// button in any CRM.

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
// Converting a lead creates a `parties` row, which routes/parties.js gates
// behind requireRole('finance') — mirror that here too so a marketing-only
// login can't silently create CRM/AR records it shouldn't.
function requireMarketingOrFinanceOrAdmin(req, res, next) {
  if (['owner', 'admin', 'finance'].includes(req.staff.role)) return next();
  return requireDepartmentHead(MARKETING_DEPARTMENT_NAME)(req, res, next);
}

router.get('/', async (req, res) => {
  try {
    const { status, source } = req.query;
    const params = [];
    const clauses = [];
    if (status) { params.push(status); clauses.push(`l.status = $${params.length}`); }
    if (source) { params.push(source); clauses.push(`l.source = $${params.length}`); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const { rows } = await safeQuery(
      `SELECT l.*, c.name AS campaign_name, p.name AS converted_party_name
       FROM marketing_leads l
       LEFT JOIN marketing_campaigns c ON c.id = l.campaign_id
       LEFT JOIN parties p ON p.id = l.converted_party_id
       ${where}
       ORDER BY l.received_at DESC NULLS LAST, l.created_at DESC`,
      params
    );
    res.json({ leads: rows });
  } catch (err) {
    console.error('[marketing-leads:list]', err);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows: [lead] } = await safeQuery(`SELECT * FROM marketing_leads WHERE id = $1`, [req.params.id]);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    res.json({ lead });
  } catch (err) {
    console.error('[marketing-leads:get]', err);
    res.status(500).json({ error: 'Failed to fetch lead' });
  }
});

router.post('/', requireMarketingOrAdmin, async (req, res) => {
  try {
    const { full_name, company_name, email, phone, source, campaign_id, status, message, received_at, notes } = req.body;
    if (!full_name) return res.status(400).json({ error: 'full_name is required' });

    const { rows: [lead] } = await safeQuery(
      `INSERT INTO marketing_leads (full_name, company_name, email, phone, source, campaign_id, status, message, received_at, notes, created_by)
       VALUES ($1,$2,$3,$4,COALESCE($5,'other'),$6,COALESCE($7,'new'),$8,COALESCE($9,CURRENT_DATE),$10,$11)
       RETURNING *`,
      [full_name, company_name || null, email || null, phone || null, source || null, campaign_id || null,
       status || null, message || null, received_at || null, notes || null, req.staff.id]
    );

    await logAction({ staffId: req.staff.id, action: 'marketing_lead.created', entity: 'marketing_leads', entityId: lead.id, newValue: { full_name: lead.full_name, source: lead.source } });

    res.status(201).json({ lead });
  } catch (err) {
    console.error('[marketing-leads:create]', err);
    res.status(500).json({ error: 'Failed to create lead' });
  }
});

router.put('/:id', requireMarketingOrAdmin, async (req, res) => {
  try {
    const allowed = ['full_name', 'company_name', 'email', 'phone', 'source', 'campaign_id', 'status', 'message', 'received_at', 'notes'];
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

    const { rows: [before] } = await safeQuery(`SELECT * FROM marketing_leads WHERE id = $1`, [req.params.id]);
    if (!before) return res.status(404).json({ error: 'Lead not found' });

    params.push(req.params.id);
    const { rows } = await safeQuery(`UPDATE marketing_leads SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params);

    await logAction({ staffId: req.staff.id, action: 'marketing_lead.updated', entity: 'marketing_leads', entityId: rows[0].id, oldValue: before, newValue: rows[0] });

    res.json({ lead: rows[0] });
  } catch (err) {
    console.error('[marketing-leads:update]', err);
    res.status(500).json({ error: 'Failed to update lead' });
  }
});

// ── convert a lead into a CRM party (customer) ──────────────────────────────
router.post('/:id/convert', requireMarketingOrFinanceOrAdmin, async (req, res) => {
  try {
    const { rows: [lead] } = await safeQuery(`SELECT * FROM marketing_leads WHERE id = $1`, [req.params.id]);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    if (lead.converted_party_id) return res.status(409).json({ error: 'Lead already converted' });

    const partyName = lead.company_name || lead.full_name;
    const { rows: [party] } = await safeQuery(
      `INSERT INTO parties (name, party_type, email, phone, lead_source)
       VALUES ($1,'customer',$2,$3,$4) RETURNING *`,
      [partyName, lead.email || null, lead.phone || null, lead.source || null]
    );

    const { rows: [updatedLead] } = await safeQuery(
      `UPDATE marketing_leads SET status = 'converted', converted_party_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [party.id, req.params.id]
    );

    await logAction({ staffId: req.staff.id, action: 'marketing_lead.converted', entity: 'marketing_leads', entityId: lead.id, newValue: { converted_party_id: party.id } });

    res.json({ lead: updatedLead, party });
  } catch (err) {
    console.error('[marketing-leads:convert]', err);
    res.status(500).json({ error: 'Failed to convert lead' });
  }
});

router.delete('/:id', requireRole('owner'), async (req, res) => {
  try {
    const { rows: [deleted] } = await safeQuery(`DELETE FROM marketing_leads WHERE id = $1 RETURNING id, full_name`, [req.params.id]);
    if (!deleted) return res.status(404).json({ error: 'Lead not found' });
    await logAction({ staffId: req.staff.id, action: 'marketing_lead.deleted', entity: 'marketing_leads', entityId: deleted.id, oldValue: { full_name: deleted.full_name } });
    res.json({ deleted: true });
  } catch (err) {
    console.error('[marketing-leads:delete]', err);
    res.status(500).json({ error: 'Failed to delete lead' });
  }
});

module.exports = router;