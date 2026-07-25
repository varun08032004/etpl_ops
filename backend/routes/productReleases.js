'use strict';
// routes/productReleases.js — the changelog: version, date, what shipped.
// feature_ids is a soft link into product_features (no FK), so the release
// history survives even if a roadmap item is later deleted.

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

router.get('/', async (req, res) => {
  try {
    const { rows: releases } = await safeQuery(`SELECT * FROM product_releases ORDER BY release_date DESC`);

    // hydrate feature titles for display without a join (feature_ids isn't a real FK array)
    const allFeatureIds = [...new Set(releases.flatMap((r) => r.feature_ids || []))];
    let featureMap = {};
    if (allFeatureIds.length) {
      const { rows: features } = await safeQuery(`SELECT id, title, area FROM product_features WHERE id = ANY($1)`, [allFeatureIds]);
      featureMap = Object.fromEntries(features.map((f) => [f.id, f]));
    }
    const hydrated = releases.map((r) => ({ ...r, features: (r.feature_ids || []).map((id) => featureMap[id]).filter(Boolean) }));

    res.json({ releases: hydrated });
  } catch (err) {
    console.error('[product-releases:list]', err);
    res.status(500).json({ error: 'Failed to fetch releases' });
  }
});

router.post('/', requireProductOrAdmin, async (req, res) => {
  try {
    const { version, release_date, summary, feature_ids } = req.body;
    if (!version) return res.status(400).json({ error: 'version is required' });

    const { rows: [release] } = await safeQuery(
      `INSERT INTO product_releases (version, release_date, summary, feature_ids, created_by)
       VALUES ($1,COALESCE($2,CURRENT_DATE),$3,COALESCE($4,'{}'),$5) RETURNING *`,
      [version, release_date || null, summary || null, feature_ids || null, req.staff.id]
    );

    await logAction({ staffId: req.staff.id, action: 'product_release.created', entity: 'product_releases', entityId: release.id, newValue: { version: release.version } });

    res.status(201).json({ release });
  } catch (err) {
    console.error('[product-releases:create]', err);
    res.status(500).json({ error: 'Failed to create release' });
  }
});

router.put('/:id', requireProductOrAdmin, async (req, res) => {
  try {
    const allowed = ['version', 'release_date', 'summary', 'feature_ids'];
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

    const { rows: [before] } = await safeQuery(`SELECT * FROM product_releases WHERE id = $1`, [req.params.id]);
    if (!before) return res.status(404).json({ error: 'Release not found' });

    params.push(req.params.id);
    const { rows } = await safeQuery(`UPDATE product_releases SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params);

    await logAction({ staffId: req.staff.id, action: 'product_release.updated', entity: 'product_releases', entityId: rows[0].id, oldValue: before, newValue: rows[0] });

    res.json({ release: rows[0] });
  } catch (err) {
    console.error('[product-releases:update]', err);
    res.status(500).json({ error: 'Failed to update release' });
  }
});

router.delete('/:id', requireProductOrAdmin, async (req, res) => {
  try {
    const { rows: [deleted] } = await safeQuery(`DELETE FROM product_releases WHERE id = $1 RETURNING id, version`, [req.params.id]);
    if (!deleted) return res.status(404).json({ error: 'Release not found' });
    await logAction({ staffId: req.staff.id, action: 'product_release.deleted', entity: 'product_releases', entityId: deleted.id, oldValue: { version: deleted.version } });
    res.json({ deleted: true });
  } catch (err) {
    console.error('[product-releases:delete]', err);
    res.status(500).json({ error: 'Failed to delete release' });
  }
});

module.exports = router;