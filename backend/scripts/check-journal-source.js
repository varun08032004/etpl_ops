#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { safeQuery } = require('../db/pool');

(async () => {
  const { rows } = await safeQuery(`
    SELECT enumlabel FROM pg_enum WHERE enumtypid = 'journal_source'::regtype ORDER BY enumsortorder
  `);
  
  console.log('journal_source enum values:');
  for (const r of rows) {
    console.log(`  ${r.enumlabel}`);
  }
  
  process.exit(0);
})();