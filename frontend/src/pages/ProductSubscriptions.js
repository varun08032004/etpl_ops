import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  TextField, MenuItem, Chip, Alert, Dialog, DialogTitle, DialogContent, DialogActions, Button,
} from '@mui/material';
import client from '../api/client';
import {
  MobilePaper,
  MobilePageHeader,
  MobileButton,
  MobileTextField,
  MobileDialog,
  MobileFormGrid,
  MobileActionButtons,
  MobileStack,
  ResponsiveTableContainer,
  MobileCardGrid,
  useMobile,
} from '../components/MobileResponsive';

const PLAN_LABEL = { starter: 'Starter', growth: 'Growth', corporate: 'Corporate' };
const PLAN_COLOR = { starter: 'default', growth: 'info', corporate: 'warning' };

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const daysUntil = (d) => d ? Math.ceil((new Date(d) - Date.now()) / 86400000) : null;

export default function ProductSubscriptions() {
  const isMobile = useMobile();
  const [subs, setSubs] = useState([]);
  const [counts, setCounts] = useState({ total: 0, corporate: 0, renewingWithin30Days: 0 });
  const [planFilter, setPlanFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [renewTarget, setRenewTarget] = useState(null);
  const [renewalDate, setRenewalDate] = useState('');
  const [seats, setSeats] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [renewError, setRenewError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    const params = {};
    if (planFilter) params.plan = planFilter;
    if (search) params.search = search;
    client.get('/product/subscriptions', { params })
      .then(({ data }) => { setSubs(data.subscriptions); setCounts(data.counts); })
      .catch((err) => setError(err.response?.data?.error || 'Failed to load subscriptions'))
      .finally(() => setLoading(false));
  }, [planFilter, search]);

  useEffect(() => {
    const t = setTimeout(load, search ? 350 : 0);
    return () => clearTimeout(t);
  }, [load]);

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
      <MobilePageHeader>
        <Box>
          <Typography variant={isMobile ? 'h6' : 'h5'}>Subscriptions</Typography>
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mt: 0.5 }}>
            Every paid ethertrack.in account — start date, renewal date, and plan. Corporate accounts (Contact Sales only) can be renewed here.
          </Typography>
        </Box>
      </MobilePageHeader>

      <MobileCardGrid sx={{ mb: 2 }}>
        <MobilePaper>
          <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.72rem', color: 'text.secondary' }}>Total paid subscriptions</Typography>
          <Typography sx={{ fontSize: isMobile ? '1rem' : '1.3rem', fontWeight: 700 }}>{counts.total}</Typography>
        </MobilePaper>
        <MobilePaper>
          <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.72rem', color: 'text.secondary' }}>Corporate accounts</Typography>
          <Typography sx={{ fontSize: isMobile ? '1rem' : '1.3rem', fontWeight: 700 }}>{counts.corporate}</Typography>
        </MobilePaper>
        <MobilePaper sx={{ borderColor: counts.renewingWithin30Days > 0 ? 'warning.main' : undefined, borderWidth: counts.renewingWithin30Days > 0 ? 2 : 1 }}>
          <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.72rem', color: 'text.secondary' }}>Renewing within 30 days</Typography>
          <Typography sx={{ fontSize: isMobile ? '1rem' : '1.3rem', fontWeight: 700, color: counts.renewingWithin30Days > 0 ? 'warning.main' : undefined }}>{counts.renewingWithin30Days}</Typography>
        </MobilePaper>
      </MobileCardGrid>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <MobilePaper sx={{ mb: 2 }}>
        <MobileStack gap={1.5} direction="row" flexWrap="wrap">
          <MobileTextField size="small" label="Search" placeholder="Email, name, company…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <MobileTextField
            select
            size="small"
            label="Plan"
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            options={[
              { value: '', label: 'All plans' },
              { value: 'starter', label: 'Starter' },
              { value: 'growth', label: 'Growth' },
              { value: 'corporate', label: 'Corporate' },
            ]}
          />
        </MobileStack>
      </MobilePaper>

      {loading && <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>Loading…</Typography>}

      {!loading && !rows.length && <MobilePaper sx={{ textAlign: 'center', color: 'text.secondary', py: 4 }}>No subscriptions found</MobilePaper>}

      <MobilePaper>
        <ResponsiveTableContainer>
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
              {rows.map((s) => {
                const dLeft = daysUntil(s.renewsAt);
                const soon = dLeft != null && dLeft <= 30 && dLeft >= 0;
                const overdue = dLeft != null && dLeft < 0;
                return (
                  <TableRow key={s.platformUserId} hover>
                    <TableCell>
                      <Typography sx={{ fontSize: isMobile ? '0.75rem' : '0.82rem', fontWeight: 600 }}>{s.fullName || '—'}</Typography>
                      <Typography sx={{ fontSize: isMobile ? '0.65rem' : '0.72rem', color: 'text.secondary' }}>{s.companyName ? `${s.companyName} · ` : ''}{s.email}</Typography>
                    </TableCell>
                    <TableCell><Chip size="small" label={PLAN_LABEL[s.plan] || s.plan} color={PLAN_COLOR[s.plan] || 'default'} sx={{ textTransform: 'capitalize' }} /></TableCell>
                    <TableCell sx={{ fontSize: isMobile ? '0.75rem' : '0.8rem', textTransform: 'capitalize' }}>{s.cycle || '—'}</TableCell>
                    <TableCell sx={{ fontSize: isMobile ? '0.75rem' : '0.8rem' }} className="figure">{fmtDate(s.startedAt)}</TableCell>
                    <TableCell sx={{ fontSize: isMobile ? '0.75rem' : '0.8rem' }} className="figure">
                      {fmtDate(s.renewsAt)}
                      {overdue && <Chip size="small" label="Overdue" color="error" sx={{ ml: 1, height: 18, fontSize: '0.62rem' }} />}
                      {soon && <Chip size="small" label={`${dLeft}d`} color="warning" sx={{ ml: 1, height: 18, fontSize: '0.62rem' }} />}
                    </TableCell>
                    <TableCell align="right" sx={{ fontSize: isMobile ? '0.75rem' : '0.8rem' }} className="figure">{s.latestPaymentINR != null ? `₹${s.latestPaymentINR.toLocaleString('en-IN')}` : '—'}</TableCell>
                    <TableCell align="right">
                      <MobileStack gap={1} direction="row">
                        {s.plan === 'corporate' && <MobileButton size="small" variant="outlined" onClick={() => openRenew(s)}>Renew</MobileButton>}
                      </MobileStack>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!rows.length && <TableRow><TableCell colSpan={7} sx={{ textAlign: 'center', color: 'text.secondary', py: 4 }}>No subscriptions found</TableCell></TableRow>}
            </TableBody>
          </Table>
        </ResponsiveTableContainer>
      </MobilePaper>

      <MobileDialog open={!!renewTarget} onClose={() => setRenewTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Renew — {renewTarget?.companyName || renewTarget?.fullName}</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mb: 1 }}>
            Current renewal: {fmtDate(renewTarget?.renewsAt)}
          </Typography>
          <MobileFormGrid sx={{ mt: 0.5 }}>
            <MobileTextField fullWidth type="date" label="New renewal date" InputLabelProps={{ shrink: true }} value={renewalDate} onChange={(e) => setRenewalDate(e.target.value)} />
            <MobileTextField fullWidth type="number" label="Seats (blank = no change)" value={seats} onChange={(e) => setSeats(e.target.value)} />
            <MobileTextField fullWidth label="Notes" multiline rows={2} placeholder="e.g. Renewal PO #5678" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </MobileFormGrid>
          {renewError && <Alert severity="error" sx={{ mt: 1 }}>{renewError}</Alert>}
        </DialogContent>
        <MobileActionButtons>
          <MobileButton onClick={() => setRenewTarget(null)}>Cancel</MobileButton>
          <MobileButton variant="contained" onClick={handleRenew} disabled={saving || !renewalDate}>{saving ? 'Saving…' : 'Confirm renewal'}</MobileButton>
        </MobileActionButtons>
      </MobileDialog>
    </Box>
  );
}