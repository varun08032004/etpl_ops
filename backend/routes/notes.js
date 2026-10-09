'use strict';

const express = require('express');
const router = express.Router();
const { safeQuery } = require('../db/pool');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// ── List my notes ──────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    if (!req.staff.employee_id) {
      return res.status(404).json({ error: 'This login is not linked to an employee record' });
    }
    const { rows } = await safeQuery(
      `SELECT * FROM employee_notes WHERE employee_id = $1 ORDER BY is_pinned DESC, updated_at DESC`,
      [req.staff.employee_id]
    );
    res.json({ notes: rows });
  } catch (err) {
    console.error('[notes:list]', err);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

// ── Download note as .txt ──────────────────────────────────────────────────────
router.get('/:id/download', async (req, res) => {
  try {
    if (!req.staff.employee_id) {
      return res.status(404).json({ error: 'This login is not linked to an employee record' });
    }
    const { rows: [note] } = await safeQuery(
      `SELECT * FROM employee_notes WHERE id = $1 AND employee_id = $2`,
      [req.params.id, req.staff.employee_id]
    );
    if (!note) return res.status(404).json({ error: 'Note not found' });
    
    const content = `${note.title}\n\n${note.content || ''}\n\n---\nCreated: ${new Date(note.created_at).toLocaleString()}\nUpdated: ${new Date(note.updated_at).toLocaleString()}`;
    const filename = `${note.title.replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
    
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  } catch (err) {
    console.error('[notes:download]', err);
    res.status(500).json({ error: 'Failed to download note' });
  }
});

// ── Get single note ────────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    if (!req.staff.employee_id) {
      return res.status(404).json({ error: 'This login is not linked to an employee record' });
    }
    const { rows: [note] } = await safeQuery(
      `SELECT * FROM employee_notes WHERE id = $1 AND employee_id = $2`,
      [req.params.id, req.staff.employee_id]
    );
    if (!note) return res.status(404).json({ error: 'Note not found' });
    res.json({ note });
  } catch (err) {
    console.error('[notes:get]', err);
    res.status(500).json({ error: 'Failed to fetch note' });
  }
});

// ── Create note ────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    if (!req.staff.employee_id) {
      return res.status(404).json({ error: 'This login is not linked to an employee record' });
    }
    const { title, content, is_pinned } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });

    const { rows: [note] } = await safeQuery(
      `INSERT INTO employee_notes (employee_id, title, content, is_pinned)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.staff.employee_id, title.trim(), content || null, is_pinned || false]
    );
    res.status(201).json({ note });
  } catch (err) {
    console.error('[notes:create]', err);
    res.status(500).json({ error: 'Failed to create note' });
  }
});

// ── Update note ────────────────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    if (!req.staff.employee_id) {
      return res.status(404).json({ error: 'This login is not linked to an employee record' });
    }
    const { title, content, is_pinned } = req.body;
    const sets = [];
    const params = [];
    let paramIndex = 1;

    if (title !== undefined) {
      if (!title.trim()) return res.status(400).json({ error: 'Title cannot be empty' });
      params.push(title.trim());
      sets.push(`title = $${paramIndex++}`);
    }
    if (content !== undefined) {
      params.push(content);
      sets.push(`content = $${paramIndex++}`);
    }
    if (is_pinned !== undefined) {
      params.push(is_pinned);
      sets.push(`is_pinned = $${paramIndex++}`);
    }
    if (!sets.length) return res.status(400).json({ error: 'No valid fields to update' });

    params.push(req.params.id);
    params.push(req.staff.employee_id);

    const { rows: [note] } = await safeQuery(
      `UPDATE employee_notes SET ${sets.join(', ')}, updated_at = NOW()
       WHERE id = $${paramIndex++} AND employee_id = $${paramIndex} RETURNING *`,
      params
    );
    if (!note) return res.status(404).json({ error: 'Note not found' });
    res.json({ note });
  } catch (err) {
    console.error('[notes:update]', err);
    res.status(500).json({ error: 'Failed to update note' });
  }
});

// ── Delete note ────────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    if (!req.staff.employee_id) {
      return res.status(404).json({ error: 'This login is not linked to an employee record' });
    }
    const { rows } = await safeQuery(
      `DELETE FROM employee_notes WHERE id = $1 AND employee_id = $2 RETURNING id`,
      [req.params.id, req.staff.employee_id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Note not found' });
    res.json({ deleted: true });
  } catch (err) {
    console.error('[notes:delete]', err);
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

module.exports = router;