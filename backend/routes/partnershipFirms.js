'use strict';
// routes/partnershipFirms.js — the BDE target account list: CA firms, audit
// firms, ESG consultancies. Includes CSV import (for migrating an existing
// Excel/Sheets tracker) and a /convert endpoint that promotes an
// active_partner firm into a real CRM `party`, same pattern as
// marketingLeads.js's lead conversion.

const express = require('express');
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const router = express.Router();
const { safeQuery } = require('../db/pool');
const { authenticate, requireRole, requireDepartmentHead } = require('../middleware/auth');
const { logAction } = require('../services/auditLog');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB cap for CSV

router.use(authenticate);

const PARTNERSHIPS_DEPARTMENT_NAME = 'Partnerships';
function requirePartnershipsOrAdmin(req, res, next) {
  if (['owner', 'admin'].includes(req.staff.role)) return next();
  return requireDepartmentHead(PARTNERSHIPS_DEPARTMENT_NAME)(req, res, next);
}
function requirePartnershipsOrFinanceOrAdmin(req, res, next) {
  if (['owner', 'admin', 'finance'].includes(req.staff.role)) return next();
  return requireDepartmentHead(PARTNERSHIPS_DEPARTMENT_NAME)(req, res, next);
}

const VALID_SERVICES = ['brsr', 'ghg', 'tcfd', 'cdp', 'gri', 'iso14064', 'other'];
const VALID_FIRM_TYPES = ['ca_firm', 'audit_firm', 'esg_consultancy', 'law_firm', 'other'];
const VALID_STAGES = ['prospect', 'contacted', 'meeting_scheduled', 'demo_done', 'partnership_discussion', 'active_partner', 'dormant', 'dead'];

router.get('/', async (req, res) => {
  try {
    const { stage, assigned_bde, service } = req.query;
    const params = [];
    const clauses = [];
    if (stage) { params.push(stage); clauses.push(`f.stage = $${params.length}`); }
    if (assigned_bde) { params.push(assigned_bde); clauses.push(`f.assigned_bde = $${params.length}`); }
    if (service) { params.push(service); clauses.push(`$${params.length} = ANY(f.services_offered)`); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const { rows } = await safeQuery(
      `SELECT f.*, e.full_name AS bde_name,
              (SELECT MAX(next_follow_up_date) FROM partnership_activities a WHERE a.firm_id = f.id) AS next_follow_up_date,
              (SELECT COUNT(*)::int FROM partnership_activities a WHERE a.firm_id = f.id) AS activity_count
       FROM partnership_firms f
       LEFT JOIN employees e ON e.id = f.assigned_bde
       ${where}
       ORDER BY f.updated_at DESC`,
      params
    );
    res.json({ firms: rows });
  } catch (err) {
    console.error('[partnership-firms:list]', err);
    res.status(500).json({ error: 'Failed to fetch firms' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows: [firm] } = await safeQuery(`SELECT * FROM partnership_firms WHERE id = $1`, [req.params.id]);
    if (!firm) return res.status(404).json({ error: 'Firm not found' });

    const { rows: activities } = await safeQuery(
      `SELECT a.*, s.email AS logged_by_email FROM partnership_activities a
       LEFT JOIN staff_accounts s ON s.id = a.logged_by
       WHERE a.firm_id = $1 ORDER BY a.activity_date DESC, a.created_at DESC`,
      [req.params.id]
    );

    res.json({ firm, activities });
  } catch (err) {
    console.error('[partnership-firms:get]', err);
    res.status(500).json({ error: 'Failed to fetch firm' });
  }
});

router.post('/', requirePartnershipsOrAdmin, async (req, res) => {
  try {
    const {
      firm_name, firm_type, city, services_offered, firm_size, contact_name, designation,
      email, phone, stage, source, assigned_bde, website, notes,
    } = req.body;
    if (!firm_name) return res.status(400).json({ error: 'firm_name is required' });

    const { rows: [firm] } = await safeQuery(
      `INSERT INTO partnership_firms
        (firm_name, firm_type, city, services_offered, firm_size, contact_name, designation, email, phone, stage, source, assigned_bde, website, notes, created_by)
       VALUES ($1,COALESCE($2,'ca_firm'),$3,COALESCE($4,'{}'),COALESCE($5,'unknown'),$6,$7,$8,$9,COALESCE($10,'prospect'),COALESCE($11,'cold_outreach'),$12,$13,$14,$15)
       RETURNING *`,
      [firm_name, firm_type || null, city || null, services_offered || null, firm_size || null,
       contact_name || null, designation || null, email || null, phone || null, stage || null,
       source || null, assigned_bde || null, website || null, notes || null, req.staff.id]
    );

    await logAction({ staffId: req.staff.id, action: 'partnership_firm.created', entity: 'partnership_firms', entityId: firm.id, newValue: { firm_name: firm.firm_name, stage: firm.stage } });

    res.status(201).json({ firm });
  } catch (err) {
    console.error('[partnership-firms:create]', err);
    res.status(500).json({ error: 'Failed to create firm' });
  }
});

router.put('/:id', requirePartnershipsOrAdmin, async (req, res) => {
  try {
    const allowed = [
      'firm_name', 'firm_type', 'city', 'services_offered', 'firm_size', 'contact_name', 'designation',
      'email', 'phone', 'stage', 'source', 'assigned_bde', 'website', 'notes',
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

    const { rows: [before] } = await safeQuery(`SELECT * FROM partnership_firms WHERE id = $1`, [req.params.id]);
    if (!before) return res.status(404).json({ error: 'Firm not found' });

    params.push(req.params.id);
    const { rows } = await safeQuery(`UPDATE partnership_firms SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params);

    await logAction({ staffId: req.staff.id, action: 'partnership_firm.updated', entity: 'partnership_firms', entityId: rows[0].id, oldValue: before, newValue: rows[0] });

    res.json({ firm: rows[0] });
  } catch (err) {
    console.error('[partnership-firms:update]', err);
    res.status(500).json({ error: 'Failed to update firm' });
  }
});

// ── convert an active partner firm into a CRM party ─────────────────────────
router.post('/:id/convert', requirePartnershipsOrFinanceOrAdmin, async (req, res) => {
  try {
    const { rows: [firm] } = await safeQuery(`SELECT * FROM partnership_firms WHERE id = $1`, [req.params.id]);
    if (!firm) return res.status(404).json({ error: 'Firm not found' });
    if (firm.converted_party_id) return res.status(409).json({ error: 'Firm already converted' });

    const { rows: [party] } = await safeQuery(
      `INSERT INTO parties (name, party_type, email, phone, lead_source)
       VALUES ($1,'customer',$2,$3,'partnership') RETURNING *`,
      [firm.firm_name, firm.email || null, firm.phone || null]
    );

    const { rows: [updatedFirm] } = await safeQuery(
      `UPDATE partnership_firms SET converted_party_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [party.id, req.params.id]
    );

    await logAction({ staffId: req.staff.id, action: 'partnership_firm.converted', entity: 'partnership_firms', entityId: firm.id, newValue: { converted_party_id: party.id } });

    res.json({ firm: updatedFirm, party });
  } catch (err) {
    console.error('[partnership-firms:convert]', err);
    res.status(500).json({ error: 'Failed to convert firm' });
  }
});

// ── CSV import — migrate an existing Excel/Sheets tracker ──────────────────
// Expected headers (case-insensitive, order doesn't matter):
// firm_name, firm_type, city, services_offered, firm_size, contact_name,
// designation, email, phone, stage, source, website, notes
// services_offered: pipe- or comma-separated, e.g. "brsr|ghg|tcfd"
router.post('/import-csv', requirePartnershipsOrAdmin, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded (field name must be "file")' });

  try {
    const records = parse(req.file.buffer, { columns: (header) => header.map((h) => h.trim().toLowerCase().replace(/\s+/g, '_')), skip_empty_lines: true, trim: true });

    if (!records.length) return res.status(400).json({ error: 'CSV has no rows' });

    const results = { imported: 0, skipped: 0, errors: [] };

    for (const [i, row] of records.entries()) {
      const firm_name = row.firm_name || row.name || row.firm || '';
      if (!firm_name.trim()) {
        results.skipped++;
        results.errors.push(`Row ${i + 2}: missing firm_name`);
        continue;
      }

      const firm_type = VALID_FIRM_TYPES.includes((row.firm_type || '').toLowerCase()) ? row.firm_type.toLowerCase() : 'other';
      const stage = VALID_STAGES.includes((row.stage || '').toLowerCase()) ? row.stage.toLowerCase() : 'prospect';
      const services = (row.services_offered || row.services || '')
        .split(/[|,]/).map((s) => s.trim().toLowerCase()).filter((s) => VALID_SERVICES.includes(s));

      try {
        await safeQuery(
          `INSERT INTO partnership_firms
            (firm_name, firm_type, city, services_offered, contact_name, designation, email, phone, stage, website, notes, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [firm_name.trim(), firm_type, row.city || null, services.length ? services : null,
           row.contact_name || row.contact || null, row.designation || null, row.email || null,
           row.phone || row.mobile || null, stage, row.website || null, row.notes || null, req.staff.id]
        );
        results.imported++;
      } catch (rowErr) {
        results.skipped++;
        results.errors.push(`Row ${i + 2} (${firm_name}): ${rowErr.message}`);
      }
    }

    await logAction({ staffId: req.staff.id, action: 'partnership_firm.csv_imported', entity: 'partnership_firms', newValue: { imported: results.imported, skipped: results.skipped } });

    res.json(results);
  } catch (err) {
    console.error('[partnership-firms:import-csv]', err);
    res.status(500).json({ error: 'Failed to parse or import CSV' });
  }
});

router.delete('/:id', requireRole('owner'), async (req, res) => {
  try {
    const { rows: [deleted] } = await safeQuery(`DELETE FROM partnership_firms WHERE id = $1 RETURNING id, firm_name`, [req.params.id]);
    if (!deleted) return res.status(404).json({ error: 'Firm not found' });
    await logAction({ staffId: req.staff.id, action: 'partnership_firm.deleted', entity: 'partnership_firms', entityId: deleted.id, oldValue: { firm_name: deleted.firm_name } });
    res.json({ deleted: true });
  } catch (err) {
    console.error('[partnership-firms:delete]', err);
    res.status(500).json({ error: 'Failed to delete firm' });
  }
});

module.exports = router;