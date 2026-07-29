import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Paper, TextField, Button, Typography, Alert, Link as MuiLink } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';

function ForgotPasswordForm({ onBackToLogin }) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const { data } = await client.post('/auth/forgot-password', { email });
      setMessage({ severity: 'success', text: data.message });
    } catch (err) {
      // Backend always returns 200 with a generic message for this route,
      // so a caught error here means something actually broke (network, 5xx).
      setMessage({ severity: 'error', text: 'Something went wrong — please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Typography sx={{ color: 'text.secondary', fontSize: '0.85rem', mb: 2 }}>
        Enter your email and we'll send you a link to reset your password.
      </Typography>
      <TextField
        fullWidth label="Email" type="email" value={email}
        onChange={(e) => setEmail(e.target.value)} margin="normal" required autoFocus
      />
      {message && <Alert severity={message.severity} sx={{ mt: 1 }}>{message.text}</Alert>}
      <Button fullWidth type="submit" variant="contained" size="large" sx={{ mt: 3 }} disabled={loading}>
        {loading ? 'Sending…' : 'Send reset link'}
      </Button>
      <Button fullWidth sx={{ mt: 1 }} onClick={onBackToLogin}>Back to sign in</Button>
    </form>
  );
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [awaitingTwoFactor, setAwaitingTwoFactor] = useState(false);
  const [awaitingDeviceApproval, setAwaitingDeviceApproval] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const { login, verifyDevice } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result.twoFactorRequired) {
        setAwaitingTwoFactor(true);
      } else if (result.deviceApprovalRequired) {
        setAwaitingDeviceApproval(true);
      } else {
        navigate('/');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleTwoFactorSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await login(email, password, twoFactorCode);
      if (result.deviceApprovalRequired) {
        setAwaitingTwoFactor(false);
        setAwaitingDeviceApproval(true);
      } else {
        navigate('/');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Incorrect code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyDevice = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await verifyDevice(email, otp, navigator.userAgent.slice(0, 100));
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default' }}>
      <Paper sx={{ width: 380, p: 4 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
          ETPL <Box component="span" sx={{ color: 'primary.main' }}>Ops</Box>
        </Typography>
        <Typography sx={{ color: 'text.secondary', fontSize: '0.85rem', mb: 3 }}>
          Sign in to EtherTrack Technologies internal tools
        </Typography>

        {forgotMode ? (
          <ForgotPasswordForm onBackToLogin={() => setForgotMode(false)} />
        ) : awaitingTwoFactor ? (
          <form onSubmit={handleTwoFactorSubmit}>
            <Typography sx={{ color: 'text.secondary', fontSize: '0.85rem', mb: 2 }}>
              Enter the 6-digit code from your authenticator app, or one of your backup codes.
            </Typography>
            <TextField
              fullWidth label="Authenticator or backup code" value={twoFactorCode}
              onChange={(e) => setTwoFactorCode(e.target.value)} margin="normal" required autoFocus
            />
            {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
            <Button fullWidth type="submit" variant="contained" size="large" sx={{ mt: 3 }} disabled={loading}>
              {loading ? 'Verifying…' : 'Verify & sign in'}
            </Button>
            <Button fullWidth sx={{ mt: 1 }} onClick={() => { setAwaitingTwoFactor(false); setTwoFactorCode(''); setError(''); }}>
              Back to sign in
            </Button>
          </form>
        ) : awaitingDeviceApproval ? (
          <form onSubmit={handleVerifyDevice}>
            <Typography sx={{ color: 'text.secondary', fontSize: '0.85rem', mb: 2 }}>
              This browser isn't recognized yet. Enter the approval code sent to {email}.
            </Typography>
            <TextField
              fullWidth label="Approval code" value={otp}
              onChange={(e) => setOtp(e.target.value)} margin="normal" required autoFocus
              inputProps={{ maxLength: 6, inputMode: 'numeric' }}
            />
            {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
            <Button fullWidth type="submit" variant="contained" size="large" sx={{ mt: 3 }} disabled={loading}>
              {loading ? 'Verifying…' : 'Approve device & sign in'}
            </Button>
            <Button fullWidth sx={{ mt: 1 }} onClick={() => { setAwaitingDeviceApproval(false); setOtp(''); setError(''); }}>
              Back to sign in
            </Button>
          </form>
        ) : (
          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth label="Email" type="email" value={email}
              onChange={(e) => setEmail(e.target.value)} margin="normal" required autoFocus
            />
            <TextField
              fullWidth label="Password" type="password" value={password}
              onChange={(e) => setPassword(e.target.value)} margin="normal" required
            />
            <Box sx={{ textAlign: 'right', mt: 0.5 }}>
              <MuiLink component="button" type="button" onClick={() => setForgotMode(true)} sx={{ fontSize: '0.8rem' }}>
                Forgot password?
              </MuiLink>
            </Box>
            {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
            <Button fullWidth type="submit" variant="contained" size="large" sx={{ mt: 3 }} disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        )}
      </Paper>
    </Box>
  );
}