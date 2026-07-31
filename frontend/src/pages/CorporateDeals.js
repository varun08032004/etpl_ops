import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  TextField, MenuItem, Chip, Alert, Button, Autocomplete, Collapse, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import client from '../api/client';

const fmtDate  = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtMoney = (paise) => `₹${(paise / 100).toLocaleString('en-IN')}`;

const STATUS_COLOR = { draft: 'default', sent: 'info', partially_paid: 'warning', paid: 'success', overdue: 'error', void: 'default' };

const emptyForm = {
  party: null, platformCustomer: null,
  termMonths: '12', billingFrequency: 'one_time',
  seats: '', totalValueINR: '', discountPercent: '0', notes: '',
};

function DealRow({ deal, onReload }) {
  const [open, setOpen] = useState(false);
  const paidCount = deal.installments.filter((i) => i.invoice_status === 'paid').length;
  const total = deal.installments.length;

  return (
    <>
      <TableRow hover>
        <TableCell>
          <IconButton size="small" onClick={() => setOpen((o) => !o)}>
            {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          </IconButton>
        </TableCell>
        <TableCell>
          <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>{deal.party_name}</Typography>
          <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>{deal.platform_email}</Typography>
        </TableCell>
        <TableCell sx={{ fontSize: '0.8rem' }}>{deal.term_months} mo</TableCell>
        <TableCell sx={{ fontSize: '0.8rem', textTransform: 'capitalize' }}>{deal.billing_frequency.replace('_', ' ')}</TableCell>
        <TableCell className="figure">{fmtMoney(deal.net_value_paise)}{deal.discount_percent > 0 && ` (${deal.discount_percent}% off)`}</TableCell>
        <TableCell>
          <Chip size="small" label={`${paidCount}/${total} paid`} color={paidCount === total ? 'success' : paidCount > 0 ? 'warning' : 'default'} />
        </TableCell>
        <TableCell sx={{ fontSize: '0.8rem' }}>{fmtDate(deal.started_at)}</TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={7} sx={{ py: 0, borderBottom: open ? undefined : 'none' }}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ my: 1.5, ml: 4 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Period</TableCell>
                    <TableCell>Invoice #</TableCell>
                    <TableCell>Due</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell align="right">Paid</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {deal.installments.map((i) => (
                    <TableRow key={i.period_number}>
                      <TableCell sx={{ fontSize: '0.78rem' }}>#{i.period_number} ({fmtDate(i.period_start)} – {fmtDate(i.period_end)})</TableCell>
                      <TableCell sx={{ fontSize: '0.78rem', fontFamily: 'monospace' }}>{i.invoice_number}</TableCell>
                      <TableCell sx={{ fontSize: '0.78rem' }}>{fmtDate(i.due_date)}</TableCell>
                      <TableCell align="right" className="figure">₹{Number(i.total_amount).toLocaleString('en-IN')}</TableCell>
                      <TableCell align="right" className="figure">₹{Number(i.amount_paid).toLocaleString('en-IN')}</TableCell>
                      <TableCell>
                        <Chip size="small" label={i.invoice_status.replace('_', ' ')} color={STATUS_COLOR[i.invoice_status] || 'default'} sx={{ textTransform: 'capitalize' }} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mt: 1 }}>
                To record a payment, open the matching invoice in Accounting → Invoices — status here updates automatically.
              </Typography>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

export default function CorporateDeals() {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [parties, setParties] = useState([]);
  const [customerOptions, setCustomerOptions] = useState([]);
  const [customerSearch, setCustomerSearch] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [formWarning, setFormWarning] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    client.get('/product/corporate-deals')
      .then(({ data }) => setDeals(data.deals || []))
      .catch((err) => setError(err.response?.data?.error || 'Failed to load corporate deals'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  useEffect(() => {
    if (!createOpen) return;
    client.get('/parties', { params: { party_type: 'customer' } })
      .then(({ data }) => setParties(data.parties || []))
      .catch(() => {});
  }, [createOpen]);

  useEffect(() => {
    if (!createOpen) return;
    const t = setTimeout(() => {
      client.get('/product/corporate-deals/lookup/platform-customers', { params: { search: customerSearch } })
        .then(({ data }) => setCustomerOptions(data.customers || []))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [createOpen, customerSearch]);

  const openCreate = () => { setForm(emptyForm); setFormError(''); setFormWarning(''); setCreateOpen(true); };

  const numPeriodsPreview = (() => {
    const term = parseInt(form.termMonths) || 0;
    if (form.billingFrequency === 'one_time') return term > 0 ? 1 : 0;
    if (form.billingFrequency === 'monthly') return term;
    return Math.ceil(term / 12); // annual
  })();

  const handleCreate = async () => {
    if (!form.party || !form.platformCustomer || !form.termMonths || !form.totalValueINR) {
      setFormError('Party, platform account, term length, and total value are required');
      return;
    }
    setSaving(true);
    setFormError('');
    setFormWarning('');
    try {
      const { data } = await client.post('/product/corporate-deals', {
        partyId: form.party.id,
        platformUserId: form.platformCustomer.id,
        platformEmail: form.platformCustomer.email,
        termMonths: parseInt(form.termMonths),
        billingFrequency: form.billingFrequency,
        seats: form.seats || null,
        totalValueINR: Number(form.totalValueINR),
        discountPercent: Number(form.discountPercent) || 0,
        notes: form.notes,
      });
      if (data.warning) {
        setFormWarning(data.warning);
      } else {
        setCreateOpen(false);
      }
      load();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to create deal');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h5">Corporate Deals</Typography>
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mt: 0.5 }}>
            Set up a Corporate subscription term — pay once, or split into monthly/annual installments.
            Each period generates a real GST invoice; payment status is read from Accounting.
          </Typography>
        </Box>
        <Button variant="contained" onClick={openCreate}>New corporate deal</Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell />
              <TableCell>Customer</TableCell>
              <TableCell>Term</TableCell>
              <TableCell>Billing</TableCell>
              <TableCell>Value</TableCell>
              <TableCell>Payment status</TableCell>
              <TableCell>Started</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && (
              <TableRow><TableCell colSpan={7} sx={{ textAlign: 'center', color: 'text.secondary', py: 4 }}>Loading…</TableCell></TableRow>
            )}
            {!loading && !deals.length && (
              <TableRow><TableCell colSpan={7} sx={{ textAlign: 'center', color: 'text.secondary', py: 4 }}>No corporate deals yet</TableCell></TableRow>
            )}
            {deals.map((d) => <DealRow key={d.id} deal={d} onReload={load} />)}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={createOpen} onClose={() => !saving && setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New corporate deal</DialogTitle>
        <DialogContent>
          <Autocomplete
            options={parties}
            getOptionLabel={(p) => p.name || ''}
            value={form.party}
            onChange={(e, val) => setForm({ ...form, party: val })}
            renderInput={(params) => <TextField {...params} fullWidth margin="normal" label="Company (CRM party)" helperText="Must already exist in Parties — created automatically when Sales marks the deal won" />}
          />
          <Autocomplete
            options={customerOptions}
            getOptionLabel={(c) => c.company_name || c.full_name ? `${c.company_name || c.full_name} — ${c.email}` : c.email}
            value={form.platformCustomer}
            onInputChange={(e, val) => setCustomerSearch(val)}
            onChange={(e, val) => setForm({ ...form, platformCustomer: val })}
            renderInput={(params) => <TextField {...params} fullWidth margin="normal" label="Platform account" helperText="The ethertrack.in account this deal activates" />}
          />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField margin="normal" type="number" label="Term (months)" sx={{ flex: 1 }}
              value={form.termMonths} onChange={(e) => setForm({ ...form, termMonths: e.target.value })} />
            <TextField select margin="normal" label="Billing frequency" sx={{ flex: 1 }}
              value={form.billingFrequency} onChange={(e) => setForm({ ...form, billingFrequency: e.target.value })}>
              <MenuItem value="one_time">One-time (single invoice)</MenuItem>
              <MenuItem value="monthly">Monthly installments</MenuItem>
              <MenuItem value="annual">Annual installments</MenuItem>
            </TextField>
          </Box>
          <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mb: 1 }}>
            {numPeriodsPreview > 0 && `Will generate ${numPeriodsPreview} invoice${numPeriodsPreview !== 1 ? 's' : ''}${form.totalValueINR ? `, ₹${(Number(form.totalValueINR) * (1 - (Number(form.discountPercent) || 0) / 100) / numPeriodsPreview).toLocaleString('en-IN', { maximumFractionDigits: 0 })} each` : ''}.`}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField margin="normal" type="number" label="Total value for the term (₹, before discount)" sx={{ flex: 1 }}
              value={form.totalValueINR} onChange={(e) => setForm({ ...form, totalValueINR: e.target.value })} />
            <TextField margin="normal" type="number" label="Discount %" sx={{ flex: 1 }}
              value={form.discountPercent} onChange={(e) => setForm({ ...form, discountPercent: e.target.value })} />
          </Box>
          <TextField margin="normal" type="number" fullWidth label="Seats (blank = unlimited)"
            value={form.seats} onChange={(e) => setForm({ ...form, seats: e.target.value })} />
          <TextField margin="normal" fullWidth multiline rows={2} label="Notes (deal terms, PO number, etc.)"
            value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          {formError && <Alert severity="error" sx={{ mt: 1 }}>{formError}</Alert>}
          {formWarning && <Alert severity="warning" sx={{ mt: 1 }}>{formWarning}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)} disabled={saving}>{formWarning ? 'Close' : 'Cancel'}</Button>
          {!formWarning && <Button variant="contained" onClick={handleCreate} disabled={saving}>{saving ? 'Creating…' : 'Create deal'}</Button>}
        </DialogActions>
      </Dialog>
    </Box>
  );
}