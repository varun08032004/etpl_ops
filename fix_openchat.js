const fs = require('fs');
let c = fs.readFileSync('C:\\Users\\ASUS\\Desktop\\etpl_ops\\frontend\\src\\pages\\Workspaces.js', 'utf8');

// Add the openWorkspaceChat function after the imports
const oldCode = `export default function Workspaces() {`;

const newCode = `const openWorkspaceChat = (workspaceId) => {
  window.location.href = \`/workspaces/\${workspaceId}/chat\`;
};

export default function Workspaces() {`;

if (c.includes(oldCode)) {
  c = c.replace(oldCode, newCode);
  console.log('Added openWorkspaceChat function');
} else {
  console.log('Pattern not found');
}

fs.writeFileSync('C:\\Users\\ASUS\\Desktop\\etpl_ops\\frontend\\src\\pages\\Workspaces.js', c);