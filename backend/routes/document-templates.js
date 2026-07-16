'use strict';

const express = require('express');
const router = express.Router();
const { safeQuery } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const auditLog = require('../services/auditLog');

router.use(authenticate);

// ── list templates ──────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { category, is_active } = req.query;
    const conditions = [];
    const params = [];
    if (category) { params.push(category); conditions.push(`category = $${params.length}`); }
    if (is_active !== undefined) { params.push(is_active === 'true'); conditions.push(`is_active = $${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await safeQuery(`SELECT * FROM document_templates ${where} ORDER BY category, name`, params);
    res.json({ templates: rows });
  } catch (err) {
    console.error('[document-templates:list]', err);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// ── get one template by code (used by the "generate" form to pull field defs) ─
router.get('/:code', async (req, res) => {
  try {
    const { rows: [template] } = await safeQuery(`SELECT * FROM document_templates WHERE code = $1`, [req.params.code]);
    if (!template) return res.status(404).json({ error: 'Template not found' });
    res.json({ template });
  } catch (err) {
    console.error('[document-templates:get]', err);
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

// ── create a new template (this is how Phase 2's ~50 document types get added — ──
// ── no code changes needed, just a row) ─────────────────────────────────────
router.post('/', requireRole('admin', 'hr'), async (req, res) => {
  try {
    const { code, name, category, department_code, title_on_page, body, fields,
            requires_seal, requires_signature, requires_qr } = req.body;
    if (!code || !name || !category || !department_code || !title_on_page || !body) {
      return res.status(400).json({ error: 'code, name, category, department_code, title_on_page, body are required' });
    }
    const { rows: [template] } = await safeQuery(
      `INSERT INTO document_templates
         (code, name, category, department_code, title_on_page, body, fields, requires_seal, requires_signature, requires_qr, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11) RETURNING *`,
      [code.toUpperCase().replace(/\s+/g, '_'), name, category, department_code.toUpperCase(), title_on_page, body,
       JSON.stringify(fields || []), requires_seal !== false, requires_signature !== false, requires_qr !== false, req.staff.id]
    );
    await auditLog.logAction({ staffId: req.staff.id, action: 'document_template.created', entity: 'document_templates', entityId: template.id, newValue: { code: template.code } });
    res.status(201).json({ template });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'A template with this code already exists' });
    console.error('[document-templates:create]', err);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// ── update a template — bumps `version` whenever `body` changes, since ─────
// ── generated_documents.template_version records which wording was used ────
router.put('/:id', requireRole('admin', 'hr'), async (req, res) => {
  try {
    const { rows: [existing] } = await safeQuery(`SELECT * FROM document_templates WHERE id = $1`, [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Template not found' });

    const { name, title_on_page, body, fields, requires_seal, requires_signature, requires_qr, is_active } = req.body;
    const bodyChanged = body !== undefined && body !== existing.body;

    const { rows: [updated] } = await safeQuery(
      `UPDATE document_templates SET
         name = COALESCE($1, name),
         title_on_page = COALESCE($2, title_on_page),
         body = COALESCE($3, body),
         fields = COALESCE($4, fields),
         requires_seal = COALESCE($5, requires_seal),
         requires_signature = COALESCE($6, requires_signature),
         requires_qr = COALESCE($7, requires_qr),
         is_active = COALESCE($8, is_active),
         version = version + $9,
         updated_by = $10
       WHERE id = $11 RETURNING *`,
      [name, title_on_page, body, fields ? JSON.stringify(fields) : null, requires_seal, requires_signature,
       requires_qr, is_active, bodyChanged ? 1 : 0, req.staff.id, req.params.id]
    );
    await auditLog.logAction({ staffId: req.staff.id, action: 'document_template.updated', entity: 'document_templates', entityId: updated.id, oldValue: { version: existing.version }, newValue: { version: updated.version } });
    res.json({ template: updated });
  } catch (err) {
    console.error('[document-templates:update]', err);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

// ── deactivate (never hard-delete — generated_documents reference the row) ─
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const { rows: [updated] } = await safeQuery(
      `UPDATE document_templates SET is_active = false WHERE id = $1 RETURNING *`, [req.params.id]
    );
    if (!updated) return res.status(404).json({ error: 'Template not found' });
    await auditLog.logAction({ staffId: req.staff.id, action: 'document_template.deactivated', entity: 'document_templates', entityId: updated.id });
    res.json({ template: updated });
  } catch (err) {
    console.error('[document-templates:deactivate]', err);
    res.status(500).json({ error: 'Failed to deactivate template' });
  }
});

module.exports = router;
