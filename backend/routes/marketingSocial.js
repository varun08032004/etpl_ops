'use strict';
// routes/marketingSocial.js
//
// Backs the Marketing module's "Socials" portfolio page — one row per
// social handle the company runs (Instagram, Twitter/X, LinkedIn, YouTube,
// etc). Follower/following/post counts are manually maintained fields
// (last_stats_update tracks when they were last refreshed) rather than
// live-synced — wiring up each platform's API is a separate integration
// per platform; ask if you want that added for a specific one.

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
    const { platform, status } = req.query;
    const params = [];
    const clauses = [];
    if (platform) { params.push(platform); clauses.push(`platform = $${params.length}`); }
    if (status) { params.push(status); clauses.push(`status = $${params.length}`); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const { rows } = await safeQuery(
      `SELECT sa.*, e.full_name AS owner_name
       FROM marketing_social_accounts sa
       LEFT JOIN employees e ON e.id = sa.owner_employee_id
       ${where}
       ORDER BY sa.platform ASC, sa.followers_count DESC NULLS LAST`,
      params
    );
    res.json({ accounts: rows });
  } catch (err) {
    console.error('[marketing-social:list]', err);
    res.status(500).json({ error: 'Failed to fetch social accounts' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows: [account] } = await safeQuery(`SELECT * FROM marketing_social_accounts WHERE id = $1`, [req.params.id]);
    if (!account) return res.status(404).json({ error: 'Social account not found' });
    res.json({ account });
  } catch (err) {
    console.error('[marketing-social:get]', err);
    res.status(500).json({ error: 'Failed to fetch social account' });
  }
});

router.post('/', requireMarketingOrAdmin, async (req, res) => {
  try {
    const {
      platform, display_name, handle, profile_url, followers_count, following_count,
      posts_count, is_verified, status, owner_employee_id, bio, last_stats_update, notes,
    } = req.body;
    if (!platform || !display_name) return res.status(400).json({ error: 'platform and display_name are required' });

    const { rows: [account] } = await safeQuery(
      `INSERT INTO marketing_social_accounts
        (platform, display_name, handle, profile_url, followers_count, following_count, posts_count,
         is_verified, status, owner_employee_id, bio, last_stats_update, notes, created_by)
       VALUES ($1,$2,$3,$4,COALESCE($5,0),COALESCE($6,0),COALESCE($7,0),COALESCE($8,false),COALESCE($9,'active'),$10,$11,$12,$13,$14)
       RETURNING *`,
      [platform, display_name, handle || null, profile_url || null, followers_count ?? null,
       following_count ?? null, posts_count ?? null, is_verified ?? null, status || null,
       owner_employee_id || null, bio || null, last_stats_update || null, notes || null, req.staff.id]
    );

    await logAction({ staffId: req.staff.id, action: 'marketing_social.created', entity: 'marketing_social_accounts', entityId: account.id, newValue: { platform: account.platform, display_name: account.display_name } });

    res.status(201).json({ account });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'That handle is already tracked for this platform' });
    console.error('[marketing-social:create]', err);
    res.status(500).json({ error: 'Failed to create social account' });
  }
});

router.put('/:id', requireMarketingOrAdmin, async (req, res) => {
  try {
    const allowed = [
      'platform', 'display_name', 'handle', 'profile_url', 'followers_count', 'following_count',
      'posts_count', 'is_verified', 'status', 'owner_employee_id', 'bio', 'last_stats_update', 'notes',
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

    const { rows: [before] } = await safeQuery(`SELECT * FROM marketing_social_accounts WHERE id = $1`, [req.params.id]);
    if (!before) return res.status(404).json({ error: 'Social account not found' });

    params.push(req.params.id);
    const { rows } = await safeQuery(
      `UPDATE marketing_social_accounts SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );

    await logAction({ staffId: req.staff.id, action: 'marketing_social.updated', entity: 'marketing_social_accounts', entityId: rows[0].id, oldValue: before, newValue: rows[0] });

    res.json({ account: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'That handle is already tracked for this platform' });
    console.error('[marketing-social:update]', err);
    res.status(500).json({ error: 'Failed to update social account' });
  }
});

router.delete('/:id', requireRole('owner'), async (req, res) => {
  try {
    const { rows: [deleted] } = await safeQuery(`DELETE FROM marketing_social_accounts WHERE id = $1 RETURNING id, display_name`, [req.params.id]);
    if (!deleted) return res.status(404).json({ error: 'Social account not found' });
    await logAction({ staffId: req.staff.id, action: 'marketing_social.deleted', entity: 'marketing_social_accounts', entityId: deleted.id, oldValue: { display_name: deleted.display_name } });
    res.json({ deleted: true });
  } catch (err) {
    console.error('[marketing-social:delete]', err);
    res.status(500).json({ error: 'Failed to delete social account' });
  }
});

module.exports = router;