const fs = require('fs');
let c = fs.readFileSync('C:\\Users\\ASUS\\Desktop\\etpl_ops\\frontend\\src\\pages\\Workspaces.js', 'utf8');

// Fix duplicate imports
const oldImports = `import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';`;

const newImports = `import client from '../api/client';
import { useAuth } from '../context/AuthContext';`;

if (c.includes(oldImports)) {
  c = c.replace(oldImports, newImports);
  console.log('Fixed duplicate imports');
} else {
  console.log('Pattern not found');
}

fs.writeFileSync('C:\\Users\\ASUS\\Desktop\\etpl_ops\\frontend\\src\\pages\\Workspaces.js', c);