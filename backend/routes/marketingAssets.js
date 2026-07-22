'use strict';
// routes/marketingAssets.js — brand asset library (logo pack, guidelines,
// templates, press kit, photos/videos). Each row either points at an
// externally-hosted link (Canva/Drive/Figma) or an uploaded document_id
// from the existing /api/documents module — same optional-link pattern
// ip_assets.document_id uses, so we don't duplicate file upload/storage here.

const express = require('express');
const router = express.Router();
const { safeQuery } = require('../db/pool');
const { authenticate, requireRole, requireDepartmentHead } = require('../middleware/auth');
const { logAction } = require('../services/auditLog');

router.use(authenticate);

const MARKETING_DEPARTMENT_NAME = 'Marketing';
function requireMarketingOrAdmin(req, res, next) {
  if (['owner', 'admin'].includes(req.staff.role)) return next();
  return requireDepartmentHead(MARKETING_DEPARTMENT_NAME)(req, res, next);
}

router.get('/', async (req, res) => {
  try {
    const { asset_type } = req.query;
    const params = [];
    let where = '';
    if (asset_type) { params.push(asset_type); where = `WHERE ba.asset_type = $1`; }

    const { rows } = await safeQuery(
      `SELECT ba.*, d.file_name AS document_file_name, d.storage_path AS document_storage_path
       FROM marketing_brand_assets ba
       LEFT JOIN documents d ON d.id = ba.document_id
       ${where}
       ORDER BY ba.created_at DESC`,
      params
    );
    res.json({ assets: rows });
  } catch (err) {
    console.error('[marketing-assets:list]', err);
    res.status(500).json({ error: 'Failed to fetch brand assets' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows: [asset] } = await safeQuery(`SELECT * FROM marketing_brand_assets WHERE id = $1`, [req.params.id]);
    if (!asset) return res.status(404).json({ error: 'Brand asset not found' });
    res.json({ asset });
  } catch (err) {
    console.error('[marketing-assets:get]', err);
    res.status(500).json({ error: 'Failed to fetch brand asset' });
  }
});

router.post('/', requireMarketingOrAdmin, async (req, res) => {
  try {
    const { title, asset_type, external_url, document_id, description, tags } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });

    const parsedTags = tags ? (Array.isArray(tags) ? tags : String(tags).split(',').map((t) => t.trim()).filter(Boolean)) : null;

    const { rows: [asset] } = await safeQuery(
      `INSERT INTO marketing_brand_assets (title, asset_type, external_url, document_id, description, tags, created_by)
       VALUES ($1,COALESCE($2,'other'),$3,$4,$5,$6,$7) RETURNING *`,
      [title, asset_type || null, external_url || null, document_id || null, description || null, parsedTags, req.staff.id]
    );

    await logAction({ staffId: req.staff.id, action: 'marketing_asset.created', entity: 'marketing_brand_assets', entityId: asset.id, newValue: { title: asset.title, asset_type: asset.asset_type } });

    res.status(201).json({ asset });
  } catch (err) {
    console.error('[marketing-assets:create]', err);
    res.status(500).json({ error: 'Failed to create brand asset' });
  }
});

router.put('/:id', requireMarketingOrAdmin, async (req, res) => {
  try {
    const allowed = ['title', 'asset_type', 'external_url', 'document_id', 'description', 'tags'];
    const sets = [];
    const params = [];
    for (const key of allowed) {
      if (key in req.body) {
        let value = req.body[key];
        if (key === 'tags' && value) value = Array.isArray(value) ? value : String(value).split(',').map((t) => t.trim()).filter(Boolean);
        params.push(value === '' ? null : value);
        sets.push(`${key} = $${params.length}`);
      }
    }
    if (!sets.length) return res.status(400).json({ error: 'No valid fields to update' });
    sets.push(`updated_at = NOW()`);

    const { rows: [before] } = await safeQuery(`SELECT * FROM marketing_brand_assets WHERE id = $1`, [req.params.id]);
    if (!before) return res.status(404).json({ error: 'Brand asset not found' });

    params.push(req.params.id);
    const { rows } = await safeQuery(
      `UPDATE marketing_brand_assets SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );

    await logAction({ staffId: req.staff.id, action: 'marketing_asset.updated', entity: 'marketing_brand_assets', entityId: rows[0].id, oldValue: before, newValue: rows[0] });

    res.json({ asset: rows[0] });
  } catch (err) {
    console.error('[marketing-assets:update]', err);
    res.status(500).json({ error: 'Failed to update brand asset' });
  }
});

router.delete('/:id', requireRole('owner'), async (req, res) => {
  try {
    const { rows: [deleted] } = await safeQuery(`DELETE FROM marketing_brand_assets WHERE id = $1 RETURNING id, title`, [req.params.id]);
    if (!deleted) return res.status(404).json({ error: 'Brand asset not found' });
    await logAction({ staffId: req.staff.id, action: 'marketing_asset.deleted', entity: 'marketing_brand_assets', entityId: deleted.id, oldValue: { title: deleted.title } });
    res.json({ deleted: true });
  } catch (err) {
    console.error('[marketing-assets:delete]', err);
    res.status(500).json({ error: 'Failed to delete brand asset' });
  }
});

module.exports = router;