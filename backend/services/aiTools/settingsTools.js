'use strict';

const { safeQuery } = require('../../db/pool');
const { logAction } = require('../auditLog');

const settingsTools = [
  {
    name: 'get_compliance_settings',
    description: 'Get all compliance settings',
    category: 'settings',
    readOnly: true,
    requiresConfirmation: false,
    allowedRoles: ['finance'],
    allowedDepartments: [],
    parameters: {},
    execute: async (params, user) => {
      const { rows } = await safeQuery(
        `SELECT cs.*, sa.email AS verified_by_email FROM compliance_settings cs LEFT JOIN staff_accounts sa ON sa.id = cs.verified_by ORDER BY cs.key`
      );
      return { settings: rows };
    },
  },

  {
    name: 'get_pt_slabs',
    description: 'Get Professional Tax slabs',
    category: 'settings',
    readOnly: true,
    requiresConfirmation: false,
    allowedRoles: ['finance'],
    allowedDepartments: [],
    parameters: {
      state: { type: 'string', required: false },
    },
    execute: async (params, user) => {
      const queryParams = [];
      let where = '';
      if (params.state) { queryParams.push(params.state); where = `WHERE state = $1`; }
      const { rows } = await safeQuery(`SELECT * FROM pt_slabs ${where} ORDER BY state, gross_from`, queryParams);
      return { slabs: rows };
    },
  },

  {
    name: 'get_tax_slabs',
    description: 'Get income tax slabs',
    category: 'settings',
    readOnly: true,
    requiresConfirmation: false,
    allowedRoles: ['finance'],
    allowedDepartments: [],
    parameters: {
      regime: { type: 'string', required: false, enum: ['old', 'new'] },
      fiscal_year: { type: 'string', required: false },
    },
    execute: async (params, user) => {
      const conditions = [];
      const queryParams = [];
      if (params.regime) { queryParams.push(params.regime); conditions.push(`regime = $${queryParams.length}`); }
      if (params.fiscal_year) { queryParams.push(params.fiscal_year); conditions.push(`fiscal_year = $${queryParams.length}`); }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const { rows } = await safeQuery(`SELECT * FROM tax_slabs ${where} ORDER BY fiscal_year DESC, regime, income_from`, queryParams);
      return { slabs: rows };
    },
  },

  {
    name: 'get_company_profile',
    description: 'Get company profile (letterhead settings)',
    category: 'settings',
    readOnly: true,
    requiresConfirmation: false,
    allowedRoles: ['*'],
    allowedDepartments: [],
    parameters: {},
    execute: async (params, user) => {
      const { rows: [profile] } = await safeQuery(`SELECT * FROM company_profile ORDER BY updated_at DESC LIMIT 1`);
      return { profile: profile || null };
    },
  },
];

module.exports = settingsTools;