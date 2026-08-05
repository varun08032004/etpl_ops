import { useEffect, useState } from 'react';
import { Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody, Chip, MenuItem, TextField, Alert } from '@mui/material';
import client from '../api/client';

const STATUS_COLOR = { open: 'error', in_progress: 'warning', resolved: 'success', closed: 'default' };
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function SupportTicketsView() {
  const [status, setStatus] = useState('open');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    client.get('/support-tickets-view', { params: { status: status === 'all' ? undefined : status } })
      .then(({ data }) => setData(data))
      .catch((err) => setError(err.response?.data?.error || 'Failed to load tickets'))
      .finally(() => setLoading(false));
  }, [status]);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
        <Box>
          <Typography variant="h5">Support Tickets</Typography>
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mt: 0.5 }}>
            Read-only view of ethertrack.in support tickets — ticket handling still happens on the platform.
          </Typography>
        </Box>
        <TextField select size="small" label="Status" value={status} onChange={(e) => setStatus(e.target.value)} sx={{ width: 160 }}>
          <MenuItem value="all">All</MenuItem>
          <MenuItem value="open">Open</MenuItem>
          <MenuItem value="in_progress">In Progress</MenuItem>
          <MenuItem value="resolved">Resolved</MenuItem>
          <MenuItem value="closed">Closed</MenuItem>
        </TextField>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {data && (data.openCount > 0) && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {data.openCount} open/in-progress ticket{data.openCount !== 1 ? 's' : ''}
          {data.corporateOpenCount > 0 ? ` — ${data.corporateOpenCount} from Corporate account${data.corporateOpenCount !== 1 ? 's' : ''}` : ''}.
        </Alert>
      )}

      <Paper variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Ticket #</TableCell>
              <TableCell>From</TableCell>
              <TableCell>Subject</TableCell>
              <TableCell>Account</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Priority</TableCell>
              <TableCell>Opened</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && (
              <TableRow><TableCell colSpan={7} sx={{ textAlign: 'center', color: 'text.secondary', py: 4 }}>Loading…</TableCell></TableRow>
            )}
            {!loading && !data?.tickets?.length && (
              <TableRow><TableCell colSpan={7} sx={{ textAlign: 'center', color: 'text.secondary', py: 4 }}>No tickets in this window</TableCell></TableRow>
            )}
            {data?.tickets?.map((t) => (
              <TableRow key={t.id} hover>
                <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{t.ticket_number}</TableCell>
                <TableCell sx={{ fontSize: '0.8rem' }}>{t.name}<br /><span style={{ color: '#888', fontSize: '0.72rem' }}>{t.email}</span></TableCell>
                <TableCell sx={{ fontSize: '0.8rem' }}>{t.subject || '—'}</TableCell>
                <TableCell sx={{ fontSize: '0.78rem' }}>
                  {t.corporate_managed
                    ? <Chip size="small" color="primary" label={t.company_name || 'Corporate'} />
                    : (t.subscription_plan && t.subscription_plan !== 'free' ? <span style={{ textTransform: 'capitalize' }}>{t.subscription_plan}</span> : '—')}
                </TableCell>
                <TableCell><Chip size="small" label={t.status.replace('_', ' ')} color={STATUS_COLOR[t.status] || 'default'} sx={{ textTransform: 'capitalize' }} /></TableCell>
                <TableCell sx={{ fontSize: '0.8rem', textTransform: 'capitalize' }}>{t.priority || '—'}</TableCell>
                <TableCell sx={{ fontSize: '0.8rem' }}>{fmtDate(t.created_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}