'use strict';
// routes/productBetaUsers.js — beta/pilot testers and design partners,
// distinct from `parties` (real paying customers). Includes a /convert
// endpoint for when one of them becomes an actual customer, same pattern
// as marketingLeads.js and partnershipFirms.js.

const express = require('express');
const router = express.Router();
const { safeQuery } = require('../db/pool');
const { authenticate, requireRole, requireDepartmentHead } = require('../middleware/auth');
const { logAction } = require('../services/auditLog');

router.use(authenticate);

const PRODUCT_DEPARTMENT_NAME = 'Product';
function requireProductOrAdmin(req, res, next) {
  if (['owner', 'admin'].includes(req.staff.role)) return next();
  return requireDepartmentHead(PRODUCT_DEPARTMENT_NAME)(req, res, next);
}
function requireProductOrFinanceOrAdmin(req, res, next) {
  if (['owner', 'admin', 'finance'].includes(req.staff.role)) return next();
  return requireDepartmentHead(PRODUCT_DEPARTMENT_NAME)(req, res, next);
}

router.get('/', async (req, res) => {
  try {
    const { stage } = req.query;
    const params = [];
    let where = '';
    if (stage) { params.push(stage); where = `WHERE stage = $1`; }
    const { rows } = await safeQuery(`SELECT * FROM product_beta_users ${where} ORDER BY created_at DESC`, params);
    res.json({ betaUsers: rows });
  } catch (err) {
    console.error('[product-beta-users:list]', err);
    res.status(500).json({ error: 'Failed to fetch beta users' });
  }
});

router.post('/', requireProductOrAdmin, async (req, res) => {
  try {
    const { name, company_name, email, phone, stage, areas_of_interest, joined_date, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const { rows: [betaUser] } = await safeQuery(
      `INSERT INTO product_beta_users (name, company_name, email, phone, stage, areas_of_interest, joined_date, notes, created_by)
       VALUES ($1,$2,$3,$4,COALESCE($5,'waitlist'),COALESCE($6,'{}'),$7,$8,$9)
       RETURNING *`,
      [name, company_name || null, email || null, phone || null, stage || null,
       areas_of_interest || null, joined_date || null, notes || null, req.staff.id]
    );

    await logAction({ staffId: req.staff.id, action: 'product_beta_user.created', entity: 'product_beta_users', entityId: betaUser.id, newValue: { name: betaUser.name, stage: betaUser.stage } });

    res.status(201).json({ betaUser });
  } catch (err) {
    console.error('[product-beta-users:create]', err);
    res.status(500).json({ error: 'Failed to create beta user' });
  }
});

router.put('/:id', requireProductOrAdmin, async (req, res) => {
  try {
    const allowed = ['name', 'company_name', 'email', 'phone', 'stage', 'areas_of_interest', 'joined_date', 'notes'];
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

    const { rows: [before] } = await safeQuery(`SELECT * FROM product_beta_users WHERE id = $1`, [req.params.id]);
    if (!before) return res.status(404).json({ error: 'Beta user not found' });

    params.push(req.params.id);
    const { rows } = await safeQuery(`UPDATE product_beta_users SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params);

    await logAction({ staffId: req.staff.id, action: 'product_beta_user.updated', entity: 'product_beta_users', entityId: rows[0].id, oldValue: before, newValue: rows[0] });

    res.json({ betaUser: rows[0] });
  } catch (err) {
    console.error('[product-beta-users:update]', err);
    res.status(500).json({ error: 'Failed to update beta user' });
  }
});

// ── convert a beta user into a real CRM customer ────────────────────────────
router.post('/:id/convert', requireProductOrFinanceOrAdmin, async (req, res) => {
  try {
    const { rows: [betaUser] } = await safeQuery(`SELECT * FROM product_beta_users WHERE id = $1`, [req.params.id]);
    if (!betaUser) return res.status(404).json({ error: 'Beta user not found' });
    if (betaUser.converted_party_id) return res.status(409).json({ error: 'Already converted' });

    const partyName = betaUser.company_name || betaUser.name;
    const { rows: [party] } = await safeQuery(
      `INSERT INTO parties (name, party_type, email, phone, lead_source)
       VALUES ($1,'customer',$2,$3,'beta_program') RETURNING *`,
      [partyName, betaUser.email || null, betaUser.phone || null]
    );

    const { rows: [updated] } = await safeQuery(
      `UPDATE product_beta_users SET stage = 'active', converted_party_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [party.id, req.params.id]
    );

    await logAction({ staffId: req.staff.id, action: 'product_beta_user.converted', entity: 'product_beta_users', entityId: betaUser.id, newValue: { converted_party_id: party.id } });

    res.json({ betaUser: updated, party });
  } catch (err) {
    console.error('[product-beta-users:convert]', err);
    res.status(500).json({ error: 'Failed to convert beta user' });
  }
});

router.delete('/:id', requireRole('owner'), async (req, res) => {
  try {
    const { rows: [deleted] } = await safeQuery(`DELETE FROM product_beta_users WHERE id = $1 RETURNING id, name`, [req.params.id]);
    if (!deleted) return res.status(404).json({ error: 'Beta user not found' });
    await logAction({ staffId: req.staff.id, action: 'product_beta_user.deleted', entity: 'product_beta_users', entityId: deleted.id, oldValue: { name: deleted.name } });
    res.json({ deleted: true });
  } catch (err) {
    console.error('[product-beta-users:delete]', err);
    res.status(500).json({ error: 'Failed to delete beta user' });
  }
});

module.exports = router;