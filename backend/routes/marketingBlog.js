'use strict';
// routes/marketingBlog.js — full blog post authoring: title, body, SEO
// fields, status lifecycle (draft → in_review → scheduled → published).
// The publishing engine and any auto-publish scheduling live in the
// landing page repo itself — this just tracks the post metadata/content.

const express = require('express');
const router = express.Router();
const { safeQuery } = require('../db/pool');
const { authenticate, requireRole, requireDepartmentHead } = require('../middleware/auth');
const { logAction } = require('../services/auditLog');
const { syncPageAnalytics } = require('../services/websiteAnalyticsSync');

router.use(authenticate);

const MARKETING_DEPARTMENT_NAME = 'Marketing';
function requireMarketingOrAdmin(req, res, next) {
  if (['owner', 'admin'].includes(req.staff.role)) return next();
  return requireDepartmentHead(MARKETING_DEPARTMENT_NAME)(req, res, next);
}

function slugify(title) {
  return String(title || '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 240);
}

router.get('/', async (req, res) => {
  try {
    const { status, category } = req.query;
    const params = [];
    const clauses = [];
    if (status) { params.push(status); clauses.push(`b.status = $${params.length}`); }
    if (category) { params.push(category); clauses.push(`b.category = $${params.length}`); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const { rows } = await safeQuery(
      `SELECT b.id, b.title, b.slug, b.excerpt, b.category, b.tags, b.status, b.cover_image_url,
              b.published_url, b.scheduled_date, b.published_at, b.view_count, b.created_at, b.updated_at,
              e.full_name AS author_name,
              a.clicks, a.impressions, a.ctr, a.avg_position, a.pageviews, a.snapshot_date AS analytics_as_of
       FROM marketing_blog_posts b
       LEFT JOIN employees e ON e.id = b.author_employee_id
       LEFT JOIN LATERAL (
         SELECT clicks, impressions, ctr, avg_position, pageviews, snapshot_date
         FROM marketing_page_analytics
         WHERE blog_post_id = b.id
         ORDER BY snapshot_date DESC LIMIT 1
       ) a ON true
       ${where}
       ORDER BY COALESCE(b.published_at, b.scheduled_date, b.created_at::date) DESC`,
      params
    );
    res.json({ posts: rows });
  } catch (err) {
    console.error('[marketing-blog:list]', err);
    res.status(500).json({ error: 'Failed to fetch blog posts' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows: [post] } = await safeQuery(
      `SELECT b.*, e.full_name AS author_name
       FROM marketing_blog_posts b LEFT JOIN employees e ON e.id = b.author_employee_id
       WHERE b.id = $1`,
      [req.params.id]
    );
    if (!post) return res.status(404).json({ error: 'Blog post not found' });
    res.json({ post });
  } catch (err) {
    console.error('[marketing-blog:get]', err);
    res.status(500).json({ error: 'Failed to fetch blog post' });
  }
});

router.post('/', requireMarketingOrAdmin, async (req, res) => {
  try {
    const {
      title, slug, excerpt, content, category, tags, status, author_employee_id,
      cover_image_url, seo_title, seo_description, published_url, scheduled_date,
      published_at, view_count, notes,
    } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });

    const finalSlug = slug?.trim() || slugify(title);
    const parsedTags = tags ? (Array.isArray(tags) ? tags : String(tags).split(',').map((t) => t.trim()).filter(Boolean)) : null;

    const { rows: [post] } = await safeQuery(
      `INSERT INTO marketing_blog_posts
        (title, slug, excerpt, content, category, tags, status, author_employee_id, cover_image_url,
         seo_title, seo_description, published_url, scheduled_date, published_at, view_count, notes, created_by)
       VALUES ($1,$2,$3,$4,COALESCE($5,'other'),COALESCE($6,'{}'),COALESCE($7,'draft'),$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING *`,
      [title, finalSlug, excerpt || null, content || null, category || null, parsedTags, status || null,
       author_employee_id || null, cover_image_url || null, seo_title || null, seo_description || null,
       published_url || null, scheduled_date || null, published_at || null, view_count ?? null, notes || null,
       req.staff.id]
    );

    await logAction({ staffId: req.staff.id, action: 'marketing_blog.created', entity: 'marketing_blog_posts', entityId: post.id, newValue: { title: post.title, status: post.status } });

    res.status(201).json({ post });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'A post with that slug already exists' });
    console.error('[marketing-blog:create]', err);
    res.status(500).json({ error: 'Failed to create blog post' });
  }
});

router.put('/:id', requireMarketingOrAdmin, async (req, res) => {
  try {
    const allowed = [
      'title', 'slug', 'excerpt', 'content', 'category', 'tags', 'status', 'author_employee_id',
      'cover_image_url', 'seo_title', 'seo_description', 'published_url', 'scheduled_date',
      'published_at', 'view_count', 'notes',
    ];
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

    if (req.body.status === 'published' && !('published_at' in req.body)) {
      sets.push(`published_at = COALESCE(published_at, CURRENT_DATE)`);
    }
    sets.push(`updated_at = NOW()`);

    const { rows: [before] } = await safeQuery(`SELECT * FROM marketing_blog_posts WHERE id = $1`, [req.params.id]);
    if (!before) return res.status(404).json({ error: 'Blog post not found' });

    params.push(req.params.id);
    const { rows } = await safeQuery(`UPDATE marketing_blog_posts SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params);

    await logAction({ staffId: req.staff.id, action: 'marketing_blog.updated', entity: 'marketing_blog_posts', entityId: rows[0].id, oldValue: before, newValue: rows[0] });

    res.json({ post: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'A post with that slug already exists' });
    console.error('[marketing-blog:update]', err);
    res.status(500).json({ error: 'Failed to update blog post' });
  }
});

router.delete('/:id', requireMarketingOrAdmin, async (req, res) => {
  try {
    const { rows: [deleted] } = await safeQuery(`DELETE FROM marketing_blog_posts WHERE id = $1 RETURNING id, title`, [req.params.id]);
    if (!deleted) return res.status(404).json({ error: 'Blog post not found' });
    await logAction({ staffId: req.staff.id, action: 'marketing_blog.deleted', entity: 'marketing_blog_posts', entityId: deleted.id, oldValue: { title: deleted.title } });
    res.json({ deleted: true });
  } catch (err) {
    console.error('[marketing-blog:delete]', err);
    res.status(500).json({ error: 'Failed to delete blog post' });
  }
});

// ── website analytics (clicks, impressions, pageviews) ──────────────────────
// Derives the page path to query from published_url if set, else falls back
// to /blog/{slug} (ethertrack.in's expected blog URL pattern).
function derivePagePath(post) {
  if (post.published_url) {
    try {
      return new URL(post.published_url).pathname;
    } catch {
      return post.published_url.startsWith('/') ? post.published_url : `/${post.published_url}`;
    }
  }
  return post.slug ? `/blog/${post.slug}` : null;
}

router.get('/:id/analytics', async (req, res) => {
  try {
    const { rows: [post] } = await safeQuery(`SELECT id, slug, published_url FROM marketing_blog_posts WHERE id = $1`, [req.params.id]);
    if (!post) return res.status(404).json({ error: 'Blog post not found' });

    const { rows: history } = await safeQuery(
      `SELECT snapshot_date, clicks, impressions, ctr, avg_position, pageviews
       FROM marketing_page_analytics WHERE blog_post_id = $1 ORDER BY snapshot_date ASC`,
      [req.params.id]
    );
    res.json({ history, pagePath: derivePagePath(post) });
  } catch (err) {
    console.error('[marketing-blog:analytics]', err);
    res.status(500).json({ error: 'Failed to fetch analytics history' });
  }
});

router.post('/:id/sync-analytics', requireMarketingOrAdmin, async (req, res) => {
  try {
    const { rows: [post] } = await safeQuery(`SELECT id, slug, published_url FROM marketing_blog_posts WHERE id = $1`, [req.params.id]);
    if (!post) return res.status(404).json({ error: 'Blog post not found' });

    const pagePath = derivePagePath(post);
    if (!pagePath) return res.status(400).json({ error: 'This post has no slug or published URL to look up analytics for' });

    const stats = await syncPageAnalytics(pagePath);

    const { rows: [snapshot] } = await safeQuery(
      `INSERT INTO marketing_page_analytics (page_path, snapshot_date, clicks, impressions, ctr, avg_position, pageviews, blog_post_id, created_by)
       VALUES ($1,CURRENT_DATE,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (page_path, snapshot_date) DO UPDATE
         SET clicks = EXCLUDED.clicks, impressions = EXCLUDED.impressions, ctr = EXCLUDED.ctr,
             avg_position = EXCLUDED.avg_position, pageviews = EXCLUDED.pageviews
       RETURNING *`,
      [pagePath, stats.clicks, stats.impressions, stats.ctr, stats.avg_position, stats.pageviews, post.id, req.staff.id]
    );

    res.json({ snapshot, warnings: stats.warnings });
  } catch (err) {
    console.error('[marketing-blog:sync-analytics]', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to sync analytics' });
  }
});

// Syncs analytics for every published post in one go.
router.post('/sync-all-analytics', requireMarketingOrAdmin, async (req, res) => {
  const { rows: posts } = await safeQuery(`SELECT id, slug, published_url FROM marketing_blog_posts WHERE status = 'published'`);

  const results = [];
  for (const post of posts) {
    const pagePath = derivePagePath(post);
    if (!pagePath) { results.push({ id: post.id, ok: false, error: 'No slug or published URL' }); continue; }
    try {
      const stats = await syncPageAnalytics(pagePath);
      await safeQuery(
        `INSERT INTO marketing_page_analytics (page_path, snapshot_date, clicks, impressions, ctr, avg_position, pageviews, blog_post_id, created_by)
         VALUES ($1,CURRENT_DATE,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (page_path, snapshot_date) DO UPDATE
           SET clicks = EXCLUDED.clicks, impressions = EXCLUDED.impressions, ctr = EXCLUDED.ctr,
               avg_position = EXCLUDED.avg_position, pageviews = EXCLUDED.pageviews`,
        [pagePath, stats.clicks, stats.impressions, stats.ctr, stats.avg_position, stats.pageviews, post.id, req.staff.id]
      );
      results.push({ id: post.id, ok: true, stats, warnings: stats.warnings });
    } catch (err) {
      results.push({ id: post.id, ok: false, error: err.message });
    }
  }

  res.json({ results });
});

module.exports = router;