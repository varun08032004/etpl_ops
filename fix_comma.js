const fs = require('fs');
let c = fs.readFileSync('C:\\Users\\ASUS\\Desktop\\etpl_ops\\frontend\\src\\pages\\WorkspaceChat.js', 'utf8');

// Fix: Add missing comma after the closing brace of the return object in formatFullTime
const oldCode = `    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
  }

  }

      const isMyMessage`;

const newCode = `    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
  }, // Added missing comma here
  }

      const isMyMessage`;

if (c.includes(oldCode)) {
  c = c.replace(oldCode, newCode);
  console.log('Fixed missing comma in formatFullTime');
} else {
  console.log('Pattern not found');
}

fs.writeFileSync('C:\\Users\\ASUS\\Desktop\\etpl_ops\\frontend\\src\\pages\\WorkspaceChat.js', c);