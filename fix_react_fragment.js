const fs = require('fs');
let c = fs.readFileSync('C:\\Users\\ASUS\\Desktop\\etpl_ops\\frontend\\src\\pages\\WorkspaceChat.js', 'utf8');

// Replace the fragment with React.Fragment
const oldCode = `                              ) : (
                                <>
                                  <Typography variant="caption" color="text.secondary">No messages yet</Typography>
                                </>
                              )}
                            <Typography variant="caption" color="text.secondary">
                              {formatTime(conv.last_message?.created_at || conv.updated_at)}
                            </Typography>`;

const newCode = `                              ) : (
                                <React.Fragment>
                                  <Typography variant="caption" color="text.secondary">No messages yet</Typography>
                                </React.Fragment>
                              )}
                            <Typography variant="caption" color="text.secondary">
                              {formatTime(conv.last_message?.created_at || conv.updated_at)}
                            </Typography>`;

if (c.includes(oldCode)) {
  c = c.replace(oldCode, newCode);
  console.log('Fixed fragment syntax');
} else {
  console.log('Pattern not found');
}

fs.writeFileSync('C:\\Users\\ASUS\\Desktop\\etpl_ops\\frontend\\src\\pages\\WorkspaceChat.js', c);