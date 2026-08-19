import { useEffect, useState } from 'react';
import { Box, Button, Dialog, DialogTitle, DialogContent, DialogActions, Typography, Alert } from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

export default function AIConfirmationDialog({ open, confirmation, onConfirm, onCancel }) {
  const [loading, setLoading] = useState(false);

  if (!open || !confirmation) return null;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm(confirmation.confirmationId);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} maxWidth="md" fullWidth onClose={onCancel}>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {confirmation.tool?.destructive ? <WarningIcon color="warning" /> : <CheckCircleIcon color="primary" />}
          <Typography variant="h6">Confirm Action</Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Typography sx={{ mb: 2 }}>{confirmation.message}</Typography>
        <Alert severity={confirmation.tool?.destructive ? 'warning' : 'info'} variant="filled" sx={{ mb: 2 }}>
          <strong>Tool:</strong> {confirmation.tool?.name || confirmation.tool}
          <br />
          <strong>Parameters:</strong> {JSON.stringify(confirmation.parameters, null, 2)}
        </Alert>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={loading} variant="outlined">
          Cancel
        </Button>
        <Button onClick={handleConfirm} disabled={loading} variant="contained" color={confirmation.tool?.destructive ? 'error' : 'primary'}>
          {loading ? 'Confirming...' : 'Confirm'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}