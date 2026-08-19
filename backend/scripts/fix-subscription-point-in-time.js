require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { safeQuery } = require('../db/pool');

async function fixSubscriptionRevenueRecognition(dryRun = true) {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  FIX SUBSCRIPTION REVENUE - POINT-IN-TIME (JULY ONLY)');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'EXECUTE'}\n`);

  const scheduleId = '3449c39e-6ff0-4fe7-b5cc-de089a0474a8';
  
  const { rows: [sched] } = await safeQuery(`SELECT * FROM revenue_recognition_schedules WHERE id = $1`, [scheduleId]);
  if (!sched) {
    console.error('Schedule not found');
    return;
  }

  console.log('Current Schedule:');
  console.log(`  Total Amount: ₹${sched.total_amount}`);
  console.log(`  Recognized: ₹${sched.recognized_amount}`);
  console.log(`  Start: ${sched.start_date} | End: ${sched.end_date}`);
  console.log(`  Next: ${sched.next_recognition_date}`);

  // Business rule: Annual subscription = full revenue in purchase month (July)
  // No further recognition in subsequent months
  const julyRevenue = Number(sched.total_amount); // Full amount in July
  
  console.log(`\nBusiness Rule: Annual subscription = full revenue in purchase month`);
  console.log(`  July 2026 revenue: ₹${julyRevenue.toFixed(2)}`);
  console.log(`  Aug 2026 onwards: ₹0`);

  if (!dryRun) {
    console.log('\n🔄 Updating schedule - mark complete, no further recognition...');
    
    // Mark schedule as complete - no further recognition
    await safeQuery(`
      UPDATE revenue_recognition_schedules 
      SET is_complete = true,
          recognized_amount = total_amount,
          next_recognition_date = end_date,
          updated_at = NOW()
      WHERE id = $1
    `, [sched.id]);
    
    console.log('✅ Schedule marked complete - no future recognition');
    console.log('  July revenue: Full amount recognized');
    console.log('  Aug onwards: No recognition entries will be created');
  } else {
    console.log('\n💡 Run with --execute to fix');
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  process.exit(0);
}

const args = process.argv.slice(2);
const dryRun = !args.includes('--execute');
fixSubscriptionRevenueRecognition(dryRun).catch(err => { console.error(err); process.exit(1); });