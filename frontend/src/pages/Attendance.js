import { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  TextField, MenuItem, Button, Alert, Chip, CircularProgress,
} from '@mui/material';
import SyncOutlinedIcon from '@mui/icons-material/SyncOutlined';
import client from '../api/client';
import StatusChip from '../components/StatusChip';
import {
  MobilePaper,
  MobilePageHeader,
  MobileFormGrid,
  MobileActionButtons,
  ResponsiveTableContainer,
  MobileCardGrid,
  MobileButton,
  MobileTextField,
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

const STATUS_ORDER = ['present', 'half_day', 'absent', 'on_leave'];

export default function Attendance() {
  const isMobile = useMobile();
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

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = { from, to };
    if (employeeId) params.employee_id = employeeId;
    client.get('/attendance', { params })
      .then(({ data }) => setRecords(data.attendance || []))
      .catch((e) => setError(e.response?.data?.error || 'Failed to load attendance'))
      .finally(() => setLoading(false));
  }, [employeeId, from, to]);

  useEffect(() => { load(); }, [load]);

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
      <MobilePageHeader>
        <Typography variant={isMobile ? 'h6' : 'h5'}>Attendance</Typography>
        <MobileButton
          variant="outlined"
          size="small"
          startIcon={syncing ? <CircularProgress size={16} /> : <SyncOutlinedIcon />}
          onClick={runSync}
          disabled={syncing}
        >
          {syncing ? 'Syncing…' : 'Sync from TrackPilot'}
        </MobileButton>
      </MobilePageHeader>

      <MobilePaper sx={{ mb: 2 }}>
        <Typography sx={{ color: 'text.secondary', fontSize: isMobile ? '0.7rem' : '0.85rem', mb: 2 }}>
          Sourced from Trackpilots (Section 18.2). "Sync from Trackpilots" pulls the whole month
          containing your "To" date — Trackpilots reports monthly, not by arbitrary range. New
          employees are auto-linked by matching their work email to their Trackpilots login on first sync.
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
                <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary' }}>Half Day</Typography>
                <Typography className="figure" sx={{ fontSize: isMobile ? '1.5rem' : '2rem', fontWeight: 600, color: 'warning.main' }}>{counts.half_day || 0}</Typography>
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
                      <TableCell>Source</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {records.map((r) => (
                      <TableRow key={r.id} hover>
                        <TableCell>{employeeName(r.employee_id)}</TableCell>
                        <TableCell className="figure">{r.date}</TableCell>
                        <TableCell className="figure">{fmtTime(r.check_in)}</TableCell>
                        <TableCell className="figure">{fmtTime(r.check_out)}</TableCell>
                        <TableCell className="figure">{fmtDuration(r.duration_seconds)}</TableCell>
                        <TableCell><StatusChip status={r.status} /></TableCell>
                        <TableCell><Chip size="small" label={r.source || 'manual'} variant="outlined" /></TableCell>
                      </TableRow>
                    ))}
                    {!records.length && <TableRow><TableCell colSpan={7} sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}>No attendance records for this period.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </ResponsiveTableContainer>
            </MobilePaper>
          </>
        )}
      </MobilePaper>
    </Box>
  );
}