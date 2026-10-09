const fs = require('fs');
let c = fs.readFileSync('C:\\Users\\ASUS\\Desktop\\etpl_ops\\frontend\\src\\pages\\WorkspaceChat.js', 'utf8');

// Fix the missing closing parenthesis in formatTime call
const oldCode = `                                {formatTime(conv.last_message?.created_at || conv.updated_at)}
                              </Typography>`;

const newCode = `                                {formatTime(conv.last_message?.created_at || conv.updated_at))}
                              </Typography>`;

if (c.includes(oldCode)) {
  c = c.replace(oldCode, newCode);
  console.log('Fixed missing parenthesis in formatTime call');
} else {
  console.log('Pattern not found');
}

fs.writeFileSync('C:\\Users\\ASUS\\Desktop\\etpl_ops\\frontend\\src\\pages\\WorkspaceChat.js', c);