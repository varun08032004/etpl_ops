'use strict';

require('dotenv').config();
const { Pool } = require('pg');
const { safeQuery, withTransaction } = require('../db/pool');
const { validateBody, schemas } = require('../middleware/validation');
const { z } = require('zod');

// Employee update validation schema (all fields optional)
const createEmployeeSchema = z.object({
  full_name: z.string().min(1, 'Full name is required').max(255),
  personal_email: schemas.email,
  work_email: schemas.email,
  phone: schemas.phone,
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional().nullable(),
  date_of_birth: schemas.isoDate.optional().nullable(),
  address_line: schemas.nullableString(500),
  city: schemas.nullableString(100),
  state: schemas.nullableString(100),
  pincode: z.union([z.string().regex(/^\d{6}$/, 'Invalid pincode'), z.literal(''), z.null()]).transform((val) => (val === '' ? null : val)).optional().nullable(),
  pan_number: schemas.pan,
  department_id: schemas.uuid.optional().nullable(),
  team_id: schemas.uuid.optional().nullable(),
  designation_id: schemas.uuid.optional().nullable(),
  manager_id: schemas.uuid.optional().nullable(),
  employment_type: z.enum(['full_time', 'part_time', 'contract', 'intern']).optional(),
  date_of_joining: schemas.isoDate,
  ctc_annual: schemas.money.optional().nullable(),
  basic_monthly: schemas.money.optional().nullable(),
  hra_monthly: schemas.money.optional().nullable(),
  other_allowances_monthly: schemas.money.optional().nullable(),
  employer_pf_monthly: schemas.money.optional().default(0),
  da_monthly: schemas.money.optional().default(0),
  tax_regime: z.enum(['old', 'new']).optional().default('new'),
  pf_applicable: schemas.boolean.optional().default(true),
  bank_account_number: schemas.nullableString(50),
  bank_ifsc: schemas.ifsc,
});

const updateEmployeeSchema = createEmployeeSchema.partial().extend({
  status: z.enum(['active', 'on_leave', 'notice_period', 'exited']).optional(),
  declared_deductions: z.object({
    section_80c: schemas.money.optional(),
    section_80d: schemas.money.optional(),
    hra_exemption_annual: schemas.money.optional(),
  }).optional(),
  notes: z.string().max(2000).optional().nullable(),
  esic_applicable: schemas.boolean.optional(),
}).strict();

async function testValidation() {
  const testData = {
    full_name: 'Archana',
    personal_email: '',
    work_email: 'archana@ethertrack.in',
    phone: '',
    city: '',
    state: 'Maharashtra',
    pan_number: '',
    employment_type: 'full_time',
    department_id: '',
    team_id: '',
    designation_id: '',
    manager_id: '',
    bank_account_number: '',
    bank_ifsc: '',
    ctc_annual: '',
    basic_monthly: '',
    da_monthly: '',
    hra_monthly: '',
    other_allowances_monthly: '',
    tax_regime: 'new',
    pf_applicable: true,
  };

  console.log('Testing validation with empty strings...');
  const result = updateEmployeeSchema.safeParse(testData);
  
  if (!result.success) {
    console.log('❌ Validation FAILED:');
    console.log('Error object:', result.error);
    console.log('Error errors:', result.error.errors);
    console.log('Error message:', result.error.message);
    console.log('Error issues:', result.error.issues);
  } else {
    console.log('✅ Validation PASSED');
    console.log('Parsed data:', JSON.stringify(result.data, null, 2));
  }
}

testValidation();