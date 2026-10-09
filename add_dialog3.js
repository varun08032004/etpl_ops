const fs = require('fs');
let c = fs.readFileSync('C:\\Users\\ASUS\\Desktop\\etpl_ops\\frontend\\src\\pages\\WorkspaceChat.js', 'utf8');

// Remove any existing dialog between component end and isMyMessage
const isMyMessageIdx = c.indexOf('const isMyMessage');
const dialogStart = c.indexOf('{/* New Conversation Dialog */}');
if (dialogStart > 0 && dialogStart < c.indexOf('const isMyMessage')) {
  c = c.slice(0, dialogStart) + c.slice(c.indexOf('const isMyMessage'));
  console.log('Removed old dialog');
}

// Find the correct insertion point - before the main return ends
const formatTimeIdx = c.indexOf('function formatTime');
const insertAt = c.lastIndexOf('});', c.indexOf('function formatTime') - 1);

console.log('Inserting at:', insertAt);
console.log('Context:', c.substring(insertAt - 50, insertAt + 20));

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

c = c.slice(0, insertAt) + dialogCode + c.slice(insertAt);
fs.writeFileSync('C:\\Users\\ASUS\\Desktop\\etpl_ops\\frontend\\src\\pages\\WorkspaceChat.js', c);
console.log('Done!');