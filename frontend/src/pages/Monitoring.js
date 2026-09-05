import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Table, TableHead, TableRow, TableCell, TableBody,
  Chip, CircularProgress, Alert, TextField, Tooltip,
} from '@mui/material';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import client from '../api/client';
import {
  MobilePaper,
  MobilePageHeader,
  MobileFormGrid,
  MobileCardGrid,
  ResponsiveTableContainer,
  useMobile,
} from '../components/MobileResponsive';

function fmtDuration(seconds) {
  if (!seconds) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function Monitoring() {
  const isMobile = useMobile();
  const navigate = useNavigate();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [date, setDate] = useState(today());

  const load = () => {
    client.get('/monitoring/live')
      .then(({ data }) => setRows(data.employees || []))
      .catch((e) => setError(e.response?.data?.error || 'Failed to load monitoring data'));
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  const filtered = useMemo(
    () => (rows || []).filter((r) => r.full_name.toLowerCase().includes(search.toLowerCase())),
    [rows, search]
  );

  const onlineCount = (rows || []).filter((r) => r.is_online).length;

  const cards = [
    { title: 'Live Dashboard', desc: 'Real-time agent status — who\'s online, current app, active/idle totals', icon: '⚡', route: '/monitoring/live' },
    { title: 'Day Drilldown', desc: 'Sessions, apps, websites, idle periods & screenshots for any date', icon: '📅', route: '/monitoring/day' },
    { title: 'Productivity Rules', desc: 'Map apps/domains to categories (productive, neutral, distracting, blocked)', icon: '📋', route: '/monitoring/productivity-rules' },
    { title: 'Settings', desc: 'Company-wide toggles — tracking, screenshots, heartbeat, privacy, scoring', icon: '⚙️', route: '/monitoring/settings' },
    { title: 'Devices', desc: 'Registered agent devices — revoke lost/offboarded laptops', icon: '💻', route: '/monitoring/devices' },
    { title: 'Screenshots', desc: 'Browse screenshots by date/employee with full-size view', icon: '📸', route: '/monitoring/screenshots' },
  ];

  return (
    <Box>
      <MobilePageHeader>
        <Box>
          <Typography variant={isMobile ? 'h6' : 'h5'}>Monitoring</Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: isMobile ? '0.7rem' : '0.85rem', mt: 0.5 }}>
            EtherTrack Agent monitoring — live status, daily drilldowns, productivity rules & settings.
          </Typography>
        </Box>
        <Chip icon={<FiberManualRecordIcon sx={{ fontSize: 10 }} />} color="success" variant="outlined" label={`${onlineCount} online`} />
      </MobilePageHeader>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <MobileCardGrid sx={{ mb: 3 }}>
        {cards.map((c) => (
          <MobilePaper key={c.route} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', '&:hover': { borderColor: 'primary.main' } }}
            onClick={() => navigate(c.route)}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Typography sx={{ fontSize: '2rem' }}>{c.icon}</Typography>
              <Box>
                <Typography sx={{ fontWeight: 600, fontSize: isMobile ? '0.85rem' : '0.95rem' }}>{c.title}</Typography>
                <Typography sx={{ fontSize: isMobile ? '0.7rem' : '0.8rem', color: 'text.secondary' }}>{c.desc}</Typography>
              </Box>
            </Box>
            <NavigateNextIcon color="action" />
          </MobilePaper>
        ))}
      </MobileCardGrid>

      <MobileFormGrid sx={{ mb: 2, alignItems: 'center' }}>
        <TextField size="small" label="Search employee" value={search} onChange={(e) => setSearch(e.target.value)} sx={{ minWidth: isMobile ? '100%' : 240 }} />
        <TextField size="small" type="date" label="Drilldown date" InputLabelProps={{ shrink: true }} value={date} onChange={(e) => setDate(e.target.value)} />
      </MobileFormGrid>

      {!rows && !error && <CircularProgress size={22} sx={{ my: 3 }} />}

      {rows && (
        <MobilePaper>
          <ResponsiveTableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Employee</TableCell>
                  <TableCell>Department</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Current App</TableCell>
                  <TableCell>Current Site</TableCell>
                  <TableCell align="right">Worked</TableCell>
                  <TableCell align="right">Idle</TableCell>
                  <TableCell align="right">
                    <Tooltip title="55% Focus + 25% Engagement + 20% Attendance" arrow>
                      <Box component="span" sx={{ cursor: 'help', borderBottom: '1px dotted', borderColor: 'text.secondary' }}>Score</Box>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow
                    key={r.employee_id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/monitoring/day?employee_id=${r.employee_id}&date=${date}`)}
                  >
                    <TableCell sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem' }}>{r.full_name}</TableCell>
                    <TableCell sx={{ fontSize: isMobile ? '0.7rem' : '0.8rem', color: 'text.secondary' }}>{r.department || '—'}</TableCell>
                    <TableCell>
                      {r.is_online
                        ? <Chip size="small" color="success" label="Online" />
                        : r.session_status === 'closed'
                        ? r.end_reason === 'timeout'
                          ? <Chip size="small" color="warning" label="Stopped reporting" />
                          : r.end_reason === 'force_logout'
                            ? <Chip size="small" variant="outlined" label="Shutdown" />
                            : <Chip size="small" variant="outlined" label="Logged out" />
                        : <Chip size="small" variant="outlined" color="default" label="Offline" />}
                    </TableCell>
                    <TableCell sx={{ fontSize: isMobile ? '0.7rem' : '0.8rem' }}>{r.current_app || '—'}</TableCell>
                    <TableCell sx={{ fontSize: isMobile ? '0.7rem' : '0.8rem' }}>{r.current_domain || '—'}</TableCell>
                    <TableCell align="right" sx={{ fontSize: isMobile ? '0.7rem' : '0.8rem' }}>
                      {fmtDuration(r.active_seconds)}
                      {r.session_count > 1 && (
                        <Typography component="span" sx={{ fontSize: isMobile ? '0.6rem' : '0.68rem', color: 'text.secondary', ml: 0.75 }}>
                          ({r.session_count} sessions)
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right" sx={{ fontSize: isMobile ? '0.7rem' : '0.8rem', color: 'text.secondary' }}>{fmtDuration(r.idle_seconds)}</TableCell>
                    <TableCell align="right">
                      <Chip
                        size="small"
                        label={r.score}
                        color={r.score >= 85 ? 'success' : r.score >= 70 ? 'primary' : r.score >= 50 ? 'warning' : 'error'}
                        variant={r.score === 0 ? 'outlined' : 'filled'}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={8} sx={{ textAlign: 'center', color: 'text.secondary', py: 4 }}>
                    No employees found{search ? ' matching your search' : ' — no agent activity yet today'}.
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </ResponsiveTableContainer>
        </MobilePaper>
      )}
    </Box>
  );
}