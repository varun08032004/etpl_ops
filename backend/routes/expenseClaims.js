'use strict';

const express = require('express');
const router = express.Router();
const { safeQuery } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const { notifyStaff } = require('../services/notifications');
const ledger = require('../services/ledger');

router.use(authenticate);

// Read-only convenience lookups for the claim form — kept here rather than in
// expenses.js/finance.js since those files are already large and own their
// own concerns; this route only needs the id+name shape, not full CRUD.
router.get('/categories', async (req, res) => {
  try {
    const { rows } = await safeQuery(`SELECT id, name FROM expense_categories ORDER BY name`);
    res.json({ categories: rows });
  } catch (err) {
    console.error('[expense-claims:categories]', err);
    res.status(500).json({ error: 'Failed to fetch expense categories' });
  }
});

router.get('/bank-accounts', requireRole('finance'), async (req, res) => {
  try {
    const { rows } = await safeQuery(`SELECT id, account_name, bank_name FROM bank_accounts WHERE is_active = true ORDER BY account_name`);
    res.json({ bankAccounts: rows });
  } catch (err) {
    console.error('[expense-claims:bank-accounts]', err);
    res.status(500).json({ error: 'Failed to fetch bank accounts' });
  }
});

async function staffIdForEmployee(employeeId) {
  if (!employeeId) return null;
  const { rows: [s] } = await safeQuery(`SELECT id FROM staff_accounts WHERE employee_id = $1 AND is_active = true`, [employeeId]);
  return s?.id || null;
}

// ── submit a claim — any logged-in employee, for themselves ────────────────
router.post('/', async (req, res) => {
  try {
    if (!req.staff.employee_id) return res.status(403).json({ error: 'This login is not linked to an employee record' });
    const { category_id, description, amount, expense_date } = req.body;
    if (!description || !amount || !expense_date) {
      return res.status(400).json({ error: 'description, amount, and expense_date are required' });
    }
    if (Number(amount) <= 0) return res.status(400).json({ error: 'amount must be greater than 0' });

    const { rows: [claim] } = await safeQuery(
      `INSERT INTO expense_claims (employee_id, category_id, description, amount, expense_date)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.staff.employee_id, category_id || null, description, amount, expense_date]
    );

    // Notify whoever's first in line to review it — manager, else department head.
    const { rows: [emp] } = await safeQuery(`SELECT manager_id, department_id, full_name FROM employees WHERE id = $1`, [req.staff.employee_id]);
    let reviewerStaffId = emp?.manager_id ? await staffIdForEmployee(emp.manager_id) : null;
    if (!reviewerStaffId && emp?.department_id) {
      const { rows: [dept] } = await safeQuery(`SELECT head_employee_id FROM departments WHERE id = $1`, [emp.department_id]);
      reviewerStaffId = dept?.head_employee_id ? await staffIdForEmployee(dept.head_employee_id) : null;
    }
    if (reviewerStaffId) {
      await notifyStaff({
        staffId: reviewerStaffId, type: 'expense_claim.submitted',
        title: `Expense claim from ${emp.full_name} — ₹${Number(amount).toLocaleString('en-IN')}`,
        body: description, link: '/me',
      });
    }

    res.status(201).json({ claim });
  } catch (err) {
    console.error('[expense-claims:create]', err);
    res.status(500).json({ error: 'Failed to submit expense claim' });
  }
});

// ── my own claims ───────────────────────────────────────────────────────────
router.get('/me', async (req, res) => {
  try {
    if (!req.staff.employee_id) return res.status(403).json({ error: 'This login is not linked to an employee record' });
    const { rows } = await safeQuery(
      `SELECT ec.*, cat.name AS category_name FROM expense_claims ec
       LEFT JOIN expense_categories cat ON cat.id = ec.category_id
       WHERE ec.employee_id = $1 ORDER BY ec.created_at DESC`,
      [req.staff.employee_id]
    );
    res.json({ claims: rows });
  } catch (err) {
    console.error('[expense-claims:me]', err);
    res.status(500).json({ error: 'Failed to fetch your expense claims' });
  }
});

// ── claims waiting on me — manager/dept-head sign-off, or finance reimbursement ──
router.get('/pending', async (req, res) => {
  try {
    const isFinance = ['owner', 'admin', 'finance'].includes(req.staff.role) || (req.staff.effectiveRoles || []).includes('finance');
    const results = { pendingManagerDecision: [], pendingReimbursement: [] };

    if (isFinance) {
      const { rows } = await safeQuery(
        `SELECT ec.*, e.full_name AS employee_name, cat.name AS category_name
         FROM expense_claims ec JOIN employees e ON e.id = ec.employee_id
         LEFT JOIN expense_categories cat ON cat.id = ec.category_id
         WHERE ec.status = 'pending_finance' ORDER BY ec.created_at ASC`
      );
      results.pendingReimbursement = rows;
    }

    if (req.staff.employee_id) {
      const { rows } = await safeQuery(
        `SELECT ec.*, e.full_name AS employee_name, cat.name AS category_name
         FROM expense_claims ec JOIN employees e ON e.id = ec.employee_id
         LEFT JOIN expense_categories cat ON cat.id = ec.category_id
         WHERE ec.status = 'pending_manager'
           AND (e.manager_id = $1 OR e.department_id IN (SELECT id FROM departments WHERE head_employee_id = $1))
         ORDER BY ec.created_at ASC`,
        [req.staff.employee_id]
      );
      results.pendingManagerDecision = rows;
    }

    res.json(results);
  } catch (err) {
    console.error('[expense-claims:pending]', err);
    res.status(500).json({ error: 'Failed to fetch pending expense claims' });
  }
});

// ── manager/department-head decision ────────────────────────────────────────
router.post('/:id/manager-decision', async (req, res) => {
  try {
    const { decision, rejection_reason } = req.body; // 'approved' | 'rejected'
    if (!['approved', 'rejected'].includes(decision)) return res.status(400).json({ error: "decision must be 'approved' or 'rejected'" });

    const { rows: [claim] } = await safeQuery(`SELECT * FROM expense_claims WHERE id = $1`, [req.params.id]);
    if (!claim) return res.status(404).json({ error: 'Expense claim not found' });
    if (claim.status !== 'pending_manager') return res.status(400).json({ error: `This claim is already ${claim.status}` });

    const { rows: [emp] } = await safeQuery(`SELECT manager_id, department_id, full_name FROM employees WHERE id = $1`, [claim.employee_id]);
    const isBroad = ['owner', 'admin'].includes(req.staff.role);
    let isAuthorized = isBroad || req.staff.employee_id === emp?.manager_id;
    if (!isAuthorized && emp?.department_id) {
      const { rows: [dept] } = await safeQuery(`SELECT head_employee_id FROM departments WHERE id = $1`, [emp.department_id]);
      isAuthorized = dept?.head_employee_id === req.staff.employee_id;
    }
    if (!isAuthorized) return res.status(403).json({ error: "Only this employee's manager, their department head, or an Admin/Founder can decide on this claim" });

    const newStatus = decision === 'approved' ? 'pending_finance' : 'rejected';
    const { rows: [updated] } = await safeQuery(
      `UPDATE expense_claims SET status = $1, manager_decision_by = $2, manager_decision_at = NOW(), rejection_reason = $3 WHERE id = $4 RETURNING *`,
      [newStatus, req.staff.id, decision === 'rejected' ? (rejection_reason || null) : null, req.params.id]
    );

    const employeeStaffId = await staffIdForEmployee(claim.employee_id);
    if (employeeStaffId) {
      await notifyStaff({
        staffId: employeeStaffId,
        type: decision === 'approved' ? 'expense_claim.manager_approved' : 'expense_claim.rejected',
        title: decision === 'approved'
          ? `Your expense claim was approved — now with Finance for reimbursement`
          : `Your expense claim was rejected${rejection_reason ? `: ${rejection_reason}` : ''}`,
        link: '/me',
      });
    }

    res.json({ claim: updated });
  } catch (err) {
    console.error('[expense-claims:manager-decision]', err);
    res.status(500).json({ error: 'Failed to record decision' });
  }
});

// ── finance reimburses — pays out and posts the ledger entry ───────────────
router.post('/:id/reimburse', requireRole('finance'), async (req, res) => {
  try {
    const { bank_account_id } = req.body;
    if (!bank_account_id) return res.status(400).json({ error: 'bank_account_id is required' });

    const { rows: [claim] } = await safeQuery(`SELECT * FROM expense_claims WHERE id = $1`, [req.params.id]);
    if (!claim) return res.status(404).json({ error: 'Expense claim not found' });
    if (claim.status !== 'pending_finance') return res.status(400).json({ error: `This claim is "${claim.status}" — it must clear manager sign-off first` });

    let expenseAccountId = null;
    if (claim.category_id) {
      const { rows: [cat] } = await safeQuery(`SELECT expense_account_id FROM expense_categories WHERE id = $1`, [claim.category_id]);
      expenseAccountId = cat?.expense_account_id;
    }
    if (!expenseAccountId) {
      const { rows: [fallback] } = await safeQuery(`SELECT id FROM chart_of_accounts WHERE code = '5100'`); // Salary/staff expense as generic fallback
      expenseAccountId = fallback?.id;
    }
    if (!expenseAccountId) return res.status(400).json({ error: 'No expense account configured for this claim\'s category, and no fallback account found' });

    const { rows: [bank] } = await safeQuery(`SELECT ledger_account_id FROM bank_accounts WHERE id = $1`, [bank_account_id]);
    if (!bank) return res.status(404).json({ error: 'Bank account not found' });

    const { rows: [emp] } = await safeQuery(`SELECT full_name FROM employees WHERE id = $1`, [claim.employee_id]);

    const je = await ledger.postJournalEntry({
      entryDate: new Date().toISOString().slice(0, 10),
      source: 'expense_claim', sourceType: 'expense_claim', sourceId: claim.id,
      narration: `Reimbursement: ${claim.description} (${emp?.full_name})`, createdBy: req.staff.id,
      lines: [
        { accountId: expenseAccountId, debit: claim.amount, description: claim.description },
        { accountId: bank.ledger_account_id, credit: claim.amount, description: `Reimbursed to ${emp?.full_name}` },
      ],
    });

    const { rows: [updated] } = await safeQuery(
      `UPDATE expense_claims SET status = 'reimbursed', finance_decision_by = $1, bank_account_id = $2, journal_entry_id = $3, reimbursed_at = NOW() WHERE id = $4 RETURNING *`,
      [req.staff.id, bank_account_id, je.id, req.params.id]
    );

    const employeeStaffId = await staffIdForEmployee(claim.employee_id);
    if (employeeStaffId) {
      await notifyStaff({
        staffId: employeeStaffId, type: 'expense_claim.reimbursed',
        title: `Reimbursed: ₹${Number(claim.amount).toLocaleString('en-IN')} for "${claim.description}"`,
        link: '/me',
      });
    }

    res.json({ claim: updated, journalEntry: je });
  } catch (err) {
    console.error('[expense-claims:reimburse]', err);
    res.status(500).json({ error: 'Failed to process reimbursement' });
  }
});

router.post('/:id/reject-finance', requireRole('finance'), async (req, res) => {
  try {
    const { reason } = req.body;
    const { rows: [claim] } = await safeQuery(`SELECT * FROM expense_claims WHERE id = $1`, [req.params.id]);
    if (!claim) return res.status(404).json({ error: 'Expense claim not found' });
    if (claim.status !== 'pending_finance') return res.status(400).json({ error: `This claim is already ${claim.status}` });

    const { rows: [updated] } = await safeQuery(
      `UPDATE expense_claims SET status = 'rejected', finance_decision_by = $1, rejection_reason = $2 WHERE id = $3 RETURNING *`,
      [req.staff.id, reason || null, req.params.id]
    );

    const employeeStaffId = await staffIdForEmployee(claim.employee_id);
    if (employeeStaffId) {
      await notifyStaff({
        staffId: employeeStaffId, type: 'expense_claim.rejected',
        title: `Finance rejected your expense claim${reason ? `: ${reason}` : ''}`, link: '/me',
      });
    }

    res.json({ claim: updated });
  } catch (err) {
    console.error('[expense-claims:reject-finance]', err);
    res.status(500).json({ error: 'Failed to reject claim' });
  }
});

module.exports = router;