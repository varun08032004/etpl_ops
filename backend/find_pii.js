const fs = require('fs');
const files = fs.readdirSync('routes').filter(f => f.endsWith('.js'));
for (const f of files) {
  const content = fs.readFileSync('routes/' + f, 'utf8');
  if (content.includes('bank_account_number') || content.includes('pan_number')) {
    console.log('=== routes/' + f + ' ===');
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('bank_account_number') || lines[i].includes('pan_number')) {
        console.log('  Line', i+1, ':', lines[i].trim());
      }
    }
  }
}