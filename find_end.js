const fs = require('fs');
let c = fs.readFileSync('C:\\Users\\ASUS\\Desktop\\etpl_ops\\frontend\\src\\pages\\WorkspaceChat.js', 'utf8');

// Find the component's closing });
const formatTimeIdx = c.indexOf('function formatTime');
const componentEnd = c.lastIndexOf('});', formatTimeIdx - 1);

console.log('Component ends at:', c.lastIndexOf('});', formatTimeIdx - 1));
console.log('Context:', c.substring(c.lastIndexOf('});', formatTimeIdx - 1) - 200, c.lastIndexOf('});', formatTimeIdx - 1) + 100));