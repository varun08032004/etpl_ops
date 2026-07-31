import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  TextField, MenuItem, Alert, Button, Switch, FormControlLabel,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import client from '../api/client';

const PLAN_OPTIONS  = ['starter', 'growth'];
const CYCLE_OPTIONS = ['monthly', 'annual'];

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const emptyForm = {
  code: '', discountType: 'percent', discountValue: '',
  applicablePlans: ['starter', 'growth'], applicableCycles: ['annual'],
  firstTimeOnly: true, perUserLimit: 1, maxRedemptions: '', validUntil: '',
};

export default function ProductCoupons() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    client.get('/product/coupons')
      .then(({ data }) => setCoupons(data.coupons || []))
      .catch((err) => setError(err.response?.data?.error || 'Failed to load coupons'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openCreate = () => { setForm(emptyForm); setFormError(''); setCreateOpen(true); };

  const handleCreate = async () => {
    if (!form.code.trim() || !form.discountValue) { setFormError('Code and discount value are required'); return; }
    setSaving(true);
    setFormError('');
    try {
      await client.post('/product/coupons', {
        code: form.code.trim().toUpperCase(),
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        applicablePlans: form.applicablePlans,
        applicableCycles: form.applicableCycles,
        firstTimeOnly: form.firstTimeOnly,
        perUserLimit: Number(form.perUserLimit) || 1,
        maxRedemptions: form.maxRedemptions ? Number(form.maxRedemptions) : null,
        validUntil: form.validUntil || null,
      });
      setCreateOpen(false);
      load();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to create coupon');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (coupon) => {
    try {
      await client.patch(`/product/coupons/${coupon.code}`, { active: !coupon.active });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update coupon');
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h5">Coupons</Typography>
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mt: 0.5 }}>
            Discount codes for self-serve Starter/Growth checkout only. Corporate discounts are set per-deal instead.
          </Typography>
        </Box>
        <Button variant="contained" onClick={openCreate}>New coupon</Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Code</TableCell>
              <TableCell>Discount</TableCell>
              <TableCell>Plans</TableCell>
              <TableCell>Cycles</TableCell>
              <TableCell>Limits</TableCell>
              <TableCell align="right">Redeemed</TableCell>
              <TableCell>Expires</TableCell>
              <TableCell align="right">Active</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && (
              <TableRow><TableCell colSpan={8} sx={{ textAlign: 'center', color: 'text.secondary', py: 4 }}>Loading…</TableCell></TableRow>
            )}
            {!loading && !coupons.length && (
              <TableRow><TableCell colSpan={8} sx={{ textAlign: 'center', color: 'text.secondary', py: 4 }}>No coupons yet</TableCell></TableRow>
            )}
            {coupons.map((c) => (
              <TableRow key={c.code} hover>
                <TableCell sx={{ fontWeight: 700, fontFamily: 'monospace' }}>{c.code}</TableCell>
                <TableCell>{c.discount_type === 'percent' ? `${c.discount_value}% off` : `₹${c.discount_value} off`}</TableCell>
                <TableCell sx={{ textTransform: 'capitalize' }}>{(c.applicable_plans || []).join(', ')}</TableCell>
                <TableCell sx={{ textTransform: 'capitalize' }}>{(c.applicable_cycles || []).join(', ')}</TableCell>
                <TableCell sx={{ fontSize: '0.75rem' }}>
                  {c.first_time_only ? 'First subscription only · ' : ''}{c.per_user_limit}× per account
                  {c.max_redemptions ? ` · ${c.max_redemptions} total` : ''}
                </TableCell>
                <TableCell align="right" className="figure">{c.redemption_count || 0}</TableCell>
                <TableCell sx={{ fontSize: '0.75rem' }}>{c.valid_until ? fmtDate(c.valid_until) : 'No expiry'}</TableCell>
                <TableCell align="right">
                  <Switch size="small" checked={!!c.active} onChange={() => toggleActive(c)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>New coupon</DialogTitle>
        <DialogContent>
          <TextField fullWidth margin="normal" label="Code" placeholder="e.g. EARLYBIRD50"
            value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField select margin="normal" label="Type" sx={{ flex: 1 }}
              value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value })}>
              <MenuItem value="percent">% off</MenuItem>
              <MenuItem value="flat">₹ flat off</MenuItem>
            </TextField>
            <TextField margin="normal" type="number" label={form.discountType === 'percent' ? 'Percent' : 'Amount (₹)'} sx={{ flex: 1 }}
              value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: e.target.value })} />
          </Box>
          <TextField select margin="normal" fullWidth label="Applicable plans" SelectProps={{ multiple: true, renderValue: (v) => v.join(', ') }}
            value={form.applicablePlans} onChange={(e) => setForm({ ...form, applicablePlans: e.target.value })}>
            {PLAN_OPTIONS.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
          </TextField>
          <TextField select margin="normal" fullWidth label="Applicable cycles" SelectProps={{ multiple: true, renderValue: (v) => v.join(', ') }}
            value={form.applicableCycles} onChange={(e) => setForm({ ...form, applicableCycles: e.target.value })}>
            {CYCLE_OPTIONS.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </TextField>
          <FormControlLabel sx={{ mt: 1 }}
            control={<Switch checked={form.firstTimeOnly} onChange={(e) => setForm({ ...form, firstTimeOnly: e.target.checked })} />}
            label="First subscription only (new customers)"
          />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField margin="normal" type="number" label="Per-account limit" sx={{ flex: 1 }}
              value={form.perUserLimit} onChange={(e) => setForm({ ...form, perUserLimit: e.target.value })} />
            <TextField margin="normal" type="number" label="Total uses (blank = unlimited)" sx={{ flex: 1 }}
              value={form.maxRedemptions} onChange={(e) => setForm({ ...form, maxRedemptions: e.target.value })} />
          </Box>
          <TextField fullWidth margin="normal" type="date" label="Expires (blank = no expiry)" InputLabelProps={{ shrink: true }}
            value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} />
          {formError && <Alert severity="error" sx={{ mt: 1 }}>{formError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={saving}>{saving ? 'Creating…' : 'Create coupon'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}