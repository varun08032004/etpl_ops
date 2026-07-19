import { useState } from 'react';
import { useNavigate, useSearchParams, Link as RouterLink } from 'react-router-dom';
import { Box, Paper, TextField, Button, Typography, Alert, Link as MuiLink } from '@mui/material';
import client from '../api/client';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) { setError("Passwords don't match"); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }

    setLoading(true);
    try {
      await client.post('/auth/reset-password', { token, password });
      setDone(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default' }}>
      <Paper sx={{ width: 380, p: 4 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', mb: 0.5 }}>Reset your password</Typography>

        {!token ? (
          <Alert severity="error" sx={{ mt: 2 }}>
            This link is missing its reset token. Request a new one from the{' '}
            <MuiLink component={RouterLink} to="/login">sign-in page</MuiLink>.
          </Alert>
        ) : done ? (
          <Alert severity="success" sx={{ mt: 2 }}>Password updated — redirecting you to sign in…</Alert>
        ) : (
          <form onSubmit={handleSubmit}>
            <Typography sx={{ color: 'text.secondary', fontSize: '0.85rem', mb: 2, mt: 1 }}>
              Choose a new password — at least 8 characters.
            </Typography>
            <TextField
              fullWidth label="New password" type="password" value={password}
              onChange={(e) => setPassword(e.target.value)} margin="normal" required autoFocus
            />
            <TextField
              fullWidth label="Confirm new password" type="password" value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)} margin="normal" required
            />
            {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
            <Button fullWidth type="submit" variant="contained" size="large" sx={{ mt: 3 }} disabled={loading}>
              {loading ? 'Saving…' : 'Set new password'}
            </Button>
          </form>
        )}
      </Paper>
    </Box>
  );
}