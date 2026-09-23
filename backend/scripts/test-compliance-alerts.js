require('dotenv').config();
const { fireEvent } = require('../services/automationEngine');

async function testComplianceAlerts() {
  console.log('Testing compliance_item.due_soon event...');
  await fireEvent('compliance_item.due_soon', {
    title: 'GSTR-3B',
    category: 'gst',
    due_date: '2026-10-20',
    days_until_due: 5,
    owner_name: 'Test User',
    link: '/compliance'
  });

  console.log('Testing compliance_item.escalated event...');
  await fireEvent('compliance_item.escalated', {
    title: 'GSTR-1',
    category: 'gst',
    due_date: '2026-10-11',
    owner_name: 'Test User',
    link: '/compliance'
  });

  console.log('✅ Events fired - check logs and admin@ethertrack.in for emails');
}

testComplianceAlerts().catch(console.error);