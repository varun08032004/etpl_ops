const fs = require('fs');
let c = fs.readFileSync('C:\\Users\\ASUS\\Desktop\\etpl_ops\\frontend\\src\\pages\\WorkspaceChat.js', 'utf8');

// Fix the ternary operator - wrap the two branches in a fragment
const oldCode = `                              ) : (
                                <Box sx={{ p: 1.5, borderTop: 1, borderColor: 'divider' }}>
                  <MobileButton variant="outlined" fullWidth startIcon={<PersonAdd />} onClick={() => setNewConvDialog(true)}>
                    New Conversation
                  </MobileButton>
                </Box>
              </Box>`;

const newCode = `                              ) : (
                <>
                  <Box sx={{ p: 1.5, borderTop: 1, borderColor: 'divider' }}>
                    <MobileButton variant="outlined" fullWidth startIcon={<PersonAdd />} onClick={() => setNewConvDialog(true)}>
                      New Conversation
                    </MobileButton>
                  </Box>
                </>
              </Box>`;

if (c.includes(oldCode)) {
  c = c.replace(oldCode, newCode);
  console.log('Fixed ternary operator');
} else {
  console.log('Pattern not found');
}

fs.writeFileSync('C:\\Users\\ASUS\\Desktop\\etpl_ops\\frontend\\src\\pages\\WorkspaceChat.js', c);