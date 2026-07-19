'use strict';
// routes/finance.js — SRS §8.7, §10.4/§10.5
//
// Two things live here:
//   1. approval_thresholds — configurable amount bands (SET-01).
//   2. expense_claims — employee-submitted reimbursement requests, routed
//      through a sequential L1 (Reporting Manager) -> L2 (Finance
//      Controller) -> L3 (CFO/Founder) chain, with how many levels required
//      determined by amount at submission time (snapshotted).

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit'); // npm install express-rate-limit (skip if already installed)
const { safeQuery, withTransaction } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const { fireEvent } = require('../services/automationEngine');

router.use(authenticate);

// Same rate-limiting pattern as expenses.js and payroll.js.
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests to the finance module — please slow down and try again shortly.' },
});
router.use(generalLimiter);

const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many changes made too quickly — please slow down and try again shortly.' },
});
router.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return writeLimiter(req, res, next);
  }
  next();
});

const ALLOWED_CLAIM_CATEGORIES = ['travel', 'meals', 'software', 'office_supplies', 'client_entertainment', 'training', 'other'];

function paginationParams(req) {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  return { limit, offset };
}

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
    const { rows: [existing] } = await safeQuery(`SELECT * FROM approval_thresholds WHERE id = $1`, [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Threshold band not found' });

    const { min_amount, max_amount, levels_required } = req.body;

    // Validate against the MERGED state (existing + incoming), so a partial
    // update can't produce an inconsistent band (e.g. only patching max_amount
    // to something below the existing min_amount).
    const mergedMin = min_amount !== undefined ? Number(min_amount) : Number(existing.min_amount);
    const mergedMaxRaw = max_amount !== undefined ? (max_amount === '' || max_amount === null ? null : Number(max_amount)) : existing.max_amount;
    const mergedMax = mergedMaxRaw === null ? null : Number(mergedMaxRaw);
    const mergedLevels = levels_required !== undefined ? Number(levels_required) : existing.levels_required;

    if (!Number.isFinite(mergedMin) || mergedMin < 0) {
      return res.status(400).json({ error: 'min_amount must be a number ≥ 0' });
    }
    if (mergedMax !== null && (!Number.isFinite(mergedMax) || mergedMax <= mergedMin)) {
      return res.status(400).json({ error: 'max_amount must be greater than min_amount, or left blank for unlimited' });
    }
    if (!Number.isInteger(mergedLevels) || mergedLevels < 0 || mergedLevels > 3) {
      return res.status(400).json({ error: 'levels_required must be an integer between 0 and 3' });
    }

    const sets = [];
    const params = [];
    if (min_amount !== undefined) { params.push(mergedMin); sets.push(`min_amount = $${params.length}`); }
    if (max_amount !== undefined) { params.push(mergedMax); sets.push(`max_amount = $${params.length}`); }
    if (levels_required !== undefined) { params.push(mergedLevels); sets.push(`levels_required = $${params.length}`); }
    if (!sets.length) return res.status(400).json({ error: 'No valid fields to update' });

    params.push(req.params.id);
    const { rows } = await safeQuery(
      `UPDATE approval_thresholds SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );
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
// Receipt attachment is a SEPARATE step now (see PATCH /:id/receipt below) —
// the claim must exist first so the receipt's entity_id is a real UUID, not
// the placeholder string the old frontend code used to send.
router.post('/expense-claims', async (req, res) => {
  try {
    if (!req.staff.employee_id) {
      return res.status(400).json({ error: 'This login is not linked to an employee record — cannot submit an expense claim' });
    }
    const { category, description, amount, expense_date } = req.body;
    if (!category || !amount || !expense_date) {
      return res.status(400).json({ error: 'category, amount, and expense_date are required' });
    }
    if (!ALLOWED_CLAIM_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `category must be one of: ${ALLOWED_CLAIM_CATEGORIES.join(', ')}` });
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || !(amt > 0)) return res.status(400).json({ error: 'amount must be a positive number' });

    const levelsRequired = await getLevelsRequired('expense_claim', amt);
    const status = levelsRequired === 0 ? 'approved' : 'pending';

    const { rows: [claim] } = await safeQuery(
      `INSERT INTO expense_claims (employee_id, category, description, amount, expense_date, levels_required, current_level, status)
       VALUES ($1,$2,$3,$4,$5,$6,0,$7) RETURNING *`,
      [req.staff.employee_id, category, description || null, amt, expense_date, levelsRequired, status]
    );

    if (levelsRequired > 0) {
      const { rows: [emp] } = await safeQuery(`SELECT full_name FROM employees WHERE id = $1`, [req.staff.employee_id]);
      fireEvent('expense_claim.submitted', { employee_name: emp?.full_name, amount: amt, category, link: '/finance' })
        .catch((err) => console.error('[finance:fireEvent] expense_claim.submitted failed:', err));
    }

    res.status(201).json({ claim });
  } catch (err) {
    console.error('[finance:expense-claims:create]', err);
    res.status(500).json({ error: 'Failed to submit expense claim' });
  }
});

// ── attach a receipt to an already-created claim ────────────────────────────
// Call this AFTER uploading the receipt via POST /documents with
// entity_type='expense_claim' and entity_id=<this claim's real id>.
// Validates the document actually belongs to this claim and was uploaded by
// the same person submitting it — otherwise anyone could attach any document
// (including another employee's file) to their own claim just by guessing an id.
router.patch('/expense-claims/:id/receipt', async (req, res) => {
  try {
    const { receipt_document_id } = req.body;
    if (!receipt_document_id) return res.status(400).json({ error: 'receipt_document_id is required' });

    const { rows: [claim] } = await safeQuery(`SELECT * FROM expense_claims WHERE id = $1`, [req.params.id]);
    if (!claim) return res.status(404).json({ error: 'Claim not found' });
    if (claim.employee_id !== req.staff.employee_id) return res.status(403).json({ error: 'You can only attach receipts to your own claims' });
    if (claim.status !== 'pending' && claim.status !== 'approved') {
      // Allow attaching even after approval (e.g. forgot the receipt), but not on a rejected/paid claim.
      return res.status(400).json({ error: `Cannot attach a receipt to a claim that is ${claim.status}` });
    }

    const { rows: [doc] } = await safeQuery(`SELECT * FROM documents WHERE id = $1`, [receipt_document_id]);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    if (doc.entity_type !== 'expense_claim' || doc.entity_id !== claim.id) {
      return res.status(400).json({ error: 'This document was not uploaded against this claim' });
    }
    if (doc.uploaded_by !== req.staff.id) {
      return res.status(403).json({ error: 'You did not upload this document' });
    }

    const { rows: [updated] } = await safeQuery(
      `UPDATE expense_claims SET receipt_document_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [receipt_document_id, req.params.id]
    );
    res.json({ claim: updated });
  } catch (err) {
    console.error('[finance:expense-claims:attach-receipt]', err);
    res.status(500).json({ error: 'Failed to attach receipt' });
  }
});

// ── self-service: my own claims ─────────────────────────────────────────────
router.get('/expense-claims/mine', async (req, res) => {
  try {
    if (!req.staff.employee_id) return res.status(404).json({ error: 'This login is not linked to an employee record' });
    const { limit, offset } = paginationParams(req);
    const { rows: [{ count }] } = await safeQuery(
      `SELECT COUNT(*) AS count FROM expense_claims WHERE employee_id = $1`,
      [req.staff.employee_id]
    );
    const { rows } = await safeQuery(
      `SELECT * FROM expense_claims WHERE employee_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [req.staff.employee_id, limit, offset]
    );
    res.json({ claims: rows, pagination: { total: Number(count), limit, offset } });
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
    const { limit, offset } = paginationParams(req);
    const params = [];
    let where = '';
    if (status) { params.push(status); where = `WHERE ec.status = $${params.length}`; }

    const { rows: [{ count }] } = await safeQuery(
      `SELECT COUNT(*) AS count FROM expense_claims ec ${where}`,
      params
    );

    params.push(limit, offset);
    const { rows } = await safeQuery(
      `SELECT ec.*, e.full_name AS employee_name FROM expense_claims ec
       JOIN employees e ON e.id = ec.employee_id ${where}
       ORDER BY ec.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({ claims: rows, pagination: { total: Number(count), limit, offset } });
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
    const isPrivileged = ['owner', 'admin', 'finance'].includes(req.staff.role);
    const isNextApprover = await canActAtLevel(claim.current_level + 1, claim, req.staff);

    // Anyone who has ALREADY acted on this claim keeps visibility into it even
    // after it moves past their level — otherwise an L1 manager who approved
    // loses all access the moment it reaches L2, which is a real gap for
    // "what happened to that claim I approved last week?"
    const { rows: [actedBefore] } = await safeQuery(
      `SELECT 1 FROM finance_approval_actions WHERE expense_claim_id = $1 AND approver_id = $2 LIMIT 1`,
      [claim.id, req.staff.id]
    );

    if (!isSelf && !isPrivileged && !isNextApprover && !actedBefore) {
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
// Wrapped in a transaction with SELECT ... FOR UPDATE: this is what actually
// closes the race condition. Two near-simultaneous decide calls on the same
// claim used to both pass the "is it still pending" check before either write
// landed — now the second request blocks on the row lock until the first
// transaction commits, then re-reads the ALREADY-UPDATED row and correctly
// sees the claim is no longer pending.
router.post('/expense-claims/:id/decide', async (req, res) => {
  try {
    const { decision, comment } = req.body;
    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ error: "decision must be 'approved' or 'rejected'" });
    }

    const result = await withTransaction(async (client) => {
      const { rows: [claim] } = await client.query(`SELECT * FROM expense_claims WHERE id = $1 FOR UPDATE`, [req.params.id]);
      if (!claim) { const e = new Error('Claim not found'); e.httpStatus = 404; throw e; }
      if (claim.status !== 'pending') { const e = new Error(`Claim is already ${claim.status}`); e.httpStatus = 400; throw e; }

      const nextLevel = claim.current_level + 1;
      if (!(await canActAtLevel(nextLevel, claim, req.staff))) {
        const e = new Error(`You are not the required approver for level ${nextLevel} of this claim`);
        e.httpStatus = 403;
        throw e;
      }

      await client.query(
        `INSERT INTO finance_approval_actions (expense_claim_id, level, approver_id, decision, comment) VALUES ($1,$2,$3,$4,$5)`,
        [claim.id, nextLevel, req.staff.id, decision, comment || null]
      );

      if (decision === 'rejected') {
        const { rows: [updated] } = await client.query(
          `UPDATE expense_claims SET status = 'rejected', updated_at = NOW() WHERE id = $1 RETURNING *`,
          [claim.id]
        );
        return { updated, event: { name: 'expense_claim.rejected', payload: { claimId: claim.id, level: nextLevel, link: '/finance' } } };
      }

      const isFinal = nextLevel >= claim.levels_required;
      const { rows: [updated] } = await client.query(
        `UPDATE expense_claims SET current_level = $1, status = $2, updated_at = NOW() WHERE id = $3 RETURNING *`,
        [nextLevel, isFinal ? 'approved' : 'pending', claim.id]
      );
      return {
        updated,
        event: isFinal ? { name: 'expense_claim.approved', payload: { claimId: claim.id, amount: claim.amount, link: '/finance' } } : null,
      };
    });

    // Fire the event AFTER the transaction commits, and never let it fail the request.
    if (result.event) {
      fireEvent(result.event.name, result.event.payload)
        .catch((err) => console.error(`[finance:fireEvent] ${result.event.name} failed:`, err));
    }

    res.json({ claim: result.updated });
  } catch (err) {
    console.error('[finance:expense-claims:decide]', err);
    res.status(err.httpStatus || 500).json({ error: err.httpStatus ? err.message : 'Failed to record decision' });
  }
});

module.exports = router;