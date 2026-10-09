const fs = require('fs');
let c = fs.readFileSync('C:\\Users\\ASUS\\Desktop\\etpl_ops\\frontend\\src\\pages\\WorkspaceChat.js', 'utf8');

// Find the formatFullTime function and add missing closing brace
const formatFullTimeIdx = c.indexOf('function formatFullTime(dateStr) {');
const afterFunc = c.substring(formatFullTimeIdx);
const returnIdx = afterFunc.indexOf('minute: \'2-digit\'');
const afterReturn = afterFunc.substring(afterFunc.indexOf('minute: \'2-digit\'') + 'minute: \'2-digit\''.length);

// Check if there's a closing brace after the return
const afterReturnStart = formatFullTimeIdx + afterFunc.indexOf('minute: \'2-digit\'') + 'minute: \'2-digit\''.length;
const afterReturnText = c.substring(afterReturnStart, afterReturnStart + 200);

// Check if there's a closing brace after the return
const nextChars = c.substring(c.indexOf('minute: \'2-digit\'') + 'minute: \'2-digit\''.length, c.indexOf('minute: \'2-digit\'') + 100);
console.log('After return:', nextChars);

// Find the exact position after the return statement
const returnEndIdx = c.indexOf('minute: \'2-digit\'') + 'minute: \'2-digit\''.length;
const afterReturnText = c.substring(returnEndIdx, returnEndIdx + 50);
console.log('After return:', afterReturnText);

// Check if there's a closing brace
const hasClosingBrace = c.indexOf('  }\n', c.indexOf('function formatFullTime')) > c.indexOf('function formatFullTime');
console.log('Has closing brace:', hasClosingBrace);

if (!hasClosingBrace) {
  // Find the end of the return statement and add the closing brace
  const returnEndIdx = c.indexOf('minute: \'2-digit\'') + 'minute: \'2-digit\''.length;
  c = c.slice(0, returnEndIdx) + '\n  }\n' + c.slice(returnEndIdx);
  console.log('Added missing closing brace for formatFullTime');
} else {
  console.log('Closing brace already exists');
}

fs.writeFileSync('C:\\Users\\ASUS\\Desktop\\etpl_ops\\frontend\\src\\pages\\WorkspaceChat.js', c);