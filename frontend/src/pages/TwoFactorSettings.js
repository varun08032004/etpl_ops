import { useState, useEffect } from 'react';
import { Box, Paper, Typography, TextField, Button, Alert, Divider, Chip } from '@mui/material';
import client from '../api/client';

export default function TwoFactorSettings() {
  const [enabled, setEnabled] = useState(null);
  const [setupData, setSetupData] = useState(null); // { qrCodeDataUrl, manualEntryKey }
  const [confirmToken, setConfirmToken] = useState('');
  const [backupCodes, setBackupCodes] = useState(null); // shown once after confirm
  const [disablePassword, setDisablePassword] = useState('');
  const [disableToken, setDisableToken] = useState('');
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadStatus = async () => {
    const { data } = await client.get('/auth/2fa/status');
    setEnabled(data.enabled);
  };

  useEffect(() => { loadStatus(); }, []);

  const startSetup = async () => {
    setMessage(null);
    setLoading(true);
    try {
      const { data } = await client.post('/auth/2fa/setup');
      setSetupData(data);
    } catch (err) {
      setMessage({ severity: 'error', text: err.response?.data?.error || 'Failed to start setup' });
    } finally {
      setLoading(false);
    }
  };

  const confirmSetup = async (e) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    try {
      const { data } = await client.post('/auth/2fa/confirm', { token: confirmToken });
      setBackupCodes(data.backupCodes);
      setSetupData(null);
      setConfirmToken('');
      setEnabled(true);
    } catch (err) {
      setMessage({ severity: 'error', text: err.response?.data?.error || 'Incorrect code' });
    } finally {
      setLoading(false);
    }
  };

  const disable2fa = async (e) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    try {
      await client.post('/auth/2fa/disable', { password: disablePassword, token: disableToken });
      setEnabled(false);
      setDisablePassword('');
      setDisableToken('');
      setMessage({ severity: 'success', text: 'Two-factor authentication disabled.' });
    } catch (err) {
      setMessage({ severity: 'error', text: err.response?.data?.error || 'Failed to disable' });
    } finally {
      setLoading(false);
    }
  };

  if (enabled === null) return null;

  return (
    <Box sx={{ maxWidth: 480 }}>
      <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', mb: 0.5 }}>Two-Factor Authentication</Typography>
      <Typography sx={{ color: 'text.secondary', fontSize: '0.85rem', mb: 3 }}>
        Requires a code from an authenticator app (Google Authenticator, Authy, 1Password, etc.) in addition to your password on every login.
      </Typography>

      {message && <Alert severity={message.severity} sx={{ mb: 2 }}>{message.text}</Alert>}

      {backupCodes && (
        <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: 'rgba(255,180,0,0.06)' }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', mb: 1 }}>
            Save these backup codes now — shown only once
          </Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: '0.8rem', mb: 1.5 }}>
            Each one lets you sign in a single time if you lose access to your authenticator app. Store them somewhere safe (password manager, not a screenshot on the same phone).
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {backupCodes.map((code) => <Chip key={code} label={code} sx={{ fontFamily: 'monospace' }} />)}
          </Box>
          <Button sx={{ mt: 2 }} variant="contained" onClick={() => setBackupCodes(null)}>Done, I've saved these</Button>
        </Paper>
      )}

      {!backupCodes && enabled && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography sx={{ fontSize: '0.9rem', mb: 2 }}>
            <Chip label="Enabled" color="success" size="small" sx={{ mr: 1 }} />
            2FA is currently protecting this account.
          </Typography>
          <Divider sx={{ my: 2 }} />
          <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', mb: 1 }}>Disable 2FA</Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: '0.8rem', mb: 2 }}>
            Requires your password and a current authenticator code — this can't be turned off with just a logged-in session.
          </Typography>
          <form onSubmit={disable2fa}>
            <TextField
              fullWidth label="Current password" type="password" value={disablePassword}
              onChange={(e) => setDisablePassword(e.target.value)} margin="dense" required
            />
            <TextField
              fullWidth label="Authenticator code" value={disableToken}
              onChange={(e) => setDisableToken(e.target.value)} margin="dense" required
            />
            <Button type="submit" color="error" variant="outlined" sx={{ mt: 1.5 }} disabled={loading}>
              {loading ? 'Disabling…' : 'Disable 2FA'}
            </Button>
          </form>
        </Paper>
      )}

      {!backupCodes && !enabled && !setupData && (
        <Button variant="contained" onClick={startSetup} disabled={loading}>
          {loading ? 'Starting…' : 'Set up two-factor authentication'}
        </Button>
      )}

      {!backupCodes && setupData && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography sx={{ fontSize: '0.85rem', mb: 2 }}>
            Scan this with your authenticator app, or enter the key manually:
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <img src={setupData.qrCodeDataUrl} alt="2FA QR code" width={200} height={200} />
          </Box>
          <Typography sx={{ fontFamily: 'monospace', fontSize: '0.8rem', textAlign: 'center', mb: 2, wordBreak: 'break-all' }}>
            {setupData.manualEntryKey}
          </Typography>
          <form onSubmit={confirmSetup}>
            <TextField
              fullWidth label="Enter the 6-digit code to confirm" value={confirmToken}
              onChange={(e) => setConfirmToken(e.target.value)} margin="dense" required autoFocus
            />
            <Button fullWidth type="submit" variant="contained" sx={{ mt: 1.5 }} disabled={loading}>
              {loading ? 'Confirming…' : 'Confirm & enable'}
            </Button>
          </form>
        </Paper>
      )}
    </Box>
  );
}