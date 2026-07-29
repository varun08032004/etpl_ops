import { useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  TextField, MenuItem, Chip, Alert, Dialog, DialogTitle, DialogContent, DialogActions, Button,
} from '@mui/material';
import client from '../api/client';

const PLAN_LABEL = { starter: 'Starter', growth: 'Growth', corporate: 'Corporate' };
const PLAN_COLOR = { starter: 'default', growth: 'info', corporate: 'warning' };

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const daysUntil = (d) => d ? Math.ceil((new Date(d) - Date.now()) / 86400000) : null;

export default function ProductSubscriptions() {
  const [subs, setSubs] = useState([]);
  const [counts, setCounts] = useState({ total: 0, corporate: 0, renewingWithin30Days: 0 });
  const [planFilter, setPlanFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [renewTarget, setRenewTarget] = useState(null); // the row being renewed
  const [renewalDate, setRenewalDate] = useState('');
  const [seats, setSeats] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [renewError, setRenewError] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    const params = {};
    if (planFilter) params.plan = planFilter;
    if (search) params.search = search;
    client.get('/product/subscriptions', { params })
      .then(({ data }) => { setSubs(data.subscriptions); setCounts(data.counts); })
      .catch((err) => setError(err.response?.data?.error || 'Failed to load subscriptions'))
      .finally(() => setLoading(false));
  };

  // Debounced search — avoid firing a request per keystroke.
  useEffect(() => {
    const t = setTimeout(load, search ? 350 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planFilter, search]);

  const openRenew = (row) => {
    setRenewTarget(row);
    setRenewalDate(row.renewsAt ? row.renewsAt.slice(0, 10) : '');
    setSeats('');
    setNotes('');
    setRenewError('');
  };

  const handleRenew = async () => {
    if (!renewTarget || !renewalDate) return;
    setSaving(true);
    setRenewError('');
    try {
      await client.patch(`/product/subscriptions/${renewTarget.platformUserId}/renew`, {
        renewalDate,
        seats: seats ? parseInt(seats, 10) : null,
        notes: notes || null,
      });
      setRenewTarget(null);
      load();
    } catch (err) {
      setRenewError(err.response?.data?.error || 'Renewal failed');
    } finally {
      setSaving(false);
    }
  };

  const rows = useMemo(() => subs, [subs]);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h5">Subscriptions</Typography>
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mt: 0.5 }}>
            Every paid ethertrack.in account — start date, renewal date, and plan. Corporate accounts (Contact Sales only) can be renewed here.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField size="small" label="Search" placeholder="Email, name, company…" value={search} onChange={(e) => setSearch(e.target.value)} sx={{ minWidth: 220 }} />
          <TextField select size="small" label="Plan" value={planFilter} onChange={(e) => setPlanFilter(e.target.value)} sx={{ minWidth: 150 }}>
            <MenuItem value="">All plans</MenuItem>
            <MenuItem value="starter">Starter</MenuItem>
            <MenuItem value="growth">Growth</MenuItem>
            <MenuItem value="corporate">Corporate</MenuItem>
          </TextField>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Paper variant="outlined" sx={{ px: 2, py: 1 }}>
          <Typography sx={{ fontSize: '1.3rem', fontWeight: 700 }}>{counts.total}</Typography>
          <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>Total paid subscriptions</Typography>
        </Paper>
        <Paper variant="outlined" sx={{ px: 2, py: 1 }}>
          <Typography sx={{ fontSize: '1.3rem', fontWeight: 700 }}>{counts.corporate}</Typography>
          <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>Corporate accounts</Typography>
        </Paper>
        <Paper variant="outlined" sx={{ px: 2, py: 1, borderColor: counts.renewingWithin30Days > 0 ? 'warning.main' : undefined }}>
          <Typography sx={{ fontSize: '1.3rem', fontWeight: 700, color: counts.renewingWithin30Days > 0 ? 'warning.main' : undefined }}>{counts.renewingWithin30Days}</Typography>
          <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>Renewing within 30 days</Typography>
        </Paper>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Customer</TableCell>
              <TableCell>Plan</TableCell>
              <TableCell>Cycle</TableCell>
              <TableCell>Started</TableCell>
              <TableCell>Renews</TableCell>
              <TableCell align="right">Latest payment</TableCell>
              <TableCell align="right">Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && (
              <TableRow><TableCell colSpan={7} sx={{ textAlign: 'center', color: 'text.secondary', py: 4 }}>Loading…</TableCell></TableRow>
            )}
            {!loading && !rows.length && (
              <TableRow><TableCell colSpan={7} sx={{ textAlign: 'center', color: 'text.secondary', py: 4 }}>No subscriptions found</TableCell></TableRow>
            )}
            {rows.map((s) => {
              const dLeft = daysUntil(s.renewsAt);
              const soon = dLeft != null && dLeft <= 30 && dLeft >= 0;
              const overdue = dLeft != null && dLeft < 0;
              return (
                <TableRow key={s.platformUserId} hover>
                  <TableCell>
                    <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>{s.fullName || '—'}</Typography>
                    <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>{s.companyName ? `${s.companyName} · ` : ''}{s.email}</Typography>
                  </TableCell>
                  <TableCell><Chip size="small" label={PLAN_LABEL[s.plan] || s.plan} color={PLAN_COLOR[s.plan] || 'default'} sx={{ textTransform: 'capitalize' }} /></TableCell>
                  <TableCell sx={{ fontSize: '0.8rem', textTransform: 'capitalize' }}>{s.cycle || '—'}</TableCell>
                  <TableCell sx={{ fontSize: '0.8rem' }} className="figure">{fmtDate(s.startedAt)}</TableCell>
                  <TableCell sx={{ fontSize: '0.8rem' }} className="figure">
                    {fmtDate(s.renewsAt)}
                    {overdue && <Chip size="small" label="Overdue" color="error" sx={{ ml: 1, height: 18, fontSize: '0.62rem' }} />}
                    {soon && <Chip size="small" label={`${dLeft}d`} color="warning" sx={{ ml: 1, height: 18, fontSize: '0.62rem' }} />}
                  </TableCell>
                  <TableCell align="right" sx={{ fontSize: '0.8rem' }} className="figure">{s.latestPaymentINR != null ? `₹${s.latestPaymentINR.toLocaleString('en-IN')}` : '—'}</TableCell>
                  <TableCell align="right">
                    {s.plan === 'corporate' && (
                      <Button size="small" variant="outlined" onClick={() => openRenew(s)}>Renew</Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={!!renewTarget} onClose={() => setRenewTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Renew — {renewTarget?.companyName || renewTarget?.fullName}</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mb: 1 }}>
            Current renewal: {fmtDate(renewTarget?.renewsAt)}
          </Typography>
          <TextField fullWidth type="date" label="New renewal date" InputLabelProps={{ shrink: true }} margin="normal"
            value={renewalDate} onChange={(e) => setRenewalDate(e.target.value)} />
          <TextField fullWidth type="number" label="Seats (blank = no change)" margin="normal"
            value={seats} onChange={(e) => setSeats(e.target.value)} />
          <TextField fullWidth label="Notes" margin="normal" multiline rows={2}
            placeholder="e.g. Renewal PO #5678" value={notes} onChange={(e) => setNotes(e.target.value)} />
          {renewError && <Alert severity="error" sx={{ mt: 1 }}>{renewError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenewTarget(null)}>Cancel</Button>
          <Button variant="contained" onClick={handleRenew} disabled={saving || !renewalDate}>{saving ? 'Saving…' : 'Confirm renewal'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}