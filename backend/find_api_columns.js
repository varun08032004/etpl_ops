const fs = require('fs');
const files = fs.readdirSync('db').filter(f => f.endsWith('.sql'));
for (const f of files) {
  const content = fs.readFileSync('db/' + f, 'utf8');
  if (content.includes('api_client_id') || content.includes('api_client_secret') || content.includes('api_base_url')) {
    console.log('===', f, '===');
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('api_client') || lines[i].includes('api_base_url')) {
        console.log('Line', i+1, ':', lines[i].trim());
      }
    }
  }
}