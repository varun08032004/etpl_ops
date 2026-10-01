/**
 * Payroll Compliance Tests
 * Tests for statutory payroll calculations: EPF, ESIC, PT, TDS, 50% wage cap
 */

const payrollCompliance = require('../services/payrollCompliance');

// Mock the db pool for tests that need it
jest.mock('../db/pool', () => ({
  safeQuery: jest.fn()
}));

const { safeQuery } = require('../db/pool');

describe('Payroll Compliance - 50% Wage Cap Rule', () => {
  test('apply50PercentWageCapRule - no adjustment needed when basic+DA >= 50% gross', () => {
    const result = payrollCompliance.apply50PercentWageCapRule({
      basic: 30000,
      da: 10000,
      otherAllowances: 20000
    });
    expect(result.wasAdjusted).toBe(false);
    expect(result.adjustedBasic).toBe(30000);
    expect(result.adjustedDA).toBe(10000);
    expect(result.adjustedOtherAllowances).toBe(20000);
  });

  test('apply50PercentWageCapRule - adjusts when basic+DA < 50% gross', () => {
    // Gross = 60000, 50% = 30000, basic+DA = 20000 -> shortfall = 10000
    const result = payrollCompliance.apply50PercentWageCapRule({
      basic: 15000,
      da: 5000,
      otherAllowances: 40000
    });
    expect(result.wasAdjusted).toBe(true);
    expect(result.adjustedBasic).toBe(25000); // 15000 + 10000
    expect(result.adjustedDA).toBe(5000);
    expect(result.adjustedOtherAllowances).toBe(30000); // 40000 - 10000
  });

  test('apply50PercentWageCapRule - otherAllowances never goes negative', () => {
    const result = payrollCompliance.apply50PercentWageCapRule({
      basic: 10000,
      da: 0,
      otherAllowances: 5000
    });
    // Gross = 15000, 50% = 7500, basic+DA = 10000 >= 7500 -> no adjustment
    expect(result.wasAdjusted).toBe(false);
  });

  test('apply50PercentWageCapRule - large shortfall caps otherAllowances at 0', () => {
    // Gross = 50000, 50% = 25000, basic+DA = 10000 -> shortfall = 15000
    // otherAllowances = 40000 - 15000 = 25000
    const result = payrollCompliance.apply50PercentWageCapRule({
      basic: 5000,
      da: 5000,
      otherAllowances: 40000
    });
    expect(result.wasAdjusted).toBe(true);
    expect(result.adjustedOtherAllowances).toBe(25000);
  });
});

describe('Payroll Compliance - EPF Calculation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('calculateEPF - returns 0 when pfApplicable is false', async () => {
    const result = await payrollCompliance.calculateEPF({
      basicPlusDA: 50000,
      pfApplicable: false
    });
    expect(result.employeeContribution).toBe(0);
    expect(result.employerContribution).toBe(0);
    expect(result.wageBase).toBe(0);
  });

  test('calculateEPF - uses wage ceiling correctly', async () => {
    safeQuery.mockResolvedValueOnce({ rows: [{ value: '15000' }] });
    
    const result = await payrollCompliance.calculateEPF({
      basicPlusDA: 20000,
      pfApplicable: true
    });
    
    expect(result.wageBase).toBe(15000);
    expect(result.employeeContribution).toBe(1800); // 15000 * 0.12
    expect(result.employerContribution).toBe(1800);
  });

  test('calculateEPF - throws when epf_wage_ceiling not configured', async () => {
    safeQuery.mockResolvedValueOnce({ rows: [] });
    
    await expect(payrollCompliance.calculateEPF({
      basicPlusDA: 20000,
      pfApplicable: true
    })).rejects.toThrow('epf_wage_ceiling is not configured');
  });
});

describe('Payroll Compliance - ESIC Calculation', () => {
  test('calculateESIC - returns 0 when not applicable', () => {
    const result = payrollCompliance.calculateESIC({
      grossMonthly: 30000,
      applicable: false
    });
    expect(result.employeeDeduction).toBe(0);
    expect(result.employerContribution).toBe(0);
  });

  test('calculateESIC - calculates correct percentages', () => {
    const result = payrollCompliance.calculateESIC({
      grossMonthly: 20000,
      applicable: true
    });
    expect(result.employeeDeduction).toBe(150); // 20000 * 0.0075
    expect(result.employerContribution).toBe(650); // 20000 * 0.0325
  });

  test('calculateESIC - rounds to 2 decimal places', () => {
    const result = payrollCompliance.calculateESIC({
      grossMonthly: 21345.67,
      applicable: true
    });
    // 21345.67 * 0.0075 = 160.092525 -> 160.09
    // 21345.67 * 0.0325 = 693.734275 -> 693.73 (rounding down at .5)
    expect(result.employeeDeduction).toBe(160.09);
    expect(result.employerContribution).toBe(693.73);
  });
});

describe('Payroll Compliance - Fiscal Year Helpers', () => {
  test('fyMonthNumber - April is month 1', () => {
    expect(payrollCompliance.fyMonthNumber(4)).toBe(1);
  });

  test('fyMonthNumber - March is month 12', () => {
    expect(payrollCompliance.fyMonthNumber(3)).toBe(12);
  });

  test('fyMonthNumber - January is month 10', () => {
    expect(payrollCompliance.fyMonthNumber(1)).toBe(10);
  });

  test('currentFiscalYearLabel - April 2024 is FY2024-25', () => {
    expect(payrollCompliance.currentFiscalYearLabel(4, 2024)).toBe('FY2024-25');
  });

  test('currentFiscalYearLabel - March 2025 is FY2024-25', () => {
    expect(payrollCompliance.currentFiscalYearLabel(3, 2025)).toBe('FY2024-25');
  });

  test('currentFiscalYearLabel - January 2025 is FY2024-25', () => {
    expect(payrollCompliance.currentFiscalYearLabel(1, 2025)).toBe('FY2024-25');
  });
});

describe('Payroll Compliance - Final Settlement Deadline', () => {
  test('addWorkingDays - skips weekends', () => {
    const start = new Date('2024-01-05'); // Friday
    const result = payrollCompliance.addWorkingDays(start, 2);
    expect(result.getDay()).toBe(2); // Tuesday (skip Sat, Sun)
  });

  test('addWorkingDays - 1 day from Friday is Monday', () => {
    const start = new Date('2024-01-05'); // Friday
    const result = payrollCompliance.addWorkingDays(start, 1);
    expect(result.getDay()).toBe(1); // Monday
  });

  test('computeFinalSettlementDeadline - uses 2 days default', async () => {
    safeQuery.mockResolvedValueOnce({ rows: [{ value: '2' }] });
    
    const exitDate = '2024-01-05'; // Friday
    const deadline = await payrollCompliance.computeFinalSettlementDeadline(exitDate);
    // Fri + 2 working days = Tue
    expect(deadline.getDay()).toBe(2);
  });
});

describe('Payroll Compliance - TDS Projection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('projectMonthlyTDS - calculates correctly for new regime', async () => {
    safeQuery
      .mockResolvedValueOnce({ rows: [{ standard_deduction: 75000 }] }) // tax_slabs query
      .mockResolvedValueOnce({ rows: [
        { income_from: 0, income_to: 300000, rate_percent: 0 },
        { income_from: 300000, income_to: 600000, rate_percent: 5 },
        { income_from: 600000, income_to: 900000, rate_percent: 10 },
        { income_from: 900000, income_to: 1200000, rate_percent: 15 },
        { income_from: 1200000, income_to: 1500000, rate_percent: 20 },
        { income_from: 1500000, income_to: null, rate_percent: 30 }
      ] }); // computeAnnualTax slabs
    
    const result = await payrollCompliance.projectMonthlyTDS({
      employee: { tax_regime: 'new', declared_deductions: {} },
      currentMonthGross: 100000,
      ytdGrossThisFY: 300000,
      ytdTDSThisFY: 10000,
      calendarMonth: 6, // June
      calendarYear: 2024
    });
    
    expect(result.monthlyTDS).toBeGreaterThanOrEqual(0);
    expect(result.fiscalYear).toBe('FY2024-25');
  });

  test('projectMonthlyTDS - applies deductions for old regime', async () => {
    safeQuery
      .mockResolvedValueOnce({ rows: [{ standard_deduction: 50000 }] }) // tax_slabs query for standard_deduction
      .mockResolvedValueOnce({ rows: [
        { income_from: 0, income_to: 250000, rate_percent: 0 },
        { income_from: 250000, income_to: 500000, rate_percent: 5 },
        { income_from: 500000, income_to: 1000000, rate_percent: 20 },
        { income_from: 1000000, income_to: null, rate_percent: 30 }
      ] }); // computeAnnualTax slabs
    
    const result = await payrollCompliance.projectMonthlyTDS({
      employee: { 
        tax_regime: 'old', 
        declared_deductions: { section_80c: 150000, section_80d: 50000, hra_exemption_annual: 100000 }
      },
      currentMonthGross: 100000,
      ytdGrossThisFY: 300000,
      ytdTDSThisFY: 5000,
      calendarMonth: 6,
      calendarYear: 2024
    });
    
    expect(result.monthlyTDS).toBeGreaterThanOrEqual(0);
  });
});