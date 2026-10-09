'use strict';

const express = require('express');
const router = express.Router();
const { safeQuery } = require('../db/pool');
const { authenticate, requireRole } = require('../middleware/auth');
const { validateBody, schemas } = require('../middleware/validation');
const { z } = require('zod');

router.use(authenticate);
router.use(requireRole('admin', 'owner'));

// ============================================================================
// COMPANY SETTINGS
// ============================================================================

router.get('/company', async (req, res) => {
    try {
        const { rows } = await safeQuery(
            `SELECT key, value, description, category, is_system, updated_at, updated_by
             FROM company_settings ORDER BY category, key`
        );
        res.json({ settings: rows });
    } catch (err) {
        console.error('[admin:settings:list]', err);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

const updateSettingSchema = z.object({
    value: z.any(),
    description: z.string().optional().nullable(),
});

router.put('/company/:key', validateBody(updateSettingSchema), async (req, res) => {
    try {
        const { value, description } = req.body;
        const { rows } = await safeQuery(
            `UPDATE company_settings 
             SET value = $1, description = COALESCE($2, description), updated_by = $3, updated_at = NOW()
             WHERE key = $4 RETURNING *`,
            [value, description || null, req.staff.id, req.params.key]
        );
        if (!rows.length) return res.status(404).json({ error: 'Setting not found' });
        res.json({ setting: rows[0] });
    } catch (err) {
        console.error('[admin:settings:update]', err);
        res.status(500).json({ error: 'Failed to update setting' });
    }
});

// ============================================================================
// LEAVE TYPES
// ============================================================================

router.get('/leave-types', async (req, res) => {
    try {
        const { rows } = await safeQuery(`SELECT * FROM leave_types ORDER BY name`);
        res.json({ leaveTypes: rows });
    } catch (err) {
        console.error('[admin:leave-types:list]', err);
        res.status(500).json({ error: 'Failed to fetch leave types' });
    }
});

const createLeaveTypeSchema = z.object({
    name: z.string().min(1).max(100),
    days_per_year: z.number().min(0).default(0),
    is_paid: z.boolean().default(true),
});

router.post('/leave-types', validateBody(createLeaveTypeSchema), async (req, res) => {
    try {
        const { name, days_per_year, is_paid } = req.body;
        const { rows } = await safeQuery(
            `INSERT INTO leave_types (name, days_per_year, is_paid) VALUES ($1,$2,$3) RETURNING *`,
            [name, days_per_year || 0, is_paid ?? true]
        );
        res.status(201).json({ leaveType: rows[0] });
    } catch (err) {
        console.error('[admin:leave-types:create]', err);
        if (err.code === '23505') return res.status(409).json({ error: 'Leave type already exists' });
        res.status(500).json({ error: 'Failed to create leave type' });
    }
});

const updateLeaveTypeSchema = createLeaveTypeSchema.partial();

router.put('/leave-types/:id', validateBody(updateLeaveTypeSchema), async (req, res) => {
    try {
        const sets = []; const params = []; let i = 1;
        for (const [key, value] of Object.entries(req.body)) {
            if (value === undefined) continue;
            params.push(value);
            sets.push(`${key} = $${i++}`);
        }
        if (!sets.length) return res.status(400).json({ error: 'No valid fields to update' });
        params.push(req.params.id);
        const { rows } = await safeQuery(
            `UPDATE leave_types SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
            params
        );
        if (!rows.length) return res.status(404).json({ error: 'Leave type not found' });
        res.json({ leaveType: rows[0] });
    } catch (err) {
        console.error('[admin:leave-types:update]', err);
        res.status(500).json({ error: 'Failed to update leave type' });
    }
});

router.delete('/leave-types/:id', async (req, res) => {
    try {
        const { rows } = await safeQuery(`DELETE FROM leave_types WHERE id = $1 RETURNING id`, [req.params.id]);
        if (!rows.length) return res.status(404).json({ error: 'Leave type not found' });
        res.json({ deleted: true });
    } catch (err) {
        console.error('[admin:leave-types:delete]', err);
        res.status(500).json({ error: 'Failed to delete leave type' });
    }
});

// ============================================================================
// ATTENDANCE POLICIES
// ============================================================================

router.get('/attendance-policies', async (req, res) => {
    try {
        const { rows } = await safeQuery(`SELECT * FROM attendance_policies ORDER BY name`);
        res.json({ policies: rows });
    } catch (err) {
        console.error('[admin:attendance-policies:list]', err);
        res.status(500).json({ error: 'Failed to fetch attendance policies' });
    }
});

const updateAttendancePolicySchema = z.object({
    working_days: z.array(z.number().min(0).max(6)).optional(),
    work_start_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
    work_end_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
    daily_hours: z.number().min(0).max(24).optional(),
    late_threshold_minutes: z.number().min(0).optional(),
    early_departure_threshold_minutes: z.number().min(0).optional(),
    break_duration_minutes: z.number().min(0).optional(),
    grace_period_minutes: z.number().min(0).optional(),
    is_active: z.boolean().optional(),
});

router.put('/attendance-policies/:name', validateBody(updateAttendancePolicySchema), async (req, res) => {
    try {
        const sets = []; const params = []; let i = 1;
        const fieldMap = {
            working_days: 'working_days',
            work_start_time: 'work_start_time',
            work_end_time: 'work_end_time',
            daily_hours: 'daily_hours',
            late_threshold_minutes: 'late_threshold',
            early_departure_threshold_minutes: 'early_departure_threshold',
            break_duration_minutes: 'break_duration',
            grace_period_minutes: 'grace_period',
            is_active: 'is_active',
        };
        
        for (const [key, value] of Object.entries(req.body)) {
            if (value === undefined) continue;
            const dbField = fieldMap[key];
            if (!dbField) continue;
            params.push(value);
            sets.push(`${dbField} = $${i++}`);
        }
        
        if (!sets.length) return res.status(400).json({ error: 'No valid fields to update' });
        
        params.push(req.params.name);
        const { rows } = await safeQuery(
            `UPDATE attendance_policies SET ${sets.join(', ')}, updated_at = NOW() WHERE name = $${i} RETURNING *`,
            params
        );
        if (!rows.length) return res.status(404).json({ error: 'Policy not found' });
        res.json({ policy: rows[0] });
    } catch (err) {
        console.error('[admin:attendance-policies:update]', err);
        res.status(500).json({ error: 'Failed to update attendance policy' });
    }
});

// ============================================================================
// LEAVE POLICIES
// ============================================================================

router.get('/leave-policies', async (req, res) => {
    try {
        const { rows } = await safeQuery(
            `SELECT lp.*, lt.name as leave_type_name
             FROM leave_policies lp
             JOIN leave_types lt ON lt.id = lp.leave_type_id
             ORDER BY lt.name`
        );
        res.json({ policies: rows });
    } catch (err) {
        console.error('[admin:leave-policies:list]', err);
        res.status(500).json({ error: 'Failed to fetch leave policies' });
    }
});

const updateLeavePolicySchema = z.object({
    accrual_per_month: z.number().min(0).optional(),
    max_accrual: z.number().min(0).optional().nullable(),
    carry_forward_limit: z.number().min(0).optional().nullable(),
    min_balance_to_apply: z.number().min(0).optional(),
    requires_approval: z.boolean().optional(),
    approval_levels: z.array(z.object({ role: z.string(), level: z.number() })).optional(),
    is_active: z.boolean().optional(),
});

router.put('/leave-policies/:leaveTypeId', validateBody(updateLeavePolicySchema), async (req, res) => {
    try {
        const sets = []; const params = []; let i = 1;
        for (const [key, value] of Object.entries(req.body)) {
            if (value === undefined) continue;
            params.push(value);
            sets.push(`${key} = $${i++}`);
        }
        if (!sets.length) return res.status(400).json({ error: 'No valid fields to update' });
        
        params.push(req.params.leaveTypeId);
        const { rows } = await safeQuery(
            `UPDATE leave_policies SET ${sets.join(', ')}, updated_at = NOW() WHERE leave_type_id = $${i} RETURNING *`,
            params
        );
        if (!rows.length) return res.status(404).json({ error: 'Leave policy not found' });
        res.json({ policy: rows[0] });
    } catch (err) {
        console.error('[admin:leave-policies:update]', err);
        res.status(500).json({ error: 'Failed to update leave policy' });
    }
});

// ============================================================================
// APPROVAL WORKFLOWS
// ============================================================================

router.get('/approval-workflows', async (req, res) => {
    try {
        const { rows } = await safeQuery(`SELECT * FROM approval_workflows ORDER BY workflow_type`);
        res.json({ workflows: rows });
    } catch (err) {
        console.error('[admin:approval-workflows:list]', err);
        res.status(500).json({ error: 'Failed to fetch approval workflows' });
    }
});

const updateWorkflowSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().optional().nullable(),
    levels: z.array(z.object({ role: z.string(), level: z.number(), conditions: z.record(z.any()).optional() })).optional(),
    is_active: z.boolean().optional(),
});

router.put('/approval-workflows/:type', validateBody(updateWorkflowSchema), async (req, res) => {
    try {
        const sets = []; const params = []; let i = 1;
        for (const [key, value] of Object.entries(req.body)) {
            if (value === undefined) continue;
            params.push(key === 'levels' ? JSON.stringify(value) : value);
            sets.push(`${key} = $${i++}`);
        }
        if (!sets.length) return res.status(400).json({ error: 'No valid fields to update' });
        
        params.push(req.params.type);
        const { rows } = await safeQuery(
            `UPDATE approval_workflows SET ${sets.join(', ')}, updated_at = NOW() WHERE workflow_type = $${i} RETURNING *`,
            params
        );
        if (!rows.length) return res.status(404).json({ error: 'Workflow not found' });
        res.json({ workflow: rows[0] });
    } catch (err) {
        console.error('[admin:approval-workflows:update]', err);
        res.status(500).json({ error: 'Failed to update approval workflow' });
    }
});

module.exports = router;