'use strict';
// routes/marketingCompetitors.js — full competitive intelligence tracker,
// matching EtherTrack_Competitive_Intelligence_v6_Final.xlsx exactly:
// Company Overview, Product Capability, Carbon Market Capability,
// Commercial Analysis, Strategic Analysis, and Customer Proof per
// competitor. Edit/delete restricted to admin/HOD/owner (founder), per
// request — view is open to any authenticated staff.

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

// Every editable field, grouped exactly like the source workbook's sections —
// used to build both INSERT and UPDATE dynamically so this stays in sync
// automatically if a column is ever added.
const FIELDS = [
  'company_name', 'region', 'is_featured', 'website', 'last_reviewed_date', 'notes',
  // Section A — Company Overview
  'country', 'hq_city', 'founded', 'funding_verified', 'team_size_verified', 'dev_stage', 'ceo_founders', 'overview_source',
  // Section B — Product Capability
  'cap_scope1', 'cap_scope2', 'cap_scope3', 'cap_supplier_portal', 'cap_ghg_inventory', 'cap_brsr', 'cap_cdp',
  'cap_tcfd', 'cap_ccts', 'cap_audit_trail', 'capability_source_notes',
  // Section C — Carbon Market Capability
  'market_marketplace', 'market_credit_issuance', 'market_trading', 'market_retirement', 'market_registry_integration',
  'market_tokenisation', 'market_blockchain_audit', 'market_onchain_settlement', 'market_source_notes',
  // Section D — Commercial Analysis
  'pricing_model', 'pricing_type', 'est_price_range', 'free_trial', 'implementation_support', 'consulting_support',
  'india_presence', 'commercial_source_notes',
  // Section E — Strategic Analysis
  'target_customer', 'gtm_model', 'key_partners', 'audit_firm_alignment', 'govt_regulatory_alignment',
  'investor_backed', 'international_expansion', 'strategic_notes',
  // Customer Proof
  'customer_count', 'case_studies_published', 'testimonials_reviews', 'known_clients', 'industry_verticals',
  'trust_signal', 'customer_proof_source_notes',
];

router.get('/', async (req, res) => {
  try {
    const { region } = req.query;
    const params = [];
    let where = '';
    if (region) { params.push(region); where = `WHERE region = $1`; }
    const { rows } = await safeQuery(
      `SELECT * FROM marketing_competitors ${where} ORDER BY is_featured DESC, region ASC, company_name ASC`, params
    );
    res.json({ competitors: rows });
  } catch (err) {
    console.error('[marketing-competitors:list]', err);
    res.status(500).json({ error: 'Failed to fetch competitors' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows: [competitor] } = await safeQuery(`SELECT * FROM marketing_competitors WHERE id = $1`, [req.params.id]);
    if (!competitor) return res.status(404).json({ error: 'Competitor not found' });
    res.json({ competitor });
  } catch (err) {
    console.error('[marketing-competitors:get]', err);
    res.status(500).json({ error: 'Failed to fetch competitor' });
  }
});

router.post('/', requireMarketingOrAdmin, async (req, res) => {
  try {
    if (!req.body.company_name) return res.status(400).json({ error: 'company_name is required' });

    const cols = ['created_by'];
    const placeholders = ['$1'];
    const params = [req.staff.id];
    for (const field of FIELDS) {
      if (field in req.body) {
        params.push(req.body[field] === '' ? null : req.body[field]);
        cols.push(field);
        placeholders.push(`$${params.length}`);
      }
    }

    const { rows: [competitor] } = await safeQuery(
      `INSERT INTO marketing_competitors (${cols.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
      params
    );

    await logAction({ staffId: req.staff.id, action: 'marketing_competitor.created', entity: 'marketing_competitors', entityId: competitor.id, newValue: { company_name: competitor.company_name } });

    res.status(201).json({ competitor });
  } catch (err) {
    console.error('[marketing-competitors:create]', err);
    res.status(500).json({ error: 'Failed to create competitor' });
  }
});

router.put('/:id', requireMarketingOrAdmin, async (req, res) => {
  try {
    const sets = [];
    const params = [];
    for (const field of FIELDS) {
      if (field in req.body) {
        params.push(req.body[field] === '' ? null : req.body[field]);
        sets.push(`${field} = $${params.length}`);
      }
    }
    if (!sets.length) return res.status(400).json({ error: 'No valid fields to update' });
    sets.push(`updated_at = NOW()`);

    const { rows: [before] } = await safeQuery(`SELECT * FROM marketing_competitors WHERE id = $1`, [req.params.id]);
    if (!before) return res.status(404).json({ error: 'Competitor not found' });

    params.push(req.params.id);
    const { rows } = await safeQuery(`UPDATE marketing_competitors SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params);

    await logAction({ staffId: req.staff.id, action: 'marketing_competitor.updated', entity: 'marketing_competitors', entityId: rows[0].id, oldValue: before, newValue: rows[0] });

    res.json({ competitor: rows[0] });
  } catch (err) {
    console.error('[marketing-competitors:update]', err);
    res.status(500).json({ error: 'Failed to update competitor' });
  }
});

// Delete allowed for owner/admin/founder and the Marketing HOD — same tier
// as create/edit, per request (admin, HOD, and founder should all have
// full control over this data).
router.delete('/:id', requireMarketingOrAdmin, async (req, res) => {
  try {
    const { rows: [deleted] } = await safeQuery(`DELETE FROM marketing_competitors WHERE id = $1 RETURNING id, company_name`, [req.params.id]);
    if (!deleted) return res.status(404).json({ error: 'Competitor not found' });
    await logAction({ staffId: req.staff.id, action: 'marketing_competitor.deleted', entity: 'marketing_competitors', entityId: deleted.id, oldValue: { company_name: deleted.company_name } });
    res.json({ deleted: true });
  } catch (err) {
    console.error('[marketing-competitors:delete]', err);
    res.status(500).json({ error: 'Failed to delete competitor' });
  }
});

module.exports = router;