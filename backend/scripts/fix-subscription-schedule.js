require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { safeQuery } = require('../db/pool');

async function fixSubscriptionSchedule(dryRun = true) {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  FIX SUBSCRIPTION SCHEDULE - 13 → 12 MONTHS');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'EXECUTE'}\n`);

  const scheduleId = '3449c39e-6ff0-4fe7-b5cc-de089a0474a8';
  const invoiceId = 'e1d31879-dc3d-4429-bd66-efcd0787efec';
  
  const { rows: [sched] } = await safeQuery(`SELECT * FROM revenue_recognition_schedules WHERE id = $1`, [scheduleId]);
  if (!sched) {
    console.error('Schedule not found');
    return;
  }

  console.log('Current Schedule:');
  console.log(`  Total Amount: ₹${sched.total_amount}`);
  console.log(`  Recognized: ₹${sched.recognized_amount}`);
  console.log(`  Start: ${sched.start_date} | End: ${sched.end_date}`);
  console.log(`  Next: ${sched.next_recognition_date} | Freq: ${sched.frequency}`);
  console.log(`  Complete: ${sched.is_complete}`);

  // Calculate correct 12-month schedule
  const startDate = new Date(sched.start_date); // 2026-07-30
  const correctEndDate = new Date(startDate);
  correctEndDate.setFullYear(correctEndDate.getFullYear() + 1); // 2027-07-30
  
  const totalMonths = 12;
  const monthlyAmount = Number(sched.total_amount) / totalMonths;

  console.log(`\nCorrected (12 months):`);
  console.log(`  Monthly: ₹${monthlyAmount.toFixed(2)}`);
  console.log(`  End Date: ${correctEndDate.toISOString().slice(0,10)}`);

  // How many months already recognized?
  const recognizedMonths = Math.round(Number(sched.recognized_amount) / monthlyAmount);
  console.log(`  Already recognized: ${recognizedMonths} months (₹${sched.recognized_amount})`);

  if (!dryRun) {
    console.log('\n🔄 Updating schedule to 12 months...');
    
    // Calculate next recognition date (should be Aug 30, 2026 for 2nd month)
    const nextDate = new Date(startDate);
    nextDate.setMonth(startDate.getMonth() + recognizedMonths);
    
    await safeQuery(`
      UPDATE revenue_recognition_schedules 
      SET end_date = $1,
          next_recognition_date = $2,
          frequency = 'monthly',
          updated_at = NOW()
      WHERE id = $3
    `, [correctEndDate.toISOString().slice(0,10), nextDate.toISOString().slice(0,10), scheduleId]);
    
    console.log('✅ Schedule updated to 12 months');
    console.log(`  Next recognition: ${nextDate.toISOString().slice(0,10)}`);
    console.log(`  Monthly amount: ₹${monthlyAmount.toFixed(2)}`);
  } else {
    console.log('\n💡 Run with --execute to fix');
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  process.exit(0);
}

const args = process.argv.slice(2);
const dryRun = !args.includes('--execute');
fixSubscriptionSchedule(dryRun).catch(err => { console.error(err); process.exit(1); });