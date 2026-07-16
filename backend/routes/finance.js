'use strict';
// routes/finance.js — SRS §8.7, §10.4/§10.5
//
// Two things live here:
//   1. approval_thresholds — configurable amount bands (SET-01). Would
//      eventually move under a full Settings module (§8.23, not yet built);
//      exposed here directly for now since Finance is the only consumer.
//   2. expense_claims — employee-submitted reimbursement requests, routed
//      through a sequential L1 (Reporting Manager) -> L2 (Finance
//      Controller) -> L3 (CFO/Founder) chain, with how many levels required
//      determined by amount at submission time (snapshotted, so a later
//      threshold config change never retroactively changes an in-flight
//      claim's required chain).
//
// Deliberately separate from services/approvals.js (the RBAC governance
// system for destructive actions like deactivating a login) — different
// shape, different purpose, same underlying idea of "gate before act."

const express = require('express');
const router = express.Router();
const { safeQuery } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const { fireEvent } = require('../services/automationEngine');

router.use(authenticate);

// ── approval thresholds — view (anyone) / edit (owner/admin only) ──────────
router.get('/thresholds', async (req, res) => {
  try {
    const { rows } = await safeQuery(
      `SELECT * FROM approval_thresholds ORDER BY request_type, min_amount`
    );
    res.json({ thresholds: rows });
  } catch (err) {
    console.error('[finance:thresholds:list]', err);
    res.status(500).json({ error: 'Failed to fetch thresholds' });
  }
});

router.put('/thresholds/:id', requireRole('admin'), async (req, res) => {
  try {
    const { min_amount, max_amount, levels_required } = req.body;
    const sets = [];
    const params = [];
    if (min_amount !== undefined) { params.push(min_amount); sets.push(`min_amount = $${params.length}`); }
    if (max_amount !== undefined) { params.push(max_amount === '' ? null : max_amount); sets.push(`max_amount = $${params.length}`); }
    if (levels_required !== undefined) { params.push(levels_required); sets.push(`levels_required = $${params.length}`); }
    if (!sets.length) return res.status(400).json({ error: 'No valid fields to update' });

    params.push(req.params.id);
    const { rows } = await safeQuery(
      `UPDATE approval_thresholds SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );
    if (!rows.length) return res.status(404).json({ error: 'Threshold band not found' });
    res.json({ threshold: rows[0] });
  } catch (err) {
    console.error('[finance:thresholds:update]', err);
    res.status(500).json({ error: 'Failed to update threshold' });
  }
});

async function getLevelsRequired(requestType, amount) {
  const { rows: [band] } = await safeQuery(
    `SELECT levels_required FROM approval_thresholds
     WHERE request_type = $1 AND min_amount <= $2 AND (max_amount IS NULL OR max_amount > $2)
     ORDER BY min_amount DESC LIMIT 1`,
    [requestType, amount]
  );
  return band ? band.levels_required : 3; // fail safe: unknown amount band requires full chain, not auto-approve
}

// Who's allowed to act at a given level for a given claim.
// L1 = the claimant's own manager. L2 = anyone with role 'finance'.
// L3 = owner specifically (not admin-bypass — mirrors services/approvals.js's
// "only the real Founder" pattern for final sign-off).
async function canActAtLevel(level, claim, staff) {
  if (staff.role === 'owner') return true; // Founder can act at any level, always
  if (level === 1) {
    if (staff.role === 'admin') return true;
    const { rows: [emp] } = await safeQuery(`SELECT manager_id FROM employees WHERE id = $1`, [claim.employee_id]);
    return emp && emp.manager_id === staff.employee_id;
  }
  if (level === 2) return ['admin', 'finance'].includes(staff.role);
  if (level === 3) return false; // only owner, handled above
  return false;
}

// ── submit a claim ──────────────────────────────────────────────────────────
router.post('/expense-claims', async (req, res) => {
  try {
    if (!req.staff.employee_id) {
      return res.status(400).json({ error: 'This login is not linked to an employee record — cannot submit an expense claim' });
    }
    const { category, description, amount, expense_date, receipt_document_id } = req.body;
    if (!category || !amount || !expense_date) {
      return res.status(400).json({ error: 'category, amount, and expense_date are required' });
    }
    const amt = Number(amount);
    if (!(amt > 0)) return res.status(400).json({ error: 'amount must be positive' });

    const levelsRequired = await getLevelsRequired('expense_claim', amt);
    const status = levelsRequired === 0 ? 'approved' : 'pending';

    const { rows: [claim] } = await safeQuery(
      `INSERT INTO expense_claims (employee_id, category, description, amount, expense_date, receipt_document_id, levels_required, current_level, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,0,$8) RETURNING *`,
      [req.staff.employee_id, category, description || null, amt, expense_date, receipt_document_id || null, levelsRequired, status]
    );

    if (levelsRequired > 0) {
      const { rows: [emp] } = await safeQuery(`SELECT full_name FROM employees WHERE id = $1`, [req.staff.employee_id]);
      fireEvent('expense_claim.submitted', { employee_name: emp?.full_name, amount: amt, category, link: '/finance' });
    }

    res.status(201).json({ claim });
  } catch (err) {
    console.error('[finance:expense-claims:create]', err);
    res.status(500).json({ error: 'Failed to submit expense claim' });
  }
});

// ── self-service: my own claims ─────────────────────────────────────────────
router.get('/expense-claims/mine', async (req, res) => {
  try {
    if (!req.staff.employee_id) return res.status(404).json({ error: 'This login is not linked to an employee record' });
    const { rows } = await safeQuery(
      `SELECT * FROM expense_claims WHERE employee_id = $1 ORDER BY created_at DESC`,
      [req.staff.employee_id]
    );
    res.json({ claims: rows });
  } catch (err) {
    console.error('[finance:expense-claims:mine]', err);
    res.status(500).json({ error: 'Failed to fetch your claims' });
  }
});

// ── claims pending the current user's decision at their level ──────────────
router.get('/expense-claims/pending-my-approval', async (req, res) => {
  try {
    const { rows: pending } = await safeQuery(
      `SELECT ec.*, e.full_name AS employee_name, e.manager_id
       FROM expense_claims ec JOIN employees e ON e.id = ec.employee_id
       WHERE ec.status = 'pending' ORDER BY ec.created_at ASC`
    );
    const mine = [];
    for (const claim of pending) {
      const nextLevel = claim.current_level + 1;
      if (await canActAtLevel(nextLevel, claim, req.staff)) {
        mine.push({ ...claim, next_level: nextLevel });
      }
    }
    res.json({ claims: mine });
  } catch (err) {
    console.error('[finance:expense-claims:pending]', err);
    res.status(500).json({ error: 'Failed to fetch claims pending your approval' });
  }
});

router.get('/expense-claims', requireRole('finance'), async (req, res) => {
  try {
    const { status } = req.query;
    const params = [];
    let where = '';
    if (status) { params.push(status); where = `WHERE ec.status = $1`; }
    const { rows } = await safeQuery(
      `SELECT ec.*, e.full_name AS employee_name FROM expense_claims ec
       JOIN employees e ON e.id = ec.employee_id ${where} ORDER BY ec.created_at DESC LIMIT 200`,
      params
    );
    res.json({ claims: rows });
  } catch (err) {
    console.error('[finance:expense-claims:list]', err);
    res.status(500).json({ error: 'Failed to fetch expense claims' });
  }
});

router.get('/expense-claims/:id', async (req, res) => {
  try {
    const { rows: [claim] } = await safeQuery(
      `SELECT ec.*, e.full_name AS employee_name FROM expense_claims ec
       JOIN employees e ON e.id = ec.employee_id WHERE ec.id = $1`,
      [req.params.id]
    );
    if (!claim) return res.status(404).json({ error: 'Claim not found' });

    const isSelf = req.staff.employee_id === claim.employee_id;
    if (!isSelf && !['owner', 'admin', 'finance'].includes(req.staff.role) &&
        !(await canActAtLevel(claim.current_level + 1, claim, req.staff))) {
      return res.status(403).json({ error: 'Not authorized to view this claim' });
    }

    const { rows: history } = await safeQuery(
      `SELECT fa.*, sa.email AS approver_email FROM finance_approval_actions fa
       LEFT JOIN staff_accounts sa ON sa.id = fa.approver_id
       WHERE fa.expense_claim_id = $1 ORDER BY fa.decided_at ASC`,
      [req.params.id]
    );
    res.json({ claim, history });
  } catch (err) {
    console.error('[finance:expense-claims:get]', err);
    res.status(500).json({ error: 'Failed to fetch claim' });
  }
});

// ── decide at the current level — approve advances the chain, reject stops it ──
router.post('/expense-claims/:id/decide', async (req, res) => {
  try {
    const { decision, comment } = req.body;
    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ error: "decision must be 'approved' or 'rejected'" });
    }

    const { rows: [claim] } = await safeQuery(`SELECT * FROM expense_claims WHERE id = $1`, [req.params.id]);
    if (!claim) return res.status(404).json({ error: 'Claim not found' });
    if (claim.status !== 'pending') return res.status(400).json({ error: `Claim is already ${claim.status}` });

    const nextLevel = claim.current_level + 1;
    if (!(await canActAtLevel(nextLevel, claim, req.staff))) {
      return res.status(403).json({ error: `You are not the required approver for level ${nextLevel} of this claim` });
    }

    await safeQuery(
      `INSERT INTO finance_approval_actions (expense_claim_id, level, approver_id, decision, comment)
       VALUES ($1,$2,$3,$4,$5)`,
      [claim.id, nextLevel, req.staff.id, decision, comment || null]
    );

    if (decision === 'rejected') {
      const { rows: [updated] } = await safeQuery(
        `UPDATE expense_claims SET status = 'rejected', updated_at = NOW() WHERE id = $1 RETURNING *`,
        [claim.id]
      );
      fireEvent('expense_claim.rejected', { claimId: claim.id, level: nextLevel, link: '/finance' });
      return res.json({ claim: updated });
    }

    const isFinal = nextLevel >= claim.levels_required;
    const { rows: [updated] } = await safeQuery(
      `UPDATE expense_claims SET current_level = $1, status = $2, updated_at = NOW() WHERE id = $3 RETURNING *`,
      [nextLevel, isFinal ? 'approved' : 'pending', claim.id]
    );
    if (isFinal) {
      fireEvent('expense_claim.approved', { claimId: claim.id, amount: claim.amount, link: '/finance' });
    }
    res.json({ claim: updated });
  } catch (err) {
    console.error('[finance:expense-claims:decide]', err);
    res.status(500).json({ error: 'Failed to record decision' });
  }
});

module.exports = router;