#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { safeQuery } = require('../db/pool');

async function checkTriggers() {
  const { rows } = await safeQuery(`
    SELECT tgname, tgrelid::regclass as table_name, tgenabled
    FROM pg_trigger
    WHERE tgrelid = 'bills'::regclass
  `);
  
  console.log('Triggers on bills table:');
  for (const r of rows) {
    console.log(`  ${r.tgname} | ${r.table_name} | enabled: ${r.tgenabled}`);
  }
  
  // Also check the function
  const { rows: funcs } = await safeQuery(`
    SELECT proname, prosrc
    FROM pg_proc
    WHERE proname ILIKE '%closed_period%'
  `);
  
  console.log('\nClosed period functions:');
  for (const f of funcs) {
    console.log(`  ${f.proname}`);
    console.log(f.prosrc.substring(0, 500));
  }
  
  process.exit(0);
}

checkTriggers().catch(e => { console.error(e); process.exit(1); });