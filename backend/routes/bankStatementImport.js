'use strict';

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticate, requireRole } = require('../middleware/auth');
const { importBankStatement, getImportPreview } = require('../services/bankStatementImport');
const { safeQuery } = require('../db/pool');
const { logAction } = require('../services/auditLog');

router.use(authenticate);
router.use(requireRole('finance'));

const upload = multer({ 
  storage: multer.memoryStorage(), 
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.toLowerCase().endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'), false);
    }
  },
});

router.get('/:bankAccountId/preview', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'CSV file required (multipart field name: "file")' });
    }
    
    const { bankAccountId } = req.params;
    const { rows: [account] } = await safeQuery('SELECT id FROM bank_accounts WHERE id = $1', [bankAccountId]);
    if (!account) {
      return res.status(404).json({ error: 'Bank account not found' });
    }
    
    const preview = await getImportPreview(req.file.buffer);
    res.json({ bankAccountId, ...preview });
  } catch (err) {
    console.error('[bank-statement-import:preview]', err);
    res.status(400).json({ error: err.message });
  }
});

router.post('/:bankAccountId/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'CSV file required (multipart field name: "file")' });
    }
    
    const { bankAccountId } = req.params;
    const { skipDuplicates = 'true' } = req.query;
    
    const { rows: [account] } = await safeQuery('SELECT id FROM bank_accounts WHERE id = $1', [bankAccountId]);
    if (!account) {
      return res.status(404).json({ error: 'Bank account not found' });
    }
    
    const result = await importBankStatement(
      bankAccountId,
      req.file.buffer,
      req.staff.id,
      { skipDuplicates: skipDuplicates === 'true' }
    );
    
    await logAction({
      staffId: req.staff.id,
      action: 'bank_statement.imported',
      entity: 'expense_bank_transactions',
      entityId: bankAccountId,
      newValue: { 
        total: result.total, 
        imported: result.imported, 
        duplicates: result.duplicates, 
        failed: result.failed,
        import_id: result.import_id,
      },
    });
    
    res.json({ bankAccountId, ...result });
  } catch (err) {
    console.error('[bank-statement-import:import]', err);
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;