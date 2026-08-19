import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  TextField, MenuItem, Alert, Button, Switch, FormControlLabel,
  Dialog, DialogTitle, DialogContent, DialogActions,
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
  useMobile,
} from '../components/MobileResponsive';

const PLAN_OPTIONS  = ['starter', 'growth'];
const CYCLE_OPTIONS = ['monthly', 'annual'];

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const emptyForm = {
  code: '', discountType: 'percent', discountValue: '',
  applicablePlans: ['starter', 'growth'], applicableCycles: ['annual'],
  firstTimeOnly: true, perUserLimit: 1, maxRedemptions: '', validUntil: '',
};

export default function ProductCoupons() {
  const isMobile = useMobile();
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
      <MobilePageHeader>
        <Box>
          <Typography variant={isMobile ? 'h6' : 'h5'}>Coupons</Typography>
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mt: 0.5 }}>
            Discount codes for self-serve Starter/Growth checkout only. Corporate discounts are set per-deal instead.
          </Typography>
        </Box>
        <MobileButton variant="contained" onClick={openCreate}>New coupon</MobileButton>
      </MobilePageHeader>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <MobilePaper variant="outlined">
        <ResponsiveTableContainer>
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
                  <TableCell sx={{ fontWeight: 700, fontFamily: 'monospace', fontSize: isMobile ? '0.75rem' : '0.85rem' }}>{c.code}</TableCell>
                  <TableCell sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem' }}>{c.discountType === 'percent' ? `${c.discountValue}% off` : `₹${c.discountValue} off`}</TableCell>
                  <TableCell sx={{ textTransform: 'capitalize', fontSize: isMobile ? '0.75rem' : '0.85rem' }}>{(c.applicablePlans || []).join(', ')}</TableCell>
                  <TableCell sx={{ textTransform: 'capitalize', fontSize: isMobile ? '0.75rem' : '0.85rem' }}>{(c.applicableCycles || []).join(', ')}</TableCell>
                  <TableCell sx={{ fontSize: isMobile ? '0.7rem' : '0.75rem' }}>
                    {c.firstTimeOnly ? 'First subscription only · ' : ''}{c.perUserLimit}× per account
                    {c.maxRedemptions ? ` · ${c.maxRedemptions} total` : ''}
                  </TableCell>
                  <TableCell align="right" className="figure" sx={{ fontSize: isMobile ? '0.75rem' : '0.85rem' }}>{c.redemptionCount || 0}</TableCell>
                  <TableCell sx={{ fontSize: isMobile ? '0.7rem' : '0.75rem' }}>{c.validUntil ? fmtDate(c.validUntil) : 'No expiry'}</TableCell>
                  <TableCell align="right">
                    <Switch size="small" checked={!!c.active} onChange={() => toggleActive(c)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ResponsiveTableContainer>
      </MobilePaper>

      <MobileDialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>New coupon</DialogTitle>
        <DialogContent>
          <MobileFormGrid sx={{ mt: 0.5 }}>
            <MobileTextField fullWidth label="Code" placeholder="e.g. EARLYBIRD50"
              value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
            <MobileStack gap={1} direction="row" flexWrap="wrap">
              <MobileTextField
                fullWidth
                select
                label="Type"
                value={form.discountType}
                onChange={(e) => setForm({ ...form, discountType: e.target.value })}
                options={[
                  { value: 'percent', label: '% off' },
                  { value: 'flat', label: '₹ flat off' },
                ]}
              />
              <MobileTextField
                fullWidth
                type="number"
                label={form.discountType === 'percent' ? 'Percent' : 'Amount (₹)'}
                value={form.discountValue}
                onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
              />
            </MobileStack>
            <MobileTextField
              fullWidth
              select
              label="Applicable plans"
              value={form.applicablePlans}
              onChange={(e) => setForm({ ...form, applicablePlans: e.target.value })}
              options={PLAN_OPTIONS.map((p) => ({ value: p, label: p }))}
            />
            <MobileTextField
              fullWidth
              select
              label="Applicable cycles"
              value={form.applicableCycles}
              onChange={(e) => setForm({ ...form, applicableCycles: e.target.value })}
              options={CYCLE_OPTIONS.map((c) => ({ value: c, label: c }))}
            />
            <FormControlLabel sx={{ mt: 1 }}
              control={<Switch checked={form.firstTimeOnly} onChange={(e) => setForm({ ...form, firstTimeOnly: e.target.checked })} />}
              label="First subscription only (new customers)"
            />
            <MobileStack gap={1} direction="row" flexWrap="wrap">
              <MobileTextField fullWidth type="number" label="Per-account limit" value={form.perUserLimit} onChange={(e) => setForm({ ...form, perUserLimit: e.target.value })} />
              <MobileTextField fullWidth type="number" label="Total uses (blank = unlimited)" value={form.maxRedemptions} onChange={(e) => setForm({ ...form, maxRedemptions: e.target.value })} />
            </MobileStack>
            <MobileTextField fullWidth type="date" label="Expires (blank = no expiry)" InputLabelProps={{ shrink: true }} value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} />
          </MobileFormGrid>
          {formError && <Alert severity="error" sx={{ mt: 1 }}>{formError}</Alert>}
        </DialogContent>
        <MobileActionButtons>
          <MobileButton onClick={() => setCreateOpen(false)}>Cancel</MobileButton>
          <MobileButton variant="contained" onClick={handleCreate} disabled={saving}>{saving ? 'Creating…' : 'Create coupon'}</MobileButton>
        </MobileActionButtons>
      </MobileDialog>
    </Box>
  );
}