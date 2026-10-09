const fs = require('fs');
let c = fs.readFileSync('C:\\Users\\ASUS\\Desktop\\etpl_ops\\frontend\\src\\pages\\WorkspaceChat.js', 'utf8');

// The component function ends prematurely
// Find the premature closing pattern
const prematurePattern = '});\n  };\n\n  const isMyMessage';
const prematureIdx = c.indexOf('});\n  };\n\n  const isMyMessage');

if (c.includes('});\n  };\n\n  const isMyMessage')) {
  c = c.replace('});\n  };\n\n  const isMyMessage', '  const isMyMessage');
  console.log('Removed premature closing');
} else {
  console.log('Premature pattern not found exactly');
}

// Now find the main return end and add component closing
const formatTimeIdx = c.indexOf('function formatTime');
const mainReturnEndIdx = c.lastIndexOf(');', c.indexOf('function formatTime') - 1);

if (mainReturnEndIdx > 0) {
  c = c.slice(0, mainReturnEndIdx + 2) + '\n};\n' + c.slice(mainReturnEndIdx + 2);
  console.log('Added component closing after main return');
} else {
  console.log('Main return end not found');
}

fs.writeFileSync('C:\\Users\\ASUS\\Desktop\\etpl_ops\\frontend\\src\\pages\\WorkspaceChat.js', c);
console.log('Fixed component structure');