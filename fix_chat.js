const fs = require('fs');
const path = require('path');

const filePath = path.join('C:', 'Users', 'ASUS', 'Desktop', 'etpl_ops', 'frontend', 'src', 'pages', 'WorkspaceChat.js');
let content = fs.readFileSync(filePath, 'utf8');

// Find the closing of the component and add dialog before it
const oldEnding = `);
  }
}

function formatTime(dateStr) {`;

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

if (content.includes(oldEnding)) {
  content = content.replace(oldEnding, newEnding);
  fs.writeFileSync(filePath, content);
  console.log('Fixed!');
} else {
  console.log('Pattern not found');
  // Show what we're looking for
  const idx = content.indexOf(');');
  if (idx > 0) {
    console.log('Found at:', content.substring(idx, idx + 50));
  }
}