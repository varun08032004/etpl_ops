const fs = require('fs');
let c = fs.readFileSync('C:\\Users\\ASUS\\Desktop\\etpl_ops\\frontend\\src\\pages\\WorkspaceChat.js', 'utf8');

// Find the component end - the }); that closes the WorkspaceChat component
const formatTimeIdx = c.indexOf('function formatTime');
const componentEnd = c.lastIndexOf('});', formatTimeIdx - 1);

console.log('Component ends at:', c.lastIndexOf('});', formatTimeIdx - 1));

// Find the last </Box> before component end - this is the main container close
const lastBoxEnd = c.lastIndexOf('</Box>', componentEnd);
console.log('Last </Box> before component end:', lastBoxEnd);

// Insert the dialog right before this </Box>
const dialogCode = `
      {/* New Conversation Dialog */}
      <Dialog open={newConvDialog} onClose={() => setNewConvDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Start New Conversation</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary">Search for an employee to start a direct message</Typography>
          </Box>
          <TextField
            fullWidth
            size="small"
            placeholder="Search employees..."
            value={newConvSearch}
            onChange={(e) => setNewConvSearch(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon color="action" />
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewConvDialog(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>`;

c = c.slice(0, lastBoxEnd) + dialogCode + c.slice(lastBoxEnd);
fs.writeFileSync('C:\\Users\\ASUS\\Desktop\\etpl_ops\\frontend\\src\\pages\\WorkspaceChat.js', c);
console.log('Done! Inserted dialog before last </Box>');