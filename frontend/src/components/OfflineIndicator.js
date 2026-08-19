import { useState, useEffect } from 'react';
import { Snackbar, Alert, Box, Typography } from '@mui/material';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import WifiIcon from '@mui/icons-material/Wifi';

function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setWasOffline(true);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && !wasOffline) return null;

  return (
    <Snackbar
      open={!isOnline || wasOffline}
      autoHideDuration={isOnline ? 4000 : 0}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      TransitionProps={{ timeout: 300 }}
    >
      <Alert
        severity={isOnline ? 'success' : 'warning'}
        sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1.5,
          width: '100%',
          maxWidth: 400,
          mx: 'auto',
          borderRadius: 2,
        }}
        iconMapping={{
          success: <span>🟢</span>,
          warning: <span>🔴</span>,
        }}
      >
        {isOnline ? (
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2" fontWeight={600}>Back online</Typography>
            <Typography variant="body2" color="text.secondary">Connection restored. Syncing data...</Typography>
          </Box>
        ) : (
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2" fontWeight={600}>You're offline</Typography>
            <Typography variant="body2" color="text.secondary">Changes will sync when connection restores.</Typography>
          </Box>
        )}
      </Alert>
    </Snackbar>
  );
}

export default OfflineIndicator;