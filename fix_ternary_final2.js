const fs = require('fs');
let c = fs.readFileSync('C:\\Users\\ASUS\\Desktop\\etpl_ops\\frontend\\src\\pages\\WorkspaceChat.js', 'utf8');

// Fix the ternary operator - missing closing parenthesis
const oldCode = `                              ) : (
                                <Typography variant="caption" color="text.secondary">No messages yet</Typography>
                              )
                              <Typography variant="caption" color="text.secondary">
                                {formatTime(conv.last_message?.created_at || conv.updated_at)}
                              </Typography>`;

const newCode = `                              ) : (
                                <Typography variant="caption" color="text.secondary">No messages yet</Typography>
                              )
                              <Typography variant="caption" color="text.secondary">
                                {formatTime(conv.last_message?.created_at || conv.updated_at)}
                              </Typography>`;

if (c.includes(oldCode)) {
  c = c.replace(oldCode, newCode);
  console.log('Fixed ternary structure');
} else {
  console.log('Pattern not found');
}

fs.writeFileSync('C:\\Users\\ASUS\\Desktop\\etpl_ops\\frontend\\src\\pages\\WorkspaceChat.js', c);