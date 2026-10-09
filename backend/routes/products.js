'use strict';
// routes/products.js — Simple product registry (EtherTrack, Landing, Internal Ops)
// Links each product to its domain, platform sync, and key metrics

const express = require('express');
const router = express.Router();
const { safeQuery } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const { fetchPlatformCustomers } = require('../services/platformClient');

router.use(authenticate);

// ──────────────────────────────────────────────────────────────────────────
// PRODUCTS CRUD (Simple - just the 3 products)
// ──────────────────────────────────────────────────────────────────────────

// GET /api/v1/products — list all products with live metrics
router.get('/', async (req, res) => {
  try {
    const { rows } = await safeQuery(`
      SELECT * FROM products 
      WHERE is_active = TRUE 
      ORDER BY 
        CASE product_type WHEN 'saas' THEN 0 WHEN 'marketing' THEN 1 WHEN 'internal_tool' THEN 2 ELSE 3 END,
        name
    `);
    res.json({ products: rows });
  } catch (err) {
    console.error('[products:list]', err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// GET /api/v1/products/:id — single product with metrics
router.get('/:id', async (req, res) => {
  try {
    const { rows: [product] } = await safeQuery(`SELECT * FROM products WHERE id = $1`, [req.params.id]);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    // Fetch live metrics from platform (for EtherTrack core)
    let platformMetrics = null;
    if (product.slug === 'ethertrack') {
      try {
        const customers = await fetchPlatformCustomers(5000);
        const active = customers.filter(c => c.is_active && c.subscription_plan && c.subscription_plan !== 'free');
        let mrr = 0;
        const byPlan = {};
        for (const c of active) {
          const lastPaid = c.latest_subscription_payment_inr;
          if (lastPaid != null) {
            const cycle = (c.subscription_cycle || 'monthly').toLowerCase();
            const monthlyValue = (cycle === 'annual' || cycle === 'yearly') ? Number(lastPaid) / 12 : Number(lastPaid);
            mrr += monthlyValue;
            const planKey = (c.subscription_plan || '').toLowerCase();
            byPlan[planKey] = (byPlan[planKey] || 0) + monthlyValue;
          }
        }
        platformMetrics = {
          mrr: Math.round(mrr * 100) / 100,
          arr: Math.round(mrr * 12 * 100) / 100,
          activeSubscribers: active.length,
          byPlan: Object.fromEntries(Object.entries(byPlan).map(([k, v]) => [k, Math.round(v * 100) / 100])),
          totalCustomers: customers.length,
        };
      } catch (e) {
        platformMetrics = { error: 'Platform unavailable', mrr: 0, activeSubscribers: 0 };
      }
    }

    res.json({ product, platformMetrics });
  } catch (err) {
    console.error('[products:get]', err);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// POST /api/v1/products — create (owner/admin)
router.post('/', requireRole('owner', 'admin'), async (req, res) => {
  try {
    const { name, slug, domain, description, product_type, stage, target_mrr_inr } = req.body;
    if (!name || !slug) return res.status(400).json({ error: 'name and slug are required' });

    const { rows: [product] } = await safeQuery(`
      INSERT INTO products (name, slug, domain, description, product_type, stage, target_mrr_inr)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
    `, [name, slug.toLowerCase(), domain || null, description || null, product_type || 'saas', stage || 'idea', target_mrr_inr || 0]);

    res.status(201).json({ product });
  } catch (err) {
    console.error('[products:create]', err);
    if (err.code === '23505') return res.status(409).json({ error: 'Product name or slug already exists' });
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// PUT /api/v1/products/:id — update
router.put('/:id', requireRole('owner', 'admin'), async (req, res) => {
  try {
    const allowed = ['name', 'domain', 'description', 'product_type', 'stage', 'monthly_revenue_inr', 'target_mrr_inr', 'is_active'];
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

    params.push(req.params.id);
    const { rows } = await safeQuery(`UPDATE products SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params);
    if (!rows.length) return res.status(404).json({ error: 'Product not found' });

    res.json({ product: rows[0] });
  } catch (err) {
    console.error('[products:update]', err);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// DELETE /api/v1/products/:id
router.delete('/:id', requireRole('owner'), async (req, res) => {
  try {
    const { rows: [deleted] } = await safeQuery(`DELETE FROM products WHERE id = $1 RETURNING id, name`, [req.params.id]);
    if (!deleted) return res.status(404).json({ error: 'Product not found' });
    res.json({ deleted: true });
  } catch (err) {
    console.error('[products:delete]', err);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

module.exports = router;