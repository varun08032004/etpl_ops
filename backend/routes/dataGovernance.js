'use strict';
// routes/dataGovernance.js
//
// Closes SRS §8.14's "Data governance" requirement: retention policy
// enforcement + audit log review workflow.
//
// Deliberately does NOT auto-delete or auto-archive anything. /scan flags
// records past their configured retention window into data_governance_flags;
// a human (owner/admin/compliance head) then reviews each flag and decides
// archived/deleted/retained/dismissed via /flags/:id/review. This matches
// this codebase's established pattern elsewhere (e.g. two-stage deletion
// approval) of never letting automation take a destructive action alone.
//
// /scan is meant to be called by the same external daily scheduler already
// hitting /compliance/run-reminders — see that route's header comment for
// the scheduler setup (Render Cron Job / GitHub Actions, etc.).

const express = require('express');
const router = express.Router();
const { safeQuery } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const { logAction } = require('../services/auditLog');

router.use(authenticate);

// Only tables safe to introspect this way — prevents a policy's entity_type
// from being used to run a scan against an arbitrary/unintended table.
const ALLOWED_ENTITY_TABLES = new Set([
  'audit_log', 'compliance_items', 'employee_documents', 'documents',
  'one_time_registrations', 'certifications', 'ip_assets', 'invoices',
]);

// ── retention policies CRUD ─────────────────────────────────────────────
router.get('/policies', async (req, res) => {
  try {
    const { rows } = await safeQuery(`SELECT * FROM data_retention_policies ORDER BY entity_type`);
    res.json({ policies: rows });
  } catch (err) {
    console.error('[data-governance:policies:list]', err);
    res.status(500).json({ error: 'Failed to fetch retention policies' });
  }
});

router.post('/policies', requireRole('owner', 'admin'), async (req, res) => {
  try {
    const { entity_type, retention_period_days, action_on_expiry, date_column, notes } = req.body;
    if (!entity_type || !retention_period_days) {
      return res.status(400).json({ error: 'entity_type and retention_period_days are required' });
    }
    if (!ALLOWED_ENTITY_TABLES.has(entity_type)) {
      return res.status(400).json({ error: `entity_type must be one of: ${[...ALLOWED_ENTITY_TABLES].join(', ')}` });
    }

    const { rows: [policy] } = await safeQuery(
      `INSERT INTO data_retention_policies (entity_type, retention_period_days, action_on_expiry, date_column, notes, created_by)
       VALUES ($1,$2,COALESCE($3,'flag'),COALESCE($4,'created_at'),$5,$6) RETURNING *`,
      [entity_type, retention_period_days, action_on_expiry || null, date_column || null, notes || null, req.staff.id]
    );

    await logAction({ staffId: req.staff.id, action: 'data_retention_policy.created', entity: 'data_retention_policies', entityId: policy.id, newValue: policy });

    res.status(201).json({ policy });
  } catch (err) {
    console.error('[data-governance:policies:create]', err);
    if (err.code === '23505') return res.status(409).json({ error: 'A policy for this entity_type already exists' });
    res.status(500).json({ error: 'Failed to create retention policy' });
  }
});

router.put('/policies/:id', requireRole('owner', 'admin'), async (req, res) => {
  try {
    const allowed = ['retention_period_days', 'action_on_expiry', 'date_column', 'is_active', 'notes'];
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

    const { rows: [before] } = await safeQuery(`SELECT * FROM data_retention_policies WHERE id = $1`, [req.params.id]);
    if (!before) return res.status(404).json({ error: 'Policy not found' });

    params.push(req.params.id);
    const { rows } = await safeQuery(`UPDATE data_retention_policies SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params);

    await logAction({ staffId: req.staff.id, action: 'data_retention_policy.updated', entity: 'data_retention_policies', entityId: rows[0].id, oldValue: before, newValue: rows[0] });

    res.json({ policy: rows[0] });
  } catch (err) {
    console.error('[data-governance:policies:update]', err);
    res.status(500).json({ error: 'Failed to update retention policy' });
  }
});

// ── scan — call daily from the same external scheduler as /compliance/run-reminders ──
router.post('/scan', requireRole('owner', 'admin'), async (req, res) => {
  try {
    const { rows: policies } = await safeQuery(`SELECT * FROM data_retention_policies WHERE is_active = TRUE`);
    let totalFlagged = 0;
    const results = [];

    for (const policy of policies) {
      if (!ALLOWED_ENTITY_TABLES.has(policy.entity_type)) continue; // defensive — table allowlist may have changed since policy creation

      // Table/column names come from a validated allowlist and the policy's
      // own configured date_column, not raw user input in this request —
      // still, quote-identify defensively since date_column IS admin-editable.
      const safeDateColumn = policy.date_column.replace(/[^a-zA-Z0-9_]/g, '');

      const { rows: candidates } = await safeQuery(
        `SELECT id, EXTRACT(DAY FROM NOW() - "${safeDateColumn}")::int AS age_days
         FROM ${policy.entity_type}
         WHERE "${safeDateColumn}" < NOW() - ($1 || ' days')::interval`,
        [policy.retention_period_days]
      );

      let flaggedThisPolicy = 0;
      for (const candidate of candidates) {
        const { rowCount } = await safeQuery(
          `INSERT INTO data_governance_flags (policy_id, entity_type, entity_id, entity_age_days)
           VALUES ($1,$2,$3,$4)
           ON CONFLICT (policy_id, entity_id) DO NOTHING`,
          [policy.id, policy.entity_type, candidate.id, candidate.age_days]
        );
        if (rowCount > 0) flaggedThisPolicy++;
      }

      await safeQuery(`UPDATE data_retention_policies SET last_scanned_at = NOW() WHERE id = $1`, [policy.id]);
      totalFlagged += flaggedThisPolicy;
      results.push({ entity_type: policy.entity_type, candidatesFound: candidates.length, newlyFlagged: flaggedThisPolicy });
    }

    res.json({ policiesScanned: policies.length, totalNewlyFlagged: totalFlagged, results });
  } catch (err) {
    console.error('[data-governance:scan]', err);
    res.status(500).json({ error: 'Failed to run retention scan' });
  }
});

// ── review workflow — this IS the "audit log review" requirement ──────────
router.get('/flags', async (req, res) => {
  try {
    const { reviewed } = req.query; // 'false' = only unreviewed (default), 'true' = only reviewed, omit = all
    const conditions = [];
    if (reviewed === 'false') conditions.push(`reviewed_by IS NULL`);
    if (reviewed === 'true') conditions.push(`reviewed_by IS NOT NULL`);
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await safeQuery(
      `SELECT f.*, p.entity_type AS policy_entity_type, p.action_on_expiry, sa.email AS reviewed_by_email
       FROM data_governance_flags f
       JOIN data_retention_policies p ON p.id = f.policy_id
       LEFT JOIN staff_accounts sa ON sa.id = f.reviewed_by
       ${where}
       ORDER BY f.flagged_at DESC`
    );
    res.json({ flags: rows });
  } catch (err) {
    console.error('[data-governance:flags:list]', err);
    res.status(500).json({ error: 'Failed to fetch governance flags' });
  }
});

router.post('/flags/:id/review', requireRole('owner', 'admin'), async (req, res) => {
  try {
    const { review_decision, review_notes } = req.body;
    if (!['archived', 'deleted', 'retained', 'dismissed'].includes(review_decision)) {
      return res.status(400).json({ error: "review_decision must be one of: archived, deleted, retained, dismissed" });
    }

    const { rows } = await safeQuery(
      `UPDATE data_governance_flags
       SET reviewed_by = $1, reviewed_at = NOW(), review_decision = $2, review_notes = $3
       WHERE id = $4 AND reviewed_by IS NULL RETURNING *`,
      [req.staff.id, review_decision, review_notes || null, req.params.id]
    );
    if (!rows.length) return res.status(400).json({ error: 'Flag not found or already reviewed' });

    await logAction({ staffId: req.staff.id, action: 'data_governance_flag.reviewed', entity: 'data_governance_flags', entityId: rows[0].id, newValue: { review_decision, entity_type: rows[0].entity_type, entity_id: rows[0].entity_id } });

    // Deliberately does NOT actually archive/delete the underlying record —
    // review_decision records the human DECISION; executing 'archived'/'deleted'
    // against the actual entity_type table is a separate, explicit action left
    // to a follow-up step (or a dedicated executor) rather than automated here,
    // to avoid a review-workflow bug ever cascading into real data loss.
    res.json({ flag: rows[0] });
  } catch (err) {
    console.error('[data-governance:flags:review]', err);
    res.status(500).json({ error: 'Failed to review flag' });
  }
});

module.exports = router;