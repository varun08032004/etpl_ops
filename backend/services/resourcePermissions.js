'use strict';
// services/resourcePermissions.js
//
// Resource-level permission checks for fine-grained access control.
// Built on top of the existing department-granted role system.
//
// Usage:
//   const { canAccessEmployee, canAccessPayrollRun, canAccessInvoice } = require('./resourcePermissions');
//   
//   if (!await canAccessEmployee(req.staff, employeeId, 'edit_compensation')) {
//     return res.status(403).json({ error: 'Insufficient permissions' });
//   }

const { safeQuery } = require('../db/pool');

/**
 * Check if a staff member can access a specific employee's data
 * @param {Object} staff - The authenticated staff member (from req.staff)
 * @param {string} targetEmployeeId - UUID of the employee being accessed
 * @param {string} action - 'view' | 'edit' | 'edit_compensation' | 'exit' | 'delete'
 * @returns {Promise<boolean>}
 */
async function canAccessEmployee(staff, targetEmployeeId, action = 'view') {
  // Owner and admin can do everything
  if (['owner', 'admin'].includes(staff.role)) return true;
  
  // Self-access: employees can always view their own data
  if (staff.employee_id === targetEmployeeId) {
    if (action === 'view') return true;
    if (action === 'edit' && ['manager', 'employee'].includes(staff.role)) return true;
    return false;
  }
  
  // Get target employee's department and manager
  const { rows: [targetEmp] } = await safeQuery(
    `SELECT department_id, manager_id FROM employees WHERE id = $1`,
    [targetEmployeeId]
  );
  
  if (!targetEmp) return false;
  
  // HR and Finance (via department grants) can view all
  const hasHR = staff.effectiveRoles?.includes('hr') || staff.role === 'hr';
  const hasFinance = staff.effectiveRoles?.includes('finance') || staff.role === 'finance';
  
  if (action === 'view' && (hasHR || hasFinance)) return true;
  
  // Department head can access their department's employees
  if (targetEmp.department_id) {
    const { rows: [dept] } = await safeQuery(
      `SELECT head_employee_id FROM departments WHERE id = $1`,
      [targetEmp.department_id]
    );
    
    if (dept?.head_employee_id === staff.employee_id) {
      if (action === 'view' || action === 'edit') return true;
      if (action === 'edit_compensation' && hasFinance) return true;
      if (action === 'exit' && hasHR) return true;
      return false;
    }
  }
  
  // Direct manager can view/edit their reports
  if (targetEmp.manager_id === staff.employee_id) {
    if (action === 'view' || action === 'edit') return true;
    return false;
  }
  
  // Team head can view their team members
  if (targetEmp.department_id) {
    const { rows: [empTeam] } = await safeQuery(
      `SELECT team_id FROM employees WHERE id = $1`,
      [targetEmployeeId]
    );
    
    if (empTeam?.team_id) {
      const { rows: [team] } = await safeQuery(
        `SELECT team_head_id FROM teams WHERE id = $1`,
        [empTeam.team_id]
      );
      
      if (team?.team_head_id === staff.employee_id) {
        if (action === 'view' || action === 'edit') return true;
        return false;
      }
    }
  }
  
  return false;
}

/**
 * Check if a staff member can access a specific payroll run
 * @param {Object} staff - The authenticated staff member
 * @param {string} payrollRunId - UUID of the payroll run
 * @param {string} action - 'view' | 'edit' | 'disburse'
 * @returns {Promise<boolean>}
 */
async function canAccessPayrollRun(staff, payrollRunId, action = 'view') {
  if (['owner', 'admin'].includes(staff.role)) return true;
  
  const hasFinance = staff.effectiveRoles?.includes('finance') || staff.role === 'finance';
  const hasHR = staff.effectiveRoles?.includes('hr') || staff.role === 'hr';
  
  if (!hasFinance && !hasHR) return false;
  
  if (action === 'disburse' && !hasFinance) return false;
  
  return true;
}

/**
 * Check if a staff member can access a specific invoice
 * @param {Object} staff - The authenticated staff member
 * @param {string} invoiceId - UUID of the invoice
 * @param {string} action - 'view' | 'edit' | 'payment' | 'void'
 * @returns {Promise<boolean>}
 */
async function canAccessInvoice(staff, invoiceId, action = 'view') {
  if (['owner', 'admin'].includes(staff.role)) return true;
  
  const hasFinance = staff.effectiveRoles?.includes('finance') || staff.role === 'finance';
  
  if (!hasFinance) return false;
  
  if (action === 'void' && staff.role !== 'owner') return false;
  
  return true;
}

/**
 * Check if a staff member can access a specific bill (AP)
 * @param {Object} staff - The authenticated staff member
 * @param {string} billId - UUID of the bill
 * @param {string} action - 'view' | 'edit' | 'payment' | 'void'
 * @returns {Promise<boolean>}
 */
async function canAccessBill(staff, billId, action = 'view') {
  if (['owner', 'admin'].includes(staff.role)) return true;
  
  const hasFinance = staff.effectiveRoles?.includes('finance') || staff.role === 'finance';
  
  if (!hasFinance) return false;
  
  if (action === 'void' && staff.role !== 'owner') return false;
  
  return true;
}

/**
 * Check if a staff member can access a specific department
 * @param {Object} staff - The authenticated staff member
 * @param {string} departmentId - UUID of the department
 * @param {string} action - 'view' | 'edit' | 'delete'
 * @returns {Promise<boolean>}
 */
async function canAccessDepartment(staff, departmentId, action = 'view') {
  if (['owner', 'admin'].includes(staff.role)) return true;
  
  // Department head can view/edit their department
  const { rows: [dept] } = await safeQuery(
    `SELECT head_employee_id FROM departments WHERE id = $1`,
    [departmentId]
  );
  
  if (dept?.head_employee_id === staff.employee_id) {
    if (action === 'view' || action === 'edit') return true;
    return false;
  }
  
  // HR can view all departments
  const hasHR = staff.effectiveRoles?.includes('hr') || staff.role === 'hr';
  if (hasHR && action === 'view') return true;
  
  return false;
}

/**
 * Check if a staff member can access a specific team
 * @param {Object} staff - The authenticated staff member
 * @param {string} teamId - UUID of the team
 * @param {string} action - 'view' | 'edit' | 'delete'
 * @returns {Promise<boolean>}
 */
async function canAccessTeam(staff, teamId, action = 'view') {
  if (['owner', 'admin'].includes(staff.role)) return true;
  
  // Team head can view/edit their team
  const { rows: [team] } = await safeQuery(
    `SELECT team_head_id, department_id FROM teams WHERE id = $1`,
    [teamId]
  );
  
  if (team?.team_head_id === staff.employee_id) {
    if (action === 'view' || action === 'edit') return true;
    return false;
  }
  
  // Department head can view teams in their department
  if (team?.department_id) {
    const { rows: [dept] } = await safeQuery(
      `SELECT head_employee_id FROM departments WHERE id = $1`,
      [team.department_id]
    );
    
    if (dept?.head_employee_id === staff.employee_id) {
      if (action === 'view') return true;
      return false;
    }
  }
  
  // HR can view all teams
  const hasHR = staff.effectiveRoles?.includes('hr') || staff.role === 'hr';
  if (hasHR && action === 'view') return true;
  
  return false;
}

/**
 * Middleware factory for resource-level permissions
 * Usage: router.put('/:id', requireResourcePermission('employee', 'edit_compensation'), handler);
 * 
 * @param {string} resourceType - 'employee' | 'payrollRun' | 'invoice' | 'bill' | 'department' | 'team'
 * @param {string} action - Action to check
 * @returns {Function} Express middleware
 */
function requireResourcePermission(resourceType, action) {
  const checkers = {
    employee: canAccessEmployee,
    payrollRun: canAccessPayrollRun,
    invoice: canAccessInvoice,
    bill: canAccessBill,
    department: canAccessDepartment,
    team: canAccessTeam,
  };
  
  const checker = checkers[resourceType];
  if (!checker) {
    throw new Error(`Unknown resource type: ${resourceType}`);
  }
  
  return async (req, res, next) => {
    const resourceId = req.params.id;
    
    try {
      const allowed = await checker(req.staff, resourceId, action);
      
      if (!allowed) {
        return res.status(403).json({ 
          error: `Insufficient permissions to ${action} this ${resourceType}`,
          code: 'RESOURCE_PERMISSION_DENIED',
          resourceType,
          resourceId,
          action,
        });
      }
      
      next();
    } catch (err) {
      console.error('[resourcePermissions] check failed:', err.message);
      res.status(500).json({ error: 'Permission check failed' });
    }
  };
}

module.exports = {
  canAccessEmployee,
  canAccessPayrollRun,
  canAccessInvoice,
  canAccessBill,
  canAccessDepartment,
  canAccessTeam,
  requireResourcePermission,
};