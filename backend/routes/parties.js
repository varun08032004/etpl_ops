'use strict';
// routes/parties.js — extended for CRM (SRS §8.2)
//
// parties IS the CRM's "company" entity — not a separate customers table.
// Sales' mark-won flow already creates rows here; Invoices bills against
// them; journal_lines.party_id references them. This file adds what CRM
// needs on top: GSTIN validation, contacts, a unified timeline, and merge —
// without ever duplicating that entity.

const express = require('express');
const router = express.Router();
const { safeQuery, withTransaction } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const { logAction } = require('../services/auditLog');
const { registerApprovalAction, createApprovalRequest } = require('../services/approvals');

router.use(authenticate);

// CRM-01: format validation before any GSTIN is saved. Real 15-char Indian
// GSTIN structure: 2-digit state code, 10-char PAN, 1-char entity number,
// 'Z' by default, 1-char checksum.
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

function validateGstin(gstin) {
  if (!gstin) return null; // optional field
  if (!GSTIN_REGEX.test(gstin)) {
    return 'Invalid GSTIN format — expected 15 characters (e.g. 27ABCDE1234F1Z5)';
  }
  return null;
}

// ── list ─────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { party_type, search } = req.query;
    const conditions = [`merged_into_party_id IS NULL`]; // merged-away records don't show up in normal listing
    const params = [];
    if (party_type) { params.push(party_type); conditions.push(`party_type = $${params.length}`); }
    if (search) { params.push(`%${search}%`); conditions.push(`(name ILIKE $${params.length} OR gstin ILIKE $${params.length})`); }
    const { rows } = await safeQuery(
      `SELECT * FROM parties WHERE ${conditions.join(' AND ')} ORDER BY name`,
      params
    );
    res.json({ parties: rows });
  } catch (err) {
    console.error('[parties:list]', err);
    res.status(500).json({ error: 'Failed to fetch parties' });
  }
});

// ── CRM-04: full detail with the unified timeline — deals, quotations,
// invoices, documents, and manual notes, all in one place ──────────────────
router.get('/:id', async (req, res) => {
  try {
    const { rows: [party] } = await safeQuery(`SELECT * FROM parties WHERE id = $1`, [req.params.id]);
    if (!party) return res.status(404).json({ error: 'Party not found' });

    const [contacts, deals, invoices, documents, notes] = await Promise.all([
      safeQuery(`SELECT * FROM contacts WHERE party_id = $1 ORDER BY full_name`, [req.params.id]),
      safeQuery(`SELECT id, company_name, stage, deal_value, updated_at FROM deals WHERE converted_party_id = $1 ORDER BY updated_at DESC`, [req.params.id]),
      safeQuery(`SELECT id, invoice_number, status, total_amount, amount_paid, created_at FROM invoices WHERE party_id = $1 ORDER BY created_at DESC LIMIT 50`, [req.params.id]),
      safeQuery(`SELECT id, title, doc_type, created_at FROM documents WHERE entity_type = 'party' AND entity_id = $1 ORDER BY created_at DESC`, [req.params.id]),
      safeQuery(
        `SELECT pn.*, sa.email AS created_by_email FROM party_notes pn
         LEFT JOIN staff_accounts sa ON sa.id = pn.created_by
         WHERE pn.party_id = $1 ORDER BY pn.created_at DESC`,
        [req.params.id]
      ),
    ]);

    // Unified timeline: merge deals/invoices/documents/notes into one
    // chronological feed rather than making the UI stitch four separate lists.
    const timeline = [
      ...deals.rows.map((d) => ({ type: 'deal', at: d.updated_at, data: d })),
      ...invoices.rows.map((i) => ({ type: 'invoice', at: i.created_at, data: i })),
      ...documents.rows.map((d) => ({ type: 'document', at: d.created_at, data: d })),
      ...notes.rows.map((n) => ({ type: 'note', at: n.created_at, data: n })),
    ].sort((a, b) => new Date(b.at) - new Date(a.at));

    res.json({ party, contacts: contacts.rows, timeline });
  } catch (err) {
    console.error('[parties:get]', err);
    res.status(500).json({ error: 'Failed to fetch party' });
  }
});

router.post('/', requireRole('finance'), async (req, res) => {
  try {
    const { name, party_type, email, phone, gstin, pan, cin, industry, employee_band, turnover_band, lead_source } = req.body;
    if (!name || !party_type) return res.status(400).json({ error: 'name and party_type are required' });

    const gstinError = validateGstin(gstin);
    if (gstinError) return res.status(400).json({ error: gstinError });

    const { rows: [party] } = await safeQuery(
      `INSERT INTO parties (name, party_type, email, phone, gstin, pan, cin, industry, employee_band, turnover_band, lead_source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [name, party_type, email || null, phone || null, gstin || null, pan || null, cin || null,
       industry || null, employee_band || null, turnover_band || null, lead_source || null]
    );

    await logAction({ staffId: req.staff.id, action: 'party.created', entity: 'parties', entityId: party.id, newValue: { name: party.name, party_type } });
    res.status(201).json({ party });
  } catch (err) {
    console.error('[parties:create]', err);
    res.status(500).json({ error: 'Failed to create party' });
  }
});

router.put('/:id', requireRole('finance'), async (req, res) => {
  try {
    if ('gstin' in req.body) {
      const gstinError = validateGstin(req.body.gstin);
      if (gstinError) return res.status(400).json({ error: gstinError });
    }
    const allowed = [
      'name', 'party_type', 'email', 'phone', 'gstin', 'pan', 'cin', 'industry',
      'employee_band', 'turnover_band', 'lead_source', 'health_score', 'renewal_date',
      'esg_status', 'crm_notes', 'is_active',
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

    const { rows: [before] } = await safeQuery(`SELECT * FROM parties WHERE id = $1`, [req.params.id]);
    if (!before) return res.status(404).json({ error: 'Party not found' });

    params.push(req.params.id);
    const { rows: [updated] } = await safeQuery(
      `UPDATE parties SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );

    // CRM-02: audit trail on every company-record change.
    await logAction({
      staffId: req.staff.id, action: 'party.updated', entity: 'parties', entityId: updated.id,
      oldValue: Object.fromEntries(allowed.filter((k) => k in req.body).map((k) => [k, before[k]])),
      newValue: Object.fromEntries(allowed.filter((k) => k in req.body).map((k) => [k, updated[k]])),
    });

    res.json({ party: updated });
  } catch (err) {
    console.error('[parties:update]', err);
    res.status(500).json({ error: 'Failed to update party' });
  }
});

// ── contacts ─────────────────────────────────────────────────────────────
router.post('/:id/contacts', requireRole('finance'), async (req, res) => {
  try {
    const { full_name, role, email, phone, communication_preference } = req.body;
    if (!full_name) return res.status(400).json({ error: 'full_name is required' });
    const { rows: [contact] } = await safeQuery(
      `INSERT INTO contacts (party_id, full_name, role, email, phone, communication_preference)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.params.id, full_name, role || null, email || null, phone || null, communication_preference || null]
    );
    res.status(201).json({ contact });
  } catch (err) {
    console.error('[parties:contacts:create]', err);
    res.status(500).json({ error: 'Failed to add contact' });
  }
});

router.put('/contacts/:contactId', requireRole('finance'), async (req, res) => {
  try {
    const allowed = ['full_name', 'role', 'email', 'phone', 'communication_preference'];
    const sets = [];
    const params = [];
    for (const key of allowed) {
      if (key in req.body) { params.push(req.body[key]); sets.push(`${key} = $${params.length}`); }
    }
    if (!sets.length) return res.status(400).json({ error: 'No valid fields to update' });
    params.push(req.params.contactId);
    const { rows } = await safeQuery(`UPDATE contacts SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params);
    if (!rows.length) return res.status(404).json({ error: 'Contact not found' });
    res.json({ contact: rows[0] });
  } catch (err) {
    console.error('[parties:contacts:update]', err);
    res.status(500).json({ error: 'Failed to update contact' });
  }
});

router.delete('/contacts/:contactId', requireRole('finance'), async (req, res) => {
  try {
    // A contact is just a person's details, not financially load-bearing —
    // unlike employees/parties, a real delete here doesn't break any
    // historical record, so no soft-delete/approval needed.
    const { rows } = await safeQuery(`DELETE FROM contacts WHERE id = $1 RETURNING id`, [req.params.contactId]);
    if (!rows.length) return res.status(404).json({ error: 'Contact not found' });
    res.json({ deleted: true });
  } catch (err) {
    console.error('[parties:contacts:delete]', err);
    res.status(500).json({ error: 'Failed to delete contact' });
  }
});

// ── manual timeline notes ───────────────────────────────────────────────────
router.post('/:id/notes', async (req, res) => {
  try {
    const { note } = req.body;
    if (!note || !note.trim()) return res.status(400).json({ error: 'note is required' });
    const { rows: [created] } = await safeQuery(
      `INSERT INTO party_notes (party_id, note, created_by) VALUES ($1,$2,$3) RETURNING *`,
      [req.params.id, note.trim(), req.staff.id]
    );
    res.status(201).json({ note: created });
  } catch (err) {
    console.error('[parties:notes:create]', err);
    res.status(500).json({ error: 'Failed to add note' });
  }
});

// ── CRM-03: merge duplicate company records without losing linked history ──
// Re-points every FK that references the duplicate (deals, invoices,
// journal_lines, contacts, documents, notes) onto the canonical party, then
// marks the duplicate merged (never hard-deleted — same "preserve history"
// principle used everywhere else in this codebase). Touches financial
// records (invoices, journal_lines) directly, so it's more conservative
// than the other approval-gated actions: only the owner acts immediately;
// admin AND finance both route through Founder approval here, not just admin.
async function mergeParties(duplicateId, payload) {
  const { canonicalId } = payload;
  return withTransaction(async (client) => {
    await client.query(`UPDATE deals SET converted_party_id = $1 WHERE converted_party_id = $2`, [canonicalId, duplicateId]);
    await client.query(`UPDATE invoices SET party_id = $1 WHERE party_id = $2`, [canonicalId, duplicateId]);
    await client.query(`UPDATE journal_lines SET party_id = $1 WHERE party_id = $2`, [canonicalId, duplicateId]);
    await client.query(`UPDATE contacts SET party_id = $1 WHERE party_id = $2`, [canonicalId, duplicateId]);
    await client.query(`UPDATE party_notes SET party_id = $1 WHERE party_id = $2`, [canonicalId, duplicateId]);
    await client.query(`UPDATE documents SET entity_id = $1 WHERE entity_type = 'party' AND entity_id = $2`, [canonicalId, duplicateId]);
    const { rows: [merged] } = await client.query(
      `UPDATE parties SET merged_into_party_id = $1, is_active = false WHERE id = $2 RETURNING *`,
      [canonicalId, duplicateId]
    );
    return merged;
  });
}
registerApprovalAction('party.merge', (targetId, payload) => mergeParties(targetId, payload));

router.post('/:id/merge', requireRole('finance'), async (req, res) => {
  try {
    const { canonical_party_id, reason } = req.body;
    if (!canonical_party_id) return res.status(400).json({ error: 'canonical_party_id is required — which record should survive?' });
    if (canonical_party_id === req.params.id) return res.status(400).json({ error: 'Cannot merge a party into itself' });

    const { rows: [duplicate] } = await safeQuery(`SELECT id, name FROM parties WHERE id = $1`, [req.params.id]);
    if (!duplicate) return res.status(404).json({ error: 'Party to merge not found' });
    const { rows: [canonical] } = await safeQuery(`SELECT id, name FROM parties WHERE id = $1`, [canonical_party_id]);
    if (!canonical) return res.status(404).json({ error: 'Canonical party not found' });

    if (req.staff.role === 'owner') {
      const merged = await mergeParties(req.params.id, { canonicalId: canonical_party_id });
      await logAction({ staffId: req.staff.id, action: 'party.merged', entity: 'parties', entityId: duplicate.id, newValue: { mergedInto: canonical.name } });
      return res.json({ party: merged });
    }

    const request = await createApprovalRequest({
      actionType: 'party.merge',
      targetType: 'party',
      targetId: duplicate.id,
      targetLabel: `${duplicate.name} → ${canonical.name}`,
      requestedBy: req.staff.id,
      reason: reason || null,
      payload: { canonicalId: canonical_party_id },
    });

    res.status(202).json({
      pending: true,
      request,
      message: `Merging "${duplicate.name}" into "${canonical.name}" requested — awaiting Founder approval.`,
    });
  } catch (err) {
    console.error('[parties:merge]', err);
    res.status(500).json({ error: 'Failed to process merge' });
  }
});

module.exports = router;