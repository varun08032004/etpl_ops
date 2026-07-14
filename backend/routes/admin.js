'use strict';

const express = require('express');
const router = express.Router();
const { safeQuery } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate);
router.use(requireRole('admin')); // everything here is owner/admin only, deliberately stricter than finance/hr

// ── audit log ────────────────────────────────────────────────────────────
router.get('/audit-log', async (req, res) => {
  try {
    const { action, staff_id, from, to } = req.query;
    const conditions = [];
    const params = [];
    if (action) { params.push(`%${action}%`); conditions.push(`al.action ILIKE $${params.length}`); }
    if (staff_id) { params.push(staff_id); conditions.push(`al.staff_id = $${params.length}`); }
    if (from) { params.push(from); conditions.push(`al.created_at >= $${params.length}`); }
    if (to) { params.push(to); conditions.push(`al.created_at <= $${params.length}::date + 1`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await safeQuery(
      `SELECT al.*, sa.email AS staff_email FROM audit_log al
       LEFT JOIN staff_accounts sa ON sa.id = al.staff_id
       ${where} ORDER BY al.created_at DESC LIMIT 200`,
      params
    );
    res.json({ entries: rows });
  } catch (err) {
    console.error('[admin:audit-log]', err);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

// ── permissions matrix — static reference, not a dynamic permission engine ─
// This documents what's actually enforced in code (requireRole() calls
// throughout the route files) rather than being a separate source of truth
// that could drift from reality. If you change a requireRole() call, update
// this table to match — it's a reference view, not the thing being enforced.
router.get('/permissions-matrix', (req, res) => {
  const ROLES = ['owner', 'admin', 'hr', 'finance', 'manager', 'employee'];
  const MODULES = [
    { module: 'Dashboard & Analytics', owner: 'full', admin: 'full', hr: 'full', finance: 'full', manager: 'none', employee: 'none' },
    { module: 'People (HR records)', owner: 'full', admin: 'full', hr: 'full', finance: 'view', manager: 'none', employee: 'own record only' },
    { module: 'Compensation data', owner: 'full', admin: 'full', hr: 'full', finance: 'full', manager: 'none', employee: 'own only' },
    { module: 'Sales pipeline', owner: 'full', admin: 'full', hr: 'view', finance: 'full', manager: 'view', employee: 'none' },
    { module: 'Invoices', owner: 'full', admin: 'full', hr: 'none', finance: 'full', manager: 'none', employee: 'none' },
    { module: 'Accounting / Ledger', owner: 'full', admin: 'full', hr: 'none', finance: 'full', manager: 'none', employee: 'none' },
    { module: 'Payroll', owner: 'full', admin: 'full', hr: 'view', finance: 'full', manager: 'none', employee: 'own payslips only' },
    { module: 'Documents (own)', owner: 'full', admin: 'full', hr: 'full', finance: 'full', manager: 'own only', employee: 'own only' },
    { module: 'Team logins (create/deactivate)', owner: 'full', admin: 'full', hr: 'none', finance: 'none', manager: 'none', employee: 'none' },
    { module: 'Role changes', owner: 'can grant any role', admin: 'cannot grant owner', hr: 'none', finance: 'none', manager: 'none', employee: 'none' },
    { module: 'Automation rules (toggle)', owner: 'full', admin: 'full', hr: 'none', finance: 'none', manager: 'none', employee: 'none' },
    { module: 'Platform Sync (run/void)', owner: 'full', admin: 'full', hr: 'none', finance: 'full', manager: 'view records only', employee: 'none' },
    { module: 'Audit Log', owner: 'full', admin: 'full', hr: 'none', finance: 'none', manager: 'none', employee: 'none' },
  ];
  res.json({ roles: ROLES, modules: MODULES });
});

module.exports = router;