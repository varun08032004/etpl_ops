import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, TextField, Button, Alert, Grid, Divider,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import TestIcon from '@mui/icons-material/Science';
import {
  MobilePaper,
  MobilePageHeader,
  MobileButton,
  MobileTextField,
  MobileStack,
  useMobile,
} from '../components/MobileResponsive';

export default function SlackBotConfig() {
  const isMobile = useMobile();
  const [config, setConfig] = useState({
    botToken: '',
    signingSecret: '',
    appToken: '',
    apiToken: '',
    allowedDomain: 'ethertrack.in',
  });
  const [status, setStatus] = useState({ connected: false, message: '' });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      // In production, this would load from backend config API
      // Config is stored in-memory; use environment variables for persistence
    } catch (err) {
      console.error('[SlackBotConfig] Load error:', err);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      // In production, would call backend API to save
      // For now, just keep in memory (resets on reload)
      setStatus({ connected: false, message: 'Configuration saved (in-memory). Use environment variables for production persistence.' });
    } catch (err) {
      setError('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setError('');
    try {
      // Test connection to Slack API
      const res = await fetch('https://slack.com/api/auth.test', {
        headers: { 'Authorization': `Bearer ${config.botToken}` },
      });
      const data = await res.json();
      if (data.ok) {
        setStatus({ connected: true, message: `Connected as ${data.user} (Team: ${data.team})` });
      } else {
        setStatus({ connected: false, message: `Failed: ${data.error}` });
      }
    } catch (err) {
      setStatus({ connected: false, message: `Error: ${err.message}` });
    } finally {
      setTesting(false);
    }
  };

  const handleChange = (key) => (e) => setConfig({ ...config, [key]: e.target.value });

  return (
    <Box>
      <MobilePageHeader>
        <Typography variant={isMobile ? 'h6' : 'h5'}>Slack Bot Configuration</Typography>
      </MobilePageHeader>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {status.message && (
        <Alert severity={status.connected ? 'success' : 'error'} sx={{ mb: 2 }}>
          {status.message}
        </Alert>
      )}

      <MobilePaper sx={{ mb: 3 }}>
        <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', textTransform: 'uppercase', mb: 2 }}>
          Bot Credentials
        </Typography>
        <MobileStack gap={2} direction="column">
          <MobileTextField
            fullWidth
            label="Bot User OAuth Token"
            type="password"
            value={config.botToken}
            onChange={handleChange('botToken')}
            helperText="xoxb-... from Slack App > OAuth & Permissions"
          />
          <MobileTextField
            fullWidth
            label="Signing Secret"
            type="password"
            value={config.signingSecret}
            onChange={handleChange('signingSecret')}
            helperText="From Slack App > Basic Information > App Credentials"
          />
          <MobileTextField
            fullWidth
            label="App-Level Token"
            type="password"
            value={config.appToken}
            onChange={handleChange('appToken')}
            helperText="xapp-... from Slack App > Basic Information > App-Level Tokens (socket_mode: true)"
          />
          <MobileTextField
            fullWidth
            label="Internal API Token (for /approve-invoice)"
            type="password"
            value={config.apiToken}
            onChange={handleChange('apiToken')}
            helperText="Bearer token for internal API calls"
          />
          <MobileTextField
            fullWidth
            label="Allowed Email Domain"
            value={config.allowedDomain}
            onChange={handleChange('allowedDomain')}
            helperText="Only users with this domain can use commands"
          />
        </MobileStack>
      </MobilePaper>

      <MobilePaper sx={{ mb: 3 }}>
        <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', textTransform: 'uppercase', mb: 2 }}>
          Slack App Setup Checklist
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <MobilePaper>
              <Typography sx={{ fontWeight: 600, mb: 1 }}>OAuth & Permissions</Typography>
              <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
                Scopes: commands, chat:write, channels:read, users:read, users:read.email, app_mentions:read
              </Typography>
            </MobilePaper>
          </Grid>
          <Grid item xs={12} sm={6}>
            <MobilePaper>
              <Typography sx={{ fontWeight: 600, mb: 1 }}>Event Subscriptions</Typography>
              <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
                Enable Events: app_mention, message.channels
                Request URL: https://your-domain.com/slack/events
              </Typography>
            </MobilePaper>
          </Grid>
          <Grid item xs={12} sm={6}>
            <MobilePaper>
              <Typography sx={{ fontWeight: 600, mb: 1 }}>Slash Commands</Typography>
              <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
                /mrr, /pipeline, /renewals, /health, /kpi, /approve-invoice, /etpl-help
              </Typography>
            </MobilePaper>
          </Grid>
          <Grid item xs={12} sm={6}>
            <MobilePaper>
              <Typography sx={{ fontWeight: 600, mb: 1 }}>Socket Mode</Typography>
              <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>
                Enable Socket Mode in App Settings
                App Token: connections:write
              </Typography>
            </MobilePaper>
          </Grid>
        </Grid>
      </MobilePaper>

      <MobilePaper>
        <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', textTransform: 'uppercase', mb: 2 }}>
          Actions
        </Typography>
        <MobileStack direction="row" gap={2} sx={{ flexWrap: 'wrap' }}>
          <MobileButton variant="contained" onClick={handleSave} startIcon={<SaveIcon />} disabled={saving}>
            {saving ? 'Saving…' : 'Save Configuration'}
          </MobileButton>
          <MobileButton variant="outlined" onClick={handleTest} startIcon={<TestIcon />} disabled={testing}>
            {testing ? 'Testing…' : 'Test Connection'}
          </MobileButton>
        </MobileStack>
      </MobilePaper>
    </Box>
  );
}