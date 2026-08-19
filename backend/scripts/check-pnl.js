#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { getProfitAndLoss } = require('../services/ledger');

(async () => {
  // August P&L
  const aug = await getProfitAndLoss('2026-08-01', '2026-08-31');
  console.log('=== August 2026 P&L ===');
  console.log('Income:', aug.income.map(i => `${i.name}: ${i.amount}`).join(', ') || 'None');
  console.log('Expenses:', aug.expenses.map(e => `${e.name}: ${e.amount}`).join(', ') || 'None');
  console.log('Total Income:', aug.totalIncome);
  console.log('Total Expense:', aug.totalExpense);
  console.log('Net Profit:', aug.netProfit);
  
  // July P&L
  const jul = await getProfitAndLoss('2026-07-01', '2026-07-31');
  console.log('\n=== July 2026 P&L ===');
  console.log('Income:', jul.income.map(i => `${i.name}: ${i.amount}`).join(', ') || 'None');
  console.log('Expenses:', jul.expenses.map(e => `${e.name}: ${e.amount}`).join(', ') || 'None');
  console.log('Total Income:', jul.totalIncome);
  console.log('Total Expense:', jul.totalExpense);
  console.log('Net Profit:', jul.netProfit);
  
  // May P&L
  const may = await getProfitAndLoss('2026-05-01', '2026-05-31');
  console.log('\n=== May 2026 P&L ===');
  console.log('Income:', may.income.map(i => `${i.name}: ${i.amount}`).join(', ') || 'None');
  console.log('Expenses:', may.expenses.map(e => `${e.name}: ${e.amount}`).join(', ') || 'None');
  console.log('Total Income:', may.totalIncome);
  console.log('Total Expense:', may.totalExpense);
  console.log('Net Profit:', may.netProfit);
  
  // June P&L
  const jun = await getProfitAndLoss('2026-06-01', '2026-06-30');
  console.log('\n=== June 2026 P&L ===');
  console.log('Income:', jun.income.map(i => `${i.name}: ${i.amount}`).join(', ') || 'None');
  console.log('Expenses:', jun.expenses.map(e => `${e.name}: ${e.amount}`).join(', ') || 'None');
  console.log('Total Income:', jun.totalIncome);
  console.log('Total Expense:', jun.totalExpense);
  console.log('Net Profit:', jun.netProfit);
  
  process.exit(0);
})();