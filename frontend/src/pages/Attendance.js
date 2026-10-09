import { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Table, TableHead, TableRow, TableCell, TableBody,
  Alert, Chip, CircularProgress, Tabs, Tab, IconButton,
  Tooltip, Badge, Paper, Card, CardContent, Grid, Divider,
  Avatar, List, ListItem, ListItemText, ListItemIcon, ListItemSecondaryAction,
  Accordion, AccordionSummary, AccordionDetails, ExpandMoreIcon,
  LinearProgress, Chip as MuiChip
} from '@mui/material';
import SyncOutlinedIcon from '@mui/icons-material/SyncOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import ScheduleIcon from '@mui/icons-material/Schedule';
import PersonIcon from '@mui/icons-material/Person';
import VisibilityIcon from '@mui/icons-material/Visibility';
import RefreshIcon from '@mui/icons-material/Refresh';
import client from '../api/client';
import StatusChip from '../components/StatusChip';
import { useAuth } from '../context/AuthContext';
import {
  MobilePaper,
  MobilePageHeader,
  MobileFormGrid,
  ResponsiveTableContainer,
  MobileCardGrid,
  MobileButton,
  MobileTextField,
  MobileStack,
  useMobile,
} from '../components/MobileResponsive';

function firstOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}
function today() {
  return new Date().toISOString().slice(0, 10);
}
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
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

const STATUS_ORDER = ['present', 'late', 'early_leave', 'half_day', 'absent', 'on_leave', 'weekend', 'wfh', 'holiday'];

export default function Attendance() {
  const isMobile = useMobile();
  const { staff } = useAuth();
  const canManage = ['owner', 'admin', 'hr'].includes(staff?.role);

  // Data states
  const [employees, setEmployees] = useState([]);
  const [employeeId, setEmployeeId] = useState('');
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const [records, setRecords] = useState(null);
  const [error, setError] = useState(null);

  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);

  // Live attendance state (read-only from agent)
  const [liveData, setLiveData] = useState(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedLiveDate, setSelectedLiveDate] = useState(today());

  // Leave approvals state
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [leaveLoading, setLeaveLoading] = useState(false);

  // Tabs
  const [tab, setTab] = useState(0);

  // Load employees
  useEffect(() => {
    client.get('/employees').then(({ data }) => setEmployees(data.employees || [])).catch(() => setEmployees([]));
  }, []);

  // Load historical records
  const load = useCallback(() => {
    setError(null);
    const params = { from, to };
    if (employeeId) params.employee_id = employeeId;
    client.get('/attendance', { params })
      .then(({ data }) => setRecords(data.attendance || []))
      .catch((e) => setError(e.response?.data?.error || 'Failed to load attendance'));
  }, [employeeId, from, to]);

  useEffect(() => { load(); }, [load]);

  // Load live attendance (read-only)
  const loadLive = useCallback(async () => {
    setLiveLoading(true);
    setLiveError(null);
    try {
      const endpoint = canManage ? '/attendance/live/date' : '/attendance/me/today';
      const params = canManage ? { date: selectedLiveDate } : {};
      const { data } = await client.get(endpoint, { params });
      setLiveData(data);
    } catch (e) {
      setLiveError(e.response?.data?.error || 'Failed to load live attendance');
    } finally {
      setLiveLoading(false);
    }
  }, [selectedLiveDate, canManage]);

  useEffect(() => {
    loadLive();
    if (!autoRefresh) return;
    const id = setInterval(loadLive, 30000);
    return () => clearInterval(id);
  }, [loadLive, autoRefresh]);

  // Load leave requests
  const loadLeaves = useCallback(async () => {
    if (!canManage) return;
    setLeaveLoading(true);
    try {
      const { data } = await client.get('/attendance/leave/pending');
      setLeaveRequests(data.leaveRequests || []);
    } catch (e) {
      console.error('Failed to load leave requests', e);
    } finally {
      setLeaveLoading(false);
    }
  }, [canManage]);

  useEffect(() => { loadLeaves(); }, [loadLeaves]);

  // Sync from agent
  const runSync = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const syncMonth = Number(to.slice(5, 7));
      const syncYear = Number(to.slice(0, 4));
      const { data } = await client.post('/attendance/sync/agent', { month: syncMonth, year: syncYear });
      setSyncMessage({ severity: 'success', text: data.message || 'Sync complete.' });
      load();
      loadLive();
    } catch (e) {
      setSyncMessage({ severity: 'warning', text: e.response?.data?.error || 'Sync failed — see server logs.' });
    } finally {
      setSyncing(false);
    }
  };

  // Approve leave
  const approveLeave = async (leaveId) => {
    try {
      await client.post(`/attendance/leave/${leaveId}/decision`, { decision: 'approved' });
      setLeaveRequests(leaveRequests.filter(l => l.id !== leaveId));
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to approve leave');
    }
  };

  // Reject leave
  const rejectLeave = async (leaveId) => {
    if (!window.confirm('Reject this leave request?')) return;
    try {
      await client.post(`/attendance/leave/${leaveId}/decision`, { decision: 'rejected' });
      setLeaveRequests(leaveRequests.filter(l => l.id !== leaveId));
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to reject leave');
    }
  };

  const employeeName = (id) => employees.find((e) => e.id === id)?.full_name || '—';

  const counts = records ? STATUS_ORDER.reduce((acc, s) => {
    acc[s] = records.filter((r) => r.status === s).length;
    return acc;
  }, {}) : {};

  const liveCounts = liveData?.summary || {
    total: 0, present: 0, active: 0, late: 0, early_leave: 0, absent: 0, not_punched_in: 0
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'present': return 'success';
      case 'late': return 'warning';
      case 'early_leave': return 'warning';
      case 'half_day': return 'info';
      case 'absent': return 'error';
      case 'on_leave': return 'info';
      default: return 'default';
    }
  };

  return (
    <Box>
      <MobilePageHeader>
        <Typography variant={isMobile ? 'h6' : 'h5'}>Attendance</Typography>
        <MobileStack gap={1} direction="row">
          <MobileButton
            variant="outlined"
            size="small"
            startIcon={syncing ? <CircularProgress size={16} /> : <SyncOutlinedIcon />}
            onClick={runSync}
            disabled={syncing}
          >
            {syncing ? 'Syncing…' : 'Sync from Agent'}
          </MobileButton>
          <Tooltip title={autoRefresh ? 'Auto-refresh: ON (30s)' : 'Auto-refresh: OFF'}>
            <IconButton
              onClick={() => setAutoRefresh(v => !v)}
              color={autoRefresh ? 'primary' : 'default'}
              size="small"
            >
              <Badge badgeContent={autoRefresh ? '●' : ''} color={autoRefresh ? 'success' : 'default'}>
                <RefreshIcon fontSize="small" />
              </Badge>
            </IconButton>
          </Tooltip>
        </MobileStack>
      </MobilePageHeader>

      {syncMessage && <Alert severity={syncMessage.severity} sx={{ mb: 2 }}>{syncMessage.text}</Alert>}

      <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ mb: 2 }} variant="scrollable" scrollButtons="auto">
        <Tab label="Live Today" icon={<VisibilityIcon />} />
        <Tab label="History" icon={<ScheduleIcon />} />
        {canManage && <Tab label="Leave Approvals" icon={<CheckCircleIcon />} />}
      </Tabs>

      {/* ========== LIVE TODAY TAB ========== */}
      {tab === 0 && (
        <MobilePaper sx={{ mb: 2 }}>
          {/* Info Banner */}
          <Alert severity="info" sx={{ mb: 2 }} icon={<span style={{fontSize:18}}>ℹ️</span>}>
            <strong>Attendance is tracked via EtherTrack Desktop Agent only.</strong>
            Employees must punch in/out through the installed agent on their work machine.
            Web portal is view-only. Working hours: Mon-Fri, 9:30 AM – 7:00 PM (15 min grace).
          </Alert>

          {/* Live Summary Cards */}
          <MobileCardGrid sx={{ mb: 3 }}>
            <MobilePaper>
              <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary' }}>Total Employees</Typography>
              <Typography className="figure" sx={{ fontSize: isMobile ? '1.5rem' : '2rem', fontWeight: 600 }}>{liveCounts.total}</Typography>
            </MobilePaper>
            <MobilePaper>
              <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary' }}>Completed (In + Out)</Typography>
              <Typography className="figure" sx={{ fontSize: isMobile ? '1.5rem' : '2rem', fontWeight: 600, color: 'success.main' }}>{liveCounts.present}</Typography>
            </MobilePaper>
            <MobilePaper>
              <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary' }}>Active Now (Punched In)</Typography>
              <Typography className="figure" sx={{ fontSize: isMobile ? '1.5rem' : '2rem', fontWeight: 600, color: 'primary.main' }}>{liveCounts.active}</Typography>
            </MobilePaper>
            <MobilePaper>
              <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary' }}>Late</Typography>
              <Typography className="figure" sx={{ fontSize: isMobile ? '1.5rem' : '2rem', fontWeight: 600, color: 'warning.main' }}>{liveCounts.late}</Typography>
            </MobilePaper>
            <MobilePaper>
              <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary' }}>Early Leave</Typography>
              <Typography className="figure" sx={{ fontSize: isMobile ? '1.5rem' : '2rem', fontWeight: 600, color: 'warning.main' }}>{liveCounts.early_leave}</Typography>
            </MobilePaper>
            <MobilePaper>
              <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary' }}>Not Punched In</Typography>
              <Typography className="figure" sx={{ fontSize: isMobile ? '1.5rem' : '2rem', fontWeight: 600, color: 'error.main' }}>{liveCounts.not_punched_in}</Typography>
            </MobilePaper>
            <MobilePaper>
              <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary' }}>Absent</Typography>
              <Typography className="figure" sx={{ fontSize: isMobile ? '1.5rem' : '2rem', fontWeight: 600, color: 'text.secondary' }}>{liveCounts.absent}</Typography>
            </MobilePaper>
          </MobileCardGrid>

          {/* Date selector for admin/hr */}
          {canManage && (
            <MobileFormGrid sx={{ mb: 2 }}>
              <MobileTextField
                size="small"
                type="date"
                label="View Date"
                InputLabelProps={{ shrink: true }}
                value={selectedLiveDate}
                onChange={(e) => setSelectedLiveDate(e.target.value)}
                max={today()}
              />
            </MobileFormGrid>
          )}

          {liveError && <Alert severity="error" sx={{ mb: 2 }}>{liveError}</Alert>}
          {liveLoading && <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>}

          {!liveLoading && liveData && (
            <MobilePaper>
              <ResponsiveTableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Employee</TableCell>
                      <TableCell>Department</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Punch In</TableCell>
                      <TableCell>Punch Out</TableCell>
                      <TableCell>Late</TableCell>
                      <TableCell>Early Leave</TableCell>
                      <TableCell>Source</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {liveData.employees?.map((e) => (
                      <TableRow key={e.employee_id} hover>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip size="small" variant="dot" color={e.clock_in ? (e.clock_out ? 'success' : 'primary') : 'default'} />
                            <Box>
                              <Typography sx={{ fontWeight: 500 }}>{e.full_name}</Typography>
                              <Typography variant="caption" color="text.secondary">{e.employee_code}</Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell>{e.department || '—'}</TableCell>
                        <TableCell>
                          <StatusChip status={e.status || (e.clock_in ? (e.clock_out ? 'present' : 'active') : 'absent')} />
                        </TableCell>
                        <TableCell>{fmtTime(e.clock_in)}</TableCell>
                        <TableCell>{fmtTime(e.clock_out)}</TableCell>
                        <TableCell>
                          {e.late_minutes > 0 ? (
                            <MuiChip size="small" label={`${e.late_minutes} min`} color="warning" variant="outlined" />
                          ) : '—'}
                        </TableCell>
                        <TableCell>
                          {e.early_leave_minutes > 0 ? (
                            <MuiChip size="small" label={`${e.early_leave_minutes} min`} color="warning" variant="outlined" />
                          ) : '—'}
                        </TableCell>
                        <TableCell>
                          <Chip size="small" label={e.source || '—'} variant="outlined" />
                        </TableCell>
                      </TableRow>
                    ))}
                    {!liveData.employees?.length && (
                      <TableRow>
                        <TableCell colSpan={8} sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}>
                          No attendance data for this date.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ResponsiveTableContainer>
            </MobilePaper>
          )}
        </MobilePaper>
      )}

      {/* ========== HISTORY TAB ========== */}
      {tab === 1 && (
        <MobilePaper sx={{ mb: 2 }}>
          <Typography sx={{ color: 'text.secondary', fontSize: isMobile ? '0.7rem' : '0.85rem', mb: 2 }}>
            Historical attendance records. Data synced from EtherTrack Desktop Agent.
          </Typography>

          {syncMessage && <Alert severity={syncMessage.severity} sx={{ mb: 2 }}>{syncMessage.text}</Alert>}

          <MobileFormGrid>
            <MobileTextField
              select
              size="small"
              label="Employee"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              options={[{ value: '', label: 'All employees' }, ...employees.map((e) => ({ value: e.id, label: e.full_name }))]}
            />
            <MobileTextField size="small" type="date" label="From" InputLabelProps={{ shrink: true }} value={from} onChange={(e) => setFrom(e.target.value)} />
            <MobileTextField size="small" type="date" label="To" InputLabelProps={{ shrink: true }} value={to} onChange={(e) => setTo(e.target.value)} />
          </MobileFormGrid>

          {error && <Alert severity="error" sx={{ mt: 2, mb: 2 }}>{error}</Alert>}

          {records && (
            <>
              <MobileCardGrid sx={{ mb: 3 }}>
                <MobilePaper>
                  <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary' }}>Present</Typography>
                  <Typography className="figure" sx={{ fontSize: isMobile ? '1.5rem' : '2rem', fontWeight: 600, color: 'success.main' }}>{counts.present || 0}</Typography>
                </MobilePaper>
                <MobilePaper>
                  <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary' }}>Late</Typography>
                  <Typography className="figure" sx={{ fontSize: isMobile ? '1.5rem' : '2rem', fontWeight: 600, color: 'warning.main' }}>{counts.late || 0}</Typography>
                </MobilePaper>
                <MobilePaper>
                  <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary' }}>Early Leave</Typography>
                  <Typography className="figure" sx={{ fontSize: isMobile ? '1.5rem' : '2rem', fontWeight: 600, color: 'warning.main' }}>{counts.early_leave || 0}</Typography>
                </MobilePaper>
                <MobilePaper>
                  <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary' }}>Half Day</Typography>
                  <Typography className="figure" sx={{ fontSize: isMobile ? '1.5rem' : '2rem', fontWeight: 600, color: 'info.main' }}>{counts.half_day || 0}</Typography>
                </MobilePaper>
                <MobilePaper>
                  <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary' }}>Absent</Typography>
                  <Typography className="figure" sx={{ fontSize: isMobile ? '1.5rem' : '2rem', fontWeight: 600, color: 'error.main' }}>{counts.absent || 0}</Typography>
                </MobilePaper>
                <MobilePaper>
                  <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary' }}>On Leave</Typography>
                  <Typography className="figure" sx={{ fontSize: isMobile ? '1.5rem' : '2rem', fontWeight: 600, color: 'info.main' }}>{counts.on_leave || 0}</Typography>
                </MobilePaper>
              </MobileCardGrid>

              <MobilePaper>
                <ResponsiveTableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Employee</TableCell>
                        <TableCell>Date</TableCell>
                        <TableCell>Check-in</TableCell>
                        <TableCell>Check-out</TableCell>
                        <TableCell>Duration</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Late</TableCell>
                        <TableCell>Early Leave</TableCell>
                        <TableCell>Source</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {records.map((r) => (
                        <TableRow key={r.id} hover>
                          <TableCell>{employeeName(r.employee_id)}</TableCell>
                          <TableCell className="figure">{r.date}</TableCell>
                          <TableCell className="figure">{fmtTime(r.clock_in)}</TableCell>
                          <TableCell className="figure">{fmtTime(r.clock_out)}</TableCell>
                          <TableCell className="figure">{fmtDuration(r.active_seconds)}</TableCell>
                          <TableCell><StatusChip status={r.status} /></TableCell>
                          <TableCell>{r.late_minutes > 0 ? `${r.late_minutes} min` : '—'}</TableCell>
                          <TableCell>{r.early_leave_minutes > 0 ? `${r.early_leave_minutes} min` : '—'}</TableCell>
                          <TableCell><Chip size="small" label={r.source || 'agent'} variant="outlined" /></TableCell>
                        </TableRow>
                      ))}
                      {!records.length && <TableRow><TableCell colSpan={9} sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}>No attendance records for this period.</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </ResponsiveTableContainer>
              </MobilePaper>
            </>
          )}
        </MobilePaper>
      )}

      {/* ========== LEAVE APPROVALS TAB ========== */}
      {tab === 2 && canManage && (
        <MobilePaper sx={{ mb: 2 }}>
          <Typography sx={{ color: 'text.secondary', fontSize: isMobile ? '0.7rem' : '0.85rem', mb: 2 }}>
            Pending leave requests requiring approval.
          </Typography>

          {leaveLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>
          ) : leaveRequests.length === 0 ? (
            <MobilePaper>
              <Typography sx={{ textAlign: 'center', color: 'text.secondary', py: 4 }}>
                No pending leave requests.
              </Typography>
            </MobilePaper>
          ) : (
            <List>
              {leaveRequests.map((lr) => (
                <Card key={lr.id} sx={{ mb: 2, variant: 'outlined' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'flex-start' }}>
                      <Box sx={{ flex: 1, minWidth: 200 }}>
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>{lr.employee_name}</Typography>
                        <Typography color="text.secondary" sx={{ mb: 1 }}>{lr.employee_code} • {lr.department_name || 'No Department'}</Typography>
                        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 1 }}>
                          <Chip size="small" label={lr.leave_type_name} color="info" variant="outlined" />
                          <Chip size="small" label={`${lr.num_days} day(s)`} color="primary" variant="outlined" />
                        </Box>
                        <Typography variant="body2" color="text.secondary">
                          {fmtDate(lr.start_date)} — {fmtDate(lr.end_date)}
                        </Typography>
                        {lr.reason && (
                          <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
                            "{lr.reason}"
                          </Typography>
                        )}
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column', alignItems: 'flex-end' }}>
                        <MobileButton variant="contained" color="success" onClick={() => approveLeave(lr.id)} size="small" startIcon={<CheckCircleIcon />}>
                          Approve
                        </MobileButton>
                        <MobileButton variant="outlined" color="error" onClick={() => rejectLeave(lr.id)} size="small" startIcon={<CancelIcon />}>
                          Reject
                        </MobileButton>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </List>
          )}
        </MobilePaper>
      )}
    </Box>
  );
}