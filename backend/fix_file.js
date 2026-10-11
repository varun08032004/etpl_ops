const fs = require('fs');

const filePath = 'C:\\Users\\ASUS\\Desktop\\etpl_ops\\backend\\services\\crypto\\fieldEncryption.js';
const content = fs.readFileSync(filePath, 'utf8');

console.log('Original length:', content.length);
console.log('LF count before:', (content.match(/\n/g) || []).length);

// The content has no line endings - it's all one line
// We need to reconstruct proper line endings

// Strategy: Replace known patterns with proper line endings
let fixed = content;

// Add newlines after common JavaScript patterns
fixed = fixed
  // After block comments
  .replace(/\*\//g, '*/\n')
  // After 'use strict'
  .replace(/'use strict';/g, "'use strict';\n\n")
  // After const/let/var declarations
  .replace(/(const|let|var) ([A-Z_]+ = )/g, '\n$1 $2')
  // After class definitions
  .replace(/class ([A-Z][a-zA-Z]+) \{/g, '\nclass $1 {')
  // After closing braces
  .replace(/\}(?=\s*(?:class|const|let|var|module|function|addKey|setActiveKey|getKey|getActiveKey|buildAAD|parseEnvelope|encrypt|decrypt|getStatus|rotateKey|reencrypt|createFromEnv|module))/g, '}\n')
  // After semicolons that end statements (not in for loops)
  .replace(/;(\s*)([A-Z_])/g, ';\n$1$2')
  // After closing braces of objects
  .replace(/(\{[^}]*\})/g, (m) => m.includes('\n') ? m : m.replace(/,/g, ',\n  '))
  // Module exports
  .replace(/module\.exports = \{/g, '\nmodule.exports = {')
  // Ensure double newlines between major sections
  .replace(/\n{3,}/g, '\n\n')
  // Clean up multiple newlines
  .replace(/\n{3,}/g, '\n\n');

console.log('Fixed length:', fixed.length);
console.log('LF count after:', (fixed.match(/\n/g) || []).length);

// Write back
require('fs').writeFileSync('C:\\Users\\ASUS\\Desktop\\etpl_ops\\backend\\services\\crypto\\fieldEncryption.js', fixed, 'utf8');
console.log('Fixed line endings written');