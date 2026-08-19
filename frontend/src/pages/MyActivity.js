import { useEffect, useState } from 'react';
import { Box, Typography, Paper, Table, TableBody, TableRow, TableCell, TextField, Alert, CircularProgress } from '@mui/material';
import client from '../api/client';
import {
  MobilePaper,
  MobilePageHeader,
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

export default function MyActivity() {
  const isMobile = useMobile();
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
      <MobilePageHeader>
        <Typography variant={isMobile ? 'h6' : 'h5'} sx={{ mb: 0 }}>My Activity</Typography>
      </MobilePageHeader>

      <MobilePaper sx={{ mb: 2 }}>
        <Typography sx={{ color: 'text.secondary', fontSize: isMobile ? '0.75rem' : '0.85rem', mb: 1.5 }}>
          What the desktop agent recorded for you — visible to you the same way it's visible to HR.
        </Typography>
        <TextField size="small" type="date" label="Date" InputLabelProps={{ shrink: true }} value={date} onChange={(e) => setDate(e.target.value)} />
      </MobilePaper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {!report && !error && <CircularProgress size={22} sx={{ my: 3 }} />}

      {report && report.sessions.length === 0 && (
        <MobilePaper>
          <Alert severity="info">No agent session recorded for {date}.</Alert>
        </MobilePaper>
      )}

      {report && report.sessions.length > 0 && (
        <>
          <MobileCardGrid sx={{ mb: 3 }}>
            <MobilePaper>
              <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary' }}>Worked</Typography>
              <Typography sx={{ fontSize: isMobile ? '1.1rem' : '1.3rem', fontWeight: 600 }}>
                {fmtDuration(report.sessions.reduce((s, x) => s + x.active_seconds, 0))}
              </Typography>
            </MobilePaper>
            <MobilePaper>
              <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary' }}>Idle</Typography>
              <Typography sx={{ fontSize: isMobile ? '1.1rem' : '1.3rem', fontWeight: 600 }}>
                {fmtDuration(report.sessions.reduce((s, x) => s + x.idle_seconds, 0))}
              </Typography>
            </MobilePaper>
            <MobilePaper>
              <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary' }}>Productive</Typography>
              <Typography sx={{ fontSize: isMobile ? '1.1rem' : '1.3rem', fontWeight: 600 }}>{report.productivity.productivePct}%</Typography>
            </MobilePaper>
            <MobilePaper>
              <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary' }}>Score</Typography>
              <Typography sx={{ fontSize: isMobile ? '1.1rem' : '1.3rem', fontWeight: 600 }}>{report.score.score}</Typography>
              <Typography sx={{ fontSize: isMobile ? '0.6rem' : '0.68rem', color: 'text.secondary' }}>{report.score.label}</Typography>
            </MobilePaper>
          </MobileCardGrid>

          <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'text.secondary', mb: 2 }}>
            Focus {report.score.breakdown.focus} · Engagement {report.score.breakdown.engagement} · Attendance {report.score.breakdown.attendance}
            <br />
            Score = 55% Focus + 25% Engagement + 20% Attendance.
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <MobilePaper>
              <Typography sx={{ fontWeight: 600, mb: 1, fontSize: isMobile ? '0.85rem' : '1rem' }}>Applications</Typography>
              <ResponsiveTableContainer>
                <Table size="small">
                  <TableBody>
                    {report.apps.map((a) => (
                      <TableRow key={a.app_name}>
                        <TableCell sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem' }}>{a.app_name}</TableCell>
                        <TableCell align="right" sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem' }}>{fmtDuration(a.duration_seconds)}</TableCell>
                      </TableRow>
                    ))}
                    {report.apps.length === 0 && <TableRow><TableCell sx={{ color: 'text.secondary', textAlign: 'center', py: 2 }}>Nothing recorded.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </ResponsiveTableContainer>
            </MobilePaper>
            <MobilePaper>
              <Typography sx={{ fontWeight: 600, mb: 1, fontSize: isMobile ? '0.85rem' : '1rem' }}>Websites</Typography>
              <ResponsiveTableContainer>
                <Table size="small">
                  <TableBody>
                    {report.websites.map((w) => (
                      <TableRow key={w.domain}>
                        <TableCell sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem' }}>{w.domain}</TableCell>
                        <TableCell align="right" sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem' }}>{fmtDuration(w.duration_seconds)}</TableCell>
                      </TableRow>
                    ))}
                    {report.websites.length === 0 && <TableRow><TableCell sx={{ color: 'text.secondary', textAlign: 'center', py: 2 }}>Nothing recorded.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </ResponsiveTableContainer>
            </MobilePaper>
          </Box>
        </>
      )}
    </Box>
  );
}