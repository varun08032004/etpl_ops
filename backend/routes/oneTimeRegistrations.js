'use strict';
// routes/oneTimeRegistrations.js
//
// One-time compliance registrations (fixed checklist — seeded by migration,
// never created/deleted freely). Editable by legal/compliance HODs (and
// owner/admin, via requireRole's built-in bypass). Marking one "done" spawns
// the first cycle of every recurring filing tied to it, per
// services/complianceRules.js — those land in the existing compliance_items
// table and are picked up automatically by the existing /compliance/run-reminders
// cron, so no new scheduler is needed.
//
// Deletion here means "reset the registration" — it's a fixed checklist item,
// not a free-form record, so nothing is DELETE-d from the table. It requires
// two sequential approvals: admin first, then founder (owner). This is a
// separate, self-contained flow from services/approvals.js's single-stage
// admin-requests/owner-approves pattern used for departments/teams — that
// system doesn't support a two-stage chain, so this route implements its own.

const express = require('express');
const router = express.Router();
const { safeQuery } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const { getRulesForSlug, computeFirstDueDate, toISODate } = require('../services/complianceRules');

router.use(authenticate);

// requireRole('legal_hod', 'compliance_hod') already lets owner/admin through
// too, via the built-in bypass in middleware/auth.js.
const EDITOR_ROLE_CHECK = requireRole('legal_hod', 'compliance_hod');

router.get('/', async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `SELECT otr.*, sa.email AS completed_by_email, d.file_name AS proof_file_name
       FROM one_time_registrations otr
       LEFT JOIN staff_accounts sa ON sa.id = otr.completed_by
       LEFT JOIN documents d ON d.id = otr.proof_document_id
       ORDER BY otr.created_at ASC`
    );
    res.json({ items: rows });
  } catch (err) {
    console.error('[one-time-registrations:list]', err);
    res.status(500).json({ error: 'Failed to fetch registrations' });
  }
});

router.get('/:slug', async (req, res) => {
  try {
    const { rows: [item] } = await safeQuery(
      `SELECT otr.*, sa.email AS completed_by_email, d.file_name AS proof_file_name
       FROM one_time_registrations otr
       LEFT JOIN staff_accounts sa ON sa.id = otr.completed_by
       LEFT JOIN documents d ON d.id = otr.proof_document_id
       WHERE otr.slug = $1`,
      [req.params.slug]
    );
    if (!item) return res.status(404).json({ error: 'Registration not found' });
    res.json({ item });
  } catch (err) {
    console.error('[one-time-registrations:get]', err);
    res.status(500).json({ error: 'Failed to fetch registration' });
  }
});

// Mark done / update details — also spawns the first cycle of every recurring
// filing tied to this registration, the moment it flips from not-done to done.
router.put('/:slug', EDITOR_ROLE_CHECK, async (req, res) => {
  try {
    const { is_done, registration_number, registered_on, proof_document_id, notes } = req.body;

    const { rows: [existing] } = await safeQuery(`SELECT * FROM one_time_registrations WHERE slug = $1`, [req.params.slug]);
    if (!existing) return res.status(404).json({ error: 'Registration not found' });

    if (is_done && (!registration_number || !registered_on)) {
      return res.status(400).json({ error: 'registration_number and registered_on are required to mark this done' });
    }

    const becomingDone = !!is_done && !existing.is_done;

    const { rows: [item] } = await safeQuery(
      `UPDATE one_time_registrations
       SET is_done = $1, registration_number = $2, registered_on = $3,
           proof_document_id = $4, notes = $5, completed_by = $6, updated_at = NOW()
       WHERE slug = $7 RETURNING *`,
      [
        !!is_done,
        registration_number || null,
        registered_on || null,
        proof_document_id || null,
        notes || null,
        is_done ? req.staff.id : null,
        req.params.slug,
      ]
    );

    let spawned = 0;
    if (becomingDone) {
      const rules = getRulesForSlug(req.params.slug);
      for (const rule of rules) {
        const dueDate = toISODate(computeFirstDueDate(rule.dueRule));
        await safeQuery(
          `INSERT INTO compliance_items
             (category, title, description, due_date, recurring_interval, created_by, is_auto_generated, source_registration_slug)
           VALUES ($1,$2,$3,$4,$5,$6,TRUE,$7)`,
          [rule.category, rule.title, rule.note || null, dueDate, rule.interval, req.staff.id, req.params.slug]
        );
        spawned++;
      }
    }

    res.json({ item, spawnedRecurringItems: spawned });
  } catch (err) {
    console.error('[one-time-registrations:update]', err);
    res.status(500).json({ error: 'Failed to update registration' });
  }
});

// ── two-stage deletion approval: admin approves first, then founder ────────
router.post('/:slug/request-deletion', EDITOR_ROLE_CHECK, async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `UPDATE one_time_registrations
       SET deletion_requested_by = $1, deletion_requested_at = NOW(),
           deletion_admin_approved_by = NULL, deletion_admin_approved_at = NULL,
           deletion_founder_approved_by = NULL, deletion_founder_approved_at = NULL
       WHERE slug = $2 RETURNING *`,
      [req.staff.id, req.params.slug]
    );
    if (!rows.length) return res.status(404).json({ error: 'Registration not found' });
    res.json({ item: rows[0] });
  } catch (err) {
    console.error('[one-time-registrations:request-deletion]', err);
    res.status(500).json({ error: 'Failed to request deletion' });
  }
});

// Deliberately NOT using requireRole here — requireRole treats owner and admin
// as interchangeable (either bypasses any role check), which would let admin
// approve BOTH stages. This needs the two roles kept strictly separate, so the
// checks are done explicitly against req.staff.role below.
router.post('/:slug/approve-deletion', async (req, res) => {
  try {
    const { rows: [item] } = await safeQuery(`SELECT * FROM one_time_registrations WHERE slug = $1`, [req.params.slug]);
    if (!item) return res.status(404).json({ error: 'Registration not found' });
    if (!item.deletion_requested_by) return res.status(400).json({ error: 'No pending deletion request for this registration' });

    if (req.staff.role === 'admin' && !item.deletion_admin_approved_by) {
      const { rows } = await safeQuery(
        `UPDATE one_time_registrations SET deletion_admin_approved_by = $1, deletion_admin_approved_at = NOW() WHERE slug = $2 RETURNING *`,
        [req.staff.id, req.params.slug]
      );
      return res.json({ item: rows[0], stage: 'admin_approved' });
    }

    if (req.staff.role === 'owner') {
      if (!item.deletion_admin_approved_by) {
        return res.status(400).json({ error: 'Admin must approve before the founder can' });
      }
      const { rows } = await safeQuery(
        `UPDATE one_time_registrations
         SET is_done = FALSE, registration_number = NULL, registered_on = NULL, proof_document_id = NULL, notes = NULL,
             completed_by = NULL, deletion_requested_by = NULL, deletion_requested_at = NULL,
             deletion_admin_approved_by = NULL, deletion_admin_approved_at = NULL,
             deletion_founder_approved_by = $1, deletion_founder_approved_at = NOW()
         WHERE slug = $2 RETURNING *`,
        [req.staff.id, req.params.slug]
      );
      return res.json({ item: rows[0], stage: 'fully_approved_and_reset' });
    }

    return res.status(403).json({ error: 'Only Admin (stage 1) or Founder (stage 2) can approve this' });
  } catch (err) {
    console.error('[one-time-registrations:approve-deletion]', err);
    res.status(500).json({ error: 'Failed to approve deletion' });
  }
});

router.post('/:slug/cancel-deletion-request', EDITOR_ROLE_CHECK, async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `UPDATE one_time_registrations
       SET deletion_requested_by = NULL, deletion_requested_at = NULL,
           deletion_admin_approved_by = NULL, deletion_admin_approved_at = NULL,
           deletion_founder_approved_by = NULL, deletion_founder_approved_at = NULL
       WHERE slug = $1 RETURNING *`,
      [req.params.slug]
    );
    if (!rows.length) return res.status(404).json({ error: 'Registration not found' });
    res.json({ item: rows[0] });
  } catch (err) {
    console.error('[one-time-registrations:cancel-deletion-request]', err);
    res.status(500).json({ error: 'Failed to cancel deletion request' });
  }
});

module.exports = router;