const fs = require('fs');
let c = fs.readFileSync('C:\\Users\\ASUS\\Desktop\\etpl_ops\\frontend\\src\\pages\\WorkspaceChat.js', 'utf8');

// The component function ends prematurely at position ~9496
// It should end after the main return (at ~35108)

// Find the premature closing pattern
const prematurePattern = '});\n  };\n\n  const isMyMessage';
const prematureIdx = c.indexOf('});\n  };\n\n  const isMyMessage');

if (prematureIdx === -1) {
  console.log('Premature pattern not found');
  process.exit(1);
}

console.log('Found premature end at:', prematureIdx);

// Replace the premature closing with just the helper function
const oldPattern = '});\n  };\n\n  const isMyMessage';
const newPattern = '  const isMyMessage';

if (c.includes('});\n  };\n\n  const isMyMessage')) {
  c = c.replace('});\n  };\n\n  const isMyMessage', '  const isMyMessage');
  console.log('Removed premature closing');
} else {
  console.log('Premature pattern not found exactly');
}

// Now add the component closing after the main return
// The main return ends at ~35108 with );
// Find the main return end
const formatTimeIdx = c.indexOf('function formatTime');
const mainReturnEnd = c.lastIndexOf(');', c.indexOf('function formatTime') - 1);
console.log('Main return ends at:', c.lastIndexOf(');', c.indexOf('function formatTime') - 1));

// Add the component closing after the main return
const mainReturnEndIdx = c.lastIndexOf(');', c.indexOf('function formatTime') - 1);
if (mainReturnEndIdx > 0) {
  c = c.slice(0, mainReturnEndIdx + 2) + '\n};\n' + c.slice(mainReturnEndIdx + 2);
  console.log('Added component closing after main return');
}

fs.writeFileSync('C:\\Users\\ASUS\\Desktop\\etpl_ops\\frontend\\src\\pages\\WorkspaceChat.js', c);
console.log('Fixed component structure');