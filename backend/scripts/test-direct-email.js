require('dotenv').config();
const { sendEmail } = require('../services/email');

async function testDirectEmail() {
  console.log('Sending test email to admin@ethertrack.in...');
  await sendEmail({
    to: 'admin@ethertrack.in',
    subject: 'Test: Compliance Alert System Working',
    html: '<p>This is a test email from the compliance automation system.</p><p>If you receive this, the email pipeline is working correctly.</p>'
  });
  console.log('✅ Test email sent - check admin@ethertrack.in inbox');
}

testDirectEmail().catch(console.error);