const fs = require('fs');
let c = fs.readFileSync('C:\\Users\\ASUS\\Desktop\\etpl_ops\\frontend\\src\\pages\\WorkspaceChat.js', 'utf8');

// The component function ends prematurely at position 9496
// It should end after the main return (at ~35108)
// The premature end has: }); };
// We need to remove the premature closing and add proper closing after the main return

// Find the premature closing pattern
const prematurePattern = `});
  };

  const isMyMessage`;
const prematureIdx = c.indexOf('});
  };

  const isMyMessage');

if (prematureIdx === -1) {
  console.log('Premature pattern not found');
  process.exit(1);
}

console.log('Found premature end at:', c.indexOf('});
  };

  const isMyMessage'));

// Remove the premature closing
// Replace "});\n  };\n\n  const isMyMessage" with just "\n  const isMyMessage"
const oldPattern = `});
  };

  const isMyMessage`;
const newPattern = `  const isMyMessage`;

if (c.includes(oldPattern)) {
  c = c.replace(oldPattern, newPattern);
  console.log('Removed premature closing');
} else {
  console.log('Premature pattern not found');
}

// Now find the main return end and add proper closing there
const mainReturnEnd = 35108;
// The main return ends with: );
// We need to add the component closing after that
// Find the exact position
const mainReturnEndIdx = 35108;
// The main return ends with: );
// We need to add: ); } after that

// Find the exact end of main return
const mainReturnEndIdx2 = c.indexOf(');', 35100);
console.log('Main return ends at:', c.indexOf(');', 35100));

// Add the component closing after the main return
// The main return ends with: );
// We need to add: ); } after that
const mainReturnEndPattern = `      </Dialog>
      </Box>
    );
  }
}

function formatTime`;

const formatTimeIdx = c.indexOf('function formatTime');
const mainReturnEndPattern2 = c.substring(c.lastIndexOf('});', 35108), formatTimeIdx);
console.log('Between main return end and formatTime:', c.substring(c.lastIndexOf('});', 35108), formatTimeIdx).substring(0, 200));

// Add the component closing after the main return
const afterMainReturn = c.lastIndexOf('});', 35108);
c = c.slice(0, afterMainReturn + 2) + `\n` + c.slice(afterMainReturn + 2);

fs.writeFileSync('C:\\Users\\ASUS\\Desktop\\etpl_ops\\frontend\\src\\pages\\WorkspaceChat.js', c);
console.log('Fixed component structure');