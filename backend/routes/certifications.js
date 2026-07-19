'use strict';
// routes/certifications.js
//
// Closes SRS §8.14's "Certifications: ISO, SOC 2" requirement. Multi-row
// registry — a company can hold several certifications simultaneously.
// When a certification is marked 'active' with an expiry_date, a single
// renewal-reminder compliance_item is spawned automatically
// (renewal_reminder_days before expiry, default 90) so it surfaces on the
// Dashboard and through the existing /compliance/run-reminders cron —
// no separate scheduler needed, same pattern as one_time_registrations.

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
    const { rows } = await safeQuery(
      `SELECT c.*, d.file_name AS certificate_file_name
       FROM certifications c
       LEFT JOIN documents d ON d.id = c.certificate_document_id
       ORDER BY c.expiry_date ASC NULLS LAST, c.created_at DESC`
    );
    res.json({ certifications: rows });
  } catch (err) {
    console.error('[certifications:list]', err);
    res.status(500).json({ error: 'Failed to fetch certifications' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows: [item] } = await safeQuery(`SELECT * FROM certifications WHERE id = $1`, [req.params.id]);
    if (!item) return res.status(404).json({ error: 'Certification not found' });
    res.json({ certification: item });
  } catch (err) {
    console.error('[certifications:get]', err);
    res.status(500).json({ error: 'Failed to fetch certification' });
  }
});

router.post('/', requireFinanceOrComplianceHead, async (req, res) => {
  try {
    const { cert_type, name, issuing_body, certificate_number, issued_date, expiry_date, status, renewal_reminder_days, notes } = req.body;
    if (!cert_type || !name) return res.status(400).json({ error: 'cert_type and name are required' });

    const { rows: [cert] } = await safeQuery(
      `INSERT INTO certifications (cert_type, name, issuing_body, certificate_number, issued_date, expiry_date, status, renewal_reminder_days, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7,'in_progress'),COALESCE($8,90),$9,$10) RETURNING *`,
      [cert_type, name, issuing_body || null, certificate_number || null, issued_date || null, expiry_date || null, status || null, renewal_reminder_days || null, notes || null, req.staff.id]
    );

    await logAction({ staffId: req.staff.id, action: 'certification.created', entity: 'certifications', entityId: cert.id, newValue: { name: cert.name, cert_type: cert.cert_type } });

    let reminderSpawned = false;
    if (cert.status === 'active' && cert.expiry_date) {
      reminderSpawned = await spawnRenewalReminderIfNeeded(cert, req.staff.id);
    }

    res.status(201).json({ certification: cert, reminderSpawned });
  } catch (err) {
    console.error('[certifications:create]', err);
    res.status(500).json({ error: 'Failed to create certification' });
  }
});

router.put('/:id', requireFinanceOrComplianceHead, async (req, res) => {
  try {
    const allowed = ['cert_type', 'name', 'issuing_body', 'certificate_number', 'issued_date', 'expiry_date', 'status', 'certificate_document_id', 'renewal_reminder_days', 'notes'];
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

    const { rows: [before] } = await safeQuery(`SELECT * FROM certifications WHERE id = $1`, [req.params.id]);
    if (!before) return res.status(404).json({ error: 'Certification not found' });

    params.push(req.params.id);
    const { rows } = await safeQuery(
      `UPDATE certifications SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );
    const cert = rows[0];

    await logAction({ staffId: req.staff.id, action: 'certification.updated', entity: 'certifications', entityId: cert.id, oldValue: before, newValue: cert });

    // If it just became active with an expiry date (or the expiry date changed),
    // (re)spawn the renewal reminder — spawnRenewalReminderIfNeeded is idempotent
    // per cert via reminder_compliance_item_id, so this is safe to call every edit.
    let reminderSpawned = false;
    if (cert.status === 'active' && cert.expiry_date) {
      reminderSpawned = await spawnRenewalReminderIfNeeded(cert, req.staff.id);
    }

    res.json({ certification: cert, reminderSpawned });
  } catch (err) {
    console.error('[certifications:update]', err);
    res.status(500).json({ error: 'Failed to update certification' });
  }
});

router.delete('/:id', requireRole('owner'), async (req, res) => {
  // Certifications are a free-form multi-row registry (unlike one_time_registrations'
  // fixed checklist), so a straightforward owner-only delete is appropriate here —
  // no two-stage approval needed, matching how the rest of the app treats simple
  // reference-data deletion vs. the specific two-stage flow reserved for the
  // one-time registrations checklist.
  try {
    const { rows: [deleted] } = await safeQuery(`DELETE FROM certifications WHERE id = $1 RETURNING id, name`, [req.params.id]);
    if (!deleted) return res.status(404).json({ error: 'Certification not found' });
    await logAction({ staffId: req.staff.id, action: 'certification.deleted', entity: 'certifications', entityId: deleted.id, oldValue: { name: deleted.name } });
    res.json({ deleted: true });
  } catch (err) {
    console.error('[certifications:delete]', err);
    res.status(500).json({ error: 'Failed to delete certification' });
  }
});

// Spawns exactly one renewal-reminder compliance_item per certification —
// tracked via reminder_compliance_item_id so repeated saves don't duplicate it.
async function spawnRenewalReminderIfNeeded(cert, staffId) {
  if (cert.reminder_compliance_item_id) return false; // already spawned

  const days = cert.renewal_reminder_days || 90;
  const dueDate = new Date(cert.expiry_date);
  dueDate.setDate(dueDate.getDate() - days);

  const { rows: [item] } = await safeQuery(
    `INSERT INTO compliance_items (category, title, description, due_date, recurring_interval, created_by, is_auto_generated, source_registration_slug)
     VALUES ('other', $1, $2, $3, NULL, $4, TRUE, $5) RETURNING id`,
    [
      `Renew certification: ${cert.name}`,
      `Certificate expires ${cert.expiry_date}. Renewal reminder set ${days} days before expiry.`,
      dueDate.toISOString().slice(0, 10),
      staffId,
      `certification:${cert.id}`,
    ]
  );

  await safeQuery(`UPDATE certifications SET reminder_compliance_item_id = $1 WHERE id = $2`, [item.id, cert.id]);
  return true;
}

module.exports = router;