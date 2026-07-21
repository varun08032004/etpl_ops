'use strict';
// routes/settings.js
//
// The real "Settings" module the SRS asks for (§8.23) — closes the gap where
// tax slabs, PT rates, EPF/ESIC thresholds, and approval limits lived in DB
// tables with zero admin UI. Everything here is owner/admin-only to write
// (these numbers drive statutory payroll math — a wrong PT slab is a real
// compliance issue, not a cosmetic setting), and every change is audit-logged.

const express = require('express');
const router = express.Router();
const { safeQuery } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const { logAction } = require('../services/auditLog');

router.use(authenticate);

// ═══════════════════════ compliance_settings (key/value) ═══════════════════

router.get('/compliance', requireRole('finance'), async (req, res) => {
  try {
    const { rows } = await safeQuery(`SELECT * FROM compliance_settings ORDER BY key`);
    res.json({ settings: rows });
  } catch (err) {
    console.error('[settings:compliance:list]', err);
    res.status(500).json({ error: 'Failed to fetch compliance settings' });
  }
});

router.put('/compliance/:key', requireRole(), async (req, res) => {
  // requireRole() with no args → owner/admin only. These numbers drive real
  // statutory calculations (EPF/ESIC thresholds, PT/F&F deadlines) — not a
  // "finance role can tweak it" level of stakes.
  try {
    const { value } = req.body;
    if (value == null || value === '') return res.status(400).json({ error: 'value is required' });

    const { rows: [before] } = await safeQuery(`SELECT * FROM compliance_settings WHERE key = $1`, [req.params.key]);
    if (!before) return res.status(404).json({ error: `No compliance setting with key "${req.params.key}"` });

    const { rows: [updated] } = await safeQuery(
      `UPDATE compliance_settings SET value = $1 WHERE key = $2 RETURNING *`,
      [String(value), req.params.key]
    );

    await logAction({
      staffId: req.staff.id, action: 'compliance_setting.updated', entity: 'compliance_settings', entityId: req.params.key,
      oldValue: { value: before.value }, newValue: { value: updated.value },
    });

    res.json({ setting: updated });
  } catch (err) {
    console.error('[settings:compliance:update]', err);
    res.status(500).json({ error: 'Failed to update compliance setting' });
  }
});

// ═══════════════════════ pt_slabs (state → gross-band → PT amount) ═════════

router.get('/pt-slabs', requireRole('finance'), async (req, res) => {
  try {
    const { state } = req.query;
    const params = [];
    let where = '';
    if (state) { params.push(state); where = `WHERE state = $1`; }
    const { rows } = await safeQuery(`SELECT * FROM pt_slabs ${where} ORDER BY state, gross_from`, params);
    res.json({ slabs: rows });
  } catch (err) {
    console.error('[settings:pt-slabs:list]', err);
    res.status(500).json({ error: 'Failed to fetch PT slabs' });
  }
});

router.post('/pt-slabs', requireRole(), async (req, res) => {
  try {
    const { state, gross_from, gross_to, monthly_amount, applies_in_february_override } = req.body;
    if (!state || gross_from == null || monthly_amount == null) {
      return res.status(400).json({ error: 'state, gross_from, and monthly_amount are required' });
    }
    const { rows: [slab] } = await safeQuery(
      `INSERT INTO pt_slabs (state, gross_from, gross_to, monthly_amount, applies_in_february_override)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [state, gross_from, gross_to || null, monthly_amount, applies_in_february_override || null]
    );
    await logAction({ staffId: req.staff.id, action: 'pt_slab.created', entity: 'pt_slabs', entityId: slab.id, newValue: slab });
    res.status(201).json({ slab });
  } catch (err) {
    console.error('[settings:pt-slabs:create]', err);
    res.status(500).json({ error: 'Failed to create PT slab' });
  }
});

router.put('/pt-slabs/:id', requireRole(), async (req, res) => {
  try {
    const allowed = ['state', 'gross_from', 'gross_to', 'monthly_amount', 'applies_in_february_override'];
    const { rows: [before] } = await safeQuery(`SELECT * FROM pt_slabs WHERE id = $1`, [req.params.id]);
    if (!before) return res.status(404).json({ error: 'PT slab not found' });

    const sets = [];
    const params = [];
    for (const key of allowed) {
      if (key in req.body) { params.push(req.body[key] === '' ? null : req.body[key]); sets.push(`${key} = $${params.length}`); }
    }
    if (!sets.length) return res.status(400).json({ error: 'No valid fields to update' });
    params.push(req.params.id);

    const { rows: [updated] } = await safeQuery(`UPDATE pt_slabs SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params);
    await logAction({ staffId: req.staff.id, action: 'pt_slab.updated', entity: 'pt_slabs', entityId: updated.id, oldValue: before, newValue: updated });
    res.json({ slab: updated });
  } catch (err) {
    console.error('[settings:pt-slabs:update]', err);
    res.status(500).json({ error: 'Failed to update PT slab' });
  }
});

router.delete('/pt-slabs/:id', requireRole(), async (req, res) => {
  try {
    const { rows: [deleted] } = await safeQuery(`DELETE FROM pt_slabs WHERE id = $1 RETURNING *`, [req.params.id]);
    if (!deleted) return res.status(404).json({ error: 'PT slab not found' });
    await logAction({ staffId: req.staff.id, action: 'pt_slab.deleted', entity: 'pt_slabs', entityId: deleted.id, oldValue: deleted });
    res.json({ success: true });
  } catch (err) {
    console.error('[settings:pt-slabs:delete]', err);
    res.status(500).json({ error: 'Failed to delete PT slab' });
  }
});

// ═══════════════════════ tax_slabs (regime + FY → income band → rate) ══════

router.get('/tax-slabs', requireRole('finance'), async (req, res) => {
  try {
    const { regime, fiscal_year } = req.query;
    const conditions = [];
    const params = [];
    if (regime) { params.push(regime); conditions.push(`regime = $${params.length}`); }
    if (fiscal_year) { params.push(fiscal_year); conditions.push(`fiscal_year = $${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await safeQuery(`SELECT * FROM tax_slabs ${where} ORDER BY fiscal_year DESC, regime, income_from`, params);
    res.json({ slabs: rows });
  } catch (err) {
    console.error('[settings:tax-slabs:list]', err);
    res.status(500).json({ error: 'Failed to fetch tax slabs' });
  }
});

router.post('/tax-slabs', requireRole(), async (req, res) => {
  try {
    const { regime, fiscal_year, income_from, income_to, rate_percent, standard_deduction, cess_percent } = req.body;
    if (!regime || !fiscal_year || income_from == null || rate_percent == null) {
      return res.status(400).json({ error: 'regime, fiscal_year, income_from, and rate_percent are required' });
    }
    if (!['old', 'new'].includes(regime)) return res.status(400).json({ error: "regime must be 'old' or 'new'" });

    const { rows: [slab] } = await safeQuery(
      `INSERT INTO tax_slabs (regime, fiscal_year, income_from, income_to, rate_percent, standard_deduction, cess_percent)
       VALUES ($1,$2,$3,$4,$5,COALESCE($6,50000),COALESCE($7,4)) RETURNING *`,
      [regime, fiscal_year, income_from, income_to || null, rate_percent, standard_deduction, cess_percent]
    );
    await logAction({ staffId: req.staff.id, action: 'tax_slab.created', entity: 'tax_slabs', entityId: slab.id, newValue: slab });
    res.status(201).json({ slab });
  } catch (err) {
    console.error('[settings:tax-slabs:create]', err);
    res.status(500).json({ error: 'Failed to create tax slab' });
  }
});

router.put('/tax-slabs/:id', requireRole(), async (req, res) => {
  try {
    const allowed = ['regime', 'fiscal_year', 'income_from', 'income_to', 'rate_percent', 'standard_deduction', 'cess_percent'];
    const { rows: [before] } = await safeQuery(`SELECT * FROM tax_slabs WHERE id = $1`, [req.params.id]);
    if (!before) return res.status(404).json({ error: 'Tax slab not found' });

    const sets = [];
    const params = [];
    for (const key of allowed) {
      if (key in req.body) { params.push(req.body[key] === '' ? null : req.body[key]); sets.push(`${key} = $${params.length}`); }
    }
    if (!sets.length) return res.status(400).json({ error: 'No valid fields to update' });
    params.push(req.params.id);

    const { rows: [updated] } = await safeQuery(`UPDATE tax_slabs SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params);
    await logAction({ staffId: req.staff.id, action: 'tax_slab.updated', entity: 'tax_slabs', entityId: updated.id, oldValue: before, newValue: updated });
    res.json({ slab: updated });
  } catch (err) {
    console.error('[settings:tax-slabs:update]', err);
    res.status(500).json({ error: 'Failed to update tax slab' });
  }
});

router.delete('/tax-slabs/:id', requireRole(), async (req, res) => {
  try {
    const { rows: [deleted] } = await safeQuery(`DELETE FROM tax_slabs WHERE id = $1 RETURNING *`, [req.params.id]);
    if (!deleted) return res.status(404).json({ error: 'Tax slab not found' });
    await logAction({ staffId: req.staff.id, action: 'tax_slab.deleted', entity: 'tax_slabs', entityId: deleted.id, oldValue: deleted });
    res.json({ success: true });
  } catch (err) {
    console.error('[settings:tax-slabs:delete]', err);
    res.status(500).json({ error: 'Failed to delete tax slab' });
  }
});

// ═══════════════════════ general app settings (key/value, mixed tables) ════
// Merges app_settings (text) + app_settings_numeric (numeric) into one view —
// callers don't need to know which underlying table a given key lives in.

const KNOWN_APP_SETTINGS = {
  environment_mode: { table: 'app_settings', label: 'Environment mode', type: 'enum', options: ['testnet', 'production'] },
  recurring_expense_approval_threshold_inr: { table: 'app_settings_numeric', label: 'Recurring expense approval threshold (₹/month)', type: 'number' },
};

router.get('/app', requireRole('finance'), async (req, res) => {
  try {
    const { rows: textRows } = await safeQuery(`SELECT key, value FROM app_settings`);
    const { rows: numRows } = await safeQuery(`SELECT key, value FROM app_settings_numeric`);
    const byKey = {};
    for (const r of textRows) byKey[r.key] = r.value;
    for (const r of numRows) byKey[r.key] = Number(r.value);

    const settings = Object.entries(KNOWN_APP_SETTINGS).map(([key, meta]) => ({
      key, ...meta, value: byKey[key] ?? null,
    }));
    res.json({ settings });
  } catch (err) {
    console.error('[settings:app:list]', err);
    res.status(500).json({ error: 'Failed to fetch app settings' });
  }
});

router.put('/app/:key', requireRole(), async (req, res) => {
  try {
    const meta = KNOWN_APP_SETTINGS[req.params.key];
    if (!meta) return res.status(404).json({ error: `Unknown setting "${req.params.key}"` });
    const { value } = req.body;
    if (value == null || value === '') return res.status(400).json({ error: 'value is required' });
    if (meta.type === 'enum' && !meta.options.includes(value)) {
      return res.status(400).json({ error: `value must be one of: ${meta.options.join(', ')}` });
    }

    if (meta.table === 'app_settings') {
      await safeQuery(
        `INSERT INTO app_settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value = $2`,
        [req.params.key, String(value)]
      );
    } else {
      const num = Number(value);
      if (!Number.isFinite(num)) return res.status(400).json({ error: 'value must be a number' });
      await safeQuery(
        `INSERT INTO app_settings_numeric (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value = $2`,
        [req.params.key, num]
      );
    }

    await logAction({ staffId: req.staff.id, action: 'app_setting.updated', entity: 'app_settings', entityId: req.params.key, newValue: { value } });

    res.json({ key: req.params.key, value });
  } catch (err) {
    console.error('[settings:app:update]', err);
    res.status(500).json({ error: 'Failed to update setting' });
  }
});

module.exports = router;