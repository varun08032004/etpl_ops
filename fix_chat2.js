const fs = require('fs');
let content = fs.readFileSync('C:\\Users\\ASUS\\Desktop\\etpl_ops\\frontend\\src\\pages\\WorkspaceChat.js', 'utf8');

// Find the end of the component (before formatTime function)
const formatTimeIndex = content.indexOf('function formatTime(dateStr) {');
const componentEnd = content.lastIndexOf('});', formatTimeIndex - 1);

if (componentEnd > 0) {
  const newEnding = `);

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
      </Dialog>
    </Box>
  );
  }
}

function formatTime(dateStr) {`;

  const oldEnding = content.substring(componentEnd, formatTimeIndex);
  if (content.includes(oldEnding)) {
    content = content.replace(oldEnding, newEnding);
    fs.writeFileSync('C:\\Users\\ASUS\\Desktop\\etpl_ops\\frontend\\src\\pages\\WorkspaceChat.js', content);
    console.log('Fixed!');
  } else {
    console.log('Pattern not found');
  }