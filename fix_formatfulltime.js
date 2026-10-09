const fs = require('fs');
let c = fs.readFileSync('C:\\Users\\ASUS\\Desktop\\etpl_ops\\frontend\\src\\pages\\WorkspaceChat.js', 'utf8');

// The formatFullTime function is missing its closing brace
// Find the end of formatFullTime function
const formatFullTimeIdx = c.indexOf('function formatFullTime');
const afterFormatFullTime = c.substring(c.indexOf('function formatFullTime') + 50);

// Find the end of the function - it should be before the next function or end of file
// The function ends after the return statement's closing brace
const formatFullTimeEnd = c.indexOf('  }', c.indexOf('function formatFullTime') + 50);
console.log('formatFullTime end at:', c.indexOf('  }', c.indexOf('function formatFullTime') + 50));

// Actually, let's find the exact position
const formatFullTimeStart = c.indexOf('function formatFullTime(dateStr) {');
const afterFunc = c.substring(formatFullTimeStart);
const returnIdx = afterFunc.indexOf('return date.toLocaleString');
const afterReturn = afterFunc.substring(returnIdx);
const braceIdx = afterReturn.indexOf('  }');
console.log('Closing brace at:', formatFullTimeStart + returnIdx + braceIdx);

if (braceIdx === -1) {
  // Missing closing brace, add it
  const returnEnd = afterFunc.indexOf('minute: \'2-digit\'') + 'minute: \'2-digit\''.length;
  const insertAt = formatFullTimeStart + returnIdx + returnEnd;
  c = c.slice(0, insertAt) + '\n  }\n' + c.slice(insertAt);
  console.log('Added missing closing brace for formatFullTime');
} else {
  console.log('Closing brace found at:', formatFullTimeStart + returnIdx + braceIdx);
}

fs.writeFileSync('C:\\Users\\ASUS\\Desktop\\etpl_ops\\frontend\\src\\pages\\WorkspaceChat.js', c);