'use strict';

const express = require('express');
const router = express.Router();
const { safeQuery } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { type } = req.query; // 'customer' | 'vendor' | 'both'
    const params = [];
    let where = '';
    if (type) { params.push(type); where = `WHERE party_type = $1 OR party_type = 'both'`; }
    const { rows } = await safeQuery(
      `SELECT * FROM parties ${where} ORDER BY name`, params
    );
    res.json({ parties: rows });
  } catch (err) {
    console.error('[parties:list]', err);
    res.status(500).json({ error: 'Failed to fetch parties' });
  }
});

router.post('/', requireRole('finance'), async (req, res) => {
  try {
    const { name, party_type, email, phone, gstin, billing_address, state, payment_terms_days } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const { rows: [party] } = await safeQuery(
      `INSERT INTO parties (name, party_type, email, phone, gstin, billing_address, state, payment_terms_days)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [name, party_type || 'customer', email || null, phone || null, gstin || null,
       billing_address || null, state || null, payment_terms_days || 30]
    );
    res.status(201).json({ party });
  } catch (err) {
    console.error('[parties:create]', err);
    res.status(500).json({ error: 'Failed to create party' });
  }
});

router.put('/:id', requireRole('finance'), async (req, res) => {
  try {
    const allowed = ['name', 'party_type', 'email', 'phone', 'gstin', 'billing_address', 'state', 'payment_terms_days', 'is_active'];
    const sets = [];
    const params = [];
    for (const key of allowed) {
      if (key in req.body) { params.push(req.body[key]); sets.push(`${key} = $${params.length}`); }
    }
    if (!sets.length) return res.status(400).json({ error: 'No valid fields to update' });
    params.push(req.params.id);
    const { rows } = await safeQuery(`UPDATE parties SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params);
    if (!rows.length) return res.status(404).json({ error: 'Party not found' });
    res.json({ party: rows[0] });
  } catch (err) {
    console.error('[parties:update]', err);
    res.status(500).json({ error: 'Failed to update party' });
  }
});

module.exports = router;
