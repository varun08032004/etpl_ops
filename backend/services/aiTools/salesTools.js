'use strict';

const { safeQuery, withTransaction } = require('../../db/pool');
const { logAction } = require('../auditLog');
const { fireEvent } = require('../automationEngine');
const ledger = require('../ledger');

const salesTools = [
  {
    name: 'list_deals',
    description: 'List sales deals with optional filters',
    category: 'sales',
    readOnly: true,
    requiresConfirmation: false,
    allowedRoles: ['sales', 'finance', 'owner', 'admin'],
    allowedDepartments: [],
    parameters: {
      stage: { type: 'string', required: false },
      assigned_to: { type: 'string', required: false },
    },
    execute: async (params, user) => {
      const conditions = [];
      const queryParams = [];
      if (params.stage) { queryParams.push(params.stage); conditions.push(`d.stage = $${queryParams.length}`); }
      if (params.assigned_to) { queryParams.push(params.assigned_to); conditions.push(`d.assigned_to = $${queryParams.length}`); }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const { rows } = await safeQuery(
        `SELECT d.*, sa.email AS assigned_to_email FROM deals d LEFT JOIN staff_accounts sa ON sa.id = d.assigned_to ${where} ORDER BY d.updated_at DESC`,
        queryParams
      );
      return { deals: rows };
    },
  },

  {
    name: 'get_deal',
    description: 'Get deal detail with quotations and tasks',
    category: 'sales',
    readOnly: true,
    requiresConfirmation: false,
    allowedRoles: ['sales', 'finance', 'owner', 'admin'],
    allowedDepartments: [],
    parameters: {
      deal_id: { type: 'string', required: true },
    },
    execute: async (params, user) => {
      const { rows: [deal] } = await safeQuery(
        `SELECT d.*, sa.email AS assigned_to_email FROM deals d LEFT JOIN staff_accounts sa ON sa.id = d.assigned_to WHERE d.id = $1`,
        [params.deal_id]
      );
      if (!deal) throw new Error('Deal not found');
      const { rows: quotations } = await safeQuery(`SELECT * FROM quotations WHERE deal_id = $1 ORDER BY created_at DESC`, [params.deal_id]);
      const { rows: tasks } = await safeQuery(`SELECT * FROM deal_tasks WHERE deal_id = $1 ORDER BY due_date ASC NULLS LAST`, [params.deal_id]);
      return { deal, quotations, tasks };
    },
  },

  {
    name: 'get_sales_forecast',
    description: 'Get weighted pipeline forecast',
    category: 'sales',
    readOnly: true,
    requiresConfirmation: false,
    allowedRoles: ['sales', 'finance', 'owner', 'admin'],
    allowedDepartments: [],
    parameters: {},
    execute: async (params, user) => {
      const { rows } = await safeQuery(
        `SELECT stage, COUNT(*) AS deal_count, COALESCE(SUM(deal_value),0) AS total_value,
                COALESCE(SUM(deal_value * probability_percent / 100),0) AS weighted_value
         FROM deals WHERE stage NOT IN ('won','lost') GROUP BY stage`
      );
      const { rows: [wonThisMonth] } = await safeQuery(
        `SELECT COALESCE(SUM(deal_value),0) AS total FROM deals WHERE stage = 'won' AND updated_at >= date_trunc('month', CURRENT_DATE)`
      );
      const totalWeighted = rows.reduce((s, r) => s + Number(r.weighted_value), 0);
      const totalOpen = rows.reduce((s, r) => s + Number(r.total_value), 0);
      return { byStage: rows, totalWeightedPipeline: totalWeighted, totalOpenPipeline: totalOpen, wonThisMonth: Number(wonThisMonth.total) };
    },
  },

  {
    name: 'create_deal',
    description: 'Create a new sales deal',
    category: 'sales',
    readOnly: false,
    requiresConfirmation: false,
    destructive: false,
    allowedRoles: ['sales', 'finance', 'owner', 'admin'],
    allowedDepartments: [],
    parameters: {
      company_name: { type: 'string', required: true },
      contact_name: { type: 'string', required: false },
      contact_email: { type: 'string', required: false },
      contact_phone: { type: 'string', required: false },
      source: { type: 'string', required: false },
      deal_value: { type: 'number', required: false },
      expected_close_date: { type: 'string', required: false, description: 'YYYY-MM-DD' },
      notes: { type: 'string', required: false },
    },
    execute: async (params, user) => {
      const { rows: [deal] } = await safeQuery(
        `INSERT INTO deals (company_name, contact_name, contact_email, contact_phone, source, deal_value, probability_percent, expected_close_date, notes, assigned_to, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10) RETURNING *`,
        [params.company_name, params.contact_name || null, params.contact_email || null, params.contact_phone || null, params.source || null,
         params.deal_value || 0, 10, params.expected_close_date || null, params.notes || null, user.staff.id]
      );
      return { deal, message: `Deal created for ${deal.company_name}` };
    },
  },

  {
    name: 'update_deal',
    description: 'Update a deal',
    category: 'sales',
    readOnly: false,
    requiresConfirmation: false,
    destructive: false,
    allowedRoles: ['sales', 'finance', 'owner', 'admin'],
    allowedDepartments: [],
    parameters: {
      deal_id: { type: 'string', required: true },
      company_name: { type: 'string', required: false },
      contact_name: { type: 'string', required: false },
      contact_email: { type: 'string', required: false },
      contact_phone: { type: 'string', required: false },
      source: { type: 'string', required: false },
      deal_value: { type: 'number', required: false },
      probability_percent: { type: 'integer', required: false },
      expected_close_date: { type: 'string', required: false },
      notes: { type: 'string', required: false },
      assigned_to: { type: 'string', required: false },
    },
    execute: async (params, user) => {
      const { deal_id, ...updates } = params;
      const allowed = ['company_name', 'contact_name', 'contact_email', 'contact_phone', 'source', 'deal_value', 'probability_percent', 'expected_close_date', 'notes', 'assigned_to'];
      const sets = [];
      const queryParams = [];
      for (const key of allowed) {
        if (key in updates) { queryParams.push(updates[key]); sets.push(`${key} = $${queryParams.length}`); }
      }
      if (!sets.length) throw new Error('No valid fields to update');
      sets.push(`last_activity_at = NOW()`, `updated_at = NOW()`);
      queryParams.push(deal_id);
      const { rows } = await safeQuery(`UPDATE deals SET ${sets.join(', ')} WHERE id = $${queryParams.length} RETURNING *`, queryParams);
      if (!rows.length) throw new Error('Deal not found');
      return { deal: rows[0] };
    },
  },

  {
    name: 'move_deal_stage',
    description: 'Move deal to a new stage',
    category: 'sales',
    readOnly: false,
    requiresConfirmation: false,
    destructive: false,
    allowedRoles: ['sales', 'finance', 'owner', 'admin'],
    allowedDepartments: [],
    parameters: {
      deal_id: { type: 'string', required: true },
      stage: { type: 'string', required: true, enum: ['new', 'qualified', 'proposal_sent', 'negotiation', 'won', 'lost'] },
    },
    execute: async (params, user) => {
      const STAGE_PROBABILITY = { new: 10, qualified: 25, proposal_sent: 50, negotiation: 75, won: 100, lost: 0 };
      if (!STAGE_PROBABILITY[params.stage]) throw new Error('Invalid stage');

      const { rows } = await safeQuery(
        `UPDATE deals SET stage = $1, probability_percent = $2, last_activity_at = NOW(), updated_at = NOW() WHERE id = $3 RETURNING *`,
        [params.stage, STAGE_PROBABILITY[params.stage], params.deal_id]
      );
      if (!rows.length) throw new Error('Deal not found');
      return { deal: rows[0] };
    },
  },

  {
    name: 'mark_deal_won',
    description: 'Mark deal as won (creates/links party for invoicing)',
    category: 'sales',
    readOnly: false,
    requiresConfirmation: true,
    destructive: false,
    allowedRoles: ['finance'],
    allowedDepartments: [],
    parameters: {
      deal_id: { type: 'string', required: true },
    },
    execute: async (params, user) => {
      const { rows: [deal] } = await safeQuery(`SELECT * FROM deals WHERE id = $1`, [params.deal_id]);
      if (!deal) throw new Error('Deal not found');

      let partyId = deal.converted_party_id;
      if (!partyId) {
        const { rows: [party] } = await safeQuery(
          `INSERT INTO parties (name, party_type, email, phone) VALUES ($1,'customer',$2,$3) RETURNING id`,
          [deal.company_name, deal.contact_email || null, deal.contact_phone || null]
        );
        partyId = party.id;
      }

      const { rows } = await safeQuery(
        `UPDATE deals SET stage = 'won', probability_percent = 100, converted_party_id = $1, last_activity_at = NOW(), updated_at = NOW() WHERE id = $2 RETURNING *`,
        [partyId, params.deal_id]
      );
      fireEvent('deal.won', { company_name: rows[0].company_name, link: `/sales` });
      return { deal: rows[0], message: `Deal won. Party created in Invoices module — you can now invoice this customer.` };
    },
  },

  {
    name: 'create_quotation',
    description: 'Create a quotation for a deal',
    category: 'sales',
    readOnly: false,
    requiresConfirmation: false,
    destructive: false,
    allowedRoles: ['sales', 'finance', 'owner', 'admin'],
    allowedDepartments: [],
    parameters: {
      deal_id: { type: 'string', required: true },
      items: { type: 'array', required: true, description: 'Array of {description, quantity, unit_price}' },
      discount_percent: { type: 'number', required: false },
      valid_until: { type: 'string', required: false, description: 'YYYY-MM-DD' },
      notes: { type: 'string', required: false },
    },
    execute: async (params, user) => {
      const subtotal = params.items.reduce((s, it) => s + Number(it.quantity || 1) * Number(it.unit_price), 0);
      const discountPct = Number(params.discount_percent || 0);
      const discountAmount = Math.round(subtotal * discountPct / 100 * 100) / 100;
      const totalAmount = Math.round((subtotal - discountAmount) * 100) / 100;

      const { rows: [threshold] } = await safeQuery(`SELECT value FROM sales_settings WHERE key = 'discount_approval_threshold_percent'`);
      const requiresApproval = discountPct > (threshold ? Number(threshold.value) : 15);

      const { rows: [{ next_num }] } = await safeQuery(
        `SELECT 'QUO-' || EXTRACT(YEAR FROM CURRENT_DATE) || '-' || LPAD((COALESCE(MAX(SUBSTRING(quote_number FROM '\\d+$')::int), 0) + 1)::text, 5, '0') AS next_num FROM quotations WHERE quote_number LIKE 'QUO-' || EXTRACT(YEAR FROM CURRENT_DATE) || '-%'`
      );

      const quotation = await withTransaction(async (client) => {
        const { rows: [quo] } = await client.query(
          `INSERT INTO quotations (deal_id, quote_number, valid_until, subtotal, discount_percent, discount_amount, total_amount, status, requires_approval, notes, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
          [params.deal_id, next_num, params.valid_until || null, subtotal, discountPct, discountAmount, totalAmount,
           requiresApproval ? 'pending_approval' : 'draft', requiresApproval, params.notes || null, user.staff.id]
        );
        for (const it of params.items) {
          const lineTotal = Number(it.quantity || 1) * Number(it.unit_price);
          await client.query(
            `INSERT INTO quotation_items (quotation_id, description, quantity, unit_price, line_total) VALUES ($1,$2,$3,$4,$5)`,
            [quo.id, it.description, it.quantity || 1, it.unit_price, lineTotal]
          );
        }
        return quo;
      });

      await safeQuery(`UPDATE deals SET last_activity_at = NOW() WHERE id = $1`, [params.deal_id]);
      return { quotation, note: requiresApproval ? `Discount of ${discountPct}% exceeds approval threshold` : null };
    },
  },

  {
    name: 'approve_quotation',
    description: 'Approve a pending quotation',
    category: 'sales',
    readOnly: false,
    requiresConfirmation: false,
    destructive: false,
    allowedRoles: ['finance'],
    allowedDepartments: [],
    parameters: {
      quotation_id: { type: 'string', required: true },
    },
    execute: async (params, user) => {
      const { rows } = await safeQuery(
        `UPDATE quotations SET status = 'draft', requires_approval = false, approved_by = $1, approved_at = NOW() WHERE id = $2 AND status = 'pending_approval' RETURNING *`,
        [user.staff.id, params.quotation_id]
      );
      if (!rows.length) throw new Error('Quotation not found or not pending approval');
      return { quotation: rows[0] };
    },
  },

  {
    name: 'list_parties',
    description: 'List CRM parties (customers/vendors)',
    category: 'sales',
    readOnly: true,
    requiresConfirmation: false,
    allowedRoles: ['finance'],
    allowedDepartments: [],
    parameters: {
      party_type: { type: 'string', required: false },
      search: { type: 'string', required: false },
    },
    execute: async (params, user) => {
      const conditions = [`merged_into_party_id IS NULL`];
      const queryParams = [];
      if (params.party_type) { queryParams.push(params.party_type); conditions.push(`party_type = $${queryParams.length}`); }
      if (params.search) { queryParams.push(`%${params.search}%`); conditions.push(`(name ILIKE $${queryParams.length} OR gstin ILIKE $${queryParams.length})`); }
      const { rows } = await safeQuery(`SELECT * FROM parties WHERE ${conditions.join(' AND ')} ORDER BY name`, queryParams);
      return { parties: rows };
    },
  },

  {
    name: 'get_party',
    description: 'Get party detail with unified timeline',
    category: 'sales',
    readOnly: true,
    requiresConfirmation: false,
    allowedRoles: ['finance'],
    allowedDepartments: [],
    parameters: {
      party_id: { type: 'string', required: true },
    },
    execute: async (params, user) => {
      const { rows: [party] } = await safeQuery(`SELECT * FROM parties WHERE id = $1`, [params.party_id]);
      if (!party) throw new Error('Party not found');

      const [contacts, deals, invoices, documents, notes] = await Promise.all([
        safeQuery(`SELECT * FROM contacts WHERE party_id = $1 ORDER BY full_name`, [params.party_id]),
        safeQuery(`SELECT id, company_name, stage, deal_value, updated_at FROM deals WHERE converted_party_id = $1 ORDER BY updated_at DESC`, [params.party_id]),
        safeQuery(`SELECT id, invoice_number, status, total_amount, amount_paid, created_at FROM invoices WHERE party_id = $1 ORDER BY created_at DESC LIMIT 50`, [params.party_id]),
        safeQuery(`SELECT id, title, doc_type, created_at FROM documents WHERE entity_type = 'party' AND entity_id = $1 ORDER BY created_at DESC`, [params.party_id]),
        safeQuery(
          `SELECT pn.*, sa.email AS created_by_email FROM party_notes pn LEFT JOIN staff_accounts sa ON sa.id = pn.created_by WHERE pn.party_id = $1 ORDER BY pn.created_at DESC`,
          [params.party_id]
        ),
      ]);

      const timeline = [
        ...deals.rows.map((d) => ({ type: 'deal', at: d.updated_at, data: d })),
        ...invoices.rows.map((i) => ({ type: 'invoice', at: i.created_at, data: i })),
        ...documents.rows.map((d) => ({ type: 'document', at: d.created_at, data: d })),
        ...notes.rows.map((n) => ({ type: 'note', at: n.created_at, data: n })),
      ].sort((a, b) => new Date(b.at) - new Date(a.at));

      return { party, contacts: contacts.rows, timeline };
    },
  },
];

module.exports = salesTools;