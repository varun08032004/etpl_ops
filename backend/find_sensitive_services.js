const fs = require('fs');
const files = fs.readdirSync('services').filter(f => f.endsWith('.js'));
for (const f of files) {
  const content = fs.readFileSync('services/' + f, 'utf8');
  if (content.includes('bank_account_number') || content.includes('pan_number') || content.includes('api_client_id') || content.includes('api_client_secret') || content.includes('api_base_url')) {
    console.log('=== services/' + f + ' ===');
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('bank_account_number') || lines[i].includes('pan_number') || lines[i].includes('api_client_id') || lines[i].includes('api_client_secret') || lines[i].includes('api_base_url')) {
        console.log('  Line', i+1, ':', lines[i].trim());
      }
    }
  }
}