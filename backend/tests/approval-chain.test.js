/**
 * Approval Chain Tests
 * Tests for the multi-stage approval chain resolution logic
 */

const { Pool } = require('pg');

// Mock pool using jest.mock with factory
jest.mock('../db/pool', () => {
  const mockQuery = jest.fn();
  return {
    safeQuery: mockQuery,
    __mockQuery: mockQuery
  };
});

const { safeQuery, __mockQuery: mockPoolQuery } = require('../db/pool');
const approvalChain = require('../services/approvalChain');

describe('Approval Chain - buildEmployeeActionChain', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('buildEmployeeActionChain - includes Team Head when employee has team and head exists', async () => {
    mockPoolQuery
      // First call: get employee department_id and team_id
      .mockResolvedValueOnce({ rows: [{ department_id: 'dept-1', team_id: 'team-1' }] })
      // Second call: get team_head_id
      .mockResolvedValueOnce({ rows: [{ team_head_id: 'emp-head-1' }] })
      // Third call: get department head
      .mockResolvedValueOnce({ rows: [{ head_employee_id: 'emp-dept-head-1' }] })
      // Fourth call: staffForEmployee for team head
      .mockResolvedValueOnce({ rows: [{ id: 'staff-team-head-1' }] })
      // Fifth call: staffForEmployee for dept head
      .mockResolvedValueOnce({ rows: [{ id: 'staff-dept-head-1' }] })
      // Sixth call: adminStage
      .mockResolvedValueOnce({ rows: [{ id: 'staff-admin-1' }] })
      // Seventh call: founderStage
      .mockResolvedValueOnce({ rows: [{ id: 'staff-founder-1' }] });

    const chain = await approvalChain.buildEmployeeActionChain('emp-1', 'requester-staff-1');
    
    expect(chain.length).toBe(4); // team_head, department_head, ceo, founder
    expect(chain[0].level).toBe('team_head');
    expect(chain[0].label).toBe('Team Head');
    expect(chain[0].staff_ids).toEqual(['staff-team-head-1']);
    expect(chain[1].level).toBe('department_head');
    expect(chain[1].label).toBe('Department Head');
    expect(chain[2].level).toBe('ceo');
    expect(chain[3].level).toBe('founder');
  });

  test('buildEmployeeActionChain - skips team head if no team', async () => {
    mockPoolQuery
      // First call: get employee (no team)
      .mockResolvedValueOnce({ rows: [{ department_id: 'dept-1', team_id: null }] })
      // Second call: get department head
      .mockResolvedValueOnce({ rows: [{ head_employee_id: 'emp-dept-head-1' }] })
      // Third call: staffForEmployee for dept head
      .mockResolvedValueOnce({ rows: [{ id: 'staff-dept-head-1' }] })
      // Fourth call: adminStage
      .mockResolvedValueOnce({ rows: [{ id: 'staff-admin-1' }] })
      // Fifth call: founderStage
      .mockResolvedValueOnce({ rows: [{ id: 'staff-founder-1' }] });

    const chain = await approvalChain.buildEmployeeActionChain('emp-1', 'requester-staff-1');
    
    expect(chain.length).toBe(3); // department_head, ceo, founder
    expect(chain[0].level).toBe('department_head');
  });

  test('buildEmployeeActionChain - skips team head if team head is the employee themselves', async () => {
    mockPoolQuery
      // First call: get employee with team
      .mockResolvedValueOnce({ rows: [{ department_id: 'dept-1', team_id: 'team-1' }] })
      // Second call: get team_head_id (same as employee)
      .mockResolvedValueOnce({ rows: [{ team_head_id: 'emp-1' }] })
      // Third call: get department head
      .mockResolvedValueOnce({ rows: [{ head_employee_id: 'emp-dept-head-1' }] })
      // Fourth call: staffForEmployee for dept head
      .mockResolvedValueOnce({ rows: [{ id: 'staff-dept-head-1' }] })
      // Fifth call: adminStage
      .mockResolvedValueOnce({ rows: [{ id: 'staff-admin-1' }] })
      // Sixth call: founderStage
      .mockResolvedValueOnce({ rows: [{ id: 'staff-founder-1' }] });

    const chain = await approvalChain.buildEmployeeActionChain('emp-1', 'requester-staff-1');
    
    expect(chain.length).toBe(3); // department_head, ceo, founder
    expect(chain[0].level).toBe('department_head');
  });

  test('buildEmployeeActionChain - skips stage if staff account not found', async () => {
    mockPoolQuery
      // First call: get employee
      .mockResolvedValueOnce({ rows: [{ department_id: 'dept-1', team_id: 'team-1' }] })
      // Second call: get team_head_id
      .mockResolvedValueOnce({ rows: [{ team_head_id: 'emp-head-1' }] })
      // Third call: get department head
      .mockResolvedValueOnce({ rows: [{ head_employee_id: 'emp-dept-head-1' }] })
      // Fourth call: staffForEmployee for team head - NOT FOUND
      .mockResolvedValueOnce({ rows: [] })
      // Fifth call: staffForEmployee for dept head
      .mockResolvedValueOnce({ rows: [{ id: 'staff-dept-head-1' }] })
      // Sixth call: adminStage
      .mockResolvedValueOnce({ rows: [{ id: 'staff-admin-1' }] })
      // Seventh call: founderStage
      .mockResolvedValueOnce({ rows: [{ id: 'staff-founder-1' }] });

    const chain = await approvalChain.buildEmployeeActionChain('emp-1', 'requester-staff-1');
    
    expect(chain.length).toBe(3); // department_head, ceo, founder (team_head skipped)
    expect(chain[0].level).toBe('department_head');
  });

  test('buildEmployeeActionChain - excludes requester from stages', async () => {
    mockPoolQuery
      // First call: get employee
      .mockResolvedValueOnce({ rows: [{ department_id: 'dept-1', team_id: 'team-1' }] })
      // Second call: get team_head_id
      .mockResolvedValueOnce({ rows: [{ team_head_id: 'emp-head-1' }] })
      // Third call: get department head
      .mockResolvedValueOnce({ rows: [{ head_employee_id: 'emp-dept-head-1' }] })
      // Fourth call: staffForEmployee for team head - IS THE REQUESTER
      .mockResolvedValueOnce({ rows: [{ id: 'requester-staff-1' }] })
      // Fifth call: staffForEmployee for dept head
      .mockResolvedValueOnce({ rows: [{ id: 'staff-dept-head-1' }] })
      // Sixth call: adminStage
      .mockResolvedValueOnce({ rows: [{ id: 'staff-admin-1' }] })
      // Seventh call: founderStage
      .mockResolvedValueOnce({ rows: [{ id: 'staff-founder-1' }] });

    const chain = await approvalChain.buildEmployeeActionChain('emp-1', 'requester-staff-1');
    
    expect(chain.length).toBe(3); // department_head, ceo, founder (team_head skipped because it's requester)
    expect(chain[0].level).toBe('department_head');
  });

  test('buildEmployeeActionChain - always includes founder stage', async () => {
    mockPoolQuery
      // First call: get employee (no team, no dept head)
      .mockResolvedValueOnce({ rows: [{ department_id: null, team_id: null }] })
      // Second call: adminStage - no admins
      .mockResolvedValueOnce({ rows: [] })
      // Third call: founderStage
      .mockResolvedValueOnce({ rows: [{ id: 'staff-founder-1' }] });

    const chain = await approvalChain.buildEmployeeActionChain('emp-1', 'requester-staff-1');
    
    expect(chain.length).toBe(1);
    expect(chain[0].level).toBe('founder');
    expect(chain[0].label).toBe('Founder');
  });
});

describe('Approval Chain - buildDepartmentChain', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('buildDepartmentChain - includes department head', async () => {
    mockPoolQuery
      // First call: get department head
      .mockResolvedValueOnce({ rows: [{ head_employee_id: 'emp-dept-head-1' }] })
      // Second call: staffForEmployee
      .mockResolvedValueOnce({ rows: [{ id: 'staff-dept-head-1' }] })
      // Third call: adminStage
      .mockResolvedValueOnce({ rows: [{ id: 'staff-admin-1' }] })
      // Fourth call: founderStage
      .mockResolvedValueOnce({ rows: [{ id: 'staff-founder-1' }] });

    const chain = await approvalChain.buildDepartmentChain('dept-1', 'requester-staff-1');
    
    expect(chain.length).toBe(3);
    expect(chain[0].level).toBe('department_head');
    expect(chain[1].level).toBe('ceo');
    expect(chain[2].level).toBe('founder');
  });

  test('buildDepartmentChain - skips department head if none', async () => {
    mockPoolQuery
      // First call: get department head - NONE
      .mockResolvedValueOnce({ rows: [{ head_employee_id: null }] })
      // Second call: adminStage
      .mockResolvedValueOnce({ rows: [{ id: 'staff-admin-1' }] })
      // Third call: founderStage
      .mockResolvedValueOnce({ rows: [{ id: 'staff-founder-1' }] });

    const chain = await approvalChain.buildDepartmentChain('dept-1', 'requester-staff-1');
    
    expect(chain.length).toBe(2);
    expect(chain[0].level).toBe('ceo');
    expect(chain[1].level).toBe('founder');
  });
});

describe('Approval Chain - buildTeamChain', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('buildTeamChain - includes team head and department head', async () => {
    mockPoolQuery
      // First call: get team info
      .mockResolvedValueOnce({ rows: [{ team_head_id: 'emp-team-head-1', department_id: 'dept-1' }] })
      // Second call: get department head
      .mockResolvedValueOnce({ rows: [{ head_employee_id: 'emp-dept-head-1' }] })
      // Third call: staffForEmployee team head
      .mockResolvedValueOnce({ rows: [{ id: 'staff-team-head-1' }] })
      // Fourth call: staffForEmployee dept head
      .mockResolvedValueOnce({ rows: [{ id: 'staff-dept-head-1' }] })
      // Fifth call: adminStage
      .mockResolvedValueOnce({ rows: [{ id: 'staff-admin-1' }] })
      // Sixth call: founderStage
      .mockResolvedValueOnce({ rows: [{ id: 'staff-founder-1' }] });

    const chain = await approvalChain.buildTeamChain('team-1', 'requester-staff-1');
    
    expect(chain.length).toBe(4);
    expect(chain[0].level).toBe('team_head');
    expect(chain[1].level).toBe('department_head');
    expect(chain[2].level).toBe('ceo');
    expect(chain[3].level).toBe('founder');
  });

  test('buildTeamChain - skips team head if none', async () => {
    mockPoolQuery
      // First call: get team info - no team head
      .mockResolvedValueOnce({ rows: [{ team_head_id: null, department_id: 'dept-1' }] })
      // Second call: get department head
      .mockResolvedValueOnce({ rows: [{ head_employee_id: 'emp-dept-head-1' }] })
      // Third call: staffForEmployee dept head
      .mockResolvedValueOnce({ rows: [{ id: 'staff-dept-head-1' }] })
      // Fourth call: adminStage
      .mockResolvedValueOnce({ rows: [{ id: 'staff-admin-1' }] })
      // Fifth call: founderStage
      .mockResolvedValueOnce({ rows: [{ id: 'staff-founder-1' }] });

    const chain = await approvalChain.buildTeamChain('team-1', 'requester-staff-1');
    
    expect(chain.length).toBe(3);
    expect(chain[0].level).toBe('department_head');
  });
});

describe('Approval Chain - buildStaffAccountChain', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('buildStaffAccountChain - uses employee chain when linked', async () => {
    mockPoolQuery
      // First call: get staff account employee_id
      .mockResolvedValueOnce({ rows: [{ employee_id: 'emp-1' }] })
      // Then buildEmployeeActionChain calls...
      .mockResolvedValueOnce({ rows: [{ department_id: 'dept-1', team_id: null }] })
      .mockResolvedValueOnce({ rows: [{ head_employee_id: 'emp-dept-head-1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'staff-dept-head-1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'staff-admin-1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'staff-founder-1' }] });

    const chain = await approvalChain.buildStaffAccountChain('staff-1', 'requester-staff-1');
    
    expect(chain.length).toBe(3); // department_head, ceo, founder
    expect(chain[0].level).toBe('department_head');
  });

  test('buildStaffAccountChain - falls back to admin + founder when no employee linked', async () => {
    mockPoolQuery
      // First call: get staff account employee_id - NONE
      .mockResolvedValueOnce({ rows: [{ employee_id: null }] })
      // Second call: adminStage
      .mockResolvedValueOnce({ rows: [{ id: 'staff-admin-1' }] })
      // Third call: founderStage
      .mockResolvedValueOnce({ rows: [{ id: 'staff-founder-1' }] });

    const chain = await approvalChain.buildStaffAccountChain('staff-1', 'requester-staff-1');
    
    expect(chain.length).toBe(2);
    expect(chain[0].level).toBe('ceo');
    expect(chain[1].level).toBe('founder');
  });
});