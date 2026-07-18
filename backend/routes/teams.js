'use strict';

const express = require('express');
const router = express.Router();
const { safeQuery } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const { logAction } = require('../services/auditLog');
const { registerApprovalAction, createApprovalRequest } = require('../services/approvals');
const { buildTeamChain } = require('../services/approvalChain');

router.use(authenticate);

// Same pattern as department.delete: owner deletes immediately, admin's
// delete goes through Founder approval.
async function deleteTeam(targetId) {
  const { rows } = await safeQuery(`DELETE FROM teams WHERE id = $1 RETURNING id, name`, [targetId]);
  return rows[0];
}
registerApprovalAction('team.delete', deleteTeam);

// ── list teams, with department + head name + employee count ──────────────
// Pass ?department_id=... to scope to one department (used by the
// employee-onboarding cascading picker).
router.get('/', async (req, res) => {
  try {
    const { department_id } = req.query;
    const params = [];
    let where = '';
    if (department_id) { params.push(department_id); where = `WHERE t.department_id = $1`; }

    const { rows } = await safeQuery(
      `SELECT t.id, t.name, t.department_id, t.team_head_id, d.name AS department_name,
              h.full_name AS head_name, h.work_email AS head_email,
              COUNT(e.id) AS employee_count
       FROM teams t
       LEFT JOIN departments d ON d.id = t.department_id
       LEFT JOIN employees h ON h.id = t.team_head_id
       LEFT JOIN employees e ON e.team_id = t.id AND e.status != 'exited'
       ${where}
       GROUP BY t.id, d.name, h.full_name, h.work_email
       ORDER BY d.name, t.name`,
      params
    );
    res.json({ teams: rows.map((r) => ({ ...r, employee_count: Number(r.employee_count) })) });
  } catch (err) {
    console.error('[teams:list]', err);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

// ── single team with members ────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { rows: [team] } = await safeQuery(
      `SELECT t.*, d.name AS department_name, h.full_name AS head_name
       FROM teams t LEFT JOIN departments d ON d.id = t.department_id
       LEFT JOIN employees h ON h.id = t.team_head_id
       WHERE t.id = $1`,
      [req.params.id]
    );
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const { rows: members } = await safeQuery(
      `SELECT e.id, e.full_name, e.work_email, e.status, des.title AS designation
       FROM employees e LEFT JOIN designations des ON des.id = e.designation_id
       WHERE e.team_id = $1 AND e.status != 'exited'
       ORDER BY e.full_name`,
      [req.params.id]
    );
    res.json({ team, members });
  } catch (err) {
    console.error('[teams:get]', err);
    res.status(500).json({ error: 'Failed to fetch team' });
  }
});

// ── create — immediate, additions don't need approval ───────────────────────
router.post('/', requireRole('hr'), async (req, res) => {
  try {
    const { name, department_id, team_head_id } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });
    if (!department_id) return res.status(400).json({ error: 'department_id is required' });

    const { rows: [team] } = await safeQuery(
      `INSERT INTO teams (name, department_id, team_head_id) VALUES ($1,$2,$3) RETURNING *`,
      [name.trim(), department_id, team_head_id || null]
    );

    await logAction({ staffId: req.staff.id, action: 'team.created', entity: 'teams', entityId: team.id, newValue: { name: team.name, department_id } });

    res.status(201).json({ team });
  } catch (err) {
    console.error('[teams:create]', err);
    if (err.code === '23505') return res.status(409).json({ error: 'A team with this name already exists in that department' });
    res.status(500).json({ error: 'Failed to create team' });
  }
});

// ── update (rename, change head, move department) — immediate, not destructive ──
router.put('/:id', requireRole('hr'), async (req, res) => {
  try {
    const allowed = ['name', 'department_id', 'team_head_id'];
    const sets = [];
    const params = [];
    for (const key of allowed) {
      if (key in req.body) {
        params.push(req.body[key] === '' ? null : req.body[key]);
        sets.push(`${key} = $${params.length}`);
      }
    }
    if (!sets.length) return res.status(400).json({ error: 'No valid fields to update' });

    params.push(req.params.id);
    const { rows } = await safeQuery(`UPDATE teams SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params);
    if (!rows.length) return res.status(404).json({ error: 'Team not found' });
    res.json({ team: rows[0] });
  } catch (err) {
    console.error('[teams:update]', err);
    if (err.code === '23505') return res.status(409).json({ error: 'A team with this name already exists in that department' });
    res.status(500).json({ error: 'Failed to update team' });
  }
});

// ── delete — destructive, routed through Founder approval for admins ───────
// Blocked outright if employees are still assigned — reassign them first,
// same guard pattern as department deletion.
router.delete('/:id', requireRole('hr'), async (req, res) => {
  try {
    const { rows: [team] } = await safeQuery(`SELECT id, name FROM teams WHERE id = $1`, [req.params.id]);
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const { rows: [{ count }] } = await safeQuery(
      `SELECT COUNT(*) FROM employees WHERE team_id = $1 AND status != 'exited'`,
      [req.params.id]
    );
    if (Number(count) > 0) {
      return res.status(400).json({ error: `${count} employee(s) are still on this team — reassign them first` });
    }

    if (req.staff.role === 'owner') {
      const deleted = await deleteTeam(req.params.id);
      await logAction({ staffId: req.staff.id, action: 'team.deleted', entity: 'teams', entityId: deleted.id, oldValue: { name: deleted.name } });
      return res.json({ team: deleted });
    }

    const chain = await buildTeamChain(team.id, req.staff.id);
    const request = await createApprovalRequest({
      actionType: 'team.delete',
      targetType: 'team',
      targetId: team.id,
      targetLabel: team.name,
      requestedBy: req.staff.id,
      reason: req.body.reason || null,
      chain,
    });

    res.status(202).json({
      pending: true,
      request,
      message: `Deletion of "${team.name}" requested — next approver: ${chain[0].label}.`,
    });
  } catch (err) {
    console.error('[teams:delete]', err);
    res.status(500).json({ error: 'Failed to process deletion' });
  }
});

module.exports = router;