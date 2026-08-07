import { useEffect, useState } from 'react';
import { Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody, Chip, MenuItem, TextField, Alert, Tabs, Tab } from '@mui/material';
import client from '../api/client';

const STATUS_COLOR = { open: 'error', in_progress: 'warning', resolved: 'success', closed: 'default', pending: 'warning', rejected: 'error', approved: 'success' };
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function SupportTicketsView() {
  const [status, setStatus] = useState('open');
  const [tab, setTab] = useState('tickets');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    client.get('/support-tickets-view', { params: { status: status === 'all' ? undefined : status } })
      .then(({ data }) => setData(data))
      .catch((err) => setError(err.response?.data?.error || 'Failed to load account health data'))
      .finally(() => setLoading(false));
  }, [status]);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
        <Box>
          <Typography variant="h5">Account Health</Typography>
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mt: 0.5 }}>
            Read-only view of ethertrack.in support tickets, disputes, and KYC status — handling still happens on the platform.
          </Typography>
        </Box>
        {tab === 'tickets' && (
          <TextField select size="small" label="Status" value={status} onChange={(e) => setStatus(e.target.value)} sx={{ width: 160 }}>
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="open">Open</MenuItem>
            <MenuItem value="in_progress">In Progress</MenuItem>
            <MenuItem value="resolved">Resolved</MenuItem>
            <MenuItem value="closed">Closed</MenuItem>
          </TextField>
        )}
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {data && (
        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          {data.openCount > 0 && (
            <Alert severity="warning" sx={{ flex: '1 1 260px' }}>
              {data.openCount} open ticket{data.openCount !== 1 ? 's' : ''}
              {data.corporateOpenCount > 0 ? ` (${data.corporateOpenCount} Corporate)` : ''}
            </Alert>
          )}
          {data.openDisputesCount > 0 && (
            <Alert severity="error" sx={{ flex: '1 1 260px' }}>
              {data.openDisputesCount} open dispute{data.openDisputesCount !== 1 ? 's' : ''}
            </Alert>
          )}
          {data.kycRejectedCount > 0 && (
            <Alert severity="info" sx={{ flex: '1 1 260px' }}>
              {data.kycRejectedCount} KYC rejection{data.kycRejectedCount !== 1 ? 's' : ''} in this window
            </Alert>
          )}
        </Box>
      )}

      <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab value="tickets" label={`Support Tickets${data ? ` (${data.tickets?.length || 0})` : ''}`} />
        <Tab value="disputes" label={`Disputes${data ? ` (${data.disputes?.length || 0})` : ''}`} />
        <Tab value="kyc" label={`KYC${data ? ` (${data.kycSubmissions?.length || 0})` : ''}`} />
      </Tabs>

      {tab === 'tickets' && (
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
              {loading && (<TableRow><TableCell colSpan={7} sx={{ textAlign: 'center', color: 'text.secondary', py: 4 }}>Loading…</TableCell></TableRow>)}
              {!loading && !data?.tickets?.length && (<TableRow><TableCell colSpan={7} sx={{ textAlign: 'center', color: 'text.secondary', py: 4 }}>No tickets in this window</TableCell></TableRow>)}
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
      )}

      {tab === 'disputes' && (
        <Paper variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Account</TableCell>
                <TableCell>Reason</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Opened</TableCell>
                <TableCell>Resolution</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && (<TableRow><TableCell colSpan={5} sx={{ textAlign: 'center', color: 'text.secondary', py: 4 }}>Loading…</TableCell></TableRow>)}
              {!loading && !data?.disputes?.length && (<TableRow><TableCell colSpan={5} sx={{ textAlign: 'center', color: 'text.secondary', py: 4 }}>No disputes in this window</TableCell></TableRow>)}
              {data?.disputes?.map((d) => (
                <TableRow key={d.id} hover>
                  <TableCell sx={{ fontSize: '0.8rem' }}>{d.full_name || d.email}<br /><span style={{ color: '#888', fontSize: '0.72rem' }}>{d.email}</span>
                    {d.corporate_managed && <Chip size="small" color="primary" label="Corporate" sx={{ ml: 1 }} />}
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.8rem' }}>{d.reason}</TableCell>
                  <TableCell><Chip size="small" label={d.status} color={STATUS_COLOR[d.status] || 'default'} sx={{ textTransform: 'capitalize' }} /></TableCell>
                  <TableCell sx={{ fontSize: '0.8rem' }}>{fmtDate(d.created_at)}</TableCell>
                  <TableCell sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>{d.resolution || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {tab === 'kyc' && (
        <Paper variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Account</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Rejection Reason</TableCell>
                <TableCell>Submitted</TableCell>
                <TableCell>Reviewed</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && (<TableRow><TableCell colSpan={5} sx={{ textAlign: 'center', color: 'text.secondary', py: 4 }}>Loading…</TableCell></TableRow>)}
              {!loading && !data?.kycSubmissions?.length && (<TableRow><TableCell colSpan={5} sx={{ textAlign: 'center', color: 'text.secondary', py: 4 }}>No submissions in this window</TableCell></TableRow>)}
              {data?.kycSubmissions?.map((k) => (
                <TableRow key={k.id} hover>
                  <TableCell sx={{ fontSize: '0.8rem' }}>{k.full_name || k.email}<br /><span style={{ color: '#888', fontSize: '0.72rem' }}>{k.email}</span></TableCell>
                  <TableCell><Chip size="small" label={k.status} color={STATUS_COLOR[k.status] || 'default'} sx={{ textTransform: 'capitalize' }} /></TableCell>
                  <TableCell sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>{k.rejection_reason || '—'}</TableCell>
                  <TableCell sx={{ fontSize: '0.8rem' }}>{fmtDate(k.submitted_at)}</TableCell>
                  <TableCell sx={{ fontSize: '0.8rem' }}>{fmtDate(k.reviewed_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Box>
  );
}