'use strict';

const employeeTools = require('./employeeTools');
const financeTools = require('./financeTools');
const salesTools = require('./salesTools');
const hrTools = require('./hrTools');
const documentTools = require('./documentTools');
const settingsTools = require('./settingsTools');

const ALL_TOOLS = [
  ...employeeTools,
  ...financeTools,
  ...salesTools,
  ...hrTools,
  ...documentTools,
  ...settingsTools,
];

const TOOL_MAP = new Map();
for (const tool of ALL_TOOLS) {
  if (TOOL_MAP.has(tool.name)) {
    throw new Error(`Duplicate tool name: ${tool.name}`);
  }
  TOOL_MAP.set(tool.name, tool);
}

function getTool(name) {
  return TOOL_MAP.get(name);
}

function getAllTools() {
  return ALL_TOOLS;
}

function getToolsByCategory(category) {
  return ALL_TOOLS.filter(t => t.category === category);
}

function getToolsForAccessLevel(accessLevel) {
  if (accessLevel === 'AI_DISABLED') return [];
  if (accessLevel === 'AI_KNOWLEDGE') {
    return ALL_TOOLS.filter(t => t.readOnly && !t.requiresConfirmation && t.allowedRoles.includes('*'));
  }
  if (accessLevel === 'AI_AGENT') {
    return ALL_TOOLS;
  }
  return [];
}

function validateToolCall(toolName, user, parameters) {
  const tool = getTool(toolName);
  if (!tool) {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  // Check read-only access
  if (!tool.readOnly && user.aiAccessLevel === 'AI_KNOWLEDGE') {
    throw new Error(`Tool ${toolName} requires AI_AGENT access level`);
  }

  // Check role authorization
  const userRoles = [user.role, ...(user.effectiveRoles || [])];
  const hasRole = tool.allowedRoles.includes('*') || tool.allowedRoles.some(r => userRoles.includes(r));
  if (!hasRole) {
    throw new Error(`Insufficient permissions for tool: ${toolName}. Required roles: ${tool.allowedRoles.join(', ')}`);
  }

  // Check department access if specified
  if (tool.allowedDepartments && tool.allowedDepartments.length > 0) {
    const userDepts = user.deptAccess?.departmentCodes || [];
    const hasDept = tool.allowedDepartments.some(d => userDepts.includes(d));
    if (!hasDept && !['owner', 'admin'].includes(user.role)) {
      throw new Error(`Insufficient department access for tool: ${toolName}`);
    }
  }

  // Validate parameters against schema
  if (tool.parameters) {
    const errors = validateParameters(tool.parameters, parameters);
    if (errors.length > 0) {
      throw new Error(`Invalid parameters for ${toolName}: ${errors.join('; ')}`);
    }
  }

  return tool;
}

function validateParameters(schema, params) {
  const errors = [];
  for (const [key, spec] of Object.entries(schema)) {
    if (spec.required && (params[key] === undefined || params[key] === null || params[key] === '')) {
      errors.push(`Missing required parameter: ${key}`);
    }
    if (params[key] !== undefined && spec.type) {
      const valid = validateType(params[key], spec.type);
      if (!valid) {
        errors.push(`Parameter ${key} must be of type ${spec.type}`);
      }
    }
    if (params[key] !== undefined && spec.enum && !spec.enum.includes(params[key])) {
      errors.push(`Parameter ${key} must be one of: ${spec.enum.join(', ')}`);
    }
  }
  return errors;
}

function validateType(value, type) {
  switch (type) {
    case 'string': return typeof value === 'string';
    case 'number': return typeof value === 'number' && isFinite(value);
    case 'integer': return Number.isInteger(value);
    case 'boolean': return typeof value === 'boolean';
    case 'array': return Array.isArray(value);
    case 'object': return typeof value === 'object' && value !== null;
    default: return true;
  }
}

module.exports = {
  getTool,
  getAllTools,
  getToolsByCategory,
  getToolsForAccessLevel,
  validateToolCall,
  TOOL_MAP,
};