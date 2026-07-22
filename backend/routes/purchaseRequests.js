'use strict';
// routes/purchaseRequests.js — SRS §8.7, §10.4/§10.5
//
// Preventive control, distinct from expense_claims (which is a DETECTIVE
// control — reimbursement after spend already happened). A purchase request
// must be approved BEFORE anything is bought. Shares the same L1 (Reporting
// Manager) -> L2 (Finance) -> L3 (Owner) approval chain as expense claims,
// via the shared services/approvalChain.js — same threshold config table
// (approval_thresholds, request_type = 'purchase_request'), same escalation
// rules, same row-lock pattern to close the decide race condition.

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { safeQuery, withTransaction } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const { fireEvent } = require('../services/automationEngine');
const { getLevelsRequired, canActAtLevel } = require('../services/approvalChain');

router.use(authenticate);

const generalLimiter = rateLimit({
  windowMs: 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many requests — please slow down and try again shortly.' },
});
router.use(generalLimiter);

const writeLimiter = rateLimit({
  windowMs: 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many changes made too quickly — please slow down and try again shortly.' },
});
router.use((req, res, next) => {
  if (['POST', 'PUT', 'DELETE'].includes(req.method)) return writeLimiter(req, res, next);
  next();
});

function paginationParams(req) {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  return { limit, offset };
}

// ── submit a purchase request ───────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    if (!req.staff.employee_id) {
      return res.status(400).json({ error: 'This login is not linked to an employee record — cannot submit a purchase request' });
    }
    const { vendor_name, item_description, estimated_amount, currency, needed_by_date, justification } = req.body;
    if (!vendor_name || !item_description || !estimated_amount) {
      return res.status(400).json({ error: 'vendor_name, item_description, and estimated_amount are required' });
    }
    const amt = Number(estimated_amount);
    if (!Number.isFinite(amt) || !(amt > 0)) return res.status(400).json({ error: 'estimated_amount must be a positive number' });

    const levelsRequired = await getLevelsRequired('purchase_request', amt);
    const status = levelsRequired === 0 ? 'approved' : 'pending';

    const { rows: [pr] } = await safeQuery(
      `INSERT INTO purchase_requests (requested_by, vendor_name, item_description, estimated_amount, currency, needed_by_date, justification, levels_required, current_level, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0,$9) RETURNING *`,
      [req.staff.employee_id, vendor_name, item_description, amt, (currency || 'INR').toUpperCase(),
       needed_by_date || null, justification || null, levelsRequired, status]
    );

    if (levelsRequired > 0) {
      const { rows: [emp] } = await safeQuery(`SELECT full_name FROM employees WHERE id = $1`, [req.staff.employee_id]);
      fireEvent('purchase_request.submitted', { employee_name: emp?.full_name, amount: amt, vendor_name, link: '/finance/purchase-requests' })
        .catch((err) => console.error('[purchase-requests:fireEvent] submitted failed:', err));
    }

    res.status(201).json({ purchaseRequest: pr });
  } catch (err) {
    console.error('[purchase-requests:create]', err);
    res.status(500).json({ error: 'Failed to submit purchase request' });
  }
});

// ── self-service: my own requests ───────────────────────────────────────────
router.get('/mine', async (req, res) => {
  try {
    if (!req.staff.employee_id) return res.status(404).json({ error: 'This login is not linked to an employee record' });
    const { limit, offset } = paginationParams(req);
    const { rows: [{ count }] } = await safeQuery(`SELECT COUNT(*) AS count FROM purchase_requests WHERE requested_by = $1`, [req.staff.employee_id]);
    const { rows } = await safeQuery(
      `SELECT * FROM purchase_requests WHERE requested_by = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [req.staff.employee_id, limit, offset]
    );
    res.json({ requests: rows, pagination: { total: Number(count), limit, offset } });
  } catch (err) {
    console.error('[purchase-requests:mine]', err);
    res.status(500).json({ error: 'Failed to fetch your purchase requests' });
  }
});

// ── requests pending the current user's decision at their level ────────────
router.get('/pending-my-approval', async (req, res) => {
  try {
    const { rows: pending } = await safeQuery(
      `SELECT pr.*, e.full_name AS requested_by_name, e.manager_id
       FROM purchase_requests pr JOIN employees e ON e.id = pr.requested_by
       WHERE pr.status = 'pending' ORDER BY pr.created_at ASC`
    );
    const mine = [];
    for (const pr of pending) {
      const nextLevel = pr.current_level + 1;
      if (await canActAtLevel(nextLevel, pr.requested_by, req.staff)) {
        mine.push({ ...pr, next_level: nextLevel });
      }
    }
    res.json({ requests: mine });
  } catch (err) {
    console.error('[purchase-requests:pending]', err);
    res.status(500).json({ error: 'Failed to fetch requests pending your approval' });
  }
});

router.get('/', requireRole('finance'), async (req, res) => {
  try {
    const { status } = req.query;
    const { limit, offset } = paginationParams(req);
    const params = [];
    let where = '';
    if (status) { params.push(status); where = `WHERE pr.status = $${params.length}`; }

    const { rows: [{ count }] } = await safeQuery(`SELECT COUNT(*) AS count FROM purchase_requests pr ${where}`, params);

    params.push(limit, offset);
    const { rows } = await safeQuery(
      `SELECT pr.*, e.full_name AS requested_by_name FROM purchase_requests pr
       JOIN employees e ON e.id = pr.requested_by ${where}
       ORDER BY pr.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({ requests: rows, pagination: { total: Number(count), limit, offset } });
  } catch (err) {
    console.error('[purchase-requests:list]', err);
    res.status(500).json({ error: 'Failed to fetch purchase requests' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows: [pr] } = await safeQuery(
      `SELECT pr.*, e.full_name AS requested_by_name FROM purchase_requests pr
       JOIN employees e ON e.id = pr.requested_by WHERE pr.id = $1`,
      [req.params.id]
    );
    if (!pr) return res.status(404).json({ error: 'Purchase request not found' });

    const isSelf = req.staff.employee_id === pr.requested_by;
    const isPrivileged = ['owner', 'admin', 'finance'].includes(req.staff.role);
    const isNextApprover = await canActAtLevel(pr.current_level + 1, pr.requested_by, req.staff);
    const { rows: [actedBefore] } = await safeQuery(
      `SELECT 1 FROM purchase_request_actions WHERE purchase_request_id = $1 AND approver_id = $2 LIMIT 1`,
      [pr.id, req.staff.id]
    );

    if (!isSelf && !isPrivileged && !isNextApprover && !actedBefore) {
      return res.status(403).json({ error: 'Not authorized to view this purchase request' });
    }

    const { rows: history } = await safeQuery(
      `SELECT pa.*, sa.email AS approver_email FROM purchase_request_actions pa
       LEFT JOIN staff_accounts sa ON sa.id = pa.approver_id
       WHERE pa.purchase_request_id = $1 ORDER BY pa.decided_at ASC`,
      [req.params.id]
    );
    res.json({ purchaseRequest: pr, history });
  } catch (err) {
    console.error('[purchase-requests:get]', err);
    res.status(500).json({ error: 'Failed to fetch purchase request' });
  }
});

// ── decide — same row-lock pattern as expense_claims to close the same race ─
router.post('/:id/decide', async (req, res) => {
  try {
    const { decision, comment } = req.body;
    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ error: "decision must be 'approved' or 'rejected'" });
    }

    const result = await withTransaction(async (client) => {
      const { rows: [pr] } = await client.query(`SELECT * FROM purchase_requests WHERE id = $1 FOR UPDATE`, [req.params.id]);
      if (!pr) { const e = new Error('Purchase request not found'); e.httpStatus = 404; throw e; }
      if (pr.status !== 'pending') { const e = new Error(`Purchase request is already ${pr.status}`); e.httpStatus = 400; throw e; }

      const nextLevel = pr.current_level + 1;
      if (!(await canActAtLevel(nextLevel, pr.requested_by, req.staff))) {
        const e = new Error(`You are not the required approver for level ${nextLevel} of this request`);
        e.httpStatus = 403;
        throw e;
      }

      await client.query(
        `INSERT INTO purchase_request_actions (purchase_request_id, level, approver_id, decision, comment) VALUES ($1,$2,$3,$4,$5)`,
        [pr.id, nextLevel, req.staff.id, decision, comment || null]
      );

      if (decision === 'rejected') {
        const { rows: [updated] } = await client.query(
          `UPDATE purchase_requests SET status = 'rejected', updated_at = NOW() WHERE id = $1 RETURNING *`,
          [pr.id]
        );
        return { updated, event: { name: 'purchase_request.rejected', payload: { requestId: pr.id, level: nextLevel, link: '/finance/purchase-requests' } } };
      }

      const isFinal = nextLevel >= pr.levels_required;
      const { rows: [updated] } = await client.query(
        `UPDATE purchase_requests SET current_level = $1, status = $2, updated_at = NOW() WHERE id = $3 RETURNING *`,
        [nextLevel, isFinal ? 'approved' : 'pending', pr.id]
      );
      return {
        updated,
        event: isFinal ? { name: 'purchase_request.approved', payload: { requestId: pr.id, amount: pr.estimated_amount, link: '/finance/purchase-requests' } } : null,
      };
    });

    if (result.event) {
      fireEvent(result.event.name, result.event.payload)
        .catch((err) => console.error(`[purchase-requests:fireEvent] ${result.event.name} failed:`, err));
    }

    res.json({ purchaseRequest: result.updated });
  } catch (err) {
    console.error('[purchase-requests:decide]', err);
    res.status(err.httpStatus || 500).json({ error: err.httpStatus ? err.message : 'Failed to record decision' });
  }
});

// ── cancel — requester can withdraw their own still-pending request ────────
router.post('/:id/cancel', async (req, res) => {
  try {
    const { rows: [pr] } = await safeQuery(`SELECT * FROM purchase_requests WHERE id = $1`, [req.params.id]);
    if (!pr) return res.status(404).json({ error: 'Purchase request not found' });
    if (pr.requested_by !== req.staff.employee_id) return res.status(403).json({ error: 'You can only cancel your own requests' });
    if (pr.status !== 'pending') return res.status(400).json({ error: `Cannot cancel a request that is already ${pr.status}` });

    const { rows: [updated] } = await safeQuery(
      `UPDATE purchase_requests SET status = 'cancelled', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    res.json({ purchaseRequest: updated });
  } catch (err) {
    console.error('[purchase-requests:cancel]', err);
    res.status(500).json({ error: 'Failed to cancel purchase request' });
  }
});

// ── convert an approved purchase request into an actual vendor bill ────────
// Closes the loop: right now an approved PR just sits there with nothing
// tracking that the actual purchase/bill ever happened. Deliberately requires
// an explicit vendor_id + category_id at conversion time rather than trying
// to auto-match purchase_requests.vendor_name (free text) against your real
// parties/vendor records — a human confirms the real vendor at the moment a
// financial record is actually created, rather than the system guessing.
router.post('/:id/convert-to-bill', requireRole('finance'), async (req, res) => {
  try {
    const { vendor_id, category_id, bill_date, due_date } = req.body;
    if (!vendor_id) return res.status(400).json({ error: 'vendor_id is required — select which vendor record this bill belongs to' });

    const { rows: [pr] } = await safeQuery(`SELECT * FROM purchase_requests WHERE id = $1`, [req.params.id]);
    if (!pr) return res.status(404).json({ error: 'Purchase request not found' });
    if (pr.status !== 'approved') return res.status(400).json({ error: `Only approved purchase requests can be converted to a bill (this one is ${pr.status})` });
    if (pr.converted_bill_id) return res.status(400).json({ error: 'This purchase request has already been converted to a bill' });

    const resolvedBillDate = bill_date || new Date().toISOString().slice(0, 10);
    const resolvedDueDate = due_date || resolvedBillDate;

    const { rows: [{ next_num }] } = await safeQuery(
      `SELECT 'BILL-' || EXTRACT(YEAR FROM CURRENT_DATE) || '-' ||
              LPAD((COALESCE(MAX(SUBSTRING(bill_number FROM '\\d+$')::int), 0) + 1)::text, 6, '0') AS next_num
       FROM bills WHERE bill_number LIKE 'BILL-' || EXTRACT(YEAR FROM CURRENT_DATE) || '-%'`
    );

    const { rows: [bill] } = await safeQuery(
      `INSERT INTO bills (bill_number, vendor_id, bill_date, due_date, status, category_id, subtotal, total_amount, amount_paid, notes, created_by)
       VALUES ($1,$2,$3,$4,'pending',$5,$6,$6,0,$7,$8) RETURNING *`,
      [next_num, vendor_id, resolvedBillDate, resolvedDueDate, category_id || null, pr.estimated_amount,
       `From purchase request: ${pr.item_description} (${pr.vendor_name})`, req.staff.id]
    );

    const { rows: [updatedPr] } = await safeQuery(
      `UPDATE purchase_requests SET status = 'converted_to_bill', converted_bill_id = $1, converted_at = NOW(), updated_at = NOW() WHERE id = $2 RETURNING *`,
      [bill.id, req.params.id]
    );

    res.status(201).json({ purchaseRequest: updatedPr, bill });
  } catch (err) {
    console.error('[purchase-requests:convert-to-bill]', err);
    res.status(500).json({ error: 'Failed to convert purchase request to bill' });
  }
});

module.exports = router;