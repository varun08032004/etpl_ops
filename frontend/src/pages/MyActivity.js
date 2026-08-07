import { useEffect, useState } from 'react';
import { Box, Typography, Paper, Table, TableBody, TableRow, TableCell, TextField, Alert, CircularProgress, Grid } from '@mui/material';
import client from '../api/client';

function fmtDuration(seconds) {
  if (!seconds) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

// Self-service mirror of Monitoring.js's drilldown — same data shape, scoped
// server-side to the caller's own employee_id so there's no way to browse
// anyone else's activity from this screen even by tampering with requests.
export default function MyActivity() {
  const [date, setDate] = useState(today());
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setReport(null);
    setError('');
    client.get('/monitoring/me/day', { params: { date } })
      .then(({ data }) => setReport(data))
      .catch((e) => setError(e.response?.data?.error || 'Failed to load your activity'));
  }, [date]);

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 0.5 }}>My Activity</Typography>
      <Typography sx={{ color: 'text.secondary', fontSize: '0.85rem', mb: 2.5 }}>
        What the desktop agent recorded for you — visible to you the same way it's visible to HR.
      </Typography>

      <TextField size="small" type="date" label="Date" InputLabelProps={{ shrink: true }} value={date} onChange={(e) => setDate(e.target.value)} sx={{ mb: 2.5 }} />

      {error && <Alert severity="error">{error}</Alert>}
      {!report && !error && <CircularProgress size={22} />}

      {report && report.sessions.length === 0 && (
        <Alert severity="info">No agent session recorded for {date}.</Alert>
      )}

      {report && report.sessions.length > 0 && (
        <>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={6} sm={3}>
              <Paper sx={{ p: 2 }}>
                <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Worked</Typography>
                <Typography sx={{ fontSize: '1.3rem', fontWeight: 600 }}>
                  {fmtDuration(report.sessions.reduce((s, x) => s + x.active_seconds, 0))}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Paper sx={{ p: 2 }}>
                <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Idle</Typography>
                <Typography sx={{ fontSize: '1.3rem', fontWeight: 600 }}>
                  {fmtDuration(report.sessions.reduce((s, x) => s + x.idle_seconds, 0))}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Paper sx={{ p: 2 }}>
                <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Productive</Typography>
                <Typography sx={{ fontSize: '1.3rem', fontWeight: 600 }}>{report.productivity.productivePct}%</Typography>
              </Paper>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Paper sx={{ p: 2 }}>
                <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Score</Typography>
                <Typography sx={{ fontSize: '1.3rem', fontWeight: 600 }}>{report.score.score}</Typography>
                <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary' }}>{report.score.label}</Typography>
              </Paper>
            </Grid>
          </Grid>

          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mb: 2.5 }}>
            Focus {report.score.breakdown.focus} · Engagement {report.score.breakdown.engagement} · Attendance {report.score.breakdown.attendance}
          </Typography>

          <Grid container spacing={2.5}>
            <Grid item xs={12} md={6}>
              <Typography sx={{ fontWeight: 600, mb: 1 }}>Applications</Typography>
              <Paper>
                <Table size="small">
                  <TableBody>
                    {report.apps.map((a) => (
                      <TableRow key={a.app_name}>
                        <TableCell sx={{ fontSize: '0.85rem' }}>{a.app_name}</TableCell>
                        <TableCell align="right" sx={{ fontSize: '0.85rem' }}>{fmtDuration(a.duration_seconds)}</TableCell>
                      </TableRow>
                    ))}
                    {report.apps.length === 0 && <TableRow><TableCell sx={{ color: 'text.secondary', textAlign: 'center', py: 2 }}>Nothing recorded.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography sx={{ fontWeight: 600, mb: 1 }}>Websites</Typography>
              <Paper>
                <Table size="small">
                  <TableBody>
                    {report.websites.map((w) => (
                      <TableRow key={w.domain}>
                        <TableCell sx={{ fontSize: '0.85rem' }}>{w.domain}</TableCell>
                        <TableCell align="right" sx={{ fontSize: '0.85rem' }}>{fmtDuration(w.duration_seconds)}</TableCell>
                      </TableRow>
                    ))}
                    {report.websites.length === 0 && <TableRow><TableCell sx={{ color: 'text.secondary', textAlign: 'center', py: 2 }}>Nothing recorded.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </Paper>
            </Grid>
          </Grid>
        </>
      )}
    </Box>
  );
}