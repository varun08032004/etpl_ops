import { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Table, TableHead, TableRow, TableCell, TableBody,
  Alert, Chip, CircularProgress, IconButton, Tooltip,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import {
  MobilePaper,
  MobilePageHeader,
  ResponsiveTableContainer,
  MobileButton,
  useMobile,
} from '../components/MobileResponsive';
import client from '../api/client';

function fmtDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function MonitoringDevices() {
  const isMobile = useMobile();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [revoking, setRevoking] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await client.get('/monitoring/devices');
      setDevices(data.devices || []);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load devices');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRevoke = async (id) => {
    if (!window.confirm('Revoke this device? The agent will be logged out and cannot reconnect until re-enabled.')) return;
    setRevoking(id);
    try {
      await client.post(`/monitoring/devices/${id}/revoke`);
      load();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to revoke device');
    } finally {
      setRevoking(null);
    }
  };

  return (
    <Box>
      <MobilePageHeader>
        <Typography variant={isMobile ? 'h6' : 'h5'}>Agent Devices</Typography>
        <MobileButton variant="outlined" onClick={load} disabled={loading}>
          Refresh
        </MobileButton>
      </MobilePageHeader>

      <Typography sx={{ color: 'text.secondary', fontSize: isMobile ? '0.7rem' : '0.8rem', mb: 2 }}>
        Each row is an employee + device combination. Revoking logs the agent out immediately and prevents re-login until re-enabled by admin.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <MobilePaper>
        {loading ? (
          <CircularProgress size={22} sx={{ display: 'block', margin: 'auto', py: 4 }} />
        ) : (
          <ResponsiveTableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Employee</TableCell>
                  <TableCell>Device</TableCell>
                  <TableCell>OS</TableCell>
                  <TableCell>Agent Version</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Last Seen</TableCell>
                  <TableCell align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {devices.map((d) => (
                  <TableRow key={d.id} hover>
                    <TableCell>
                      <Box>
                        <Typography sx={{ fontWeight: 500 }}>{d.full_name}</Typography>
                        <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>{d.work_email}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>{d.device_name}</TableCell>
                    <TableCell>{d.os || '—'}</TableCell>
                    <TableCell>{d.agent_version || '—'}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={d.status}
                        color={d.status === 'active' ? 'success' : 'error'}
                        variant="outlined"
                        icon={d.status === 'active' ? <CheckCircleIcon fontSize="10px" /> : <BlockIcon fontSize="10px" />}
                      />
                    </TableCell>
                    <TableCell>{fmtDateTime(d.last_seen_at)}</TableCell>
                    <TableCell align="right">
                      {d.status === 'active' && (
                        <Tooltip title="Revoke device">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleRevoke(d.id)}
                            disabled={revoking === d.id}
                          >
                            {revoking === d.id ? <CircularProgress size={16} /> : <DeleteIcon fontSize="small" />}
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {!devices.length && <TableRow><TableCell colSpan={7} sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}>No devices registered.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </ResponsiveTableContainer>
        )}
      </MobilePaper>
    </Box>
  );
}