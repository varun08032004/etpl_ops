'use strict';

const { 
  importBankStatement, 
  getImportPreview, 
  validateRow, 
  parseAmountToPaise, 
  parseDate, 
  normalizeType,
  generateFingerprint,
  paiseToNumericString,
  MAX_FILE_SIZE,
  MAX_ROWS,
  MAX_DECIMAL_PLACES,
  SUPPORTED_CREDIT_TYPES,
  SUPPORTED_DEBIT_TYPES,
} = require('../services/bankStatementImport');

describe('Bank Statement Import Service', () => {
  describe('parseAmountToPaise', () => {
    test('parses plain positive integers', () => {
      expect(parseAmountToPaise('100')).toBe(10000);
      expect(parseAmountToPaise('0')).toBe(0);
    });
    
    test('parses decimal amounts correctly', () => {
      expect(parseAmountToPaise('100.50')).toBe(10050);
      expect(parseAmountToPaise('100.5')).toBe(10050);
      expect(parseAmountToPaise('0.10')).toBe(10);
      expect(parseAmountToPaise('0.20')).toBe(20);
      expect(parseAmountToPaise('0.30')).toBe(30);
    });
    
    test('parses Indian currency format', () => {
      expect(parseAmountToPaise('₹1,000')).toBe(100000);
      expect(parseAmountToPaise('₹ 1,000.50')).toBe(100050);
      expect(parseAmountToPaise('1,000')).toBe(100000);
      expect(parseAmountToPaise('10,00,000.00')).toBe(100000000); // 10 lakh
    });
    
    test('handles negative amounts', () => {
      expect(parseAmountToPaise('-100')).toBe(-10000);
      expect(parseAmountToPaise('-100.50')).toBe(-10050);
      expect(parseAmountToPaise('-₹1,000')).toBe(-100000);
    });
    
    test('handles large amounts', () => {
      expect(parseAmountToPaise('99999999.99')).toBe(9999999999); // Max for NUMERIC(14,2)
    });
    
    test('handles null/empty', () => {
      expect(parseAmountToPaise(null)).toBeNull();
      expect(parseAmountToPaise('')).toBeNull();
      expect(parseAmountToPaise(undefined)).toBeNull();
      expect(parseAmountToPaise('   ')).toBeNull();
    });
    
    test('rejects invalid formats', () => {
      expect(parseAmountToPaise('abc')).toBeNull();
      expect(parseAmountToPaise('100.123')).toBeNull(); // Too many decimal places
      expect(parseAmountToPaise('100.')).toBeNull();
      expect(parseAmountToPaise('.50')).toBeNull();
      expect(parseAmountToPaise('1,00,000.123')).toBeNull(); // Too many decimals
    });
    
    test('rejects non-finite values', () => {
      expect(parseAmountToPaise('Infinity')).toBeNull();
      expect(parseAmountToPaise('NaN')).toBeNull();
    });
  });

  describe('paiseToNumericString', () => {
    test('converts paise to numeric string', () => {
      expect(paiseToNumericString(10000)).toBe('100.00');
      expect(paiseToNumericString(10050)).toBe('100.50');
      expect(paiseToNumericString(10)).toBe('0.10');
      expect(paiseToNumericString(20)).toBe('0.20');
      expect(paiseToNumericString(30)).toBe('0.30');
      expect(paiseToNumericString(-10050)).toBe('-100.50');
      expect(paiseToNumericString(0)).toBe('0.00');
    });
  });

  describe('parseDate', () => {
    test('parses YYYY-MM-DD', () => {
      expect(parseDate('2024-01-15')).toBe('2024-01-15');
      expect(parseDate('2024-12-31')).toBe('2024-12-31');
    });
    
    test('parses DD/MM/YYYY', () => {
      expect(parseDate('15/01/2024')).toBe('2024-01-15');
      expect(parseDate('31/12/2024')).toBe('2024-12-31');
    });
    
    test('parses DD-MM-YYYY', () => {
      expect(parseDate('15-01-2024')).toBe('2024-01-15');
      expect(parseDate('31-12-2024')).toBe('2024-12-31');
    });
    
    test('parses DD.MM.YYYY', () => {
      expect(parseDate('15.01.2024')).toBe('2024-01-15');
      expect(parseDate('31.12.2024')).toBe('2024-12-31');
    });
    
    test('handles null/empty', () => {
      expect(parseDate(null)).toBeNull();
      expect(parseDate('')).toBeNull();
      expect(parseDate('   ')).toBeNull();
    });
    
    test('rejects invalid calendar dates', () => {
      expect(parseDate('31/02/2024')).toBeNull(); // Feb 31
      expect(parseDate('29/02/2023')).toBeNull(); // Non-leap year
      expect(parseDate('2024-02-30')).toBeNull();
    });
    
    test('rejects unsupported/ambiguous formats', () => {
      // DD/MM/YYYY is ambiguous - only accepted when day > 12
      expect(parseDate('01/02/2024')).toBeNull(); // Ambiguous - day <= 12
      expect(parseDate('15/02/2024')).toBe('2024-02-15'); // Unambiguous - day > 12
      expect(parseDate('Jan 15, 2024')).toBeNull();
      expect(parseDate('15-Jan-2024')).toBeNull();
      expect(parseDate('2024/01/15')).toBeNull();
      expect(parseDate('invalid')).toBeNull();
    });
    
    test('rejects partial dates', () => {
      expect(parseDate('2024-01')).toBeNull();
      expect(parseDate('01-2024')).toBeNull();
    });
  });

  describe('normalizeType', () => {
    test('accepts credit variants (case-insensitive)', () => {
      for (const t of ['credit', 'CREDIT', 'Credit', 'cr', 'CR', 'income', 'INCOME']) {
        const result = normalizeType(t);
        expect(result.valid).toBe(true);
        expect(result.direction).toBe('credit');
        expect(result.error).toBeNull();
      }
    });
    
    test('accepts debit variants (case-insensitive)', () => {
      for (const t of ['debit', 'DEBIT', 'Debit', 'dr', 'DR', 'expense', 'EXPENSE', 'withdrawal', 'WITHDRAWAL']) {
        const result = normalizeType(t);
        expect(result.valid).toBe(true);
        expect(result.direction).toBe('debit');
        expect(result.error).toBeNull();
      }
    });
    
    test('handles whitespace', () => {
      expect(normalizeType('  credit  ').direction).toBe('credit');
      expect(normalizeType('\tdebit\n').direction).toBe('debit');
    });
    
    test('rejects missing/empty type', () => {
      expect(normalizeType('').valid).toBe(false);
      expect(normalizeType(null).valid).toBe(false);
      expect(normalizeType(undefined).valid).toBe(false);
      expect(normalizeType('   ').valid).toBe(false);
    });
    
    test('rejects unrecognized values', () => {
      const result = normalizeType('unknown');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unsupported transaction type');
      expect(result.error).toContain('unknown');
    });
    
    test('rejects similar but unsupported values', () => {
      expect(normalizeType('credits').valid).toBe(false);
      expect(normalizeType('deb').valid).toBe(false);
      expect(normalizeType('inc').valid).toBe(false);
      expect(normalizeType('exp').valid).toBe(false);
    });
  });

  describe('validateRow', () => {
    test('validates required columns', () => {
      const result = validateRow({ date: '2024-01-15', description: 'Test', amount: '100', type: 'credit' }, 1);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.parsed.amount_paise).toBe(10000);
      expect(result.parsed.direction).toBe('credit');
    });
    
    test('rejects missing date', () => {
      const result = validateRow({ description: 'Test', amount: '100', type: 'credit' }, 1);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required column: date');
    });
    
    test('rejects missing amount', () => {
      const result = validateRow({ date: '2024-01-15', description: 'Test', type: 'credit' }, 1);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required column: amount');
    });
    
    test('rejects missing type', () => {
      const result = validateRow({ date: '2024-01-15', description: 'Test', amount: '100' }, 1);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Transaction type is required');
    });
    
    test('rejects invalid amount', () => {
      const result = validateRow({ date: '2024-01-15', description: 'Test', amount: 'abc', type: 'credit' }, 1);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid amount format (must be numeric with up to 2 decimal places)');
    });
    
    test('rejects zero amount', () => {
      const result = validateRow({ date: '2024-01-15', description: 'Test', amount: '0', type: 'credit' }, 1);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Amount must be non-zero');
    });
    
    test('rejects too many decimal places', () => {
      const result = validateRow({ date: '2024-01-15', description: 'Test', amount: '100.123', type: 'credit' }, 1);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid amount format (must be numeric with up to 2 decimal places)');
    });
    
    test('rejects invalid date', () => {
      const result = validateRow({ date: 'invalid', description: 'Test', amount: '100', type: 'credit' }, 1);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Invalid date format');
    });
    
    test('rejects invalid calendar date', () => {
      const result = validateRow({ date: '31/02/2024', description: 'Test', amount: '100', type: 'credit' }, 1);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Invalid date format');
    });
    
    test('rejects unknown transaction type', () => {
      const result = validateRow({ date: '2024-01-15', description: 'Test', amount: '100', type: 'unknown' }, 1);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Unsupported transaction type');
    });
    
    test('normalizes amount to paise with correct sign', () => {
      const creditResult = validateRow({ date: '2024-01-15', description: 'Test', amount: '100.50', type: 'credit' }, 1);
      expect(creditResult.parsed.amount_paise).toBe(10050);
      expect(creditResult.parsed.direction).toBe('credit');
      
      const debitResult = validateRow({ date: '2024-01-15', description: 'Test', amount: '100.50', type: 'debit' }, 1);
      expect(debitResult.parsed.amount_paise).toBe(-10050);
      expect(debitResult.parsed.direction).toBe('debit');
    });
    
    test('includes external_transaction_id from reference', () => {
      const result = validateRow({ date: '2024-01-15', description: 'Test', amount: '100', type: 'credit', reference: 'TXN123' }, 1);
      expect(result.parsed.external_transaction_id).toBe('TXN123');
    });
    
    test('truncates long description', () => {
      const longDesc = 'a'.repeat(600);
      const result = validateRow({ date: '2024-01-15', description: longDesc, amount: '100', type: 'credit' }, 1);
      expect(result.parsed.description.length).toBe(500);
    });
  });

  describe('generateFingerprint', () => {
    test('generates consistent fingerprint for same inputs', () => {
      const fp1 = generateFingerprint('acc-1', '2024-01-15', 10000, 'credit', 'REF123', 'Test payment');
      const fp2 = generateFingerprint('acc-1', '2024-01-15', 10000, 'credit', 'REF123', 'Test payment');
      expect(fp1).toBe(fp2);
      expect(fp1).toMatch(/^fp_acc-1_2024-01-15_10000_credit_/);
    });
    
    test('differs for different amounts', () => {
      const fp1 = generateFingerprint('acc-1', '2024-01-15', 10000, 'credit', 'REF123', 'Test');
      const fp2 = generateFingerprint('acc-1', '2024-01-15', 20000, 'credit', 'REF123', 'Test');
      expect(fp1).not.toBe(fp2);
    });
    
    test('differs for different accounts', () => {
      const fp1 = generateFingerprint('acc-1', '2024-01-15', 10000, 'credit', 'REF123', 'Test');
      const fp2 = generateFingerprint('acc-2', '2024-01-15', 10000, 'credit', 'REF123', 'Test');
      expect(fp1).not.toBe(fp2);
    });
    
    test('differs for different descriptions', () => {
      const fp1 = generateFingerprint('acc-1', '2024-01-15', 10000, 'credit', 'REF123', 'Test A');
      const fp2 = generateFingerprint('acc-1', '2024-01-15', 10000, 'credit', 'REF123', 'Test B');
      expect(fp1).not.toBe(fp2);
    });
    
    test('handles missing reference/description', () => {
      const fp = generateFingerprint('acc-1', '2024-01-15', 10000, 'credit', '', '');
      expect(fp).toMatch(/^fp_acc-1_2024-01-15_10000_credit__/);
    });
  });

  describe('getImportPreview', () => {
    test('parses valid CSV and returns preview', async () => {
      const csv = `date,description,amount,reference,type
2024-01-15,Salary Credit,50000,REF001,credit
2024-01-16,Rent Payment,20000,REF002,debit`;
      
      const result = await getImportPreview(Buffer.from(csv));
      
      expect(result.totalRows).toBe(2);
      expect(result.validRows).toBe(2);
      expect(result.preview).toHaveLength(2);
      expect(result.preview[0].amount_paise).toBe(5000000);
      expect(result.preview[0].direction).toBe('credit');
      expect(result.preview[0].amount_display).toBe('50000.00');
      expect(result.preview[1].amount_paise).toBe(-2000000);
      expect(result.preview[1].direction).toBe('debit');
      expect(result.preview[1].amount_display).toBe('20000.00');
    });
    
    test('detects columns', async () => {
      const csv = `date,description,amount,reference,type,balance
2024-01-15,Test,100,REF001,credit,50000`;
      
      const result = await getImportPreview(Buffer.from(csv));
      expect(result.detectedColumns).toContain('date');
      expect(result.detectedColumns).toContain('description');
      expect(result.detectedColumns).toContain('amount');
      expect(result.detectedColumns).toContain('reference');
      expect(result.detectedColumns).toContain('type');
      expect(result.detectedColumns).toContain('balance');
    });
    
    test('limits preview to 20 rows', async () => {
      const rows = Array(25).fill('2024-01-15,Test,100,REF,debit').join('\n');
      const csv = `date,description,amount,reference,type\n${rows}`;
      
      const result = await getImportPreview(Buffer.from(csv));
      expect(result.preview).toHaveLength(20);
      expect(result.totalRows).toBe(25);
    });
    
    test('includes errors for invalid rows', async () => {
      const csv = `date,description,amount,type
2024-01-15,Valid,100,credit
invalid,Invalid,200,debit`;
      
      const result = await getImportPreview(Buffer.from(csv));
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].row).toBe(3);
    });
    
    test('throws on empty CSV', async () => {
      await expect(getImportPreview(Buffer.from(''))).rejects.toThrow('CSV has no data rows');
    });
    
    test('throws on parse error', async () => {
      // csv-parse with relax_quotes=false throws on malformed quoting
      await expect(getImportPreview(Buffer.from('"unclosed quote,field\nvalue'))).rejects.toThrow('CSV parse error');
    });
    
    test('throws on file too large', async () => {
      const largeBuffer = Buffer.alloc(MAX_FILE_SIZE + 1);
      await expect(getImportPreview(largeBuffer)).rejects.toThrow('File size exceeds limit');
    });
    
    test('returns limits info', async () => {
      const csv = `date,description,amount,type\n2024-01-15,Test,100,credit`;
      const result = await getImportPreview(Buffer.from(csv));
      expect(result.limits.maxFileSize).toBe(MAX_FILE_SIZE);
      expect(result.limits.maxRows).toBe(MAX_ROWS);
      expect(result.limits.maxDecimalPlaces).toBe(MAX_DECIMAL_PLACES);
    });
  });

  describe('importBankStatement (unit logic)', () => {
    test('validateRow returns correct structure with paise', () => {
      const result = validateRow({ 
        date: '15/01/2024', 
        description: 'Test Transaction', 
        amount: '1,000.00',
        reference: 'TXN123',
        type: 'credit'
      }, 1);
      
      expect(result.valid).toBe(true);
      expect(result.parsed.transaction_date).toBe('2024-01-15');
      expect(result.parsed.description).toBe('Test Transaction');
      expect(result.parsed.amount_paise).toBe(100000);
      expect(result.parsed.direction).toBe('credit');
      expect(result.parsed.external_transaction_id).toBe('TXN123');
    });
    
    test('handles debit with negative paise', () => {
      const result = validateRow({ 
        date: '2024-01-15', 
        description: 'Payment', 
        amount: '500.25',
        type: 'debit'
      }, 1);
      
      expect(result.parsed.amount_paise).toBe(-50025);
      expect(result.parsed.direction).toBe('debit');
    });
  });
});