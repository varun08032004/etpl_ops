import { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Alert, CircularProgress, Switch, FormControlLabel,
} from '@mui/material';
import {
  MobilePaper,
  MobilePageHeader,
  MobileFormGrid,
  MobileButton,
  MobileTextField,
  useMobile,
} from '../components/MobileResponsive';
import client from '../api/client';

export default function MonitoringSettings() {
  const isMobile = useMobile();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await client.get('/monitoring/settings');
      setSettings(data.settings || {});
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleChange = (key, value) => {
    setSettings((s) => ({ ...s, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await client.put('/monitoring/settings', settings);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (!settings && !loading) return null;

  return (
    <Box>
      <MobilePageHeader>
        <Typography variant={isMobile ? 'h6' : 'h5'}>Monitoring Settings</Typography>
        <MobileButton variant="contained" onClick={handleSave} disabled={saving || loading}>
          {saving ? 'Saving…' : 'Save Changes'}
        </MobileButton>
      </MobilePageHeader>

      {success && <Alert severity="success" sx={{ mb: 2 }}>Settings saved.</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <MobilePaper sx={{ mb: 2 }}>
        <Typography variant="subtitle1" sx={{ mb: 2 }}>Tracking</Typography>
        <MobileFormGrid>
          <FormControlLabel
            control={<Switch checked={settings.track_apps} onChange={(e) => handleChange('track_apps', e.target.checked)} />}
            label="Track Applications"
          />
          <FormControlLabel
            control={<Switch checked={settings.track_websites} onChange={(e) => handleChange('track_websites', e.target.checked)} />}
            label="Track Websites"
          />
          <FormControlLabel
            control={<Switch checked={settings.track_idle} onChange={(e) => handleChange('track_idle', e.target.checked)} />}
            label="Track Idle Time"
          />
        </MobileFormGrid>
      </MobilePaper>

      <MobilePaper sx={{ mb: 2 }}>
        <Typography variant="subtitle1" sx={{ mb: 2 }}>Screenshots</Typography>
        <MobileFormGrid>
          <FormControlLabel
            control={<Switch checked={settings.screenshots_enabled} onChange={(e) => handleChange('screenshots_enabled', e.target.checked)} />}
            label="Enable Screenshots"
          />
          <FormControlLabel
            control={<Switch checked={settings.blur_screenshots} onChange={(e) => handleChange('blur_screenshots', e.target.checked)} />}
            label="Blur Sensitive Content"
          />
          <MobileTextField
            type="number"
            label="Screenshot Interval (seconds)"
            value={settings.screenshot_interval_sec || 300}
            onChange={(e) => handleChange('screenshot_interval_sec', Number(e.target.value))}
            min={60}
            max={3600}
            fullWidth
          />
        </MobileFormGrid>
      </MobilePaper>

      <MobilePaper sx={{ mb: 2 }}>
        <Typography variant="subtitle1" sx={{ mb: 2 }}>Heartbeat & Idle</Typography>
        <MobileFormGrid>
          <MobileTextField
            type="number"
            label="Heartbeat Interval (seconds)"
            value={settings.heartbeat_interval_seconds || 30}
            onChange={(e) => handleChange('heartbeat_interval_seconds', Number(e.target.value))}
            min={10}
            max={300}
            fullWidth
          />
          <MobileTextField
            type="number"
            label="Idle Threshold (seconds)"
            value={settings.idle_threshold_seconds || 300}
            onChange={(e) => handleChange('idle_threshold_seconds', Number(e.target.value))}
            min={60}
            max={1800}
            fullWidth
          />
        </MobileFormGrid>
      </MobilePaper>

      <MobilePaper sx={{ mb: 2 }}>
        <Typography variant="subtitle1" sx={{ mb: 2 }}>Privacy & Consent</Typography>
        <MobileFormGrid>
          <FormControlLabel
            control={<Switch checked={settings.privacy_mode_default} onChange={(e) => handleChange('privacy_mode_default', e.target.checked)} />}
            label="Privacy Mode Default (agent starts with screenshots/apps off)"
          />
          <FormControlLabel
            control={<Switch checked={settings.restrict_incognito} onChange={(e) => handleChange('restrict_incognito', e.target.checked)} />}
            label="Block Tracking in Incognito/Private Windows"
          />
          <MobileTextField
            multiline
            rows={3}
            fullWidth
            label="Consent Notice (shown in agent)"
            value={settings.consent_notice || ''}
            onChange={(e) => handleChange('consent_notice', e.target.value)}
            placeholder="This device is monitored for productivity..."
          />
        </MobileFormGrid>
      </MobilePaper>

      <MobilePaper sx={{ mb: 2 }}>
        <Typography variant="subtitle1" sx={{ mb: 2 }}>Scoring</Typography>
        <MobileFormGrid>
          <MobileTextField
            type="number"
            label="Expected Daily Hours"
            value={settings.expected_daily_hours || 8}
            onChange={(e) => handleChange('expected_daily_hours', Number(e.target.value))}
            min={1}
            max={16}
            step={0.5}
            fullWidth
          />
        </MobileFormGrid>
      </MobilePaper>

      {loading && <CircularProgress size={22} />}
    </Box>
  );
}