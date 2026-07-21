'use strict';
// routes/oneTimeRegistrations.js
//
// One-time compliance registrations (fixed checklist — seeded by migration,
// never created/deleted freely). Editable by whoever heads the
// "Legal & Compliance" department (checked dynamically against
// departments.head_employee_id — see middleware/auth.js's
// requireDepartmentHead), plus owner/admin via the usual bypass.
//
// 2026-07 update: switched from a legal_hod/compliance_hod role-enum check
// to requireDepartmentHead('Legal & Compliance'), matching this codebase's
// existing pattern (departments.head_employee_id, teams.team_head_id) for
// representing "who heads what" — this scales to any number of departments
// without ever touching the staff_role enum again.
//
// Marking one "done" spawns the first cycle of every recurring filing tied
// to it, per services/complianceRules.js — those land in the existing
// compliance_items table and are picked up automatically by the existing
// /compliance/run-reminders cron, so no new scheduler is needed.
//
// Deletion here means "reset the registration" — it's a fixed checklist item,
// not a free-form record, so nothing is DELETE-d from the table. It requires
// two sequential approvals: admin first, then founder (owner). This is a
// separate, self-contained flow from services/approvals.js's chain-based
// approval system (buildDepartmentChain) — that system resolves a dynamic
// chain per department, not a fixed two-stage admin-then-founder sequence,
// so this route keeps its own simple version rather than forcing a fit.

const express = require('express');
const router = express.Router();
const { safeQuery } = require('../db/pool');
const { authenticate, requireDepartmentHead } = require('../middleware/auth');
const { getRulesForSlug, computeFirstDueDate, toISODate } = require('../services/complianceRules');
const { logAction } = require('../services/auditLog');

router.use(authenticate);

// Change this string if your department is ever renamed — it must match
// departments.name exactly (case-sensitive).
const COMPLIANCE_DEPARTMENT_NAME = 'Legal & Compliance';
const EDITOR_ROLE_CHECK = requireDepartmentHead(COMPLIANCE_DEPARTMENT_NAME);

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
// Also usable to correct a mistake on an already-done registration (e.g. a
// wrong date) without going through the deletion-approval flow, since
// becomingDone only fires on the not-done -> done transition.
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
      const rules = await getRulesForSlug(req.params.slug);
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

    await logAction({
      staffId: req.staff.id,
      action: becomingDone ? 'one_time_registration.marked_done' : 'one_time_registration.edited',
      entity: 'one_time_registrations',
      entityId: item.id,
      oldValue: { registration_number: existing.registration_number, registered_on: existing.registered_on, is_done: existing.is_done },
      newValue: { registration_number: item.registration_number, registered_on: item.registered_on, is_done: item.is_done },
    });

    res.json({ item, spawnedRecurringItems: spawned });
  } catch (err) {
    console.error('[one-time-registrations:update]', err);
    res.status(500).json({ error: 'Failed to update registration' });
  }
});

// ── two-stage deletion approval: admin approves first, then founder ────────
router.post('/:slug/request-deletion', EDITOR_ROLE_CHECK, async (req, res) => {
  try {
    // Owner bypass — same pattern as departments.js/teams.js: the founder
    // requesting their own action doesn't need to wait on an admin approval
    // that exists specifically to check people BELOW the founder. Reset
    // immediately instead of creating a pending two-stage request.
    if (req.staff.role === 'owner') {
      const { rows } = await safeQuery(
        `UPDATE one_time_registrations
         SET is_done = FALSE, registration_number = NULL, registered_on = NULL, proof_document_id = NULL, notes = NULL,
             completed_by = NULL, deletion_requested_by = NULL, deletion_requested_at = NULL,
             deletion_admin_approved_by = NULL, deletion_admin_approved_at = NULL,
             deletion_founder_approved_by = $1, deletion_founder_approved_at = NOW()
         WHERE slug = $2 RETURNING *`,
        [req.staff.id, req.params.slug]
      );
      if (!rows.length) return res.status(404).json({ error: 'Registration not found' });
      await logAction({ staffId: req.staff.id, action: 'one_time_registration.deleted_by_founder', entity: 'one_time_registrations', entityId: rows[0].id });
      return res.json({ item: rows[0], stage: 'founder_immediate_reset' });
    }

    const { rows } = await safeQuery(
      `UPDATE one_time_registrations
       SET deletion_requested_by = $1, deletion_requested_at = NOW(),
           deletion_admin_approved_by = NULL, deletion_admin_approved_at = NULL,
           deletion_founder_approved_by = NULL, deletion_founder_approved_at = NULL
       WHERE slug = $2 RETURNING *`,
      [req.staff.id, req.params.slug]
    );
    if (!rows.length) return res.status(404).json({ error: 'Registration not found' });
    await logAction({ staffId: req.staff.id, action: 'one_time_registration.deletion_requested', entity: 'one_time_registrations', entityId: rows[0].id, newValue: { reason: req.body.reason || null } });
    res.json({ item: rows[0], stage: 'pending_admin_approval' });
  } catch (err) {
    console.error('[one-time-registrations:request-deletion]', err);
    res.status(500).json({ error: 'Failed to request deletion' });
  }
});

// Deliberately NOT using requireRole/requireDepartmentHead here — those both
// treat owner and admin as interchangeable bypasses, which would let admin
// approve BOTH stages. This needs the two roles kept strictly separate, so
// the checks are done explicitly against req.staff.role below.
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
      await logAction({ staffId: req.staff.id, action: 'one_time_registration.deletion_admin_approved', entity: 'one_time_registrations', entityId: rows[0].id });
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
      await logAction({ staffId: req.staff.id, action: 'one_time_registration.deletion_founder_approved_and_reset', entity: 'one_time_registrations', entityId: rows[0].id, oldValue: { registration_number: item.registration_number, registered_on: item.registered_on } });
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