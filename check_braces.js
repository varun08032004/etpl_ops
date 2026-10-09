const fs = require('fs');
let c = fs.readFileSync('C:\\Users\\ASUS\\Desktop\\etpl_ops\\frontend\\src\\pages\\WorkspaceChat.js', 'utf8');

let braceCount = 0;
let inJSX = false;
let inString = false;
let stringChar = '';

for (let i = 0; i < c.length; i++) {
  const char = c[i];
  const next = c[i+1];
  
  // Track JSX tags
  if (char === '<' && c[i+1] !== '/' && c[i+1] !== '!' && c[i+1] !== '?') {
    if (!inString) inJSX = true;
  } else if (char === '<' && c[i+1] === '/') {
    if (!inString) inJSX = false;
  }
  
  // Track string literals
  if (!inJSX && (char === '"' || char === "'" || char === '`')) {
    if (!inString) {
      inString = true;
      stringChar = char;
    } else if (char === stringChar) {
      inString = false;
    }
  }
  
  // Count braces only in JS code (not in JSX)
  if (!inJSX && !inString) {
    if (char === '{') braceCount++;
    else if (char === '}') braceCount--;
  }
}

console.log('Final brace count:', braceCount);