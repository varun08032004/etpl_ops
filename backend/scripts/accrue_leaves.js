const { Client } = require('pg');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const client = new Client({
    host: 'aws-0-ap-southeast-1.pooler.supabase.com',
    port: 5432,
    database: 'postgres',
    user: 'postgres.hybufntjrxikcpkwonei',
    password: 'C8InvJEpLjkP7vNI',
    ssl: { rejectUnauthorized: false },
});

async function calculateMonthsWorked(joiningDate) {
  const join = new Date(joiningDate);
  const now = new Date();
  let months = (now.getFullYear() - join.getFullYear()) * 12 + (now.getMonth() - join.getMonth());
  if (now.getDate() < join.getDate()) months--;
  return Math.max(0, months);
}

client.connect().then(async () => {
  const { rows: employees } = await client.query('SELECT id, full_name, date_of_joining, leave_balance_annual, leave_balance_sick FROM employees WHERE status = \'active\'');
  
  for (const emp of employees) {
    const months = await calculateMonthsWorked(emp.date_of_joining);
    const annualAccrual = months * 2; // 2 days/month
    const sickAccrual = months * 1;   // 1 day/month
    
    const cappedAnnual = Math.min(annualAccrual, 30); // max 30
    const cappedSick = Math.min(sickAccrual, 15);      // max 15
    
    if (cappedAnnual !== Number(emp.leave_balance_annual) || cappedSick !== Number(emp.leave_balance_sick)) {
      await client.query(
        'UPDATE employees SET leave_balance_annual = $1, leave_balance_sick = $2 WHERE id = $3',
        [cappedAnnual, cappedSick, emp.id]
      );
      console.log(`Updated ${emp.full_name}: ${months} months -> Annual: ${cappedAnnual}, Sick: ${cappedSick}`);
    } else {
      console.log(`${emp.full_name}: already up to date (Annual: ${emp.leave_balance_annual}, Sick: ${emp.leave_balance_sick})`);
    }
  }
  
  await client.end();
});