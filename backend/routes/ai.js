'use strict';

const express = require('express');
const router = express.Router();
const { safeQuery } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const { askAssistant } = require('../services/aiAssistant');

router.use(authenticate);

// Financial/operational data is broad here — restrict to the same privileged
// roles that can already see company-wide numbers elsewhere in the app.
router.post('/query', requireRole('finance'), async (req, res) => {
  try {
    const { question } = req.body;
    if (!question || !question.trim()) return res.status(400).json({ error: 'question is required' });

    const { answer, toolsUsed } = await askAssistant(question.trim());

    await safeQuery(
      `INSERT INTO ai_chat_log (staff_id, question, answer, tools_used) VALUES ($1,$2,$3,$4)`,
      [req.staff.id, question.trim(), answer, toolsUsed]
    );

    res.json({ answer, toolsUsed });
  } catch (err) {
    console.error('[ai:query]', err);
    res.status(500).json({ error: err.message || 'Failed to process your question' });
  }
});

router.get('/history', requireRole('finance'), async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `SELECT * FROM ai_chat_log WHERE staff_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [req.staff.id]
    );
    res.json({ history: rows.reverse() });
  } catch (err) {
    console.error('[ai:history]', err);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

module.exports = router;