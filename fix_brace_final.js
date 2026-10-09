const fs = require('fs');
let c = fs.readFileSync('C:\\Users\\ASUS\\Desktop\\etpl_ops\\frontend\\src\\pages\\WorkspaceChat.js', 'utf8');

// Fix: Add missing closing brace for formatFullTime function
// The formatFullTime function ends with a return statement but is missing the closing brace
// Find the formatFullTime function
const formatFullTimeIdx = c.indexOf('function formatFullTime(dateStr) {');
const afterFunc = c.substring(formatFullTimeIdx);

// Find the end of the function - after the return statement
const returnIdx = c.indexOf('minute: \'2-digit\'', formatFullTimeIdx);
const returnEndIdx = c.indexOf('minute: \'2-digit\'') + 'minute: \'2-digit\''.length;

// Check if there's a closing brace after the return
const afterReturn = c.substring(c.indexOf('minute: \'2-digit\'') + 'minute: \'2-digit\''.length, c.indexOf('minute: \'2-digit\'') + 100);

if (!c.includes('  }\n', c.indexOf('function formatFullTime'))) {
  // Missing closing brace, add it after the return statement
  const returnEndIdx = c.indexOf('minute: \'2-digit\'') + 'minute: \'2-digit\''.length;
  c = c.slice(0, returnEndIdx) + '\n  }\n' + c.slice(returnEndIdx);
  console.log('Added missing closing brace for formatFullTime');
} else {
  console.log('Closing brace already exists');
}

fs.writeFileSync('C:\\Users\\ASUS\\Desktop\\etpl_ops\\frontend\\src\\pages\\WorkspaceChat.js', c);