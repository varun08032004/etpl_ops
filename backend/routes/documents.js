'use strict';

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { safeQuery } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const storage = require('../services/storage');

router.use(authenticate);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } }); // 20MB cap

function safeFileName(name) {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
}

// ── upload a new document ───────────────────────────────────────────────────
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'File required (multipart field name: "file")' });

    const { title, doc_type, entity_type, entity_id, expiry_date, tags } = req.body;
    if (!title || !doc_type) return res.status(400).json({ error: 'title and doc_type are required' });

    const timestamp = Date.now();
    const cleanName = safeFileName(req.file.originalname);
    const folder = entity_type && entity_id ? `${entity_type}/${entity_id}` : (entity_type || 'company');
    const storagePath = `${folder}/${timestamp}-${cleanName}`;

    await storage.uploadFile(storagePath, req.file.buffer, req.file.mimetype);

    const parsedTags = tags ? (Array.isArray(tags) ? tags : tags.split(',').map((t) => t.trim())) : null;

    const { rows: [doc] } = await safeQuery(
      `INSERT INTO documents (title, doc_type, entity_type, entity_id, storage_path, file_name, file_size_bytes, mime_type, expiry_date, tags, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [title, doc_type, entity_type || 'company', entity_id || null, storagePath, req.file.originalname,
       req.file.size, req.file.mimetype, expiry_date || null, parsedTags, req.staff.id]
    );

    res.status(201).json({ document: doc });
  } catch (err) {
    console.error('[documents:upload]', err);
    res.status(500).json({ error: err.message || 'Failed to upload document' });
  }
});

// ── upload a NEW VERSION of an existing document ────────────────────────────
router.post('/:id/new-version', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'File required' });

    const { rows: [existing] } = await safeQuery(`SELECT * FROM documents WHERE id = $1`, [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Document not found' });

    const timestamp = Date.now();
    const cleanName = safeFileName(req.file.originalname);
    const folder = existing.entity_id ? `${existing.entity_type}/${existing.entity_id}` : existing.entity_type;
    const storagePath = `${folder}/${timestamp}-${cleanName}`;

    await storage.uploadFile(storagePath, req.file.buffer, req.file.mimetype);

    const { rows: [newDoc] } = await safeQuery(
      `INSERT INTO documents (title, doc_type, entity_type, entity_id, storage_path, file_name, file_size_bytes, mime_type, expiry_date, tags, version, supersedes_id, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [existing.title, existing.doc_type, existing.entity_type, existing.entity_id, storagePath,
       req.file.originalname, req.file.size, req.file.mimetype, existing.expiry_date, existing.tags,
       existing.version + 1, existing.id, req.staff.id]
    );

    await safeQuery(`UPDATE documents SET is_current = false WHERE id = $1`, [existing.id]);

    res.status(201).json({ document: newDoc });
  } catch (err) {
    console.error('[documents:new-version]', err);
    res.status(500).json({ error: err.message || 'Failed to upload new version' });
  }
});

// ── list documents (filter by entity, or get everything) ───────────────────
router.get('/', async (req, res) => {
  try {
    const { entity_type, entity_id, doc_type, current_only } = req.query;
    const conditions = [];
    const params = [];
    if (entity_type) { params.push(entity_type); conditions.push(`entity_type = $${params.length}`); }
    if (entity_id) { params.push(entity_id); conditions.push(`entity_id = $${params.length}`); }
    if (doc_type) { params.push(doc_type); conditions.push(`doc_type = $${params.length}`); }
    if (current_only !== 'false') conditions.push(`is_current = true`); // default: only show latest version

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await safeQuery(
      `SELECT d.*, sa.email AS uploaded_by_email FROM documents d
       LEFT JOIN staff_accounts sa ON sa.id = d.uploaded_by
       ${where} ORDER BY d.created_at DESC`,
      params
    );
    res.json({ documents: rows });
  } catch (err) {
    console.error('[documents:list]', err);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// ── version history for one document lineage ────────────────────────────────
router.get('/:id/history', async (req, res) => {
  try {
    let current = req.params.id;
    let doc;
    while (true) {
      const { rows: [d] } = await safeQuery(`SELECT * FROM documents WHERE id = $1`, [current]);
      if (!d) return res.status(404).json({ error: 'Document not found' });
      doc = d;
      if (!d.supersedes_id) break;
      current = d.supersedes_id;
    }
    const { rows: history } = await safeQuery(
      `WITH RECURSIVE chain AS (
         SELECT * FROM documents WHERE id = $1
         UNION ALL
         SELECT d.* FROM documents d JOIN chain c ON d.supersedes_id = c.id
       )
       SELECT * FROM chain ORDER BY version DESC`,
      [doc.id]
    );
    res.json({ history });
  } catch (err) {
    console.error('[documents:history]', err);
    res.status(500).json({ error: 'Failed to fetch version history' });
  }
});

// ── get a time-limited download link ────────────────────────────────────────
router.get('/:id/download', async (req, res) => {
  try {
    const { rows: [doc] } = await safeQuery(`SELECT * FROM documents WHERE id = $1`, [req.params.id]);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    const url = await storage.getSignedUrl(doc.storage_path, 300); // 5-minute link
    res.json({ url, fileName: doc.file_name });
  } catch (err) {
    console.error('[documents:download]', err);
    res.status(500).json({ error: err.message || 'Failed to generate download link' });
  }
});

// ── delete (only latest version, and only admin/hr/finance) ────────────────
router.delete('/:id', requireRole('hr'), async (req, res) => {
  try {
    const { rows: [doc] } = await safeQuery(`SELECT * FROM documents WHERE id = $1`, [req.params.id]);
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    await storage.deleteFile(doc.storage_path).catch((err) => console.warn('[documents:delete] storage cleanup failed, continuing:', err.message));
    await safeQuery(`DELETE FROM documents WHERE id = $1`, [req.params.id]);

    res.json({ deleted: true });
  } catch (err) {
    console.error('[documents:delete]', err);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

module.exports = router;