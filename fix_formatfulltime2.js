const fs = require('fs');
let c = fs.readFileSync('C:\\Users\\ASUS\\Desktop\\etpl_ops\\frontend\\src\\pages\\WorkspaceChat.js', 'utf8');

// The formatFullTime function is missing its closing brace
// Find the formatFullTime function
const formatFullTimeIdx = c.indexOf('function formatFullTime(dateStr) {');
const afterFunc = c.substring(formatFullTimeIdx);
const returnIdx = afterFunc.indexOf('minute: \'2-digit\'');
const afterReturn = afterFunc.substring(returnIdx);
const nextLineIdx = afterReturn.indexOf('\n');

if (c.indexOf('  }\n', c.indexOf('function formatFullTime')) === -1) {
  // Missing closing brace, add it after the return statement
  const returnEndIdx = c.indexOf('minute: \'2-digit\'') + 'minute: \'2-digit\''.length;
  c = c.slice(0, returnEndIdx) + '\n  }\n' + c.slice(returnEndIdx);
  console.log('Added missing closing brace for formatFullTime');
} else {
  console.log('Closing brace already exists');
}

fs.writeFileSync('C:\\Users\\ASUS\\Desktop\\etpl_ops\\frontend\\src\\pages\\WorkspaceChat.js', c);