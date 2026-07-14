'use strict';

const express = require('express');
const router = express.Router();
const { safeQuery } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `SELECT des.*, d.name AS department_name
       FROM designations des LEFT JOIN departments d ON d.id = des.department_id
       ORDER BY des.title`
    );
    res.json({ designations: rows });
  } catch (err) {
    console.error('[designations:list]', err);
    res.status(500).json({ error: 'Failed to fetch designations' });
  }
});

// Find-or-create by title — lets the employee form's designation field
// accept either an existing title or a brand new one without a separate
// "manage designations" screen. Not gated behind approval: creating a new
// job title isn't destructive.
router.post('/', requireRole('hr'), async (req, res) => {
  try {
    const { title, department_id } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: 'title is required' });

    const { rows } = await safeQuery(
      `INSERT INTO designations (title, department_id) VALUES ($1,$2)
       ON CONFLICT (title) DO UPDATE SET title = EXCLUDED.title
       RETURNING *`,
      [title.trim(), department_id || null]
    );
    res.status(201).json({ designation: rows[0] });
  } catch (err) {
    console.error('[designations:create]', err);
    res.status(500).json({ error: 'Failed to save designation' });
  }
});

module.exports = router;