'use strict';

const express = require('express');
const router = express.Router();
const { safeQuery } = require('../db/pool');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// ── my notifications, most recent first — ?unread=true to filter ──────────
router.get('/', async (req, res) => {
  try {
    const { unread } = req.query;
    const params = [req.staff.id];
    let where = `WHERE staff_id = $1`;
    if (unread === 'true') where += ` AND is_read = false`;

    const { rows } = await safeQuery(
      `SELECT * FROM staff_notifications ${where} ORDER BY created_at DESC LIMIT 100`,
      params
    );
    const { rows: [{ count }] } = await safeQuery(
      `SELECT COUNT(*) FROM staff_notifications WHERE staff_id = $1 AND is_read = false`,
      [req.staff.id]
    );
    res.json({ notifications: rows, unreadCount: Number(count) });
  } catch (err) {
    console.error('[notifications:list]', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

router.post('/:id/read', async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `UPDATE staff_notifications SET is_read = true WHERE id = $1 AND staff_id = $2 RETURNING *`,
      [req.params.id, req.staff.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Notification not found' });
    res.json({ notification: rows[0] });
  } catch (err) {
    console.error('[notifications:read]', err);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

router.post('/read-all', async (req, res) => {
  try {
    await safeQuery(`UPDATE staff_notifications SET is_read = true WHERE staff_id = $1 AND is_read = false`, [req.staff.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[notifications:read-all]', err);
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

module.exports = router;