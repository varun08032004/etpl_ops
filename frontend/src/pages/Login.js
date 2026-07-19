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
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
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