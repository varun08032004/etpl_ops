'use strict';
// routes/ipAssets.js
//
// Closes SRS §8.14's "IP: Trademark and patent application/renewal status"
// requirement. Multi-row registry — a company can hold several trademarks
// and/or patents, each at a different lifecycle stage (filed -> examination
// -> granted/registered, or opposed/abandoned along the way).
//
// Unlike certifications.js, renewal reminders are NOT auto-spawned here:
// trademark renewal is a 10-year cycle and patent maintenance fees follow
// jurisdiction-specific annual schedules that vary too much to hardcode
// safely (see services/complianceRules.js's comment on why trademark was
// left out of the recurring-rules engine). next_renewal_date is tracked as
// a field for manual reference; if you want automatic reminders here too,
// say so and I'll wire the same spawnRenewalReminderIfNeeded pattern from
// certifications.js once the renewal cadence per ip_type is confirmed.

const express = require('express');
const router = express.Router();
const { safeQuery } = require('../db/pool');
const { authenticate, requireRole, requireDepartmentHead } = require('../middleware/auth');
const { logAction } = require('../services/auditLog');

router.use(authenticate);

const COMPLIANCE_DEPARTMENT_NAME = 'Legal & Compliance';
function requireFinanceOrComplianceHead(req, res, next) {
  if (['owner', 'admin', 'finance'].includes(req.staff.role)) return next();
  return requireDepartmentHead(COMPLIANCE_DEPARTMENT_NAME)(req, res, next);
}

router.get('/', async (req, res) => {
  try {
    const { ip_type } = req.query;
    const params = [];
    let where = '';
    if (ip_type) { params.push(ip_type); where = `WHERE ip_type = $1`; }

    const { rows } = await safeQuery(
      `SELECT ia.*, d.file_name AS document_file_name
       FROM ip_assets ia
       LEFT JOIN documents d ON d.id = ia.document_id
       ${where}
       ORDER BY ia.next_renewal_date ASC NULLS LAST, ia.created_at DESC`,
      params
    );
    res.json({ ipAssets: rows });
  } catch (err) {
    console.error('[ip-assets:list]', err);
    res.status(500).json({ error: 'Failed to fetch IP assets' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows: [item] } = await safeQuery(`SELECT * FROM ip_assets WHERE id = $1`, [req.params.id]);
    if (!item) return res.status(404).json({ error: 'IP asset not found' });
    res.json({ ipAsset: item });
  } catch (err) {
    console.error('[ip-assets:get]', err);
    res.status(500).json({ error: 'Failed to fetch IP asset' });
  }
});

router.post('/', requireFinanceOrComplianceHead, async (req, res) => {
  try {
    const { ip_type, title, application_number, registration_number, status, filing_date, grant_date, next_renewal_date, renewal_interval_years, notes } = req.body;
    if (!ip_type || !title) return res.status(400).json({ error: 'ip_type and title are required' });
    if (!['trademark', 'patent'].includes(ip_type)) return res.status(400).json({ error: "ip_type must be 'trademark' or 'patent'" });

    const defaultRenewalYears = ip_type === 'trademark' ? 10 : 1;

    const { rows: [asset] } = await safeQuery(
      `INSERT INTO ip_assets (ip_type, title, application_number, registration_number, status, filing_date, grant_date, next_renewal_date, renewal_interval_years, notes, created_by)
       VALUES ($1,$2,$3,$4,COALESCE($5,'filed'),$6,$7,$8,COALESCE($9,$10),$11,$12) RETURNING *`,
      [ip_type, title, application_number || null, registration_number || null, status || null,
       filing_date || null, grant_date || null, next_renewal_date || null,
       renewal_interval_years || null, defaultRenewalYears, notes || null, req.staff.id]
    );

    await logAction({ staffId: req.staff.id, action: 'ip_asset.created', entity: 'ip_assets', entityId: asset.id, newValue: { ip_type: asset.ip_type, title: asset.title } });

    res.status(201).json({ ipAsset: asset });
  } catch (err) {
    console.error('[ip-assets:create]', err);
    res.status(500).json({ error: 'Failed to create IP asset' });
  }
});

router.put('/:id', requireFinanceOrComplianceHead, async (req, res) => {
  try {
    const allowed = ['title', 'application_number', 'registration_number', 'status', 'filing_date', 'grant_date', 'next_renewal_date', 'renewal_interval_years', 'document_id', 'notes'];
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

    const { rows: [before] } = await safeQuery(`SELECT * FROM ip_assets WHERE id = $1`, [req.params.id]);
    if (!before) return res.status(404).json({ error: 'IP asset not found' });

    params.push(req.params.id);
    const { rows } = await safeQuery(
      `UPDATE ip_assets SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );

    await logAction({ staffId: req.staff.id, action: 'ip_asset.updated', entity: 'ip_assets', entityId: rows[0].id, oldValue: before, newValue: rows[0] });

    res.json({ ipAsset: rows[0] });
  } catch (err) {
    console.error('[ip-assets:update]', err);
    res.status(500).json({ error: 'Failed to update IP asset' });
  }
});

router.delete('/:id', requireRole('owner'), async (req, res) => {
  try {
    const { rows: [deleted] } = await safeQuery(`DELETE FROM ip_assets WHERE id = $1 RETURNING id, title`, [req.params.id]);
    if (!deleted) return res.status(404).json({ error: 'IP asset not found' });
    await logAction({ staffId: req.staff.id, action: 'ip_asset.deleted', entity: 'ip_assets', entityId: deleted.id, oldValue: { title: deleted.title } });
    res.json({ deleted: true });
  } catch (err) {
    console.error('[ip-assets:delete]', err);
    res.status(500).json({ error: 'Failed to delete IP asset' });
  }
});

module.exports = router;