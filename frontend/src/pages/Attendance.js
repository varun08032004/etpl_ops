import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  TextField, MenuItem, Button, Alert, Grid, Chip, CircularProgress,
} from '@mui/material';
import SyncOutlinedIcon from '@mui/icons-material/SyncOutlined';
import client from '../api/client';
import StatusChip from '../components/StatusChip';

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

const STATUS_ORDER = ['present', 'half_day', 'absent', 'on_leave'];

export default function Attendance() {
  const [employees, setEmployees] = useState([]);
  const [employeeId, setEmployeeId] = useState('');
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const [records, setRecords] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);

  useEffect(() => {
    client.get('/employees').then(({ data }) => setEmployees(data.employees || [])).catch(() => setEmployees([]));
  }, []);

  const load = () => {
    setLoading(true);
    setError(null);
    const params = { from, to };
    if (employeeId) params.employee_id = employeeId;
    client.get('/attendance', { params })
      .then(({ data }) => setRecords(data.attendance || []))
      .catch((e) => setError(e.response?.data?.error || 'Failed to load attendance'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [employeeId, from, to]);

  const runSync = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const syncMonth = Number(to.slice(5, 7));
      const syncYear = Number(to.slice(0, 4));
      const { data } = await client.post('/attendance/sync/trackpilot', { month: syncMonth, year: syncYear });
      setSyncMessage({ severity: 'success', text: data.message || 'Sync complete.' });
      load();
    } catch (e) {
      setSyncMessage({ severity: 'warning', text: e.response?.data?.error || 'Sync failed — see server logs.' });
    } finally {
      setSyncing(false);
    }
  };

  const employeeName = (id) => employees.find((e) => e.id === id)?.full_name || '—';

  const counts = STATUS_ORDER.reduce((acc, s) => {
    acc[s] = (records || []).filter((r) => r.status === s).length;
    return acc;
  }, {});

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">Attendance</Typography>
        <Button
          variant="outlined"
          startIcon={syncing ? <CircularProgress size={16} /> : <SyncOutlinedIcon />}
          onClick={runSync}
          disabled={syncing}
        >
          {syncing ? 'Syncing…' : 'Sync from TrackPilot'}
        </Button>
      </Box>

      <Typography sx={{ color: 'text.secondary', fontSize: '0.85rem', mb: 2.5 }}>
        Sourced from Trackpilots (Section 18.2). "Sync from Trackpilots" pulls the whole month
        containing your "To" date — Trackpilots reports monthly, not by arbitrary range. New
        employees are auto-linked by matching their work email to their Trackpilots login on first sync.
      </Typography>

      {syncMessage && <Alert severity={syncMessage.severity} sx={{ mb: 2.5 }}>{syncMessage.text}</Alert>}

      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2.5, flexWrap: 'wrap' }}>
        <TextField select size="small" label="Employee" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} sx={{ minWidth: 220 }}>
          <MenuItem value="">All employees</MenuItem>
          {employees.map((e) => <MenuItem key={e.id} value={e.id}>{e.full_name}</MenuItem>)}
        </TextField>
        <TextField size="small" type="date" label="From" InputLabelProps={{ shrink: true }} value={from} onChange={(e) => setFrom(e.target.value)} />
        <TextField size="small" type="date" label="To" InputLabelProps={{ shrink: true }} value={to} onChange={(e) => setTo(e.target.value)} />
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2.5 }}>{error}</Alert>}

      {records && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {STATUS_ORDER.map((s) => (
            <Grid item xs={6} sm={3} key={s}>
              <Paper sx={{ p: 2 }}>
                <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', textTransform: 'capitalize' }}>{s.replace('_', ' ')}</Typography>
                <Typography sx={{ fontSize: '1.3rem', fontWeight: 600 }}>{counts[s]}</Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}

      {loading && <CircularProgress size={22} />}

      {!loading && records && (
        <Paper>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                {!employeeId && <TableCell>Employee</TableCell>}
                <TableCell>Status</TableCell>
                <TableCell>Clock in</TableCell>
                <TableCell>Clock out</TableCell>
                <TableCell align="right">Active</TableCell>
                <TableCell align="right">Idle</TableCell>
                <TableCell>Source</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {records.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="figure" sx={{ fontSize: '0.8rem' }}>{r.work_date?.slice(0, 10)}</TableCell>
                  {!employeeId && <TableCell sx={{ fontSize: '0.8rem' }}>{employeeName(r.employee_id)}</TableCell>}
                  <TableCell><StatusChip status={r.status} /></TableCell>
                  <TableCell sx={{ fontSize: '0.8rem' }}>{fmtTime(r.clock_in)}</TableCell>
                  <TableCell sx={{ fontSize: '0.8rem' }}>{fmtTime(r.clock_out)}</TableCell>
                  <TableCell align="right" sx={{ fontSize: '0.8rem' }}>{fmtDuration(r.active_seconds)}</TableCell>
                  <TableCell align="right" sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>{fmtDuration(r.idle_seconds)}</TableCell>
                  <TableCell><Chip size="small" label={r.source || 'manual'} variant="outlined" /></TableCell>
                </TableRow>
              ))}
              {records.length === 0 && (
                <TableRow><TableCell colSpan={employeeId ? 7 : 8} sx={{ textAlign: 'center', color: 'text.secondary', py: 4 }}>
                  No attendance records for this range.
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Box>
  );
}