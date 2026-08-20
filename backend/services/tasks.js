'use strict';
// services/tasks.js
//
// Task management service for internal operations
// Used by referral tracking, invoice anomaly detection, etc.

const { safeQuery: query } = require('../db/pool');

// ──────────────────────────────────────────────────────────────────────────
// Create Task
// ──────────────────────────────────────────────────────────────────────────
async function createTask(data) {
  const {
    title, description, dueDate, assignedTo,
    relatedEntity, relatedEntityId,
    priority = 'medium', tags = [],
    createdBy,
  } = data;

  const { rows: [task] } = await query(
    `INSERT INTO tasks
       (title, description, due_date, assigned_to, related_entity, related_entity_id,
        priority, tags, status, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending',$9)
     RETURNING *`,
    [
      title, description, dueDate, assignedTo,
      relatedEntity, relatedEntityId,
      priority, tags, createdBy,
    ]
  );

  return task;
}

// ──────────────────────────────────────────────────────────────────────────
// Update Task
// ──────────────────────────────────────────────────────────────────────────
async function updateTask(taskId, data, updatedBy) {
  const allowedFields = ['title', 'description', 'due_date', 'assigned_to', 'status', 'priority', 'tags', 'completed_at'];
  const updates = [];
  const params = [taskId];
  let paramIdx = 2;

  for (const [key, value] of Object.entries(data)) {
    if (allowedFields.includes(key)) {
      params.push(typeof value === 'object' ? JSON.stringify(value) : value);
      updates.push(`${key} = $${paramIdx++}`);
    }
  }

  if (updates.length === 0) throw new Error('No valid fields to update');

  params.push(updatedBy);
  updates.push(`updated_by = $${paramIdx++}`);
  updates.push(`updated_at = NOW()`);

  const { rows: [task] } = await query(
    `UPDATE tasks SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
    params
  );

  return task;
}

// ──────────────────────────────────────────────────────────────────────────
// Get Tasks with Filters
// ──────────────────────────────────────────────────────────────────────────
async function getTasks(filters = {}) {
  let sql = `
    SELECT t.*, u.full_name as assigned_to_name, u.email as assigned_to_email
    FROM tasks t
    LEFT JOIN staff_accounts u ON u.id = t.assigned_to
    WHERE 1=1
  `;
  const params = [];
  let paramIdx = 1;

  if (filters.assignedTo) { params.push(filters.assignedTo); sql += ` AND t.assigned_to = $${paramIdx++}`; }
  if (filters.status) { params.push(filters.status); sql += ` AND t.status = $${paramIdx++}`; }
  if (filters.priority) { params.push(filters.priority); sql += ` AND t.priority = $${paramIdx++}`; }
  if (filters.relatedEntity) { params.push(filters.relatedEntity); sql += ` AND t.related_entity = $${paramIdx++}`; }
  if (filters.relatedEntityId) { params.push(filters.relatedEntityId); sql += ` AND t.related_entity_id = $${paramIdx++}`; }
  if (filters.fromDate) { params.push(filters.fromDate); sql += ` AND t.created_at >= $${paramIdx++}`; }
  if (filters.toDate) { params.push(filters.toDate); sql += ` AND t.created_at <= $${paramIdx++}`; }

  sql += ` ORDER BY t.created_at DESC LIMIT 200`;

  const { rows } = await query(sql, params);
  return rows;
}

// ──────────────────────────────────────────────────────────────────────────
// Get Single Task
// ──────────────────────────────────────────────────────────────────────────
async function getTaskById(taskId) {
  const { rows: [task] } = await query(
    `SELECT t.*, u.full_name as assigned_to_name
     FROM tasks t
     LEFT JOIN staff_accounts u ON u.id = t.assigned_to
     WHERE t.id = $1`,
    [taskId]
  );
  return task;
}

// ──────────────────────────────────────────────────────────────────────────
// Complete Task
// ──────────────────────────────────────────────────────────────────────────
async function completeTask(taskId, completedBy) {
  const { rows: [task] } = await query(
    `UPDATE tasks SET status = 'completed', completed_at = NOW(), updated_by = $1, updated_at = NOW()
     WHERE id = $2 AND status != 'completed' RETURNING *`,
    [completedBy, taskId]
  );
  return task;
}

// ──────────────────────────────────────────────────────────────────────────
// Delete Task (soft delete)
// ──────────────────────────────────────────────────────────────────────────
async function deleteTask(taskId, deletedBy) {
  const { rows: [task] } = await query(
    `UPDATE tasks SET status = 'cancelled', updated_by = $1, updated_at = NOW()
     WHERE id = $2 RETURNING *`,
    [deletedBy, taskId]
  );
  return task;
}

module.exports = {
  createTask,
  updateTask,
  getTasks,
  getTaskById,
  completeTask,
  deleteTask,
};