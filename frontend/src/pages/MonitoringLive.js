import { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Table, TableHead, TableRow, TableCell, TableBody,
  Alert, Chip, IconButton, Tooltip, Badge,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import VisibilityIcon from '@mui/icons-material/Visibility';
import {
  MobilePaper,
  MobilePageHeader,
  MobileCardGrid,
  ResponsiveTableContainer,
  MobileButton,
  useMobile,
} from '../components/MobileResponsive';
import client from '../api/client';
import StatusChip from '../components/StatusChip';

function fmtDuration(seconds) {
  if (seconds == null) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function fmtTime(t) {
  if (!t) return '—';
  return new Date(t).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export default function MonitoringLive() {
  const isMobile = useMobile();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: res } = await client.get('/monitoring/live');
      setData(res);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load live data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    if (!autoRefresh) return;
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load, autoRefresh]);

  const employees = data?.employees || [];
  const onlineCount = employees.filter((e) => e.is_online).length;
  const totalCount = employees.length;

  return (
    <Box>
      <MobilePageHeader>
        <Typography variant={isMobile ? 'h6' : 'h5'}>Live Monitoring</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Tooltip title={autoRefresh ? 'Auto-refresh: ON (30s)' : 'Auto-refresh: OFF'}>
            <IconButton
              onClick={() => setAutoRefresh((v) => !v)}
              color={autoRefresh ? 'primary' : 'default'}
              size="small"
            >
              <Badge badgeContent={autoRefresh ? '●' : ''} color={autoRefresh ? 'success' : 'default'}>
                <RefreshIcon fontSize="small" />
              </Badge>
            </IconButton>
          </Tooltip>
          <MobileButton variant="outlined" onClick={load} disabled={loading} startIcon={<RefreshIcon />}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </MobileButton>
        </Box>
      </MobilePageHeader>

      <MobileCardGrid sx={{ mb: 3 }}>
        <MobilePaper>
          <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary' }}>Online Now</Typography>
          <Typography className="figure" sx={{ fontSize: isMobile ? '1.5rem' : '2rem', fontWeight: 600, color: 'success.main' }}>{onlineCount}</Typography>
        </MobilePaper>
        <MobilePaper>
          <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary' }}>Total Active</Typography>
          <Typography className="figure" sx={{ fontSize: isMobile ? '1.5rem' : '2rem', fontWeight: 600 }}>{totalCount}</Typography>
        </MobilePaper>
        <MobilePaper>
          <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary' }}>Offline</Typography>
          <Typography className="figure" sx={{ fontSize: isMobile ? '1.5rem' : '2rem', fontWeight: 600, color: 'text.secondary' }}>{totalCount - onlineCount}</Typography>
        </MobilePaper>
      </MobileCardGrid>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <MobilePaper>
        <ResponsiveTableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Employee</TableCell>
                <TableCell>Dept</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Session</TableCell>
                <TableCell>Clock In</TableCell>
                <TableCell>Active</TableCell>
                <TableCell>Idle</TableCell>
                <TableCell>Current App</TableCell>
                <TableCell>Current Domain</TableCell>
                <TableCell>Last Heartbeat</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {employees.map((e) => (
                <TableRow key={e.employee_id} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip
                        size="small"
                        variant="dot"
                        color={e.is_online ? 'success' : 'default'}
                        icon={<VisibilityIcon fontSize="10px" />}
                      />
                      <Box>
                        <Typography sx={{ fontSize: '0.85rem', fontWeight: 500 }}>{e.full_name}</Typography>
                        <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>{e.work_email}</Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>{e.department || '—'}</TableCell>
                  <TableCell>
                    <StatusChip status={e.session_status || 'closed'} />
                  </TableCell>
                  <TableCell>
                    {e.session_id ? (
                      <Tooltip title={`Session ID: ${e.session_id}`}>
                        <Chip size="small" label={e.end_reason || 'open'} variant="outlined" />
                      </Tooltip>
                    ) : '—'}
                  </TableCell>
                  <TableCell>{fmtTime(e.clock_in)}</TableCell>
                  <TableCell className="figure">{fmtDuration(e.active_seconds)}</TableCell>
                  <TableCell className="figure">{fmtDuration(e.idle_seconds)}</TableCell>
                  <TableCell sx={{ fontSize: '0.75rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.current_app || '—'}
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.75rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.current_domain || '—'}
                  </TableCell>
                  <TableCell>{fmtTime(e.last_heartbeat_at)}</TableCell>
                </TableRow>
              ))}
              {!employees.length && <TableRow><TableCell colSpan={10} sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}>No active employees.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </ResponsiveTableContainer>
      </MobilePaper>
    </Box>
  );
}